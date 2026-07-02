// Emission factors based on published research
// Sources:
// - Patterson et al. 2021 (Energy & Policy Considerations for DL in NLP)
// - Luccioni et al. 2023 (Power Hungry Processing)
// - Li et al. 2023 (Making AI Less Thirsty)

const EMISSION_FACTORS = {
  chatgpt: {
    name: "ChatGPT",
    energyPerToken: 0.000003,    // Wh per token (GPT-4 estimate)
    carbonIntensity: 0.386,      // gCO2 per Wh (US grid average)
    waterIntensity: 1.8,         // ml per Wh
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

function calculateEmissions(tokens, platform) {
  const factors = EMISSION_FACTORS[platform]
  if (!factors) return null

  const energy = tokens * factors.energyPerToken          // Wh
  const co2 = energy * factors.carbonIntensity            // grams
  const water = energy * factors.waterIntensity * 1000    // ml

  return {
    platform: factors.name,
    tokens: tokens,
    energy: parseFloat(energy.toFixed(6)),   // Wh
    co2: parseFloat(co2.toFixed(6)),          // grams
    water: parseFloat(water.toFixed(4)),      // ml
  }
}