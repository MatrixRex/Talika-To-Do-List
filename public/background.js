/**
 * Talika Chrome Extension - Background Service Worker (Manifest V3)
 */

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu to quickly open Talika in the side panel
  chrome.contextMenus.create({
    id: 'talika-open-sidepanel',
    title: 'Open Talika in Side Panel',
    contexts: ['all'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'talika-open-sidepanel') {
    if (tab?.windowId) {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } catch (err) {
        console.error('Failed to open Talika side panel:', err);
      }
    }
  }
});
