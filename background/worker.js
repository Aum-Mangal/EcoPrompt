console.log("EcoPrompt: Background worker loaded")

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_EMISSION") {
    const data = message.data
    console.log("EcoPrompt: Saving emission data", data)

    // Get existing history
    chrome.storage.local.get(["history"], (result) => {
      const history = result.history || []
      history.push(data)

      // Save back
      chrome.storage.local.set({ history }, () => {
        console.log("EcoPrompt: Saved. Total entries:", history.length)
        sendResponse({ success: true })
      })
    })

    return true // Keep message channel open for async response
  }
})