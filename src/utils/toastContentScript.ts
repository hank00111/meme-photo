/**
 * Toast Notification System - Content Script Version (Phase 6.2)
 * 
 * Content script specific toast notifications with unique class prefixes
 * to avoid conflicts with host page CSS.
 * 
 * Differences from src/utils/toast.ts:
 * - All class names use 'meme-photo-' prefix
 * - Designed for injection into arbitrary web pages
 * - Matches styling from src/styles/toast-content-script.css
 * 
 * Technical Notes:
 * - Runs in isolated JavaScript world (no variable conflicts with page)
 * - Shares DOM with page (requires unique CSS class names)
 * - Injected programmatically only when needed (context menu click)
 * 
 * @example
 * ```typescript
 * import { showToast, ERROR_MESSAGES } from '../utils/toastContentScript';
 * 
 * showToast(ERROR_MESSAGES.UPLOAD_FAILED, 'error');
 * showToast('Image uploaded successfully!', 'success');
 * ```
 */

/**
 * Toast notification types
 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Predefined error messages (English-first, prepared for i18n)
 */
export const ERROR_MESSAGES = {
  THUMBNAIL_LOAD_FAILED: 'Failed to load thumbnail. Please try again.',
  NETWORK_ERROR: 'Network connection failed. Please check your internet.',
  API_ERROR: 'Google Photos API is temporarily unavailable.',
  AUTH_FAILED: 'Authorization failed. Please sign in again.',
  STORAGE_READ_FAILED: 'Failed to read upload history.',
  UPLOAD_FAILED: 'Upload failed. Please try again.',
  DELETE_FAILED: 'Failed to delete record.',
  INVALID_FILE_TYPE: 'Invalid file type. Supported: JPEG, PNG, GIF, BMP, TIFF, WebP, HEIC.',
  FILE_TOO_LARGE: 'File size exceeds 200MB limit.',
  PROFILE_LOAD_FAILED: 'Failed to load user profile. Please try again.'
} as const;

/**
 * Extended toast type including loading state
 */
export type ExtendedToastType = ToastType | 'loading';

/**
 * Show a toast notification in the content script context
 * 
 * @param message - Message to display
 * @param type - Toast type (success/error/info/warning/loading)
 * @param options - Optional configuration
 * @param options.duration - Auto-dismiss duration in ms (default: 3000, 0 = no auto-dismiss)
 * @param options.toastId - Optional ID for dismissing specific toasts
 */
export function showToast(
  message: string, 
  type: ExtendedToastType = 'info', 
  options: { duration?: number; toastId?: string } = {}
): void {
  const { duration = 3000, toastId } = options;

  // Create toast container if it doesn't exist
  let container = document.getElementById('meme-photo-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'meme-photo-toast-container';
    document.body.appendChild(container);
  }

  // If toastId is provided and a toast with this ID exists, remove it first
  if (toastId) {
    const existingToast = container.querySelector(`[data-toast-id="${toastId}"]`);
    if (existingToast) {
      existingToast.remove();
    }
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `meme-photo-toast meme-photo-toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  
  // Set toast ID if provided
  if (toastId) {
    toast.setAttribute('data-toast-id', toastId);
  }

  // For loading type, add spinner before message
  if (type === 'loading') {
    const spinner = document.createElement('span');
    spinner.className = 'meme-photo-toast-spinner';
    toast.appendChild(spinner);
    
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);
  } else {
    toast.textContent = message;
  }

  // Add to container
  container.appendChild(toast);

  // Trigger animation (force reflow)
  void toast.offsetWidth;
  toast.classList.add('meme-photo-toast-visible');

  // Auto-dismiss (skip if duration is 0 or type is loading)
  if (duration > 0 && type !== 'loading') {
    setTimeout(() => {
      removeToastElement(toast, container);
    }, duration);
  }
}

/**
 * Remove a toast element with animation
 * @internal
 */
function removeToastElement(toast: Element, container: Element | null): void {
  toast.classList.remove('meme-photo-toast-visible');
  toast.classList.add('meme-photo-toast-hiding');
  
  // Remove from DOM after animation
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
    
    // Remove container if empty
    if (container && container.children.length === 0) {
      container.remove();
    }
  }, 300); // Match CSS transition duration
}

/**
 * Dismiss a specific toast by its ID
 * 
 * @param toastId - The ID of the toast to dismiss
 * @returns true if toast was found and dismissed, false otherwise
 */
export function dismissToast(toastId: string): boolean {
  const container = document.getElementById('meme-photo-toast-container');
  if (!container) {
    return false;
  }

  const toast = container.querySelector(`[data-toast-id="${toastId}"]`);
  if (!toast) {
    return false;
  }

  removeToastElement(toast, container);
  return true;
}

/**
 * Show a loading toast with spinner (does not auto-dismiss)
 * 
 * @param message - Message to display
 * @param toastId - Unique ID for this toast (required for later dismissal)
 * @param failsafeTimeout - Maximum time before auto-dismiss in ms (default: 30000)
 */
export function showLoading(
  message: string,
  toastId: string,
  failsafeTimeout: number = 30000
): void {
  showToast(message, 'loading', { duration: 0, toastId });

  // Failsafe: auto-dismiss after timeout to prevent stuck toasts
  if (failsafeTimeout > 0) {
    setTimeout(() => {
      dismissToast(toastId);
    }, failsafeTimeout);
  }
}

/**
 * Show error toast with predefined message
 * 
 * @param errorKey - Key from ERROR_MESSAGES
 */
export function showError(errorKey: keyof typeof ERROR_MESSAGES): void {
  showToast(ERROR_MESSAGES[errorKey], 'error');
}

/**
 * Show success toast
 * 
 * @param message - Success message
 */
export function showSuccess(message: string): void {
  showToast(message, 'success');
}
