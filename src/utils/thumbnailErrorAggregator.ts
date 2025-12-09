/** Aggregate thumbnail errors to show single toast (500ms debounce) */

import { showToast } from './toast';

let errorCount = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const DEBOUNCE_DELAY = 500;

export function reportThumbnailError(): void {
  errorCount++;
  
  // Clear existing timer to extend the window
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // Set new timer
  debounceTimer = setTimeout(() => {
    if (errorCount === 1) {
      showToast('Failed to load thumbnail', 'error');
    } else if (errorCount > 1) {
      showToast(`${errorCount} thumbnails failed to load`, 'error');
    }
    
    // Reset state
    errorCount = 0;
    debounceTimer = null;
  }, DEBOUNCE_DELAY);
}

export function cleanupThumbnailErrorAggregator(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  errorCount = 0;
}
