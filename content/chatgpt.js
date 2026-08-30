// EcoPrompt: ChatGPT Content Script (v2.0.0)
console.log("🌿 EcoPrompt: ChatGPT content script loaded (v2.0.0)")

// Fallback calculator in case utils/calculator.js runs in an isolated context
function getCalculator() {
  if (typeof globalThis !== "undefined" && globalThis.EcoPromptCalculator) {
    return globalThis.EcoPromptCalculator
  }
  return {
    countTokens: (text) => (text ? Math.ceil(text.trim().length / 4) : 0),
    calculateEmissions: (tokens) => {
      const energy = tokens * 0.000003
      const co2 = energy * 0.386
      const water = energy * 1.8 // mL (1.8 mL / Wh)
      return {
        platform: "chatgpt",
        platformName: "ChatGPT",
        tokens,
        energy: parseFloat(energy.toFixed(6)),
        co2: parseFloat(co2.toFixed(6)),
        water: parseFloat(water.toFixed(4)),
      }
    }
  }
}

// Extract message text safely from the live DOM without cloneNode issues
function getCleanMessageText(el) {
  if (!el) return ""
  // Target markdown / prose container if present, else fallback to turn container
  const target = el.querySelector(".markdown, .prose, [class*='markdown']") || el
  const raw = target.innerText || target.textContent || ""
  // Strip out any badge text if badge happens to be inside
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

// Find all assistant turn containers across all ChatGPT DOM versions
function getAssistantContainers() {
  // 1. Canonical data attribute used across ChatGPT versions
  const standard = document.querySelectorAll('[data-message-author-role="assistant"]')
  if (standard.length > 0) return Array.from(standard)

  // 2. Alternative: articles that do not have user role
  const turns = document.querySelectorAll('article[data-testid^="conversation-turn-"]')
  const list = []
  turns.forEach(turn => {
    if (!turn.querySelector('[data-message-author-role="user"]')) {
      list.push(turn)
    }
  })
  if (list.length > 0) return list

  // 3. Fallback: elements with agent-turn class
  const agentTurns = document.querySelectorAll('.agent-turn')
  if (agentTurns.length > 0) return Array.from(agentTurns)

  return []
}

// Check if page is actively generating
function isPageGenerating() {
  return Boolean(
    document.querySelector('button[data-testid="stop-button"]') ||
    document.querySelector('button[aria-label*="Stop"]') ||
    document.querySelector('button[data-testid*="stop"]') ||
    document.querySelector('.result-streaming') ||
    document.querySelector('.streaming-caret') ||
    document.querySelector('span[class*="cursor"]')
  )
}

let isInitialScan = true

// Reset initial scan status on page load
setTimeout(() => {
  isInitialScan = false
}, 1500)

function processResponses() {
  const calc = getCalculator()
  const responses = getAssistantContainers()

  responses.forEach(el => {
    const text = getCleanMessageText(el)
    if (!text || text.length < 5) return

    const tokens = calc.countTokens(text)
    if (tokens === 0) return

    const emissions = calc.calculateEmissions(tokens, "chatgpt")
    emissions.timestamp = Date.now()

    // 1. INJECT / UPDATE BADGE
    let badge = el.querySelector(".eco-prompt-badge")
    if (!badge) {
      badge = createBadge(emissions)
      el.appendChild(badge)
    } else {
      badge.innerHTML = getBadgeHTML(emissions)
    }

    // 2. PRE-EXISTING / HISTORICAL MESSAGE PROTECTION
    // If this is the initial scan on page load, mark past messages as already counted
    if (isInitialScan) {
      el.dataset.ecoLastSavedTokens = String(tokens)
      return
    }

    // 3. RECORDING COMPLETED RESPONSES
    // Clear debounce timer if new tokens keep arriving
    if (el._ecoSaveTimer) clearTimeout(el._ecoSaveTimer)

    el._ecoSaveTimer = setTimeout(() => {
      // If still actively generating, don't finalize yet
      if (isPageGenerating()) return

      // Save only once per final token count
      if (el.dataset.ecoLastSavedTokens !== String(tokens)) {
        el.dataset.ecoLastSavedTokens = String(tokens)
        chrome.runtime.sendMessage({ type: "SAVE_EMISSION", data: emissions }, (res) => {
          console.log("🌿 EcoPrompt: ChatGPT emission recorded!", emissions.tokens, "tokens", res)
        })
      }
    }, 1500) // 1.5s stability confirms generation has completed
  })
}

// Listen for SPA chat navigation (when user clicks another conversation in sidebar)
let lastUrl = location.href
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    isInitialScan = true
    setTimeout(() => {
      isInitialScan = false
    }, 1500)
    processResponses()
  }
}, 500)

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