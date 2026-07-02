console.log("EcoPrompt: Gemini content script loaded")

function countTokens(text) {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

const FACTORS = {
  energyPerToken: 0.0000028,
  carbonIntensity: 0.386,
  waterIntensity: 1.8,
}

function calculateEmissions(tokens) {
  const energy = tokens * FACTORS.energyPerToken
  const co2 = energy * FACTORS.carbonIntensity
  const water = energy * FACTORS.waterIntensity * 1000
  return {
    platform: "gemini",
    tokens,
    energy: parseFloat(energy.toFixed(6)),
    co2: parseFloat(co2.toFixed(6)),
    water: parseFloat(water.toFixed(4)),
  }
}

function createBadge(emissions) {
  const badge = document.createElement("div")
  badge.className = "eco-prompt-badge"
  badge.style.cssText = `
    display: inline-flex;
    gap: 10px;
    align-items: center;
    background: #0f1a0f;
    border: 1px solid #1a3a1a;
    border-radius: 8px;
    padding: 6px 12px;
    margin-top: 8px;
    font-size: 12px;
    color: #6fcf97;
    font-family: -apple-system, sans-serif;
  `
  badge.innerHTML = `
    <span>💧 ${emissions.water.toFixed(2)} ml</span>
    <span>⚡ ${(emissions.energy * 1000).toFixed(4)} mWh</span>
    <span>🌿 ${(emissions.co2 * 1000).toFixed(4)} mg CO₂</span>
    <span style="color:#444;font-size:10px">${emissions.tokens} tokens</span>
  `
  return badge
}

let typingTimer;

function processResponses() {
  const responses = document.querySelectorAll('message-content .markdown')
  
  responses.forEach(el => {
    const text = el.innerText
    if (!text || text.length < 10) return

    const tokens = countTokens(text)
    const emissions = calculateEmissions(tokens)
    emissions.timestamp = Date.now()

    // GEMINI FIX: Attach badge OUTSIDE the markdown container so it survives re-renders
    const container = el.closest('message-content')
    if (!container) return

    let badge = container.querySelector('.eco-prompt-badge')
    
    if (!badge) {
      badge = createBadge(emissions)
      container.appendChild(badge)
    } else {
      // Live update
      badge.innerHTML = `
        <span>💧 ${emissions.water.toFixed(2)} ml</span>
        <span>⚡ ${(emissions.energy * 1000).toFixed(4)} mWh</span>
        <span>🌿 ${(emissions.co2 * 1000).toFixed(4)} mg CO₂</span>
        <span style="color:#444;font-size:10px">${emissions.tokens} tokens</span>
      `
    }

    // Gemini doesn't have a simple streaming class, so if text hasn't changed in 2 seconds, save it.
    clearTimeout(container.saveTimer)
    container.saveTimer = setTimeout(() => {
      if (!container.dataset.ecoSaved) {
        container.dataset.ecoSaved = "true"
        chrome.runtime.sendMessage({ type: "SAVE_EMISSION", data: emissions })
      }
    }, 2000)
  })
}

function init() {
  const observer = new MutationObserver(() => {
    clearTimeout(typingTimer)
    typingTimer = setTimeout(() => {
      processResponses()
    }, 300)
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