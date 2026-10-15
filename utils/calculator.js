// EcoPrompt Emission Calculator (v2.0.0)
// Sources:
// - Patterson et al. 2021 (Energy & Policy Considerations for DL in NLP)
// - Luccioni et al. 2023 (Power Hungry Processing)
// - Li et al. 2023 (Making AI Less Thirsty)
//
// Smartphone battery baseline:
// Standard modern smartphone battery is ~3,300 - 4,000 mAh @ 3.8V ≈ 12 - 15 Wh.
// Baseline is set to 12.0 Wh.

const SMARTPHONE_BATTERY_WH = 12.0

const EMISSION_FACTORS = {
  chatgpt: {
    name: "ChatGPT",
    energyPerToken: 0.000003,    // Wh per token (~0.003 mWh)
    carbonIntensity: 0.386,      // g CO2 per Wh (~386 g/kWh)
    waterIntensity: 1.8,         // mL per Wh (1.8 L per kWh cooling)
  },
  claude: {
    name: "Claude",
    energyPerToken: 0.0000025,   // Wh per token
    carbonIntensity: 0.386,
    waterIntensity: 1.8,
  },
  gemini: {
    name: "Gemini",
    energyPerToken: 0.0000028,   // Wh per token
    carbonIntensity: 0.386,
    waterIntensity: 1.8,
  }
}

function countTokens(text) {
  if (!text) return 0
  const cleaned = text.trim()
  if (!cleaned) return 0
  return Math.ceil(cleaned.length / 4)
}

function calculateEmissions(tokens, platform) {
  const key = (platform || "chatgpt").toLowerCase()
  const factors = EMISSION_FACTORS[key] || EMISSION_FACTORS.chatgpt

  const energy = tokens * factors.energyPerToken          // Wh
  const co2 = energy * factors.carbonIntensity            // grams CO2
  const water = energy * factors.waterIntensity           // mL (1.8 mL / Wh)

  return {
    platform: key,
    platformName: factors.name,
    tokens: tokens,
    energy: parseFloat(energy.toFixed(6)),                // Wh
    energyMWh: parseFloat((energy * 1000).toFixed(4)),    // mWh
    co2: parseFloat(co2.toFixed(6)),                      // grams CO2
    co2Mg: parseFloat((co2 * 1000).toFixed(4)),           // mg CO2
    water: parseFloat(water.toFixed(4)),                  // mL
    phonePct: parseFloat(((energy / SMARTPHONE_BATTERY_WH) * 100).toFixed(4)),
  }
}

const EcoPromptCalculator = {
  SMARTPHONE_BATTERY_WH,
  EMISSION_FACTORS,
  countTokens,
  calculateEmissions
}

if (typeof globalThis !== "undefined") {
  globalThis.EcoPromptCalculator = EcoPromptCalculator
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = EcoPromptCalculator
}