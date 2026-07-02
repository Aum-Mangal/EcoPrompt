import { useState, useEffect } from "react"
import { Line } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
} from "chart.js"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const PLATFORMS = {
  chatgpt: { name: "ChatGPT", color: "#38bdf8", bg: "rgba(56,189,248,0.08)" },
  claude:  { name: "Claude",  color: "#a78bfa", bg: "rgba(167,139,250,0.08)" },
  gemini:  { name: "Gemini",  color: "#34d399", bg: "rgba(52,211,153,0.08)" },
}

function GlassCard({ children, style = {} }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "18px",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      ...style
    }}>
      {children}
    </div>
  )
}

function MiniLabel({ children }) {
  return (
    <div style={{
      fontSize: "9px",
      color: "#475569",
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      fontWeight: "600",
      marginBottom: "12px"
    }}>
      {children}
    </div>
  )
}

export default function App() {
  const [history, setHistory] = useState([])
  const [tab, setTab] = useState("today")

  useEffect(() => {
    chrome.storage.local.get(["history"], (result) => {
      setHistory(result.history || [])
    })
  }, [])

  const now = Date.now()
  const filtered = history.filter(h => {
    if (tab === "today") return h.timestamp > now - 86400000
    if (tab === "week")  return h.timestamp > now - 604800000
    return true
  })

  const totals = filtered.reduce((acc, h) => ({
    water: acc.water + h.water,
    energy: acc.energy + h.energy,
    co2: acc.co2 + h.co2,
    tokens: acc.tokens + h.tokens,
  }), { water: 0, energy: 0, co2: 0, tokens: 0 })

  const platforms = {}
  filtered.forEach(h => {
    if (!platforms[h.platform]) platforms[h.platform] = { count: 0, water: 0 }
    platforms[h.platform].count++
    platforms[h.platform].water += h.water
  })

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * 86400000)
    return d.toLocaleDateString("en", { weekday: "short" })
  })

  const chartData = {
    labels: last7Days,
    datasets: Object.entries(PLATFORMS).map(([key, p]) => ({
      label: p.name,
      data: last7Days.map((_, i) => {
        const dayStart = now - (6 - i) * 86400000
        return history
          .filter(h => h.platform === key && h.timestamp >= dayStart && h.timestamp < dayStart + 86400000)
          .reduce((sum, h) => sum + h.water, 0)
          .toFixed(3)
      }),
      borderColor: p.color,
      backgroundColor: p.bg,
      tension: 0.4,
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: p.color,
      borderWidth: 1.5,
    }))
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(2,6,15,0.95)",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        titleColor: "#e2e8f0",
        bodyColor: "#64748b",
        padding: 10,
        cornerRadius: 10,
      }
    },
    scales: {
      x: {
        ticks: { color: "#334155", font: { size: 9 } },
        grid: { display: false },
        border: { display: false }
      },
      y: {
        ticks: { color: "#334155", font: { size: 9 } },
        grid: { color: "rgba(255,255,255,0.02)" },
        border: { display: false }
      }
    }
  }

  const phonePct = ((totals.energy / 0.012) * 100).toFixed(1)

  return (
    <div style={{
      width: "380px",
      minWidth: "380px",
      maxWidth: "380px",
      minHeight: "580px",
      color: "#fff",
      padding: "0 20px 24px",
      position: "relative",
      overflowX: "hidden",
    }}>

      {/* Earth */}
      <div className="earth-container" />
      <div className="earth-fade" />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 10 }}>

        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "20px",
          marginBottom: "130px"
        }}>
          <div style={{
            fontSize: "13px",
            fontWeight: "700",
            color: "rgba(255,255,255,0.9)",
            letterSpacing: "0.12em",
            textTransform: "uppercase"
          }}>EcoPrompt</div>

          <div style={{
            background: "rgba(56,189,248,0.08)",
            border: "1px solid rgba(56,189,248,0.15)",
            borderRadius: "20px",
            padding: "4px 12px",
            fontSize: "10px",
            fontWeight: "600",
            color: "#38bdf8",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}>
            <span style={{
              width: "5px", height: "5px",
              background: "#38bdf8",
              borderRadius: "50%",
              boxShadow: "0 0 6px #38bdf8",
              display: "inline-block"
            }} />
            {filtered.length} Responses
          </div>
        </div>

        {/* Hero metric */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            fontSize: "10px",
            color: "#475569",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontWeight: "600",
            marginBottom: "10px"
          }}>Total Water Footprint</div>

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "6px", textAlign: "center" }}>
            <span style={{
              fontSize: "52px",
              fontWeight: "600",
              letterSpacing: "-0.04em",
              color: "#f8fafc",
              lineHeight: 1,
              textShadow: "0 0 40px rgba(56,189,248,0.15)"
            }}>
              {totals.water.toFixed(1)}
            </span>
            <span style={{ fontSize: "20px", color: "#334155", fontWeight: "500" }}>mL</span>
          </div>

          <div style={{
            fontSize: "11px",
            color: "#334155",
            marginTop: "8px"
          }}>
            {phonePct}% of a smartphone charge
          </div>
        </div>

        {/* Tabs */}
        <GlassCard style={{ padding: "4px", marginBottom: "16px", display: "flex", gap: "3px" }}>
          {[
            { key: "today", label: "24 Hours" },
            { key: "week",  label: "7 Days" },
            { key: "all",   label: "All Time" }
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1,
              padding: "8px",
              background: tab === t.key ? "rgba(255,255,255,0.07)" : "transparent",
              color: tab === t.key ? "#f1f5f9" : "#475569",
              border: "none",
              borderRadius: "13px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: tab === t.key ? "600" : "500",
              transition: "all 0.2s",
              outline: "none"
            }}>
              {t.label}
            </button>
          ))}
        </GlassCard>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          {[
            { label: "Energy",  value: (totals.energy * 1000).toFixed(2), unit: "mWh", color: "#fbbf24" },
            { label: "Carbon",  value: (totals.co2 * 1000).toFixed(2),    unit: "mg",  color: "#34d399" },
            { label: "Tokens",  value: totals.tokens,                      unit: "tok", color: "#a78bfa" },
          ].map(s => (
            <GlassCard key={s.label} style={{ flex: 1, padding: "14px 10px", textAlign: "center" }}>
              <div style={{
                fontSize: "18px",
                fontWeight: "600",
                color: s.color,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                marginBottom: "4px"
              }}>{s.value}</div>
              <div style={{ fontSize: "10px", color: "#334155", marginBottom: "3px" }}>{s.unit}</div>
              <div style={{ fontSize: "9px", color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
            </GlassCard>
          ))}
        </div>

        {/* Platform breakdown */}
        {Object.keys(platforms).length > 0 && (
          <GlassCard style={{ padding: "16px", marginBottom: "12px" }}>
            <MiniLabel>Network Distribution</MiniLabel>
            {Object.entries(platforms).map(([key, data]) => {
              const p = PLATFORMS[key]
              const pct = totals.water > 0 ? (data.water / totals.water) * 100 : 0
              return (
                <div key={key} style={{ marginBottom: "12px" }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{
                        width: "6px", height: "6px",
                        borderRadius: "50%",
                        background: p.color,
                        boxShadow: `0 0 8px ${p.color}88`
                      }} />
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "#334155" }}>
                      {data.water.toFixed(2)} mL · {data.count} req
                    </span>
                  </div>
                  <div style={{
                    height: "2px",
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: "99px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${p.color}44, ${p.color})`,
                      borderRadius: "99px",
                      transition: "width 0.6s ease"
                    }} />
                  </div>
                </div>
              )
            })}
          </GlassCard>
        )}

        {/* Chart */}
        {history.length > 0 && (
          <GlassCard style={{ padding: "16px", marginBottom: "16px" }}>
            <MiniLabel>Usage Timeline — mL</MiniLabel>
            {/* Custom legend */}
            <div style={{ display: "flex", gap: "14px", marginBottom: "12px" }}>
              {Object.entries(PLATFORMS).map(([key, p]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "16px", height: "2px", background: p.color, borderRadius: "99px" }} />
                  <span style={{ fontSize: "10px", color: "#475569" }}>{p.name}</span>
                </div>
              ))}
            </div>
            <div style={{ height: "110px" }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </GlassCard>
        )}

        {filtered.length === 0 && (
          <div style={{
            textAlign: "center",
            color: "#1e293b",
            fontSize: "12px",
            padding: "20px 0",
            lineHeight: 1.7
          }}>
            Start a conversation on ChatGPT,<br />Claude, or Gemini to track your impact.
          </div>
        )}

        <div style={{
          fontSize: "9px",
          color: "#1e293b",
          textAlign: "center",
          letterSpacing: "0.03em"
        }}>
          Inference estimates · Patterson et al. 2021 · Luccioni et al. 2023
        </div>
      </div>
    </div>
  )
}