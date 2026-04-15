/**
 * ============================================================
 *  EvidenceChain — ESP32 Forensic Sensor Node  v2.0
 * ============================================================
 *  Sensors  : MPU6050 (Accelerometer/Gyro) + NEO-6M (GPS)
 *  Target   : ESP32 (30-pin or 38-pin Dev Board)
 *  Backend  : POST /api/accident/report
 *
 *  WIRING:
 *  -------
 *  MPU6050 (I2C):
 *    VCC  → 3.3V       GND  → GND
 *    SDA  → GPIO 21    SCL  → GPIO 22
 *    AD0  → GND        (I2C address = 0x68)
 *
 *  NEO-6M GPS (UART):
 *    VCC  → 3.3V (or 5V via VIN)   GND → GND
 *    TX   → GPIO 16 (ESP32 RX2)    RX  → GPIO 17 (ESP32 TX2)
 *
 *  LIBRARIES (install via Arduino Library Manager):
 *    - Adafruit MPU6050          (by Adafruit)
 *    - Adafruit Unified Sensor   (by Adafruit) — dependency
 *    - TinyGPSPlus               (by Mikal Hart)
 *    - ArduinoJson               (by Benoit Blanchon) v6.x
 *
 *  HOW TO CONFIGURE:
 *  -----------------
 *  Create a file called "credentials.h" in the same folder as this .ino
 *  and fill in your values following the template below.
 *  This file is listed in .gitignore so credentials are NEVER committed.
 *
 *      // credentials.h
 *      #define WIFI_SSID       "YourNetworkName"
 *      #define WIFI_PASSWORD   "YourPassword"
 *      #define SERVER_URL      "http://192.168.x.x:5000/api/accident/report"
 *      #define API_KEY         "YourSecureApiKey"
 *      #define VEHICLE_ID      "YourVehicleReg"
 *
 *  COLLISION DETECTION ALGORITHM:
 *  --------------------------------
 *  Uses a dual-window STA/LTA (Short-Term Average / Long-Term Average)
 *  detector on the acceleration magnitude signal, supplemented by a
 *  jerk (rate-of-change of acceleration) threshold.
 *  This approach significantly reduces false positives from road vibration
 *  compared to a naive single fixed-threshold method.
 *
 *  References:
 *    Allen, R.V. (1978). "Automatic earthquake recognition and timing from
 *    single traces." Bulletin of the Seismological Society of America.
 *    (STA/LTA originally developed for seismic detection; adopted here for
 *    vehicular impact detection as in related IoV literature.)
 *
 *  PERFORMANCE PARAMETERS (reported in paper):
 *    Sample rate   : 5 Hz  (200 ms loop)
 *    STA window    : 5 samples  (1.0 s)
 *    LTA window    : 25 samples (5.0 s)
 *    STA/LTA ratio : ≥ 3.0 triggers alert
 *    Jerk threshold: 8.0 m/s³
 *    Cooldown      : 30 s
 * ============================================================
 */

// ── Credentials (never hardcode — use credentials.h) ─────────────────────────
#include "credentials.h"

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h>
#include <math.h>

// ─────────────────────────────────────────────────────────────
//  TUNABLE PARAMETERS  (do not touch unless re-calibrating)
// ─────────────────────────────────────────────────────────────

// STA/LTA windows (number of 200 ms samples)
static const uint8_t  STA_WINDOW   = 5;    // 1.0 s short-term
static const uint8_t  LTA_WINDOW   = 25;   // 5.0 s long-term

// Trigger thresholds
static const float    STA_LTA_RATIO_THRESHOLD = 3.0f;  // dimensionless
static const float    JERK_THRESHOLD          = 8.0f;  // m/s³

// Cooldown after a reported collision
static const unsigned long COOLDOWN_MS = 30000UL;   // 30 s

// GPS: max age of a fix before we consider it stale
static const unsigned long GPS_MAX_AGE_MS = 5000UL;  // 5 s

// GPS serial port
#define GPS_SERIAL_PORT  2
#define GPS_RX_PIN       16
#define GPS_TX_PIN       17
#define GPS_BAUD         9600

// ─────────────────────────────────────────────────────────────
//  GLOBAL OBJECTS
// ─────────────────────────────────────────────────────────────
Adafruit_MPU6050  mpu;
TinyGPSPlus       gps;
HardwareSerial    gpsSerial(GPS_SERIAL_PORT);

