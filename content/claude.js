console.log("EcoPrompt: Claude content script loaded")

function countTokens(text) {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

const FACTORS = {
  energyPerToken: 0.0000025,
  carbonIntensity: 0.386,
  waterIntensity: 1.8,
}

function calculateEmissions(tokens) {
  const energy = tokens * FACTORS.energyPerToken
  const co2 = energy * FACTORS.carbonIntensity
  const water = energy * FACTORS.waterIntensity * 1000
  return {
    platform: "claude",
    tokens,
    energy: parseFloat(energy.toFixed(6)),
    co2: parseFloat(co2.toFixed(6)),
    water: parseFloat(water.toFixed(4)),
  }
}

function createBadge(emissions) {
  const badge = document.createElement("div")
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

function processResponse(el) {
  if (el.dataset.ecoProcessed) return
  el.dataset.ecoProcessed = "true"

  const text = el.innerText
  if (!text || text.length < 10) return

  const tokens = countTokens(text)
  const emissions = calculateEmissions(tokens)
  emissions.timestamp = Date.now()

  const badge = createBadge(emissions)
  el.appendChild(badge)

  chrome.runtime.sendMessage({ type: "SAVE_EMISSION", data: emissions })
  console.log("🌿 EcoPrompt Claude badge injected:", emissions)
}

function scanForResponses() {
  const responses = document.querySelectorAll('[data-is-streaming="false"]')
  console.log("EcoPrompt: Found", responses.length, "Claude responses")
  responses.forEach(el => processResponse(el))
}

function init() {
  // Scan after delays to catch responses at different load times
  setTimeout(scanForResponses, 1000)
  setTimeout(scanForResponses, 3000)
  setTimeout(scanForResponses, 5000)

  const observer = new MutationObserver(() => {
    scanForResponses()
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-is-streaming']
  })
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}