/**
 * Thumbnail Error Aggregator - BUG-004 Fix
 * 
 * Collects thumbnail loading errors within a time window
 * and shows a single aggregated toast message instead of
 * multiple identical toasts.
 * 
 * Problem: When UploadHistory displays 10 records and all
 * thumbnails fail to load, the user would see 10 identical
 * error toasts. This creates a poor user experience.
 * 
 * Solution: Use debounce pattern to collect errors within
 * a 500ms time window, then show a single aggregated message.
 * 
 * @example
 * ```typescript
 * import { reportThumbnailError, cleanupThumbnailErrorAggregator } from '../utils/thumbnailErrorAggregator';
 * 
 * // In ThumbnailImage component
 * reportThumbnailError(); // Collects error
 * 
 * // In UploadHistory cleanup
 * cleanupThumbnailErrorAggregator();
 * ```
 */

import { showToast } from './toast';

/**
 * Module-level state for error aggregation
 * Each page (Popup/Sidepanel) has its own isolated instance
 */
let errorCount = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Time window for collecting errors (milliseconds)
 * After this delay, the aggregated message will be shown
 */
const DEBOUNCE_DELAY = 500;

/**
 * Report a thumbnail loading error
 * 
 * Errors are collected within the debounce window and
 * displayed as a single aggregated toast message.
 * 
 * Examples:
 * - 1 error: "Failed to load thumbnail"
 * - 3 errors: "3 thumbnails failed to load"
 * - 10 errors: "10 thumbnails failed to load"
 */
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

/**
 * Cleanup function for component unmount
 * 
 * Call this when UploadHistory unmounts to prevent:
 * - Memory leaks from orphaned timers
 * - Stale toast messages appearing after navigation
 * 
 * Scenarios that trigger cleanup:
 * - User logs out (UploadHistory unmounts)
 * - Page closes (automatic cleanup by browser)
 * - Authorization state changes
 */
export function cleanupThumbnailErrorAggregator(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  errorCount = 0;
}
