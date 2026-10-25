#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// ===== 1. CAU HINH WIFI VA HIVEMQ =====
const char* WIFI_SSID = "Hào Hùng Phát 2";
const char* WIFI_PASS = "999999999";
//const char* WIFI_SSID = "Hùnn";
//const char* WIFI_PASS = "11223301";

const char* MQTT_HOST = "c542be78d0cb4caba47847e0f90e97f5.s1.eu.hivemq.cloud";
const int MQTT_PORT = 8883;
const char* MQTT_USER = "lenguyenmanhhung";
const char* MQTT_PASS = "Manhhung05";

const char* DATA_TOPIC = "iot/sensor/data";
const char* CMD_TOPIC = "iot/device/control";
const char* STATUS_TOPIC = "iot/device/status";

// ===== 2. CHAN GPIO =====
#define DHT_PIN 4
#define DHT_TYPE DHT22

#define RELAY_PIN 23
#define LAMP_PIN 19
#define BUZZER_PIN 18

#define RELAY_ACTIVE_LOW true
#define BUZZER_ACTIVE_HIGH true
#define LAMP_ACTIVE_HIGH true

// ===== 3. THIET BI =====
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_MPU6050 mpu;
LiquidCrystal_I2C lcd(0x27, 16, 2);

WiFiClientSecure secureClient;
PubSubClient mqtt(secureClient);

// ===== 4. NGUONG CANH BAO =====
const float TEMP_LIMIT = 35.0;
const float HUM_LIMIT = 80.0;
const float VIB_LIMIT = 1.5;

const unsigned long READ_INTERVAL = 500;
const unsigned long PUBLISH_INTERVAL = 3000;
const unsigned long BEEP_INTERVAL = 200;

// ===== 5. TRANG THAI =====
bool autoMode = true;
bool fanOn = false;
bool lampOn = false;
bool buzzerOn = false;
bool buzzerBlinkState = false;
bool mpuReady = false;

bool tempAlert = false;
bool humAlert = false;
bool vibAlert = false;

bool lastFan = false;
bool lastLamp = false;
bool lastBuzzer = false;

unsigned long lastRead = 0;
unsigned long lastPublish = 0;
unsigned long lastBeep = 0;

float temperature = NAN;
float humidity = NAN;
float vibration = 0;

// ===== 6. DIEU KHIEN NGO RA =====
void setRelay(bool on) {
  fanOn = on;
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? !on : on);
}

void setLamp(bool on) {
  lampOn = on;
  digitalWrite(LAMP_PIN, LAMP_ACTIVE_HIGH ? on : !on);
}

void setBuzzer(bool on) {
  buzzerOn = on;
  digitalWrite(BUZZER_PIN, BUZZER_ACTIVE_HIGH ? on : !on);
}

// ===== 7. GUI TRANG THAI THIET BI =====
void publishStatus() {
  if (!mqtt.connected()) return;

  StaticJsonDocument<192> doc;

  doc["type"] = "status";
  doc["mode"] = autoMode ? "auto" : "manual";
  doc["fan"] = fanOn;
  doc["lamp"] = lampOn;
  doc["buzzer"] = buzzerOn;

  char payload[192];
  serializeJson(doc, payload);

  mqtt.publish(STATUS_TOPIC, payload, true);

  Serial.print("Trang thai: ");
  Serial.println(payload);
}

// ===== 8. NHAN LENH TU DASHBOARD =====
void mqttCallback(char* topic, byte* payload,
                  unsigned int length) {
  if (String(topic) != CMD_TOPIC) return;

  StaticJsonDocument<192> doc;
  DeserializationError error = deserializeJson(
    doc, payload, length
  );

  if (error) {
    Serial.println("Lenh JSON khong hop le");
    return;
  }

  const char* type = doc["type"] | "";
  const char* mode = doc["mode"] | "";
  const char* device = doc["device"] | "";

  // Doi che do
  if (strcmp(type, "mode") == 0) {
    if (strcmp(mode, "auto") == 0) {
      autoMode = true;
      Serial.println("Chuyen sang TU DONG");
    } else if (strcmp(mode, "manual") == 0) {
      autoMode = false;
      Serial.println("Chuyen sang THU CONG");
    } else {
      return;
    }

    publishStatus();
    return;
  }

  // Chi nhan lenh bat/tat khi o che do thu cong
  if (strcmp(type, "relay") == 0 && !autoMode) {
    if (!doc["state"].is<bool>()) return;

    bool state = doc["state"].as<bool>();

    if (strcmp(device, "fan") == 0) {
      setRelay(state);
    } else if (strcmp(device, "lamp") == 0) {
      setLamp(state);
    } else if (strcmp(device, "buzzer") == 0) {
      buzzerBlinkState = false;
      setBuzzer(state);
    } else {
      return;
    }

    publishStatus();
    Serial.println("Da xu ly lenh relay");
  } else if (strcmp(type, "relay") == 0) {
    Serial.println("Tu choi lenh relay: dang o che do TU DONG");
  }
}

// ===== 9. KET NOI WIFI =====
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Dang ket noi WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi da ket noi!");
  Serial.println(WiFi.localIP());
}

