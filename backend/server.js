require("dotenv").config();

const http = require("http");
const mqtt = require("mqtt");
const WebSocket = require("ws");

const mysql = require("mysql2/promise");//thêm mới sql
const cors = require("cors");

const PORT = 3000;

// Kết nối MySQL
const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Kiểm tra kết nối MySQL
db.getConnection()
  .then((connection) => {
    console.log("Đã kết nối MySQL!");
    connection.release();
  })
  .catch((err) => {
    console.error("Kết nối MySQL thất bại:", err.message);
  });

const SENSOR_TOPIC = process.env.MQTT_TOPIC || "iot/sensor/data";
const CONTROL_TOPIC = "iot/device/control";
const STATUS_TOPIC = "iot/device/status";

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173"); //thêm mới sql history
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // API lấy lịch sử cảm biến
  if (req.method === "GET" && url.pathname === "/api/history") {
    try {
      const limitParam = Number(url.searchParams.get("limit") || 100);
      const limit = Math.min(
        Math.max(Number.isInteger(limitParam) ? limitParam : 100, 1),
        1000
      );

      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");

      let sql = `
        SELECT id, recorded_at, temperature, humidity, vibration,
               temp_alert, hum_alert, vib_alert
        FROM sensor_history
        WHERE 1 = 1
      `;

      const params = [];

      if (from) {
        sql += " AND recorded_at >= ?";
        params.push(from);
      }

      if (to) {
        sql += " AND recorded_at <= ?";
        params.push(to);
      }

      sql += " ORDER BY recorded_at DESC LIMIT ?";
      params.push(limit);

      const [rows] = await db.execute(sql, params);

      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
      });

      res.end(JSON.stringify({
        success: true,
        count: rows.length,
        data: rows,
      }));
    } catch (err) {
      console.error("Lấy lịch sử thất bại:", err.message);

      res.writeHead(500, {
        "Content-Type": "application/json; charset=utf-8",
      });

      res.end(JSON.stringify({
        success: false,
        message: "Không thể lấy lịch sử cảm biến",
      }));
    }

    return;
  }

  // API lấy nhật ký cảnh báo
  if (req.method === "GET" && url.pathname === "/api/alerts") {
    try {
      const limitParam = Number(url.searchParams.get("limit") || 100);
      const limit = Math.min(
        Math.max(Number.isInteger(limitParam) ? limitParam : 100, 1),
        1000
      );

      const status = url.searchParams.get("status");
      const type = url.searchParams.get("type");

      let sql = `
        SELECT id, alert_type, alert_value, threshold_value,
               message, started_at, resolved_at, status
        FROM alert_history
        WHERE 1 = 1
      `;
      const params = [];

      if (status === "ACTIVE" || status === "RESOLVED") {
        sql += " AND status = ?";
        params.push(status);
      }

      const allowedTypes = ["temperature", "humidity", "vibration"];
      if (allowedTypes.includes(type)) {
        sql += " AND alert_type = ?";
        params.push(type);
      }

      sql += " ORDER BY started_at DESC LIMIT ?";
      params.push(limit);

      const [rows] = await db.execute(sql, params);

      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify({
        success: true,
        count: rows.length,
        data: rows,
      }));
    } catch (err) {
      console.error("Lấy nhật ký cảnh báo thất bại:", err.message);
      res.writeHead(500, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify({
        success: false,
        message: "Không thể lấy nhật ký cảnh báo",
      }));
    }
    return;
  }

  // Giữ nguyên địa chỉ kiểm tra Backend
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
    });

    res.end("IoT Monitoring Backend is running!");
    return;
  }

  res.writeHead(404, {
    "Content-Type": "application/json; charset=utf-8",
  });

  res.end(JSON.stringify({
    success: false,
    message: "Not Found",
  }));
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


  // Cập nhật nhật ký cảnh báo trong MySQL
  async function updateAlertHistory(data) {
    const alerts = [
      {
        type: "temperature",
        active: Boolean(data.tempAlert),
        value: Number(data.temperature),
        threshold: 35,
        message: "Nhiệt độ vượt ngưỡng 35°C",
      },
      {
        type: "humidity",
        active: Boolean(data.humAlert),
        value: Number(data.humidity),
        threshold: 80,
        message: "Độ ẩm vượt ngưỡng 80%",
      },
      {
        type: "vibration",
        active: Boolean(data.vibAlert),
        value: Number(data.vibration),
        threshold: 1.5,
        message: "Độ rung vượt ngưỡng 1.5 m/s²",
      },
    ];

    for (const alert of alerts) {
      // Bỏ qua nếu dữ liệu cảm biến không hợp lệ
      if (!Number.isFinite(alert.value)) continue;

      const [rows] = await db.execute(
        `SELECT id FROM alert_history
         WHERE alert_type = ? AND status = 'ACTIVE'
         ORDER BY id DESC LIMIT 1`,
        [alert.type]
      );

      if (alert.active && rows.length === 0) {
        // Chỉ tạo bản ghi khi cảnh báo bắt đầu
        await db.execute(
          `INSERT INTO alert_history
           (alert_type, alert_value, threshold_value, message, status)
           VALUES (?, ?, ?, ?, 'ACTIVE')`,
          [
            alert.type,
            alert.value,
            alert.threshold,
            alert.message,
          ]
        );

        console.log("Cảnh báo bắt đầu:", alert.message);
      } else if (alert.active && rows.length > 0) {
        // Cập nhật giá trị mới nhất trong cùng sự kiện
        await db.execute(
          `UPDATE alert_history
           SET alert_value = ?
           WHERE id = ?`,
          [alert.value, rows[0].id]
        );
      } else if (!alert.active && rows.length > 0) {
        // Kết thúc sự kiện khi cảm biến trở lại bình thường
        await db.execute(
          `UPDATE alert_history
           SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [rows[0].id]
        );

        console.log("Cảnh báo đã kết thúc:", alert.type);
      }
    }
  }

// Nhận dữ liệu cảm biến và trạng thái relay
let alertQueue = Promise.resolve();
client.on("message", (topic, message) => {
  try {
    const data = JSON.parse(message.toString());

    console.log("MQTT:", topic, data);

    // Lưu lịch sử cảm biến vào MySQL
    if (topic === SENSOR_TOPIC) {
      db.execute(
        `INSERT INTO sensor_history
        (temperature, humidity, vibration,
         temp_alert, hum_alert, vib_alert)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          data.temperature ?? null,
          data.humidity ?? null,
          data.vibration ?? null,
          Boolean(data.tempAlert),
          Boolean(data.humAlert),
          Boolean(data.vibAlert),
        ]
      ).catch((err) => {
        console.error("Lưu lịch sử cảm biến thất bại:", err.message);
      });
      // Cập nhật nhật ký cảnh báo
      alertQueue = alertQueue
        .then(() => updateAlertHistory(data))
        .catch((err) => {
          console.error("Cập nhật cảnh báo thất bại:", err.message);
        });
    }

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