import { useState, useEffect, useMemo, useCallback } from "react"
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

// Smartphone battery baseline: 12.0 Wh (standard ~3,300–4,000 mAh @ 3.8V)
const SMARTPHONE_BATTERY_WH = 12.0

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
  const [currentTime, setCurrentTime] = useState(0)
  const [showConfirmClear, setShowConfirmClear] = useState(false)

  // Fetch data from storage on mount
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["history"], (result) => {
        setHistory(Array.isArray(result.history) ? result.history : [])
        setCurrentTime(Date.now())
      })
    } else {
      // Dev preview fallback when viewing in browser outside extension
      const timer = setTimeout(() => {
        const now = Date.now()
        setHistory([
          { platform: "chatgpt", tokens: 1250, energy: 0.00375, co2: 0.00145, water: 0.00675, timestamp: now - 3600000 },
          { platform: "claude",  tokens: 2100, energy: 0.00525, co2: 0.00203, water: 0.00945, timestamp: now - 7200000 },
          { platform: "gemini",  tokens: 1600, energy: 0.00448, co2: 0.00173, water: 0.00806, timestamp: now - 14400000 },
        ])
        setCurrentTime(now)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleClearHistory = useCallback(() => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ history: [] }, () => {
        setHistory([])
        setShowConfirmClear(false)
      })
    } else {
      setHistory([])
      setShowConfirmClear(false)
    }
  }, [])

  // Filter history based on active time tab
  const filtered = useMemo(() => {
    if (!currentTime) return history
    return history.filter(h => {
      const ts = h.timestamp || 0
      if (tab === "today") return ts > currentTime - 86400000
      if (tab === "week")  return ts > currentTime - 604800000
      return true
    })
  }, [history, tab, currentTime])

  // Aggregate totals
  const totals = useMemo(() => {
    return filtered.reduce((acc, h) => ({
      water: acc.water + (h.water || 0),
      energy: acc.energy + (h.energy || 0),
      co2: acc.co2 + (h.co2 || 0),
      tokens: acc.tokens + (h.tokens || 0),
    }), { water: 0, energy: 0, co2: 0, tokens: 0 })
  }, [filtered])

  // Platform network breakdown
  const platforms = useMemo(() => {
    const map = {}
    filtered.forEach(h => {
      const p = (h.platform || "chatgpt").toLowerCase()
      if (!map[p]) map[p] = { count: 0, water: 0 }
      map[p].count++
      map[p].water += (h.water || 0)
    })
    return map
  }, [filtered])

  // Calendar-day aligned 7-day timeline
  const { chartData, chartOptions } = useMemo(() => {
    if (!currentTime) {
      return {
        chartData: { labels: [], datasets: [] },
        chartOptions: { responsive: true }
      }
    }

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentTime - (6 - i) * 86400000)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const dayEnd = dayStart + 86400000
      return {
        label: d.toLocaleDateString("en", { weekday: "short" }),
        start: dayStart,
        end: dayEnd
      }
    })

    const datasets = Object.entries(PLATFORMS).map(([key, p]) => ({
      label: p.name,
      data: days.map(d => {
        const sum = history
          .filter(h => (h.platform || "").toLowerCase() === key && h.timestamp >= d.start && h.timestamp < d.end)
          .reduce((acc, h) => acc + (h.water || 0), 0)
        return Number(sum.toFixed(3))
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

    const data = {
      labels: days.map(d => d.label),
      datasets
    }

    const options = {
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
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} mL`
          }
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

    return { chartData: data, chartOptions: options }
  }, [history, currentTime])

  // Realistic phone charge benchmark: 12.0 Wh
  const phonePct = ((totals.energy / SMARTPHONE_BATTERY_WH) * 100).toFixed(2)

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

      {/* Earth visual */}
      <div className="earth-container" />
      <div className="earth-fade" />

      {/* Content wrapper */}
      <div style={{ position: "relative", zIndex: 10 }}>

        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "20px",
          marginBottom: "130px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "rgba(255,255,255,0.9)",
              letterSpacing: "0.12em",
              textTransform: "uppercase"
            }}>EcoPrompt</span>
            <span style={{
              fontSize: "9px",
              color: "#38bdf8",
              background: "rgba(56,189,248,0.12)",
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: "600"
            }}>v2.0</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
              background: "rgba(56,189,248,0.08)",
              border: "1px solid rgba(56,189,248,0.15)",
              borderRadius: "20px",
              padding: "4px 10px",
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
              {filtered.length} {filtered.length === 1 ? "Response" : "Responses"}
            </div>

            {history.length > 0 && (
              <button
                onClick={() => setShowConfirmClear(prev => !prev)}
                title="Clear tracking history"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  padding: "4px 8px",
                  color: "#64748b",
                  fontSize: "10px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Clear Confirmation Banner */}
        {showConfirmClear && (
          <GlassCard style={{ padding: "10px 14px", marginBottom: "16px", background: "rgba(239, 68, 68, 0.08)", borderColor: "rgba(239, 68, 68, 0.25)" }}>
            <div style={{ fontSize: "11px", color: "#fca5a5", marginBottom: "8px", textAlign: "center" }}>
              Are you sure you want to reset all tracked emissions?
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <button
                onClick={handleClearHistory}
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "4px 12px",
                  fontSize: "10px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Yes, Reset
              </button>
              <button
                onClick={() => setShowConfirmClear(false)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "#94a3b8",
                  border: "none",
                  borderRadius: "8px",
                  padding: "4px 12px",
                  fontSize: "10px",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          </GlassCard>
        )}

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
            {phonePct}% of a full smartphone charge (12 Wh)
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
            { label: "Tokens",  value: totals.tokens.toLocaleString(),    unit: "tok", color: "#a78bfa" },
          ].map(s => (
            <GlassCard key={s.label} style={{ flex: 1, padding: "14px 10px", textAlign: "center" }}>
              <div style={{
                fontSize: "17px",
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
              const p = PLATFORMS[key] || { name: key, color: "#94a3b8" }
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

        {/* Timeline Chart */}
        {history.length > 0 && (
          <GlassCard style={{ padding: "16px", marginBottom: "16px" }}>
            <MiniLabel>7-Day Usage Timeline — mL Water</MiniLabel>
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
            color: "#334155",
            fontSize: "12px",
            padding: "20px 0",
            lineHeight: 1.7
          }}>
            Start a conversation on ChatGPT,<br />Claude, or Gemini to track your real-time impact.
          </div>
        )}

        <div style={{
          fontSize: "9px",
          color: "#1e293b",
          textAlign: "center",
          letterSpacing: "0.03em"
        }}>
          Inference benchmarks · Patterson et al. 2021 · Li et al. 2023 · Luccioni et al. 2023
        </div>
      </div>
    </div>
  )
}