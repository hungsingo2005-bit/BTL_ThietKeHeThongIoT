
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Droplets,
  Fan,
  Lightbulb,
  Thermometer,
  Warehouse,
  Wifi,
  WifiOff,
  Volume2,
  Power,
  LayoutDashboard,
  History as HistoryIcon,
  BellRing,
  Settings as SettingsIcon,
  CalendarDays,//thêm mới sql
  RefreshCw,
  Search,
  Database,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

const LIMITS = { temperature: 35, humidity: 80, vibration: 1.5 };

function Gauge({ title, value, unit, max, color, icon: Icon }) {
  const valid = value !== null && value !== undefined &&
    Number.isFinite(Number(value));
  const number = valid ? Number(value) : 0;
  const percent = Math.max(0, Math.min(number / max, 1));
  const limit = title === "Nhiệt độ"
    ? LIMITS.temperature
    : LIMITS.humidity;
  const alert = valid && number >= limit;

  return (
    <section className="card gauge-card">
      <div className="card-heading">
        <span className="metric-icon" style={{ color }}>
          <Icon size={20} />
        </span>
        <span>{title}</span>
        <span className={`status-dot ${alert ? "danger-dot" : ""}`} />
      </div>

      <div className="gauge">
        <svg viewBox="0 0 200 115" role="img" aria-label={title}>
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            pathLength="100"
            className="gauge-track"
          />
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            pathLength="100"
            stroke={alert ? "#dc4545" : color}
            strokeDasharray={`${percent * 100} 100`}
            className="gauge-value"
          />
        </svg>
        <div className="gauge-reading">
          <strong>{valid ? number.toFixed(1) : "--"}</strong>
          <span>{unit}</span>
        </div>
      </div>

      <div className="gauge-footer">
        <span>Ngưỡng: {limit}{unit}</span>
        <span className={alert ? "text-danger" : "text-success"}>
          {alert ? "Vượt ngưỡng" : valid ? "Bình thường" : "Chưa có dữ liệu"}
        </span>
      </div>

      <div className="metric-number-card">
        <span>Giá trị hiện tại</span>
        <strong>{valid ? `${number.toFixed(1)} ${unit}` : "--"}</strong>
      </div>
    </section>
  );
}