bool mpuAvailable  = false;
bool wifiConnected = false;

unsigned long lastReportTime = 0;

// ── GPS state ─────────────────────────────────────────────────
double lastLat = 0.0, lastLon = 0.0;
bool   hasEverHadFix = false;

// ── STA/LTA ring buffer ───────────────────────────────────────
float  ltaBuffer[LTA_WINDOW];
uint8_t ltaHead = 0;
bool   ltaFull  = false;

float  staBuffer[STA_WINDOW];
uint8_t staHead = 0;
bool   staFull  = false;

// ── Jerk calculation (previous magnitude) ────────────────────
float prevMagnitude = 0.0f;
unsigned long prevSampleTime = 0;

// ── Performance counters (reported to backend) ────────────────
uint32_t sampleCount     = 0;
uint32_t falsePositives  = 0;   // incremented when STA/LTA > thresh but jerk < thresh

// ─────────────────────────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n========================================");
    Serial.println(" EvidenceChain Forensic Sensor Node v2.0");
    Serial.println("========================================");
    Serial.printf("  STA window  : %d samples (%.1f s)\n", STA_WINDOW,  STA_WINDOW  * 0.2f);
    Serial.printf("  LTA window  : %d samples (%.1f s)\n", LTA_WINDOW,  LTA_WINDOW  * 0.2f);
    Serial.printf("  STA/LTA ≥   : %.1f  |  Jerk ≥ %.1f m/s³\n", STA_LTA_RATIO_THRESHOLD, JERK_THRESHOLD);
    Serial.println("----------------------------------------");

    initWiFi();
    initMPU6050();
    initGPS();

    // Initialise ring buffers to steady-state (gravity + ~0 noise)
    for (uint8_t i = 0; i < LTA_WINDOW; i++) ltaBuffer[i] = 9.8f;
    for (uint8_t i = 0; i < STA_WINDOW;  i++) staBuffer[i] = 9.8f;
    ltaFull = staFull = true;

    prevMagnitude  = 9.8f;
    prevSampleTime = millis();

    Serial.println("\n✅ System ready. Monitoring for collisions (STA/LTA)...");
    Serial.println("----------------------------------------");
}