// ===== 10. KET NOI HIVEMQ =====
void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("Dang ket noi HiveMQ...");

    String clientId = "ESP32-Warehouse-" +
      String((uint32_t)ESP.getEfuseMac(), HEX);

    if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println(" thanh cong!");

      mqtt.subscribe(CMD_TOPIC);
      Serial.println("Dang nghe: iot/device/control");

      publishStatus();
    } else {
      Serial.print(" Loi, state=");
      Serial.println(mqtt.state());
      delay(3000);
    }
  }
}

// ===== 11. DOC MPU6050 =====
void readMPU() {
  if (!mpuReady) return;

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  float magnitude = sqrt(
    a.acceleration.x * a.acceleration.x +
    a.acceleration.y * a.acceleration.y +
    a.acceleration.z * a.acceleration.z
  );

  vibration = fabs(magnitude - 9.81);
}

// ===== 12. DIEU KHIEN TU DONG =====
void automaticControl(unsigned long now) {
  // Kenh 1: quat khi nhiet do vuot 35 C
  bool fanAlert = !isnan(temperature) &&
                  temperature > TEMP_LIMIT;

  // Kenh 2: den khi nhiet do hoac do am cham nguong
  bool lampAlert =
    (!isnan(temperature) && temperature >= TEMP_LIMIT) ||
    (!isnan(humidity) && humidity >= HUM_LIMIT);

  setRelay(fanAlert);
  setLamp(lampAlert);

  // Kenh 3: coi bip khi rung vuot nguong
  if (vibAlert) {
    if (now - lastBeep >= BEEP_INTERVAL) {
      lastBeep = now;
      buzzerBlinkState = !buzzerBlinkState;
      setBuzzer(buzzerBlinkState);
    }
  } else {
    buzzerBlinkState = false;
    setBuzzer(false);
    lastBeep = now;
  }
}

// ===== 13. CAP NHAT LCD =====
void updateLCD() {
  lcd.setCursor(0, 0);
  lcd.print("T:");

  if (isnan(temperature)) lcd.print("--.-");
  else lcd.print(temperature, 1);

  lcd.print("C H:");

  if (isnan(humidity)) lcd.print("--");
  else lcd.print((int)humidity);

  lcd.print("%  ");

  lcd.setCursor(0, 1);

  if (vibAlert) {
    lcd.print("RUNG MANH!      ");
  } else if (tempAlert || humAlert) {
    lcd.print("CANH BAO MT     ");
  } else {
    lcd.print("Rung:");
    lcd.print(vibration, 1);
    lcd.print(" m/s2   ");
  }
}

// ===== 14. GUI DU LIEU CAM BIEN =====
void publishData() {
  if (!mqtt.connected()) return;

  StaticJsonDocument<256> doc;

  if (isnan(temperature)) doc["temperature"] = nullptr;
  else doc["temperature"] = temperature;

  if (isnan(humidity)) doc["humidity"] = nullptr;
  else doc["humidity"] = humidity;

  doc["vibration"] = vibration;
  doc["fan"] = fanOn;
  doc["tempAlert"] = tempAlert;
  doc["humAlert"] = humAlert;
  doc["vibAlert"] = vibAlert;

  char payload[256];
  serializeJson(doc, payload);

  if (mqtt.publish(DATA_TOPIC, payload)) {
    Serial.print("MQTT: ");
    Serial.println(payload);
  } else {
    Serial.println("Gui MQTT that bai");
  }
}

// ===== 15. SETUP =====
void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LAMP_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  setRelay(false);
  setLamp(false);
  setBuzzer(false);

  Wire.begin(21, 22);

  dht.begin();
  lcd.init();
  lcd.backlight();

  lcd.setCursor(0, 0);
  lcd.print("Kho hang IoT");
  lcd.setCursor(0, 1);
  lcd.print("Dang khoi dong");

  if (mpu.begin()) {
    mpuReady = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("MPU6050 OK");
  } else {
    Serial.println("Khong tim thay MPU6050!");
  }

  connectWiFi();

  // Chi dung cho thu nghiem; production nen xac minh TLS
  secureClient.setInsecure();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);

  lcd.clear();
}

// ===== 16. LOOP =====
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!mqtt.connected()) {
    connectMQTT();
  }

  mqtt.loop();

  unsigned long now = millis();

  // Doc cam bien moi 500 ms
  if (now - lastRead >= READ_INTERVAL) {
    lastRead = now;

    temperature = dht.readTemperature();
    humidity = dht.readHumidity();

    readMPU();

    tempAlert = !isnan(temperature) &&
                temperature >= TEMP_LIMIT;

    humAlert = !isnan(humidity) &&
               humidity >= HUM_LIMIT;

    vibAlert = mpuReady &&
               vibration >= VIB_LIMIT;

    // Chi tu dong dieu khien ngo ra khi o che do AUTO
    if (autoMode) {
      automaticControl(now);
    }

    updateLCD();

    // Gui lai trang thai khi trang thai relay thay doi
    if (fanOn != lastFan ||
        lampOn != lastLamp ||
        buzzerOn != lastBuzzer) {
      lastFan = fanOn;
      lastLamp = lampOn;
      lastBuzzer = buzzerOn;
      publishStatus();
    }

    Serial.printf(
      "T=%.1f C | H=%.1f %% | Rung=%.2f m/s2 | Mode=%s\n",
      temperature, humidity, vibration,
      autoMode ? "AUTO" : "MANUAL"
    );
  }

  // Gui du lieu cam bien moi 5 giay
  if (now - lastPublish >= PUBLISH_INTERVAL) {
    lastPublish = now;
    publishData();
  }
}