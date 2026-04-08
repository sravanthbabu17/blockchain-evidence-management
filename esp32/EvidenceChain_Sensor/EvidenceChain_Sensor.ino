/**
 * ============================================================
 *  EvidenceChain — ESP32 Forensic Sensor Node
 * ============================================================
 *  Sensors  : MPU6050 (Accelerometer/Gyro) + NEO-6M (GPS)
 *  Target   : ESP32 (30-pin or 38-pin Dev Board)
 *  Backend  : POST /api/accident/report
 *
 *  WIRING:
 *  -------
 *  MPU6050:
 *    VCC  → 3.3V
 *    GND  → GND
 *    SDA  → GPIO 21
 *    SCL  → GPIO 22
 *    AD0  → GND  (I2C address = 0x68)
 *
 *  NEO-6M GPS:
 *    VCC  → 3.3V (or 5V via VIN if module needs it)
 *    GND  → GND
 *    TX   → GPIO 16  (ESP32 RX2)
 *    RX   → GPIO 17  (ESP32 TX2)
 *
 *  LIBRARIES (install via Arduino Library Manager):
 *    - Adafruit MPU6050   (by Adafruit)
 *    - Adafruit Unified Sensor (by Adafruit) — dependency
 *    - TinyGPSPlus        (by Mikal Hart)
 *    - ArduinoJson        (by Benoit Blanchon) v6.x
 * ============================================================
 */

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h>

// ─────────────────────────────────────────
//  USER CONFIG — edit these before flashing
// ─────────────────────────────────────────
const char* WIFI_SSID       = "YourWiFi_SSID";
const char* WIFI_PASSWORD   = "YourWiFi_Password";

// Your PC's local IP running the backend (node server.js)
// Find it with: ipconfig (look for IPv4 Address)
const char* SERVER_URL      = "http://192.168.1.100:5000/api/accident/report";
const char* API_KEY         = "device123";

// Vehicle identity (must match what's configured in Firestore)
const char* VEHICLE_ID      = "AP09XX1234";

// Collision detection threshold in m/s² (9.8 = 1G)
// Raise this if you're getting false triggers while driving normally.
// Lower it if genuine impacts aren't detected.
const float IMPACT_THRESHOLD = 15.0;  // ~1.5G

// Cooldown: don't send another report for this many ms after one is sent
const unsigned long COOLDOWN_MS = 30000;  // 30 seconds

// GPS: how long to wait for a valid GPS fix before using fallback coords
const unsigned long GPS_TIMEOUT_MS = 5000;  // 5 seconds per loop cycle

// GPS serial port
#define GPS_SERIAL_PORT  2      // Uses Serial2
#define GPS_RX_PIN       16
#define GPS_TX_PIN       17
#define GPS_BAUD         9600

// ─────────────────────────────────────────
//  GLOBAL OBJECTS
// ─────────────────────────────────────────
Adafruit_MPU6050 mpu;
TinyGPSPlus      gps;
HardwareSerial   gpsSerial(GPS_SERIAL_PORT);

bool mpuAvailable  = false;
bool wifiConnected = false;

unsigned long lastReportTime = 0;

// Last known GPS coordinates (used as fallback when fix isn't available)
double lastLat = 0.0;
double lastLon = 0.0;
bool   hasEverHadFix = false;

// ─────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n========================================");
  Serial.println(" EvidenceChain Forensic Sensor Node");
  Serial.println("========================================");

  initWiFi();
  initMPU6050();
  initGPS();

  Serial.println("\n✅ System ready. Monitoring for collisions...");
  Serial.println("----------------------------------------");
}

// ─────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────
void loop() {
  // Feed GPS data continuously (non-blocking)
  feedGPS();

  // Skip if MPU6050 failed to initialize
  if (!mpuAvailable) {
    Serial.println("⚠️  MPU6050 not available. Retrying init...");
    initMPU6050();
    delay(3000);
    return;
  }

  // Read accelerometer
  sensors_event_t accel, gyro, temp;
  if (!mpu.getEvent(&accel, &gyro, &temp)) {
    Serial.println("⚠️  Failed to read MPU6050 event.");
    delay(500);
    return;
  }

  float ax = accel.acceleration.x;
  float ay = accel.acceleration.y;
  float az = accel.acceleration.z;

  // Compute total acceleration magnitude
  float magnitude = sqrt(ax * ax + ay * ay + az * az);

  // Print sensor readings every loop
  Serial.printf("[Sensor] ax=%.2f  ay=%.2f  az=%.2f  |Mag|=%.2f m/s²\n",
                ax, ay, az, magnitude);

  // ── Collision Detection ──
  unsigned long now = millis();
  bool inCooldown   = (now - lastReportTime) < COOLDOWN_MS;

  if (magnitude > IMPACT_THRESHOLD && !inCooldown) {
    Serial.println("\n💥 COLLISION DETECTED!");
    Serial.printf("   Magnitude: %.2f m/s²  (Threshold: %.2f)\n",
                  magnitude, IMPACT_THRESHOLD);

    // Get best available GPS coordinates
    double reportLat, reportLon;
    bool   hasFix = getGPSCoords(reportLat, reportLon);

    if (hasFix) {
      Serial.printf("   GPS Fix: %.6f, %.6f\n", reportLat, reportLon);
    } else {
      Serial.println("   GPS: No fix — using last known / fallback coords.");
    }

    // Attempt to send the report
    if (wifiConnected || reconnectWiFi()) {
      bool sent = sendReport(ax, ay, az, magnitude, reportLat, reportLon, hasFix);
      if (sent) {
        lastReportTime = now;
        Serial.printf("   ⏳ Cooldown active for %lu seconds.\n", COOLDOWN_MS / 1000);
      }
    } else {
      Serial.println("   ❌ No WiFi — report NOT sent.");
    }

    Serial.println("----------------------------------------");
  }

  delay(200);  // Sample every 200ms (5Hz)
}