// ─────────────────────────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────────────────────────
void loop() {
    feedGPS();

    if (!mpuAvailable) {
        Serial.println("⚠️  MPU6050 unavailable. Retrying init...");
        initMPU6050();
        delay(3000);
        return;
    }

    // ── Read accelerometer ────────────────────────────────────
    sensors_event_t accel, gyro, temp;
    if (!mpu.getEvent(&accel, &gyro, &temp)) {
        Serial.println("⚠️  MPU6050 read failed.");
        delay(500);
        return;
    }

    float ax = accel.acceleration.x;
    float ay = accel.acceleration.y;
    float az = accel.acceleration.z;
    float magnitude = sqrtf(ax*ax + ay*ay + az*az);

    unsigned long now = millis();
    sampleCount++;

    // ── Jerk (m/s³ ≈ Δmagnitude / Δt) ───────────────────────
    float dt   = max((float)(now - prevSampleTime) / 1000.0f, 0.001f);
    float jerk = fabsf(magnitude - prevMagnitude) / dt;
    prevMagnitude  = magnitude;
    prevSampleTime = now;

    // ── Update STA / LTA ring buffers ─────────────────────────
    ltaBuffer[ltaHead] = magnitude;
    ltaHead = (ltaHead + 1) % LTA_WINDOW;
    if (ltaHead == 0) ltaFull = true;

    staBuffer[staHead] = magnitude;
    staHead = (staHead + 1) % STA_WINDOW;
    if (staHead == 0) staFull = true;

    // ── Compute STA and LTA means ─────────────────────────────
    float ltaSum = 0, staSum = 0;
    uint8_t ltaCount = ltaFull ? LTA_WINDOW : ltaHead;
    uint8_t staCount = staFull ? STA_WINDOW  : staHead;

    for (uint8_t i = 0; i < ltaCount; i++) ltaSum += ltaBuffer[i];
    for (uint8_t i = 0; i < staCount; i++) staSum += staBuffer[i];

    float lta       = (ltaCount > 0) ? ltaSum / ltaCount : 9.8f;
    float sta       = (staCount > 0) ? staSum / staCount : 9.8f;
    float staltaRatio = (lta > 0.1f) ? sta / lta : 1.0f;

    // ── Print live readings ───────────────────────────────────
    Serial.printf("[#%lu] |a|=%.2f  STA=%.2f  LTA=%.2f  R=%.2f  J=%.2f m/s³\n",
                  (unsigned long)sampleCount, magnitude, sta, lta, staltaRatio, jerk);

    // ── Dual-condition collision detector ─────────────────────
    bool stalttaTrigger = (staltaRatio >= STA_LTA_RATIO_THRESHOLD);
    bool jerkTrigger    = (jerk >= JERK_THRESHOLD);
    bool inCooldown     = ((now - lastReportTime) < COOLDOWN_MS);

    if (stalttaTrigger && !inCooldown) {
        if (!jerkTrigger) {
            // STA/LTA triggered but jerk too low → probable road bump / vibration
            falsePositives++;
            Serial.printf("   ⚠️  STA/LTA spike (R=%.2f) — jerk %.2f < %.2f → suppressed (FP #%lu)\n",
                          staltaRatio, jerk, JERK_THRESHOLD, (unsigned long)falsePositives);
        } else {
            // Both conditions met → confirmed collision
            Serial.println("\n💥 COLLISION CONFIRMED (STA/LTA + Jerk)!");
            Serial.printf("   STA/LTA Ratio : %.2f  (threshold: %.1f)\n",
                          staltaRatio, STA_LTA_RATIO_THRESHOLD);
            Serial.printf("   Jerk          : %.2f m/s³  (threshold: %.1f)\n",
                          jerk, JERK_THRESHOLD);
            Serial.printf("   |Acceleration| : %.2f m/s²\n", magnitude);

            double reportLat, reportLon;
            bool hasFix = getGPSCoords(reportLat, reportLon);

            if (hasFix) {
                Serial.printf("   GPS Fix: %.6f, %.6f\n", reportLat, reportLon);
            } else {
                Serial.println("   GPS: No valid fix — GPS will be flagged on server.");
            }

            if (wifiConnected || reconnectWiFi()) {
                bool sent = sendReport(ax, ay, az, magnitude, jerk, staltaRatio,
                                       reportLat, reportLon, hasFix);
                if (sent) {
                    lastReportTime = now;
                    Serial.printf("   ⏳ Cooldown: %lu s\n", COOLDOWN_MS / 1000);
                }
            } else {
                Serial.println("   ❌ No WiFi — report NOT sent.");
            }

            Serial.println("----------------------------------------");
        }
    }

    delay(200);  // 5 Hz sample rate
}

// ─────────────────────────────────────────────────────────────
//  WIFI
// ─────────────────────────────────────────────────────────────
void initWiFi() {
    Serial.printf("\n📡 Connecting to WiFi: %s", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 25) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        Serial.printf("\n✅ WiFi connected! IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        wifiConnected = false;
        Serial.printf("\n⚠️  WiFi failed (status=%d). Will retry on collision.\n", WiFi.status());
    }
}

bool reconnectWiFi() {
    if (WiFi.status() == WL_CONNECTED) { wifiConnected = true; return true; }

    Serial.print("🔄 Reconnecting WiFi...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    for (int i = 0; i < 20; i++) {
        if (WiFi.status() == WL_CONNECTED) {
            wifiConnected = true;
            Serial.println(" ✅");
            return true;
        }
        delay(500);
        Serial.print(".");
    }

    wifiConnected = false;
    Serial.println(" ❌ Failed.");
    return false;
}

// ─────────────────────────────────────────────────────────────
//  MPU6050
// ─────────────────────────────────────────────────────────────
void initMPU6050() {
    Serial.print("\n🔧 Initialising MPU6050...");
    Wire.begin(21, 22);

    if (!mpu.begin()) {
        Serial.println(" ❌ NOT FOUND! Check wiring.");
        mpuAvailable = false;
        return;
    }

    // ±8G range for crash detection; 21 Hz bandwidth per datasheet guidance
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

    mpuAvailable = true;
    Serial.println(" ✅  (±8G, Bandwidth: 21 Hz)");
}

// ─────────────────────────────────────────────────────────────
//  NEO-6M GPS
// ─────────────────────────────────────────────────────────────
void initGPS() {
    Serial.print("\n🛰️  Initialising NEO-6M GPS (RX=16, TX=17)...");
    gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    delay(100);
    Serial.println(" ✅");
    Serial.println("   ℹ️  Outdoors fix: 30–120 s  |  Indoors: unlikely");
}

