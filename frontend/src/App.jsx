import "./App.css";
import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/* ─── SVG Icon Components ─── */
const IconDashboard = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const IconUpload = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const IconFile = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);
const IconBell = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);
const IconSettings = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

/* ─── Custom Recharts Tooltip ─── */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>{label}</div>
        <div style={{ color: "#818cf8", fontWeight: 700 }}>
          {payload[0].value} accidents
        </div>
      </div>
    );
  }
  return null;
};

/* ─── Main App ─── */
export default function App() {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [stats, setStats] = useState({
    total_accidents: 0,
    latest_confidence: 0,
    total_alerts: 0,
    latest_alert_status: "none",
  });
  const [loading, setLoading]         = useState(false);
  const [file, setFile]               = useState(null);
  const [result, setResult]           = useState(null);
  const [dragOver, setDragOver]       = useState(false);
  const [uploadProgress, setProgress] = useState(0);
  const [activity, setActivity]       = useState([
    { time: "Just now", text: "System initialized", type: "info" },
    { time: "Just now", text: "YOLOv8 model loaded", type: "success" },
    { time: "Just now", text: "Backend API connected", type: "success" },
  ]);

  const fileInputRef = useRef(null);
  const progressRef  = useRef(null);

  /* Seed chart with some realistic-looking history */
  const chartData = [
    { time: "Jan", accidents: 2 },
    { time: "Feb", accidents: 5 },
    { time: "Mar", accidents: 3 },
    { time: "Apr", accidents: 8 },
    { time: "May", accidents: 4 },
    { time: "Jun", accidents: stats.total_accidents },
  ];

  useEffect(() => {
    axios
      .get("http://127.0.0.1:8000/dashboard-stats")
      .then((res) => setStats(res.data))
      .catch(console.error);
  }, []);

  /* ── Progress animation ── */
  const startProgress = () => {
    setProgress(0);
    let p = 0;
    progressRef.current = setInterval(() => {
      p += Math.random() * 9 + 2;
      if (p >= 88) { p = 88; clearInterval(progressRef.current); }
      setProgress(Math.round(p));
    }, 320);
  };

  /* ── Upload handler ── */
  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      startProgress();

      const response = await axios.post(
        "http://127.0.0.1:8000/upload-video",
        formData
      );

      clearInterval(progressRef.current);
      setProgress(100);
      setResult(response.data);

      const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const isAccident = response.data.status?.includes("ACCIDENT");

      setActivity((prev) => [
        { time: t, text: response.data.status,             type: isAccident ? "danger"  : "success" },
        { time: t, text: `Confidence: ${response.data.confidence}%`, type: "info" },
        { time: t, text: "PDF report generated",           type: "success" },
        { time: t, text: `Alert: ${response.data.alert?.status || "n/a"}`, type: "warning" },
        ...prev,
      ].slice(0, 10));

      setStats((cur) => ({
        ...cur,
        total_accidents: cur.total_accidents + 1,
        latest_confidence: response.data.confidence,
        total_alerts:
          response.data.alert?.status &&
          ["queued","accepted","sending","sent","delivered","read"].includes(
            response.data.alert.status
          )
            ? cur.total_alerts + 1
            : cur.total_alerts,
        latest_alert_status: response.data.alert?.status || "none",
      }));
    } catch (err) {
      clearInterval(progressRef.current);
      setProgress(0);
      console.error("Upload error:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Drag & drop ── */
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type.startsWith("video/")) {
      setFile(dropped);
      setResult(null);
      setProgress(0);
    }
  }, []);

  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragOver(true);  }, []);
  const onDragLeave = useCallback(()  => setDragOver(false), []);

  const onFileChange = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setResult(null); setProgress(0); }
  };

  /* ── Nav items ── */
  const NAV = [
    { id: "dashboard", label: "Dashboard",    Icon: IconDashboard },
    { id: "upload",    label: "Upload Video",  Icon: IconUpload    },
    { id: "reports",   label: "Reports",       Icon: IconFile      },
    { id: "alerts",    label: "Alerts",        Icon: IconBell      },
    { id: "settings",  label: "Settings",      Icon: IconSettings  },
  ];

  /* ── Stat cards config ── */
  const STATS = [
    {
      value: stats.total_accidents,
      label: "Total Accidents",
      emoji: "🚨",
      color: "red",
      chip: "+12%",
      chipClass: "chip-orange",
    },
    {
      value: stats.total_alerts,
      label: "WhatsApp Alerts",
      emoji: "📱",
      color: "orange",
      chip: "Active",
      chipClass: "chip-blue",
    },
    {
      value: 45,
      label: "Vehicles Detected",
      emoji: "🚗",
      color: "blue",
      chip: "+8%",
      chipClass: "chip-green",
    },
    {
      value: `${Number(stats.latest_confidence).toFixed(1)}%`,
      label: "Avg. Confidence",
      emoji: "🎯",
      color: "green",
      chip: "High",
      chipClass: "chip-green",
    },
  ];

  /* ─────────────────────────────── RENDER ─────────────────────────────── */
  return (
    <div className="app-layout">

      {/* ══════════ SIDEBAR ══════════ */}
      <aside className="sidebar">

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">🛡️</div>
          <div className="logo-text">
            <span className="logo-title">AccidentAI</span>
            <span className="logo-sub">Detection System</span>
          </div>
        </div>

        {/* Live badge */}
        <div className="live-badge">
          <span className="live-dot" />
          SYSTEM LIVE
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-item ${activeNav === id ? "active" : ""}`}
              onClick={() => setActiveNav(id)}
            >
              <Icon />
              <span>{label}</span>
              {activeNav === id && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sys-status">
            <span className="sdot green" />
            <span>Backend Online</span>
          </div>
          <div className="sys-status">
            <span className="sdot blue" />
            <span>YOLO Model Ready</span>
          </div>
        </div>

      </aside>

      {/* ══════════ MAIN CONTENT ══════════ */}
      <main className="main-content">

        {/* ── Hero ── */}
        <header className="hero">
          <div className="hero-text">
            <div className="hero-badge">
              <span className="pulse-dot" />
              Real-Time Monitoring Active
            </div>
            <h1 className="hero-title">
              AI Accident <span className="grad">Monitoring</span>
              <br />Command Center
            </h1>
            <p className="hero-sub">
              Smart real-time vehicle surveillance &amp; accident detection
              platform powered by YOLOv8 deep learning.
            </p>
          </div>

          <div className="hero-visual">
            <div className="ring ring-1" />
            <div className="ring ring-2" />
            <div className="ring ring-3" />
            <div className="radar-icon">🛡️</div>
          </div>
        </header>

        {/* ── Stats ── */}
        <section className="stats-grid">
          {STATS.map((s, i) => (
            <div key={i} className={`stat-card ${s.color}`}>
              <div className="stat-icon-wrap">{s.emoji}</div>
              <div className="stat-body">
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
              <span className={`stat-chip ${s.chipClass}`}>{s.chip}</span>
            </div>
          ))}
        </section>

        {/* ── Upload + Results ── */}
        <div className="content-grid">

          {/* Upload Card */}
          <section className="glass-card">
            <div className="section-head">
              <h2 className="section-title">
                <span>📹</span> Upload Accident Video
              </h2>
              <span className="sec-badge">AI Powered</span>
            </div>

            {/* Drop Zone */}
            <div
              className={`drop-zone${dragOver ? " drag-over" : ""}${file ? " has-file" : ""}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={onFileChange}
                style={{ display: "none" }}
              />
              <span className="dz-icon">{file ? "🎬" : "📁"}</span>

              {file ? (
                <>
                  <p className="dz-filename">{file.name}</p>
                  <p className="dz-size">
                    {(file.size / 1024 / 1024).toFixed(2)} MB &nbsp;·&nbsp; Ready to analyze
                  </p>
                </>
              ) : (
                <>
                  <p className="dz-title">Drag &amp; drop your video here</p>
                  <p className="dz-hint">or click to browse &nbsp;·&nbsp; MP4, AVI, MOV supported</p>
                </>
              )}
            </div>

            {/* Progress */}
            {loading && (
              <div className="progress-wrap">
                <div className="progress-head">
                  <span>Analyzing with YOLOv8…</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="steps-row">
                  {["Preprocessing", "Detection", "Classification", "Report"].map((s, i) => (
                    <span
                      key={s}
                      className={`step-pill${uploadProgress > [10, 35, 62, 88][i] ? " done" : ""}`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Button */}
            <button
              className="analyze-btn"
              onClick={handleUpload}
              disabled={loading || !file}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Analyzing Video…
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Analyze Video
                </>
              )}
            </button>
          </section>

          {/* Results Card */}
          <section className="glass-card">
            <div className="section-head">
              <h2 className="section-title">
                <span>🎯</span> Detection Results
              </h2>
              {result && (
                <span
                  className={`sec-badge`}
                  style={
                    result.status?.includes("ACCIDENT")
                      ? { background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.25)", color: "#f87171" }
                      : { background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.25)", color: "#34d399" }
                  }
                >
                  {result.status?.includes("ACCIDENT") ? "⚠ Accident" : "✓ Clear"}
                </span>
              )}
            </div>

            {result ? (
              <div className="results-inner">

                {/* Status Banner */}
                <div
                  className={`result-status ${
                    result.status?.includes("ACCIDENT") ? "danger" : "success"
                  }`}
                >
                  <span className="rs-icon">
                    {result.status?.includes("ACCIDENT") ? "🚨" : "✅"}
                  </span>
                  <div>
                    <div className="rs-text">{result.status}</div>
                    <div className="rs-file">{result.filename}</div>
                  </div>
                </div>

                {/* Confidence Meter */}
                <div className="conf-bar-wrap">
                  <div className="conf-row">
                    <span>Confidence Score</span>
                    <span className="conf-val">{result.confidence}%</span>
                  </div>
                  <div className="conf-track">
                    <div className="conf-fill" style={{ width: `${result.confidence}%` }} />
                  </div>
                </div>

                {/* Meta chips */}
                <div className="meta-grid">
                  <div className="meta-item">
                    <span className="meta-key">Alert Status</span>
                    <span
                      className={`chip ${
                        ["delivered","read","sent"].includes(result.alert?.status)
                          ? "success"
                          : result.alert?.status === "failed"
                          ? "muted"
                          : "warning"
                      }`}
                    >
                      {result.alert?.status || "N/A"}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-key">PDF Report</span>
                    <span className="chip success">Generated ✓</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-key">Screenshot</span>
                    <span className="chip info">Captured ✓</span>
                  </div>
                </div>

                {/* Error Box */}
                {result.alert?.error && (
                  <div className="err-box">
                    <span>⚠️</span>
                    <span>{result.alert.error.slice(0, 140)}{result.alert.error.length > 140 ? "…" : ""}</span>
                  </div>
                )}

              </div>
            ) : (
              <div className="results-empty">
                <div className="empty-icon">🔍</div>
                <p className="empty-title">No Analysis Yet</p>
                <p className="empty-hint">Upload a video and click Analyze to see detection results here</p>
              </div>
            )}
          </section>

        </div>

        {/* ── Chart + Activity ── */}
        <div className="bottom-grid">

          {/* Chart */}
          <section className="glass-card">
            <div className="section-head">
              <h2 className="section-title">
                <span>📈</span> Accident Analytics
              </h2>
              <span className="sec-badge">Last 6 months</span>
            </div>

            <ResponsiveContainer width="100%" height={230}>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />

                <XAxis
                  dataKey="time"
                  stroke="transparent"
                  tick={{ fill: "#4b5563", fontSize: 11, fontFamily: "Inter" }}
                />
                <YAxis
                  stroke="transparent"
                  tick={{ fill: "#4b5563", fontSize: 11, fontFamily: "Inter" }}
                />

                <Tooltip content={<CustomTooltip />} />

                <Area
                  type="monotone"
                  dataKey="accidents"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#areaGrad)"
                  dot={{ fill: "#6366f1", strokeWidth: 0, r: 4 }}
                  activeDot={{ fill: "#818cf8", r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </section>

          {/* Activity Feed */}
          <section className="glass-card">
            <div className="section-head">
              <h2 className="section-title">
                <span>🕒</span> Recent Activity
              </h2>
            </div>

            <div className="activity-list">
              {activity.map((item, i) => (
                <div key={i} className="activity-item">
                  <span className={`act-dot ${item.type}`} />
                  <div className="act-body">
                    <span className="act-text">{item.text}</span>
                    <span className="act-time">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
        {/* end bottom-grid */}

      </main>
      {/* end main-content */}

    </div>
  );
}
