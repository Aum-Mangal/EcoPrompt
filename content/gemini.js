// EcoPrompt: Gemini Content Script (v2.0.0)
console.log("🌿 EcoPrompt: Gemini content script loaded (v2.0.0)")

function getCalculator() {
  if (typeof globalThis !== "undefined" && globalThis.EcoPromptCalculator) {
    return globalThis.EcoPromptCalculator
  }
  return {
    countTokens: (text) => (text ? Math.ceil(text.trim().length / 4) : 0),
    calculateEmissions: (tokens, platform) => {
      const energy = tokens * 0.0000028
      const co2 = energy * 0.386
      const water = energy * 1.8 // mL (1.8 mL / Wh)
      return {
        platform: platform || "gemini",
        platformName: "Gemini",
        tokens,
        energy: parseFloat(energy.toFixed(6)),
        co2: parseFloat(co2.toFixed(6)),
        water: parseFloat(water.toFixed(4)),
      }
    }
  }
}

function getCleanMessageText(el) {
  if (!el) return ""
  const target = el.querySelector(".markdown") || el
  const raw = target.innerText || target.textContent || ""
  return raw.replace(/💧[\s\S]*?tok(ens)?/gi, "").trim()
}

function getBadgeHTML(emissions) {
  const water = (emissions.water || 0).toFixed(2)
  const energyMWh = ((emissions.energy || 0) * 1000).toFixed(3)
  const co2Mg = ((emissions.co2 || 0) * 1000).toFixed(3)
  const tokens = (emissions.tokens || 0).toLocaleString()

  return `
    <span title="Water Footprint">💧 ${water} mL</span>
    <span title="Energy Consumed">⚡ ${energyMWh} mWh</span>
    <span title="Carbon Emissions">🌿 ${co2Mg} mg CO₂</span>
    <span style="color: #64748b; font-size: 10px;" title="Estimated Tokens">${tokens} tok</span>
  `
}

function createBadge(emissions) {
  const badge = document.createElement("div")
  badge.className = "eco-prompt-badge"
  badge.setAttribute("data-eco-badge", "true")
  badge.style.cssText = `
    display: inline-flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    gap: 10px !important;
    align-items: center !important;
    align-self: flex-start !important;
    background: #0f1a0f !important;
    border: 1px solid #1a3a1a !important;
    border-radius: 8px !important;
    padding: 6px 12px !important;
    margin-top: 10px !important;
    margin-bottom: 6px !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    color: #6fcf97 !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    line-height: 1.4 !important;
    user-select: none !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
    z-index: 9999 !important;
    position: relative !important;
    width: fit-content !important;
  `
  badge.innerHTML = getBadgeHTML(emissions)
  return badge
}

let isInitialScan = true
setTimeout(() => {
  isInitialScan = false
}, 1500)

function processResponses() {
  const calc = getCalculator()
  const responses = document.querySelectorAll("message-content, model-response")

  responses.forEach(container => {
    const text = getCleanMessageText(container)
    if (!text || text.length < 5) return

    const tokens = calc.countTokens(text)
    if (tokens === 0) return

    const emissions = calc.calculateEmissions(tokens, "gemini")
    emissions.timestamp = Date.now()

    let badge = container.querySelector(".eco-prompt-badge")
    if (!badge) {
      badge = createBadge(emissions)
      container.appendChild(badge)
    } else {
      badge.innerHTML = getBadgeHTML(emissions)
    }

    // Historical message protection on initial load
    if (isInitialScan) {
      container.dataset.ecoLastSavedTokens = String(tokens)
      return
    }

    // Debounce 1.5s of stable text before saving
    clearTimeout(container._ecoSaveTimer)
    container._ecoSaveTimer = setTimeout(() => {
      if (container.dataset.ecoLastSavedTokens !== String(tokens)) {
        container.dataset.ecoLastSavedTokens = String(tokens)
        chrome.runtime.sendMessage({ type: "SAVE_EMISSION", data: emissions }, (res) => {
          console.log("🌿 EcoPrompt: Gemini emission recorded!", emissions.tokens, "tokens", res)
        })
      }
    }, 1500)
  })
}

let typingTimer
function init() {
  processResponses()

  const observer = new MutationObserver(() => {
    clearTimeout(typingTimer)
    typingTimer = setTimeout(() => {
      processResponses()
    }, 250)
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  })
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}