void feedGPS() {
    unsigned long start = millis();
    while (gpsSerial.available() > 0 && millis() - start < 10) {
        gps.encode(gpsSerial.read());
    }
    if (gps.location.isUpdated() && gps.location.isValid()) {
        lastLat        = gps.location.lat();
        lastLon        = gps.location.lng();
        hasEverHadFix  = true;
    }
}

/**
 * Return the best available GPS coordinates.
 * Returns false if no valid fix — the backend will flag gps_valid=false
 * and will NOT anchor (0,0) coordinates on the blockchain.
 */
bool getGPSCoords(double &lat, double &lon) {
    if (gps.location.isValid() && gps.location.age() < GPS_MAX_AGE_MS) {
        lat = gps.location.lat();
        lon = gps.location.lng();
        return true;
    }
    if (hasEverHadFix) {
        lat = lastLat;
        lon = lastLon;
        return false;  // Stale, but better than nothing
    }
    // No fix at all — return NaN to signal invalid to the backend
    lat = NAN;
    lon = NAN;
    return false;
}

// ─────────────────────────────────────────────────────────────
//  HTTP REPORT
// ─────────────────────────────────────────────────────────────
bool sendReport(float ax, float ay, float az,
                float magnitude, float jerk, float staltaRatio,
                double lat, double lon, bool hasFix) {

    Serial.println("   📤 Sending collision report to backend...");

    StaticJsonDocument<512> doc;
    doc["vehicle_id"] = VEHICLE_ID;
    doc["impact"]     = true;
    doc["type"]       = "ESP32_COLLISION";

    // ── Accelerometer telemetry ───────────────────────────────
    JsonObject accelObj = doc.createNestedObject("accel");
    accelObj["x"]   = roundf(ax        * 100.0f) / 100.0f;
    accelObj["y"]   = roundf(ay        * 100.0f) / 100.0f;
    accelObj["z"]   = roundf(az        * 100.0f) / 100.0f;
    accelObj["mag"] = roundf(magnitude * 100.0f) / 100.0f;

    // ── Detection metrics (for paper) ─────────────────────────
    JsonObject detectionObj = doc.createNestedObject("detection");
    detectionObj["algorithm"]   = "STA_LTA_JERK";
    detectionObj["sta_lta"]     = roundf(staltaRatio * 100.0f) / 100.0f;
    detectionObj["jerk_ms3"]    = roundf(jerk        * 100.0f) / 100.0f;
    detectionObj["sta_window"]  = STA_WINDOW;
    detectionObj["lta_window"]  = LTA_WINDOW;
    detectionObj["sample_rate_hz"] = 5;

    // ── GPS ───────────────────────────────────────────────────
    JsonObject gpsObj = doc.createNestedObject("gps");
    if (!isnan(lat) && !isnan(lon)) {
        gpsObj["lat"] = lat;
        gpsObj["lon"] = lon;
    }
    gpsObj["fix"]        = hasFix;
    gpsObj["satellites"] = gps.satellites.isValid() ? (int)gps.satellites.value() : 0;
    gpsObj["hdop"]       = gps.hdop.isValid() ? gps.hdop.hdop() : -1.0;

    // ── Timestamp from GPS or fallback to millis ──────────────
    if (gps.date.isValid() && gps.time.isValid()) {
        char ts[25];
        snprintf(ts, sizeof(ts), "%04d-%02d-%02dT%02d:%02d:%02dZ",
                 gps.date.year(), gps.date.month(), gps.date.day(),
                 gps.time.hour(), gps.time.minute(), gps.time.second());
        doc["timestamp"] = ts;
    }

    // ── Device metadata ───────────────────────────────────────
    doc["source"]       = "ESP32-MPU6050-v2";
    doc["sample_count"] = sampleCount;

    String payload;
    serializeJson(doc, payload);
    Serial.println("   Payload: " + payload);

    // ── HTTP POST ─────────────────────────────────────────────
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", API_KEY);
    http.setTimeout(8000);

    int httpCode = http.POST(payload);

    if (httpCode > 0) {
        String response = http.getString();
        Serial.printf("   ✅ Server: %d — %s\n", httpCode, response.c_str());
        http.end();
        return true;
    } else {
        Serial.printf("   ❌ HTTP Error: %s\n", http.errorToString(httpCode).c_str());
        http.end();
        return false;
    }
}
