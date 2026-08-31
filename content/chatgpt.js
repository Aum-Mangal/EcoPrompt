// EcoPrompt: ChatGPT Content Script (v2.0.0)
console.log("🌿 EcoPrompt: ChatGPT content script loaded (v2.0.0)")

// Shared calculator with embedded fallback
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
    border: 1px solid #22c55e !important;
    border-radius: 8px !important;
    padding: 6px 12px !important;
    margin-top: 10px !important;
    margin-bottom: 8px !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    color: #4ade80 !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    line-height: 1.4 !important;
    user-select: none !important;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4) !important;
    z-index: 1000 !important;
    position: relative !important;
    width: fit-content !important;
  `
  badge.innerHTML = getBadgeHTML(emissions)
  return badge
}

// Injects the badge into the turn's message column right above the action buttons
function injectBadge(el, badge) {
  const markdown = el.querySelector(".markdown, .prose, [class*='markdown']")
  if (markdown) {
    const actionRow = el.querySelector("div.mt-1, div[class*='mt-1'], .flex.gap-3")
    if (actionRow && actionRow.parentNode) {
      actionRow.parentNode.insertBefore(badge, actionRow)
      return
    }
    if (markdown.nextSibling) {
      markdown.parentNode.insertBefore(badge, markdown.nextSibling)
      return
    }
    markdown.parentNode.appendChild(badge)
    return
  }
  el.appendChild(badge)
}

// Find all assistant turn containers across all ChatGPT DOM structures
function getAssistantContainers() {
  // 1. Primary selector for assistant messages in ChatGPT
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
  const agentTurns = document.querySelectorAll(".agent-turn")
  if (agentTurns.length > 0) return Array.from(agentTurns)

  return []
}

// Checks if ChatGPT is actively generating
function isPageGenerating() {
  return Boolean(
    document.querySelector('button[data-testid="stop-button"]') ||
    document.querySelector('button[aria-label*="Stop generating"]') ||
    document.querySelector('button[aria-label*="Stop streaming"]') ||
    document.querySelector('.result-streaming') ||
    document.querySelector('.result-thinking')
  )
}

// Keep track of pre-existing historical messages on initial page load
let initialTurnsRecorded = false
const initialTurns = new WeakSet()

function recordInitialTurns() {
  const containers = getAssistantContainers()
  containers.forEach(el => initialTurns.add(el))
  initialTurnsRecorded = true
}

// Schedule debounce completion save
function scheduleSave(el, tokens, emissions) {
  if (el._ecoSaveTimer) clearTimeout(el._ecoSaveTimer)

  el._ecoSaveTimer = setTimeout(() => {
    // If still actively generating, reschedule
    if (isPageGenerating()) {
      scheduleSave(el, tokens, emissions)
      return
    }

    // Save only once when generation finishes
    if (el.dataset.ecoSaved !== "true") {
      el.dataset.ecoSaved = "true"
      chrome.runtime.sendMessage({ type: "SAVE_EMISSION", data: emissions }, (res) => {
        console.log("🌿 EcoPrompt: ChatGPT emission recorded!", emissions.tokens, "tokens", res)
      })
    }
  }, 1500)
}

function processResponses() {
  const calc = getCalculator()
  const responses = getAssistantContainers()

  if (!initialTurnsRecorded && responses.length > 0) {
    recordInitialTurns()
  }

  responses.forEach(el => {
    const text = getCleanMessageText(el)
    if (!text || text.length < 5) return

    const tokens = calc.countTokens(text)
    if (tokens === 0) return

    const emissions = calc.calculateEmissions(tokens, "chatgpt")
    emissions.timestamp = Date.now()

    // 1. INJECT OR LIVE-UPDATE BADGE
    let badge = el.querySelector(".eco-prompt-badge")
    if (!badge) {
      badge = createBadge(emissions)
      injectBadge(el, badge)
    } else {
      badge.innerHTML = getBadgeHTML(emissions)
    }

    // 2. HISTORICAL MESSAGE PROTECTION
    // Messages that were already on screen before user prompted are marked saved without sending message
    if (initialTurns.has(el) && !el.dataset.ecoSaved) {
      el.dataset.ecoSaved = "true"
      return
    }

    // 3. LIVE SESSION MESSAGE SAVING
    scheduleSave(el, tokens, emissions)
  })
}

// Handle SPA URL changes (when user clicks another conversation in the sidebar)
let lastUrl = location.href
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    initialTurnsRecorded = false
    setTimeout(processResponses, 500)
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