function HistoryPage({
  rows,
  loading,
  error,
  range,
  setRange,
  limit,
  setLimit,
  from,
  setFrom,
  to,
  setTo,
  onRefresh,
}) {
  return (
    <div className="history-page">
      <div className="history-header">
        <div>
          <h1>Lịch sử cảm biến</h1>
          <p>Tra cứu dữ liệu đã lưu trong kho hàng</p>
        </div>

        <button onClick={onRefresh} disabled={loading}>
          <RefreshCw size={16} />
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      <div className="history-filters">
        <label>
          Khoảng thời gian
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="1h">1 giờ gần nhất</option>
            <option value="24h">24 giờ gần nhất</option>
            <option value="7d">7 ngày gần nhất</option>
            <option value="custom">Tùy chọn</option>
          </select>
        </label>

        {range === "custom" && (
          <>
            <label>
              Từ thời điểm
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>

            <label>
              Đến thời điểm
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </>
        )}

        <label>
          Số bản ghi
          <select value={limit} onChange={(e) => setLimit(e.target.value)}>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="250">250</option>
            <option value="500">500</option>
            <option value="1000">1000</option>
          </select>
        </label>
      </div>

      {error && <div className="history-error">{error}</div>}

      <div className="history-summary">
        <div>
          <span>Số bản ghi</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span>Nhiệt độ mới nhất</span>
          <strong>
            {rows.length && rows[0].temperature != null
              ? `${Number(rows[0].temperature).toFixed(1)} °C`
              : "--"}
          </strong>
        </div>
        <div>
          <span>Độ ẩm mới nhất</span>
          <strong>
            {rows.length && rows[0].humidity != null
              ? `${Number(rows[0].humidity).toFixed(1)} %`
              : "--"}
          </strong>
        </div>
        <div>
          <span>Rung động mới nhất</span>
          <strong>
            {rows.length && rows[0].vibration != null
              ? `${Number(rows[0].vibration).toFixed(3)} m/s²`
              : "--"}
          </strong>
        </div>
      </div>

      <div className="history-table-card">
        <h2>Dữ liệu chi tiết</h2>

        {loading && <p>Đang tải dữ liệu lịch sử...</p>}

        {!loading && !error && rows.length === 0 && (
          <p>Không có dữ liệu trong khoảng thời gian này.</p>
        )}

        <div className="history-table-scroll">
          <table className="history-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Nhiệt độ (°C)</th>
                <th>Độ ẩm (%)</th>
                <th>Rung động (m/s²)</th>
                <th>Cảnh báo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const alerts = [];
                if (row.temp_alert) alerts.push("Nhiệt độ");
                if (row.hum_alert) alerts.push("Độ ẩm");
                if (row.vib_alert) alerts.push("Rung động");

                return (
                  <tr key={row.id}>
                    <td>{new Date(row.recorded_at).toLocaleString("vi-VN")}</td>
                    <td>{row.temperature == null ? "--" : Number(row.temperature).toFixed(1)}</td>
                    <td>{row.humidity == null ? "--" : Number(row.humidity).toFixed(1)}</td>
                    <td>{row.vibration == null ? "--" : Number(row.vibration).toFixed(3)}</td>
                    <td>
                      {alerts.length ? (
                        <span className="history-alert">{alerts.join(", ")}</span>
                      ) : (
                        <span className="history-normal">Bình thường</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AlertsPage({ rows, loading, error, onRefresh }) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const filteredRows = rows.filter((row) =>
    (statusFilter === "ALL" || row.status === statusFilter) &&
    (typeFilter === "ALL" || row.alert_type === typeFilter)
  );
  const activeCount = rows.filter((row) => row.status === "ACTIVE").length;
  const resolvedCount = rows.filter((row) => row.status === "RESOLVED").length;
  const typeLabels = {
    temperature: "Nhiệt độ",
    humidity: "Độ ẩm",
    vibration: "Rung động",
  };
  const formatDate = (value) => value
    ? new Date(value).toLocaleString("vi-VN")
    : "--";

  const cardStyle = {
    background: "var(--card-bg, #fff)", border: "1px solid var(--border-color, #e5eaf1)",
    borderRadius: 14, padding: 20, minWidth: 0,
  };
  const selectStyle = {
    padding: "10px 12px", border: "1px solid #d9e0ea", borderRadius: 9,
    background: "white", color: "#263244", minWidth: 155,
  };

  return (
    <div className="history-page">
      <div className="history-header">
        <div>
          <h1>Nhật ký cảnh báo</h1>
          <p>Theo dõi các cảnh báo môi trường được lưu trong cơ sở dữ liệu</p>
        </div>
        <button onClick={onRefresh} disabled={loading}>
          <RefreshCw size={16} /> {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 14 }}>Tổng cảnh báo</div>
          <strong style={{ display: "block", fontSize: 30, marginTop: 8 }}>{rows.length}</strong>
          <span style={{ color: "#64748b", fontSize: 13 }}>Bản ghi đã tải</span>
        </div>
        <div style={cardStyle}>
          <div style={{ color: "#dc4545", fontSize: 14 }}>Đang hoạt động</div>
          <strong style={{ display: "block", fontSize: 30, marginTop: 8, color: "#dc4545" }}>{activeCount}</strong>
          <span style={{ color: "#64748b", fontSize: 13 }}>Cần theo dõi</span>
        </div>
        <div style={cardStyle}>
          <div style={{ color: "#15966a", fontSize: 14 }}>Đã kết thúc</div>
          <strong style={{ display: "block", fontSize: 30, marginTop: 8, color: "#15966a" }}>{resolvedCount}</strong>
          <span style={{ color: "#64748b", fontSize: 13 }}>Đã trở về bình thường</span>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569" }}>
            Trạng thái
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">Tất cả</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="RESOLVED">Đã kết thúc</option>
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569" }}>
            Loại cảnh báo
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">Tất cả loại</option>
              <option value="temperature">Nhiệt độ</option>
              <option value="humidity">Độ ẩm</option>
              <option value="vibration">Rung động</option>
            </select>
          </label>
          <span style={{ color: "#64748b", fontSize: 13, marginLeft: "auto" }}>
            Hiển thị {filteredRows.length}/{rows.length} bản ghi
          </span>
        </div>
      </div>

      {error && <div className="history-error">{error}</div>}
      <div className="history-table-card">
        <h2>Chi tiết cảnh báo</h2>
        {loading && <p>Đang tải nhật ký cảnh báo...</p>}
        {!loading && !error && filteredRows.length === 0 && <p>Không có cảnh báo phù hợp với bộ lọc.</p>}
        <div className="history-table-scroll">
          <table className="history-table">
            <thead><tr>
              <th>Thời gian bắt đầu</th><th>Loại cảnh báo</th><th>Giá trị</th>
              <th>Ngưỡng</th><th>Thời gian kết thúc</th><th>Trạng thái</th>
            </tr></thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.started_at)}</td>
                  <td>{typeLabels[row.alert_type] || row.alert_type}</td>
                  <td>{Number(row.alert_value).toFixed(2)}</td>
                  <td>{Number(row.threshold_value).toFixed(2)}</td>
                  <td>{formatDate(row.resolved_at)}</td>
                  <td>
                    <span className={row.status === "ACTIVE" ? "history-alert" : "history-normal"}>
                      {row.status === "ACTIVE" ? "Đang cảnh báo" : "Đã kết thúc"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState("dashboard");

  const [historyRows, setHistoryRows] = useState([]);//thêm mới sql
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRange, setHistoryRange] = useState("24h");
  const [historyLimit, setHistoryLimit] = useState("100");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [alertRows, setAlertRows] = useState([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertError, setAlertError] = useState("");

  const socketRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [sensor, setSensor] = useState(null);
  const [history, setHistory] = useState([]);
  const [lastReceived, setLastReceived] = useState(null);
  const [mode, setMode] = useState("auto");
  const [devices, setDevices] = useState({
    fan: false,
    lamp: false,
    buzzer: false,
  });
  const [statusReceived, setStatusReceived] = useState(false);
  const [commandError, setCommandError] = useState("");

  useEffect(() => {
    let socket;
    let retryTimer;
    let stopped = false;

    function connect() {
      if (stopped) return;

      socket = new WebSocket("ws://localhost:3000");
      socketRef.current = socket;

      socket.onopen = () => setConnected(true);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "connected") return;

          // Trang thai relay va che do tu ESP32
          if (data.topic === "iot/device/status") {
            if (data.mode === "auto" || data.mode === "manual") {
              setMode(data.mode);
            }

            setDevices((previous) => ({
              fan: typeof data.fan === "boolean" ? data.fan : previous.fan,
              lamp: typeof data.lamp === "boolean" ? data.lamp : previous.lamp,
              buzzer: typeof data.buzzer === "boolean"
                ? data.buzzer
                : previous.buzzer,
            }));

            setStatusReceived(true);
            setCommandError("");
            return;
          }

          // Chi cap nhat cam bien tu topic sensor
          if (
            data.topic !== "iot/sensor/data" ||
            data.temperature === undefined
          ) {
            return;
          }

          const receivedAt = data.receivedAt || new Date().toISOString();
          const time = new Date(receivedAt).toLocaleTimeString("vi-VN");

          setSensor(data);
          setLastReceived(receivedAt);
          setHistory((previous) => [
            ...previous,
            {
              time,
              vibration: Number(data.vibration) || 0,
            },
          ].slice(-30));
        } catch {
          console.error("Khong doc duoc du lieu WebSocket");
        }
      };

      socket.onerror = () => socket.close();

      socket.onclose = () => {
        setConnected(false);
        if (socketRef.current === socket) socketRef.current = null;
        if (!stopped) retryTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      if (socket) socket.close();
    };
  }, []);

  function sendCommand(command) {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setCommandError("WebSocket chưa kết nối. Vui lòng thử lại.");
      return;
    }

    socket.send(JSON.stringify(command));
    setCommandError("");
  }

  function changeMode(nextMode) {
    sendCommand({ type: "mode", mode: nextMode });
  }

  function toggleDevice(device) {
    if (mode !== "manual") return;

    sendCommand({
      type: "relay",
      device,
      state: !devices[device],
    });
  }

  
function formatLocalDateTime(date) {
    const pad = (n) => String(n).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const params = new URLSearchParams({
        limit: historyLimit,
      });

      if (historyRange === "custom") {
        if (historyFrom) {
          params.set("from", historyFrom.replace("T", " "));
        }

        if (historyTo) {
          params.set("to", historyTo.replace("T", " "));
        }
      } else {
        const hours =
          historyRange === "1h" ? 1 :
          historyRange === "24h" ? 24 : 168;

        const to = new Date();
        const from = new Date(
          to.getTime() - hours * 60 * 60 * 1000
        );

        params.set("from", formatLocalDateTime(from));
        params.set("to", formatLocalDateTime(to));
      }

      const response = await fetch(
        `http://localhost:3000/api/history?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error("Backend không trả về dữ liệu lịch sử.");
      }

      setHistoryRows(result.data);
    } catch (error) {
      setHistoryError(
        "Không tải được lịch sử. Hãy kiểm tra Backend và API /api/history."
      );
      console.error("History:", error);
    } finally {
      setHistoryLoading(false);
    }
  }



  async function loadAlerts() {
    setAlertLoading(true);
    setAlertError("");
    try {
      const response = await fetch("http://localhost:3000/api/alerts?limit=500");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error("Backend không trả về nhật ký cảnh báo hợp lệ.");
      }
      setAlertRows(result.data);
    } catch (error) {
      setAlertError("Không tải được nhật ký cảnh báo. Hãy kiểm tra Backend và API /api/alerts.");
      console.error("Alerts:", error);
    } finally {
      setAlertLoading(false);
    }
  }

  useEffect(() => {
    if (activePage !== "alerts") return;
    loadAlerts();
    const timer = setInterval(loadAlerts, 3000); // chỉnh thời gian lịch sử alerts tự động cập nhật (3000mm = 3 giây)
    return () => clearInterval(timer);
  }, [activePage]);

  useEffect(() => {// thêm mới cập nhật tự động lịch sử history
    if (activePage !== "history") return;

    loadHistory();

    const timer = setInterval(() => {
      loadHistory();
    }, 3000);// chỉnh thời gian lịch sử history tự động cập nhật (3000mm = 3 giây)

    return () => clearInterval(timer);
  }, [activePage, historyRange, historyLimit]);

  const temperatureAlert = sensor &&
    (sensor.tempAlert === true ||
      Number(sensor.temperature) >= LIMITS.temperature);

  const humidityAlert = sensor &&
    (sensor.humAlert === true ||
      Number(sensor.humidity) >= LIMITS.humidity);

  const vibrationAlert = sensor &&
    (sensor.vibAlert === true ||
      Number(sensor.vibration) >= LIMITS.vibration);

  const alarms = [
    { label: "Nhiệt độ", active: temperatureAlert },
    { label: "Độ ẩm", active: humidityAlert },
    { label: "Rung động", active: vibrationAlert },
  ];

  const activeAlarms = alarms.filter((alarm) => alarm.active);

  const deviceList = [
    { key: "fan", label: "Quạt thông gió", icon: Fan },
    { key: "lamp", label: "Đèn báo", icon: Lightbulb },
    { key: "buzzer", label: "Còi cảnh báo", icon: Volume2 },
  ];

  const navigation = [
    { id: "dashboard", label: "Dashboard", description: "Giám sát trực tiếp", icon: LayoutDashboard },
    { id: "history", label: "History", description: "Lịch sử dữ liệu", icon: HistoryIcon },
    { id: "alerts", label: "Alerts", description: "Nhật ký cảnh báo", icon: BellRing },
    { id: "settings", label: "Settings", description: "Cấu hình hệ thống", icon: SettingsIcon },
  ];

  const pageInfo = {
    history: { title: "History", subtitle: "Lịch sử dữ liệu cảm biến", description: "Trang này sẽ được xây dựng ở bước tiếp theo để tra cứu dữ liệu đã lưu trong cơ sở dữ liệu. Hiện tại hệ thống chưa lưu lịch sử lâu dài." },
    alerts: { title: "Alerts", subtitle: "Nhật ký cảnh báo", description: "Theo dõi cảnh báo môi trường từ cơ sở dữ liệu." },
    settings: { title: "Settings", subtitle: "Cài đặt hệ thống", description: "Tại đây sẽ cấu hình ngưỡng nhiệt độ, độ ẩm, độ rung và chế độ Auto/Manual. Chưa có thay đổi nào được gửi tới ESP32 từ trang này." },
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo"><Warehouse size={24} /></div>
          <div><strong>WAREHOUSE IoT</strong><span>Monitoring & Control</span></div>
        </div>
        <div className="sidebar-section-label">MENU CHÍNH</div>
        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          {navigation.map(({ id, label, description, icon: Icon }) => (
            <button key={id} className={`sidebar-link ${activePage === id ? "active" : ""}`} onClick={() => setActivePage(id)} aria-current={activePage === id ? "page" : undefined}>
              <Icon size={20} />
              <span className="sidebar-link-copy"><strong>{label}</strong><small>{description}</small></span>
              {activePage === id && <span className="sidebar-active-mark" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className={`sidebar-status-dot ${connected ? "is-online" : ""}`} />
          <div><strong>{connected ? "Backend trực tuyến" : "Đang kết nối"}</strong><small>ESP32 · MQTT · WebSocket</small></div>
        </div>
      </aside>
      <main className="app-main">
        {activePage === "dashboard" ? <div className="dashboard">
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo"><Warehouse size={25} /></div>
          <div>
            <h1>Warehouse Monitor</h1>
            <p>Hệ thống giám sát kho hàng IoT</p>
          </div>
        </div>

        <div className={`connection-pill ${connected ? "online" : "offline"}`}>
          {connected ? <Wifi size={17} /> : <WifiOff size={17} />}
          {connected ? "Backend đã kết nối" : "Đang kết nối lại..."}
        </div>
      </header>

      <section className="welcome-row">
        <div>
          <p className="eyebrow">TỔNG QUAN HỆ THỐNG</p>
          <h2>Giám sát môi trường kho</h2>
          <p className="subheading">
            Theo dõi điều kiện bảo quản theo thời gian thực.
          </p>
        </div>
        <div className="live-tag"><span /> LIVE DATA</div>
      </section>

      <section className="metric-grid">
        <Gauge
          title="Nhiệt độ"
          value={sensor?.temperature}
          unit="°C"
          max={50}
          color="#e58b43"
          icon={Thermometer}
        />

        <Gauge
          title="Độ ẩm"
          value={sensor?.humidity}
          unit="%"
          max={100}
          color="#3988e8"
          icon={Droplets}
        />

        <section className="card vibration-card">
          <div className="card-heading">
            <span className="metric-icon vibration-icon">
              <Activity size={20} />
            </span>
            <span>Rung động</span>
            <span className={`status-dot ${vibrationAlert ? "danger-dot" : ""}`} />
          </div>

          <div className="big-reading">
            <strong>
              {sensor ? Number(sensor.vibration).toFixed(2) : "--"}
            </strong>
            <span>m/s²</span>
          </div>

          <div className="threshold-row">
            <span>Ngưỡng cảnh báo</span>
            <strong>{LIMITS.vibration} m/s²</strong>
          </div>

          <div className={`state-banner ${vibrationAlert ? "state-danger" : "state-normal"}`}>
            {vibrationAlert
              ? <AlertTriangle size={17} />
              : <CheckCircle2 size={17} />}
            {vibrationAlert
              ? "Rung động vượt ngưỡng"
              : sensor ? "Trong ngưỡng cho phép" : "Đang chờ dữ liệu"}
          </div>
        </section>
      </section>

      <section className="content-grid">
        <section className="card chart-card">
          <div className="section-heading">
            <div>
              <h3>Biểu đồ rung động</h3>
              <p>Dữ liệu ESP32 · 30 điểm gần nhất</p>
            </div>
            <span className="chart-legend"><i /> Rung động</span>
          </div>

          <div className="chart-area">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 12, right: 12, left: -15, bottom: 0 }}>
                  <CartesianGrid stroke="#e9edf3" strokeDasharray="4 4" />
                  <XAxis dataKey="time" tick={{ fill: "#7b8798", fontSize: 11 }} minTickGap={30} />
                  <YAxis tick={{ fill: "#7b8798", fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="vibration"
                    name="Rung động (m/s²)"
                    stroke="#6478e8"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">
                <Activity size={30} />
                <strong>Đang chờ dữ liệu cảm biến</strong>
                <span>Biểu đồ xuất hiện khi nhận được bản tin đầu tiên.</span>
              </div>
            )}
          </div>
        </section>

        <section className="card status-card">
          <div className="section-heading">
            <div>
              <h3>Trạng thái hệ thống</h3>
              <p>Phản hồi từ ESP32 và Backend</p>
            </div>
          </div>

          <div className="device-row">
            <div className="device-icon"><Wifi size={21} /></div>
            <div className="device-info">
              <strong>Backend WebSocket</strong>
              <span>Cổng 3000</span>
            </div>
            <span className={`device-state ${connected ? "fan-on" : "fan-off"}`}>
              {connected ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          <div className="device-row">
            <div className="device-icon"><Power size={21} /></div>
            <div className="device-info">
              <strong>Phản hồi ESP32</strong>
              <span>Topic iot/device/status</span>
            </div>
            <span className={`device-state ${statusReceived ? "fan-on" : "fan-off"}`}>
              {statusReceived ? "ĐÃ NHẬN" : "ĐANG CHỜ"}
            </span>
          </div>

          <div className="last-update">
            <Clock3 size={17} />
            <span>Dữ liệu cảm biến gần nhất</span>
            <strong>
              {lastReceived
                ? new Date(lastReceived).toLocaleTimeString("vi-VN")
                : "--:--:--"}
            </strong>
          </div>

          <div className="alarm-summary">
            <div className="alarm-title">
              <AlertTriangle size={18} />
              <strong>Cảnh báo môi trường</strong>
              <span>{activeAlarms.length}/3</span>
            </div>

            {alarms.map((alarm) => (
              <div className="alarm-row" key={alarm.label}>
                <span className={`alarm-indicator ${alarm.active ? "alarm-active" : ""}`} />
                <span>{alarm.label}</span>
                <strong className={alarm.active ? "text-danger" : "text-success"}>
                  {alarm.active ? "Cảnh báo" : sensor ? "Bình thường" : "Chưa có dữ liệu"}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="card control-card">
        <div className="section-heading">
          <div>
            <h3>Điều khiển thiết bị</h3>
            <p>Điều khiển 3 kênh relay thông qua MQTT</p>
          </div>
          <span className={`device-state ${mode === "auto" ? "fan-on" : "manual-state"}`}>
            {mode === "auto" ? "TỰ ĐỘNG" : "THỦ CÔNG"}
          </span>
        </div>

        <div className="mode-switch">
          <button
            className={mode === "manual" ? "mode-button selected" : "mode-button"}
            disabled={!connected}
            onClick={() => changeMode("manual")}
          >
            <Power size={18} /> Thủ công
          </button>

          <button
            className={mode === "auto" ? "mode-button selected" : "mode-button"}
            disabled={!connected}
            onClick={() => changeMode("auto")}
          >
            <Activity size={18} /> Tự động
          </button>
        </div>

        <p className="control-hint">
          {mode === "manual"
            ? "Bro có thể bật/tắt từng thiết bị. Trạng thái sẽ cập nhật khi ESP32 phản hồi."
            : "ESP32 đang tự điều khiển thiết bị theo ngưỡng cảm biến. Chuyển sang Thủ công để thao tác trực tiếp."}
        </p>

        {commandError && (
          <div className="control-error">{commandError}</div>
        )}

        <div className="relay-grid">
          {deviceList.map(({ key, label, icon: Icon }) => (
            <div className="relay-card" key={key}>
              <div className={`relay-icon ${devices[key] ? "relay-active" : ""}`}>
                <Icon size={25} />
              </div>

              <div className="relay-details">
                <strong>{label}</strong>
                <span>
                  {devices[key] ? "ĐANG BẬT" : "ĐANG TẮT"}
                </span>
              </div>

              <button
                className={`relay-toggle ${devices[key] ? "is-on" : ""}`}
                aria-label={`${devices[key] ? "Tắt" : "Bật"} ${label}`}
                disabled={!connected || mode !== "manual"}
                onClick={() => toggleDevice(key)}
              >
                <span />
              </button>
            </div>
          ))}
        </div>

        {!statusReceived && (
          <p className="control-hint">
            Chưa nhận được trạng thái relay từ ESP32. Kiểm tra topic
            iot/device/status nếu trạng thái không cập nhật.
          </p>
        )}
      </section>

      <footer className="footer">
        <span>IoT Warehouse Monitoring</span>
        <span>
          {sensor ? "Đang hiển thị dữ liệu thực" : "Chưa nhận được dữ liệu cảm biến"}
        </span>
      </footer>
        </div> : activePage === "history" ? (
          <HistoryPage
            rows={historyRows}
            loading={historyLoading}
            error={historyError}
            range={historyRange}
            setRange={setHistoryRange}
            limit={historyLimit}
            setLimit={setHistoryLimit}
            from={historyFrom}
            setFrom={setHistoryFrom}
            to={historyTo}
            setTo={setHistoryTo}
            onRefresh={loadHistory}
          />
        ) : activePage === "alerts" ? (
          <AlertsPage rows={alertRows} loading={alertLoading} error={alertError} onRefresh={loadAlerts} />
        ) : (
          <section className="placeholder-page">
            <header className="placeholder-header">
              <div className="placeholder-icon">{(() => { const Icon = navigation.find((item) => item.id === activePage)?.icon || SettingsIcon; return <Icon size={24} />; })()}</div>
              <div><p className="eyebrow">WAREHOUSE IoT / {activePage.toUpperCase()}</p><h1>{pageInfo[activePage].title}</h1><p>{pageInfo[activePage].subtitle}</p></div>
              <span className="coming-soon">SẼ TRIỂN KHAI</span>
            </header>
            <div className="placeholder-card">
              <div className="placeholder-card-icon"><Clock3 size={26} /></div>
              <h2>Chức năng đang được lên kế hoạch</h2>
              <p>{pageInfo[activePage].description}</p>
              <button className="back-dashboard-button" onClick={() => setActivePage("dashboard")}><LayoutDashboard size={17} /> Quay lại Dashboard</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
