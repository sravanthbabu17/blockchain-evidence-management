#define WIFI_SSID       "YourNetworkName"
#define WIFI_PASSWORD   "YourPassword"
#define SERVER_URL      "https://192.168.x.x:5443/api/accident/report"
#define API_KEY         "ReplaceWithPerDeviceBackendKey"
#define VEHICLE_ID      "YourVehicleReg"

// Development only. Prefer BACKEND_ROOT_CA for real deployments.
// #define ALLOW_INSECURE_TLS

const char BACKEND_ROOT_CA[] PROGMEM =
"-----BEGIN CERTIFICATE-----\n"
"...\n"
"-----END CERTIFICATE-----\n";
