chrome.action.onClicked.addListener((tab) => {
  // 确保扩展仅在 gemini.google.com 下生效
  if (tab.url && tab.url.includes("gemini.google.com")) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    }).then(() => {
      chrome.tabs.sendMessage(tab.id, { action: "EXPORT_CHAT" });
    }).catch((err) => {
      console.error("Failed to inject script: ", err);
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.status === "success" && sender.tab) {
    chrome.action.setBadgeText({ text: "OK", tabId: sender.tab.id });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: "", tabId: sender.tab.id });
    }, 2000);
  }
  return true;
});