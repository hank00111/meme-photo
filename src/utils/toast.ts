/**
 * Toast Notification System - Phase 3.8
 * 
 * Simple DOM-based toast notifications with auto-dismiss.
 * No external dependencies, uses pure CSS transitions.
 * 
 * Features:
 * - Maximum visible toasts limit (prevents stacking overflow)
 * - Duplicate message prevention (same message won't show twice)
 * 
 * @example
 * ```typescript
 * import { showToast, ERROR_MESSAGES } from '../utils/toast';
 * 
 * showToast(ERROR_MESSAGES.NETWORK_ERROR, 'error');
 * showToast('Upload successful!', 'success');
 * ```
 */

/**
 * Maximum number of visible toasts at once
 * Based on Sonner library best practice (default: 3)
 */
const MAX_VISIBLE_TOASTS = 3;

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
 * Show a toast notification
 * 
 * @param message - Message to display
 * @param type - Toast type (success/error/info/warning)
 * @param duration - Auto-dismiss duration in milliseconds (default: 3000)
 */
export function showToast(
  message: string, 
  type: ToastType = 'info', 
  duration: number = 3000
): void {
  // Create toast container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  // Duplicate message prevention: skip if same message already exists
  const existingToasts = container.querySelectorAll('.toast');
  for (const existing of existingToasts) {
    if (existing.getAttribute('data-message') === message) {
      // Same message already showing, skip
      return;
    }
  }

  // Remove oldest toasts if exceeding limit
  while (container.children.length >= MAX_VISIBLE_TOASTS) {
    const oldest = container.firstChild;
    if (oldest) {
      oldest.remove();
    }
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('data-message', message); // For duplicate detection

  // Add to container
  container.appendChild(toast);

  // Trigger animation (force reflow)
  void toast.offsetWidth;
  toast.classList.add('toast-visible');

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');
    
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
  }, duration);
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
