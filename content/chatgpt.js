console.log("EcoPrompt: ChatGPT content script loaded")

function countTokens(text) {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

const FACTORS = {
  energyPerToken: 0.000003,
  carbonIntensity: 0.386,
  waterIntensity: 1.8,
}

function calculateEmissions(tokens) {
  const energy = tokens * FACTORS.energyPerToken
  const co2 = energy * FACTORS.carbonIntensity
  const water = energy * FACTORS.waterIntensity * 1000
  return {
    platform: "chatgpt",
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
  const responses = document.querySelectorAll('[data-message-author-role="assistant"]')
  responses.forEach(el => {
    const text = el.innerText
    if (!text || text.length < 10) return

    const tokens = countTokens(text)
    const emissions = calculateEmissions(tokens)
    emissions.timestamp = Date.now()

    let badge = el.querySelector('.eco-prompt-badge')
    
    if (!badge) {
      badge = createBadge(emissions)
      el.appendChild(badge)
    } else {
      // Live update the numbers while the AI is typing!
      badge.innerHTML = `
        <span>💧 ${emissions.water.toFixed(2)} ml</span>
        <span>⚡ ${(emissions.energy * 1000).toFixed(4)} mWh</span>
        <span>🌿 ${(emissions.co2 * 1000).toFixed(4)} mg CO₂</span>
        <span style="color:#444;font-size:10px">${emissions.tokens} tokens</span>
      `
    }

    // Only save to storage when ChatGPT removes the 'result-streaming' class
    const isStreaming = el.classList.contains('result-streaming') || el.closest('.result-streaming')
    if (!isStreaming && !el.dataset.ecoSaved) {
      el.dataset.ecoSaved = "true"
      chrome.runtime.sendMessage({ type: "SAVE_EMISSION", data: emissions })
    }
  })
}

function init() {
  const observer = new MutationObserver(() => {
    clearTimeout(typingTimer)
    typingTimer = setTimeout(() => {
      processResponses()
    }, 300) // 300ms debounce: fast enough to look live, slow enough to not lag the browser
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true // This is the secret to instantly detecting text updates
  })
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}