/**
 * content.js - Content Script Bridge
 * Injects inject.js into the main execution context and syncs captured logs with chrome.storage.local.
 */
(function () {
  'use strict';

  const MESSAGE_SOURCE = 'EMS_NEXACRO_INTERCEPTOR';
  const STORAGE_KEY = 'ems_captured_apis';
  const MAX_LOG_ENTRIES = 100;

  /**
   * Injects the hooking script into page context.
   */
  function injectMainWorldScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('inject.js');
      script.onload = function () {
        this.remove();
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.error('[NexacroBridge] Injection error:', e);
    }
  }

  injectMainWorldScript();

  /**
   * Listen for intercepted messages from inject.js.
   */
  window.addEventListener('message', (event) => {
    // Only accept messages from the current window and matching signature
    if (event.source !== window) return;
    if (!event.data || event.data.source !== MESSAGE_SOURCE) return;
    if (event.data.type !== 'API_INTERCEPTED') return;

    const newRecord = event.data.data;
    if (!newRecord) return;

    // Persist to storage with sliding window cap
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      let history = result[STORAGE_KEY] || [];
      if (!Array.isArray(history)) history = [];

      // Avoid duplicate IDs
      if (history.some((item) => item.id === newRecord.id)) {
        return;
      }

      history.push(newRecord);

      // Keep only the most recent MAX_LOG_ENTRIES requests
      if (history.length > MAX_LOG_ENTRIES) {
        history = history.slice(history.length - MAX_LOG_ENTRIES);
      }

      chrome.storage.local.set({ [STORAGE_KEY]: history }, () => {
        // Optional badge update message to background
        chrome.runtime.sendMessage({
          type: 'TRAFFIC_COUNT_UPDATED',
          count: history.length
        }).catch(() => {
          // Popup might be closed, suppress unhandled port error
        });
      });
    });
  });
})();