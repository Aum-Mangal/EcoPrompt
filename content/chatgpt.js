// EcoPrompt: ChatGPT Content Script (v2.0.0)
console.log("EcoPrompt: ChatGPT content script loaded (v2.0.0)")

// Fallback calculation in case utils/calculator.js runs in isolated context
function getCalculator() {
  if (typeof globalThis !== "undefined" && globalThis.EcoPromptCalculator) {
    return globalThis.EcoPromptCalculator
  }
  return {
    countTokens: (text) => (text ? Math.ceil(text.trim().length / 4) : 0),
    calculateEmissions: (tokens, platform) => {
      const energy = tokens * 0.000003
      const co2 = energy * 0.386
      const water = energy * 1.8 // mL (1.8 mL / Wh)
      return {
        platform: platform || "chatgpt",
        tokens,
        energy: parseFloat(energy.toFixed(6)),
        co2: parseFloat(co2.toFixed(6)),
        water: parseFloat(water.toFixed(4)),
      }
    }
  }
}

// Extract message text while stripping out our badge, code actions, and UI buttons
function extractCleanText(element) {
  if (!element) return ""
  const clone = element.cloneNode(true)
  
  // Remove any previously injected eco badges so we don't count our own text
  clone.querySelectorAll(".eco-prompt-badge, button, [role='button'], .copy-code-button, svg").forEach(node => node.remove())
  
  // Focus on the markdown content if present, else entire container
  const markdownEl = clone.querySelector(".markdown, .prose, [class*='markdown']")
  const target = markdownEl || clone
  return target.innerText ? target.innerText.trim() : ""
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

// Check if ChatGPT is currently generating an answer
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

// Find all assistant response elements across different ChatGPT versions
function getAssistantElements() {
  const selectors = [
    '[data-message-author-role="assistant"]',
    'article[data-testid^="conversation-turn-"]:has([data-message-author-role="assistant"])',
    'div.agent-turn'
  ]

  const elements = new Set()
  for (const selector of selectors) {
    try {
      document.querySelectorAll(selector).forEach(el => elements.add(el))
    } catch {
      // Ignore unsupported pseudo-selector on older engines
    }
  }

  // Fallback: search turns with assistant role attribute
  if (elements.size === 0) {
    document.querySelectorAll('[data-message-author-role="assistant"]').forEach(el => elements.add(el))
  }

  return Array.from(elements)
}

let isInitialScan = true

function processResponses() {
  const calc = getCalculator()
  const responses = getAssistantElements()
  const pageGenerating = isPageGenerating()

  responses.forEach(el => {
    // Determine the host container for the badge
    const messageContainer = el.getAttribute("data-message-author-role") === "assistant" 
      ? el 
      : el.querySelector('[data-message-author-role="assistant"]') || el

    const text = extractCleanText(messageContainer)
    if (!text || text.length < 8) return

    const tokens = calc.countTokens(text)
    if (tokens === 0) return

    const emissions = calc.calculateEmissions(tokens, "chatgpt")
    emissions.timestamp = Date.now()

    let badge = messageContainer.querySelector('.eco-prompt-badge')

    if (!badge) {
      badge = createBadge(emissions)
      // Append below markdown or at bottom of message container
      const markdown = messageContainer.querySelector('.markdown, .prose, [class*="markdown"]')
      if (markdown && markdown.parentNode) {
        markdown.parentNode.insertBefore(badge, markdown.nextSibling)
      } else {
        messageContainer.appendChild(badge)
      }
    } else {
      updateBadgeContent(badge, emissions)
    }

    // Historical message protection: Messages already present on page load should display badges
    // but not inflate user totals with repeated calls to storage
    if (isInitialScan && !el.dataset.ecoSaved) {
      el.dataset.ecoSaved = "historical"
      return
    }

    // Live session message saving:
    // When generation stops (stop button removed, actions visible, or streaming stopped)
    const hasCopyAction = Boolean(el.querySelector('button[aria-label="Copy"], [data-testid="copy-turn-action-button"]'))
    const isActivelyStreaming = pageGenerating || el.classList.contains("result-streaming")

    // Clear existing timer if text continues updating
    if (el._ecoSaveTimer) clearTimeout(el._ecoSaveTimer)

    if (!isActivelyStreaming || hasCopyAction) {
      if (!el.dataset.ecoSaved || el.dataset.ecoSaved === "pending") {
        el.dataset.ecoSaved = "true"
        chrome.runtime.sendMessage({ type: "SAVE_EMISSION", data: emissions })
      }
    } else {
      // If streaming, wait for text to stay unchanged for 1.8s as fallback completion
      el.dataset.ecoSaved = "pending"
      el._ecoSaveTimer = setTimeout(() => {
        if (el.dataset.ecoSaved === "pending") {
          el.dataset.ecoSaved = "true"
          chrome.runtime.sendMessage({ type: "SAVE_EMISSION", data: emissions })
        }
      }, 1800)
    }
  })

  if (isInitialScan) {
    isInitialScan = false
  }
}

let typingTimer
function init() {
  // First scan for existing thread messages
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