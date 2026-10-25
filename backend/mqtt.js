
require("dotenv").config();
const mqtt = require("mqtt");

const client = mqtt.connect(
  `mqtts://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`,
  {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  }
);

client.on("connect", () => {
  console.log("Đã kết nối HiveMQ Cloud!");

  client.subscribe(process.env.MQTT_TOPIC, (err) => {
    if (err) console.error("Subscribe thất bại:", err.message);
    else console.log("Đang nhận topic:", process.env.MQTT_TOPIC);
  });
});

client.on("message", (topic, message) => {
  console.log("Topic:", topic);
  console.log("Dữ liệu:", message.toString());
});

client.on("error", (err) => {
  console.error("Lỗi MQTT:", err.message);
});
