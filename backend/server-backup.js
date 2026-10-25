require("dotenv").config();

const http = require("http");
const mqtt = require("mqtt");
const WebSocket = require("ws");

const PORT = 3000;

const SENSOR_TOPIC = process.env.MQTT_TOPIC || "iot/sensor/data";
const CONTROL_TOPIC = "iot/device/control";
const STATUS_TOPIC = "iot/device/status";

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end("IoT Monitoring Backend is running!");
});

const wss = new WebSocket.Server({ server });

const client = mqtt.connect(
  `mqtts://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`,
  {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  }
);

// Kết nối MQTT và đăng ký nhận dữ liệu
client.on("connect", () => {
  console.log("Đã kết nối HiveMQ Cloud!");

  client.subscribe(
    [SENSOR_TOPIC, STATUS_TOPIC],
    (err) => {
      if (err) {
        console.error("Subscribe thất bại:", err.message);
      } else {
        console.log("Đang nhận:", SENSOR_TOPIC, STATUS_TOPIC);
      }
    }
  );
});

// Nhận dữ liệu cảm biến và trạng thái relay
client.on("message", (topic, message) => {
  try {
    const data = JSON.parse(message.toString());

    console.log("MQTT:", topic, data);

    const payload = JSON.stringify({
      topic,
      ...data,
      receivedAt: new Date().toISOString(),
    });

    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  } catch (err) {
    console.error("JSON không hợp lệ:", err.message);
  }
});

// Nhận lệnh từ Dashboard rồi gửi lên HiveMQ
wss.on("connection", (ws) => {
  console.log("Dashboard đã kết nối WebSocket!");

  ws.send(JSON.stringify({
    type: "connected",
    message: "Đã kết nối Backend WebSocket",
  }));

  ws.on("message", (message) => {
    try {
      const command = JSON.parse(message.toString());

      const allowedModes = ["manual", "auto"];
      const allowedDevices = ["fan", "lamp", "buzzer"];

      // Lệnh đổi chế độ
      if (
        command.type === "mode" &&
        allowedModes.includes(command.mode)
      ) {
        client.publish(
          CONTROL_TOPIC,
          JSON.stringify({
            type: "mode",
            mode: command.mode,
          }),
          { qos: 1 },
          (err) => {
            if (err) console.error("Gửi chế độ thất bại:", err.message);
            else console.log("Đã gửi lệnh chế độ:", command.mode);
          }
        );
        return;
      }

      // Lệnh bật/tắt thiết bị trong chế độ thủ công
      if (
        command.type === "relay" &&
        allowedDevices.includes(command.device) &&
        typeof command.state === "boolean"
      ) {
        client.publish(
          CONTROL_TOPIC,
          JSON.stringify({
            type: "relay",
            device: command.device,
            state: command.state,
          }),
          { qos: 1 },
          (err) => {
            if (err) console.error("Gửi relay thất bại:", err.message);
            else console.log("Đã gửi lệnh relay:", command);
          }
        );
        return;
      }

      console.log("Lệnh không hợp lệ:", command);
    } catch (err) {
      console.error("Lệnh WebSocket không hợp lệ:", err.message);
    }
  });
});

client.on("error", (err) => {
  console.error("Lỗi MQTT:", err.message);
});

server.listen(PORT, () => {
  console.log(`Backend đang chạy tại http://localhost:${PORT}`);
});