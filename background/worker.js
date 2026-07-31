// EcoPrompt: Background Service Worker (v2.0.0)
console.log("EcoPrompt: Background worker initialized (v2.0.0)")

const MAX_HISTORY_ITEMS = 5000

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_EMISSION") {
    const data = message.data
    if (!data || typeof data.tokens !== "number") {
      sendResponse({ success: false, error: "Invalid emission payload" })
      return false
    }

    chrome.storage.local.get(["history"], (result) => {
      let history = Array.isArray(result.history) ? result.history : []

      // Generate unique fingerprint for deduplication
      const fingerprint = `${data.platform}_${data.tokens}_${Math.floor(data.timestamp / 3000)}`
      const isDuplicate = history.some(item => {
        const itemPrint = `${item.platform}_${item.tokens}_${Math.floor((item.timestamp || 0) / 3000)}`
        return itemPrint === fingerprint
      })

      if (isDuplicate) {
        console.log("EcoPrompt: Duplicate entry suppressed", fingerprint)
        sendResponse({ success: true, duplicate: true })
        return
      }

      history.push(data)

      // Limit memory footprint in storage
      if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(history.length - MAX_HISTORY_ITEMS)
      }

      chrome.storage.local.set({ history }, () => {
        console.log("EcoPrompt: Recorded emission. Total count:", history.length)
        sendResponse({ success: true, count: history.length })
      })
    })

    return true // Keep async channel open
  }

  if (message.type === "CLEAR_HISTORY") {
    chrome.storage.local.set({ history: [] }, () => {
      console.log("EcoPrompt: History cleared")
      sendResponse({ success: true })
    })
    return true
  }
})