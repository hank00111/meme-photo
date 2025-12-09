/** Toast notification system with auto-dismiss and duplicate prevention. */

const MAX_VISIBLE_TOASTS = 3;

const activeTimers: Set<ReturnType<typeof setTimeout>> = new Set();

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export const ERROR_MESSAGES = {
  THUMBNAIL_LOAD_FAILED: 'Failed to load thumbnail. Please try again.',
  NETWORK_ERROR: 'Network connection failed. Please check your internet.',
  API_ERROR: 'Google Photos API is temporarily unavailable.',
  AUTH_FAILED: 'Authorization failed. Please sign in again.',
  AUTH_TOKEN_EXPIRED: 'Session expired. Please sign in again.',
  STORAGE_READ_FAILED: 'Failed to read upload history.',
  STORAGE_WRITE_ERROR: 'Failed to save settings. Please try again.',
  UPLOAD_FAILED: 'Upload failed. Please try again.',
  DELETE_FAILED: 'Failed to delete record.',
  INVALID_FILE_TYPE: 'Invalid file type. Supported: JPEG, PNG, GIF, BMP, TIFF, WebP, HEIC.',
  FILE_TOO_LARGE: 'File size exceeds 200MB limit.',
  PROFILE_LOAD_FAILED: 'Failed to load user profile. Please try again.',
  ALBUM_LOAD_FAILED: 'Failed to load albums. Please try again.',
  ALBUM_CREATE_FAILED: 'Failed to create album. Please try again.'
} as const;

export function cleanupToasts(): void {
  for (const timer of activeTimers) {
    clearTimeout(timer);
  }
  activeTimers.clear();
  
  const container = document.getElementById('toast-container');
  if (container) {
    container.remove();
  }
}

export function showToast(
  message: string, 
  type: ToastType = 'info', 
  duration: number = 3000
): void {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const existingToasts = container.querySelectorAll('.toast');
  for (const existing of existingToasts) {
    if (existing.getAttribute('data-message') === message) {
      // Same message already showing, skip
      return;
    }
  }

  while (container.children.length >= MAX_VISIBLE_TOASTS) {
    const oldest = container.firstChild;
    if (oldest) {
      oldest.remove();
    }
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('data-message', message);

  // Add to container
  container.appendChild(toast);

  void toast.offsetWidth;
  toast.classList.add('toast-visible');

  const dismissTimer = setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');
    
    const removeTimer = setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      
      setTimeout(() => {
        const currentContainer = document.getElementById('toast-container');
        if (currentContainer && currentContainer.children.length === 0) {
          currentContainer.remove();
        }
      }, 50);
      
      activeTimers.delete(removeTimer);
    }, 300); // Match CSS transition duration
    
    activeTimers.add(removeTimer);
    activeTimers.delete(dismissTimer);
  }, duration);
  
  activeTimers.add(dismissTimer);
}

export function showError(errorKey: keyof typeof ERROR_MESSAGES): void {
  showToast(ERROR_MESSAGES[errorKey], 'error');
}

export function showSuccess(message: string): void {
  showToast(message, 'success');
}