// ─────────────────────────────────────────
//  INIT: WiFi
// ─────────────────────────────────────────
void initWiFi() {
  Serial.printf("\n📡 Connecting to WiFi: %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\n✅ WiFi connected!");
    Serial.printf("   IP Address: %s\n", WiFi.localIP().toString().c_str());
  } else {
    wifiConnected = false;
    Serial.println("\n⚠️  WiFi failed. Will retry on collision.");
  }
}

bool reconnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    return true;
  }
  Serial.print("🔄 Reconnecting WiFi...");
  WiFi.reconnect();
  for (int i = 0; i < 10; i++) {
    if (WiFi.status() == WL_CONNECTED) {
      wifiConnected = true;
      Serial.println(" connected!");
      return true;
    }
    delay(500);
    Serial.print(".");
  }
  wifiConnected = false;
  Serial.println(" failed.");
  return false;
}

// ─────────────────────────────────────────
//  INIT: MPU6050
// ─────────────────────────────────────────
void initMPU6050() {
  Serial.print("\n🔧 Initializing MPU6050...");
  Wire.begin(21, 22);  // SDA=21, SCL=22

  if (!mpu.begin()) {
    Serial.println(" ❌ NOT FOUND! Check wiring (SDA→21, SCL→22, AD0→GND).");
    mpuAvailable = false;
    return;
  }

  // Configure range: ±8G gives good sensitivity for crash detection
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  mpuAvailable = true;
  Serial.println(" ✅ OK (Range: ±8G, Filter: 21Hz)");
}

// ─────────────────────────────────────────
//  INIT: NEO-6M GPS
// ─────────────────────────────────────────
void initGPS() {
  Serial.print("\n🛰️  Initializing NEO-6M GPS...");
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  delay(100);
  Serial.println(" ✅ Serial2 open (RX=16, TX=17)");
  Serial.println("   ℹ️  GPS fix may take 30–120 seconds outdoors.");
  Serial.println("   ℹ️  Indoors / near walls: fix may not be available.");
}

// ─────────────────────────────────────────
//  GPS: Feed parser (call every loop)
// ─────────────────────────────────────────
void feedGPS() {
  unsigned long start = millis();
  while (gpsSerial.available() > 0 && millis() - start < 10) {
    gps.encode(gpsSerial.read());
  }

  // Update last known coords if we have a fresh valid fix
  if (gps.location.isUpdated() && gps.location.isValid()) {
    lastLat = gps.location.lat();
    lastLon = gps.location.lng();
    hasEverHadFix = true;
  }
}

// ─────────────────────────────────────────
//  GPS: Get best available coordinates
//  Returns true if we have a CURRENT valid fix,
//  false if using last known or fallback (0,0).
// ─────────────────────────────────────────
bool getGPSCoords(double &lat, double &lon) {
  // Check if current fix is valid and recent
  if (gps.location.isValid() && gps.location.age() < GPS_TIMEOUT_MS) {
    lat = gps.location.lat();
    lon = gps.location.lng();
    return true;
  }

  // Use last known position if we've ever had a fix
  if (hasEverHadFix) {
    lat = lastLat;
    lon = lastLon;
    return false;  // Not current, but better than nothing
  }

  // Absolute fallback — no GPS data ever received
  lat = 0.0;
  lon = 0.0;
  return false;
}

// ─────────────────────────────────────────
//  HTTP: Send accident report to backend
// ─────────────────────────────────────────
bool sendReport(float ax, float ay, float az, float magnitude,
                double lat, double lon, bool hasFix) {

  Serial.println("   📤 Sending report to backend...");

  // Build JSON payload using ArduinoJson
  StaticJsonDocument<512> doc;
  doc["vehicle_id"] = VEHICLE_ID;
  doc["impact"]     = true;
  doc["type"]       = "ESP32_COLLISION";

  // Sensor telemetry
  JsonObject accelObj = doc.createNestedObject("accel");
  accelObj["x"]     = round(ax * 100) / 100.0;
  accelObj["y"]     = round(ay * 100) / 100.0;
  accelObj["z"]     = round(az * 100) / 100.0;
  accelObj["mag"]   = round(magnitude * 100) / 100.0;

  // GPS data (with fix quality flag)
  JsonObject gpsObj = doc.createNestedObject("gps");
  gpsObj["lat"]     = lat;
  gpsObj["lon"]     = lon;
  gpsObj["fix"]     = hasFix;

  // Additional metadata
  if (gps.date.isValid() && gps.time.isValid()) {
    char ts[25];
    snprintf(ts, sizeof(ts), "%04d-%02d-%02dT%02d:%02d:%02dZ",
             gps.date.year(), gps.date.month(), gps.date.day(),
             gps.time.hour(), gps.time.minute(), gps.time.second());
    doc["timestamp"] = ts;
  }

  doc["satellites"] = gps.satellites.isValid() ? (int)gps.satellites.value() : 0;
  doc["source"]     = "ESP32-MPU6050";

  String payload;
  serializeJson(doc, payload);

  Serial.println("   Payload: " + payload);

  // HTTP POST
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  http.setTimeout(8000);  // 8 second timeout

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("   ✅ Server responded: %d\n", httpCode);
    Serial.println("   Response: " + response);
    http.end();
    return true;
  } else {
    Serial.printf("   ❌ HTTP Error: %s\n", http.errorToString(httpCode).c_str());
    Serial.println("   Check: Is backend running? Is SERVER_URL correct?");
    http.end();
    return false;
  }
}
