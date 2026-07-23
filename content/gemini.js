// EcoPrompt: Gemini Content Script (v2.0.0)
console.log("EcoPrompt: Gemini content script loaded (v2.0.0)")

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
        tokens,
        energy: parseFloat(energy.toFixed(6)),
        co2: parseFloat(co2.toFixed(6)),
        water: parseFloat(water.toFixed(4)),
      }
    }
  }
}

function extractCleanText(element) {
  if (!element) return ""
  const clone = element.cloneNode(true)
  clone.querySelectorAll(".eco-prompt-badge, button, [role='button'], svg, .source-citation").forEach(node => node.remove())
  return clone.innerText ? clone.innerText.trim() : ""
}

function createBadge(emissions) {
  const badge = document.createElement("div")
  badge.className = "eco-prompt-badge"
  badge.setAttribute("data-eco-badge", "true")
  badge.style.cssText = `
    display: inline-flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
    background: rgba(15, 26, 15, 0.85);
    border: 1px solid rgba(111, 207, 151, 0.25);
    border-radius: 8px;
    padding: 5px 10px;
    margin-top: 8px;
    margin-bottom: 4px;
    font-size: 11px;
    font-weight: 500;
    color: #6fcf97;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.4;
    user-select: none;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    backdrop-filter: blur(8px);
    width: fit-content;
  `
  updateBadgeContent(badge, emissions)
  return badge
}

function updateBadgeContent(badge, emissions) {
  const mWh = (emissions.energy * 1000).toFixed(3)
  const mgCO2 = (emissions.co2 * 1000).toFixed(3)
  const mLWater = emissions.water.toFixed(2)

  badge.innerHTML = `
    <span title="Water Footprint">💧 ${mLWater} mL</span>
    <span title="Energy Consumed">⚡ ${mWh} mWh</span>
    <span title="Carbon Emissions">🌿 ${mgCO2} mg CO₂</span>
    <span style="color: #64748b; font-size: 10px;" title="Estimated Tokens">${emissions.tokens.toLocaleString()} tok</span>
  `
}

let isInitialScan = true

function processResponses() {
  const calc = getCalculator()
  const responses = document.querySelectorAll("message-content .markdown, model-response .markdown")

  responses.forEach(el => {
    const container = el.closest("message-content, model-response") || el
    const text = extractCleanText(el)
    if (!text || text.length < 8) return

    const tokens = calc.countTokens(text)
    if (tokens === 0) return

    const emissions = calc.calculateEmissions(tokens, "gemini")
    emissions.timestamp = Date.now()

    let badge = container.querySelector(".eco-prompt-badge")

    if (!badge) {
      badge = createBadge(emissions)
      container.appendChild(badge)
    } else {
      updateBadgeContent(badge, emissions)
    }

    // Historical message protection on first load
    if (isInitialScan && !container.dataset.ecoSaved) {
      container.dataset.ecoSaved = "historical"
      return
    }

    // Gemini doesn't have an explicit streaming attribute, so debounce 1.8s of stable text
    clearTimeout(container._ecoSaveTimer)
    container.dataset.ecoSaved = "pending"
    container._ecoSaveTimer = setTimeout(() => {
      if (container.dataset.ecoSaved === "pending") {
        container.dataset.ecoSaved = "true"
        chrome.runtime.sendMessage({ type: "SAVE_EMISSION", data: emissions })
      }
    }, 1800)
  })

  if (isInitialScan) {
    isInitialScan = false
  }
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