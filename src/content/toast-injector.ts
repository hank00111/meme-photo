/**
 * Toast Injector - Content Script
 * 
 * This content script is programmatically injected into web pages by the background script
 * when an image upload completes. It listens for messages from the background script and
 * displays toast notifications on the web page.
 * 
 * Injection Method: chrome.scripting.executeScript (Programmatic Injection)
 * Trigger: Context Menu image upload completion
 * CSS: toast-content-script.css (injected via chrome.scripting.insertCSS)
 * 
 * Message Format:
 * {
 *   action: 'showToast',
 *   type: 'success' | 'error',
 *   message: string
 * }
 * 
 * IMPORTANT: This script may be injected multiple times into the same page.
 * We use a window flag to prevent duplicate listener registration.
 */

import { showToast, showLoading, dismissToast, type ExtendedToastType } from '../utils/toastContentScript';

// Extend Window interface for our initialization flag
declare global {
  interface Window {
    __memePhotoToastInitialized?: boolean;
  }
}

/**
 * Guard against duplicate listener registration
 * 
 * Since chrome.scripting.executeScript injects this script every time showToastInTab
 * is called, we need to prevent registering multiple message listeners.
 * Without this guard, each injection would add a new listener, causing
 * the toast to appear multiple times for a single message.
 */
if (window.__memePhotoToastInitialized) {
  // Already initialized, skip listener registration
} else {
  // Mark as initialized
  window.__memePhotoToastInitialized = true;
  
  /**
   * Listen for messages from the background script
   * 
   * Supported actions:
   * - showToast: Display a toast notification (all types including loading)
   * - dismissToast: Dismiss a specific toast by its ID
   */
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Handle showToast action
    if (message.action === 'showToast') {
      const type = message.type as ExtendedToastType;
      const toastId = message.toastId as string | undefined;
      
      // Use showLoading for loading type, otherwise use showToast
      if (type === 'loading' && toastId) {
        showLoading(message.message, toastId);
      } else {
        showToast(message.message, type, { toastId });
      }
      
      // Send acknowledgment back to background script
      sendResponse({ success: true });
      return true;
    }
    
    // Handle dismissToast action
    if (message.action === 'dismissToast') {
      const toastId = message.toastId as string;
      if (toastId) {
        const dismissed = dismissToast(toastId);
        sendResponse({ success: true, dismissed });
      } else {
        sendResponse({ success: false, error: 'Missing toastId' });
      }
      return true;
    }
    
    // Unknown action
    return false;
  });
}
