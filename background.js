// GesturePad background — executes real browser commands for the app page.
// chrome.tabs back/forward/reload/create/duplicate need no host permissions.
"use strict";

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "gp-command") return;
  if (sender.id !== chrome.runtime.id) return;
  (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      // never act on the GesturePad page itself unless the command is newtab
      const isSelf = tab?.url?.startsWith(chrome.runtime.getURL(""));
      switch (msg.cmd) {
        case "back":
          if (tab && !isSelf) await chrome.tabs.goBack(tab.id).catch(() => {});
          break;
        case "forward":
          if (tab && !isSelf) await chrome.tabs.goForward(tab.id).catch(() => {});
          break;
        case "reload":
          if (tab && !isSelf) await chrome.tabs.reload(tab.id);
          break;
        case "newtab":
          await chrome.tabs.create({});
          break;
        case "duplicate":
          if (tab && !isSelf) await chrome.tabs.duplicate(tab.id);
          break;
        case "nexttab": {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const i = tabs.findIndex((t) => t.active);
          if (i >= 0) await chrome.tabs.update(tabs[(i + 1) % tabs.length].id, { active: true });
          break;
        }
        case "prevtab": {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const i = tabs.findIndex((t) => t.active);
          if (i >= 0) await chrome.tabs.update(tabs[(i - 1 + tabs.length) % tabs.length].id, { active: true });
          break;
        }
      }
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true; // async response
});