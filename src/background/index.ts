import { addUploadRecord } from "../utils/uploadHistory";
import { stripExifMetadata } from "../utils/imageProcessor";

console.log("INFO: Meme Photo extension loaded");

chrome.runtime.onInstalled.addListener((details) => {
  console.log("INFO: Extension installed:", details.reason);

  chrome.storage.local.set({
    installedAt: new Date().toISOString(),
  });

  // CREATE CONTEXT MENU
  // Remove all existing menus first to prevent duplicates on extension reload
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: "upload-to-google-photos",
        title: "Upload to Google Photos",
        contexts: ["image"],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "MENU_ERROR: Failed to create context menu:",
            chrome.runtime.lastError
          );
        } else {
          console.log("MENU: Context menu created successfully");
        }
      }
    );
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log("INFO: Extension started");
});

// Handle context menu clicks
// NOTE: tab parameter is optional - may be undefined in some contexts (e.g., platform apps)
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("MENU_CLICK: Context menu clicked");
  console.log("MENU_CLICK: Menu item ID:", info.menuItemId);

  if (info.menuItemId === "upload-to-google-photos" && info.srcUrl) {
    console.log("MENU_CLICK: Image URL:", info.srcUrl);
    console.log("MENU_CLICK: Page URL:", info.pageUrl);
    console.log("MENU_CLICK: Tab ID:", tab?.id);

    handleImageUpload(info.srcUrl, info.pageUrl, tab)
      .then(() => {
        console.log("UPLOAD_SUCCESS: Image uploaded successfully");
      })
      .catch(async (error) => {
        console.error("UPLOAD_ERROR: Upload failed:", error);
        // Show error toast in web page if tab is available
        if (tab?.id) {
          try {
            await showToastInTab(tab.id, "error", error.message || "Upload failed");
          } catch (toastError) {
            console.error("TOAST_ERROR: Failed to show error toast:", toastError);
          }
        } else {
          console.log("TOAST_SKIP: No tab ID available for error toast");
        }
      });
  }
});

/** Toast type for content script notifications */
type ToastType = "success" | "error" | "info" | "warning" | "loading";

/**
 * Show toast notification in the web page
 * Injects CSS and JS into the active tab and displays a toast message
 *
 * @param tabId - The ID of the tab to inject into
 * @param type - The type of toast
 * @param message - The message to display
 * @param toastId - Optional unique ID for the toast (required for loading toasts)
 */
async function showToastInTab(
  tabId: number,
  type: ToastType,
  message: string,
  toastId?: string
): Promise<void> {
  try {
    console.log(`TOAST_INJECT: Injecting toast into tab ${tabId}`);

    // Step 1: Inject CSS (only once per tab)
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["styles/toast-content-script.css"],
    });
    console.log("TOAST_INJECT: CSS injected successfully");

    // Step 2: Inject toast script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/toast-injector.js"],
    });
    console.log("TOAST_INJECT: Script injected successfully");

    // Step 3: Send message to show toast
    await chrome.tabs.sendMessage(tabId, {
      action: "showToast",
      type: type,
      message: message,
      toastId: toastId,
    });
    console.log(`TOAST_INJECT: Toast message sent (${type})`);
  } catch (error) {
    console.error("TOAST_INJECT_ERROR: Failed to inject toast:", error);
    // Don't throw - toast injection failure shouldn't break the upload flow
  }
}

/**
 * Dismiss a toast notification in the web page
 *
 * @param tabId - The ID of the tab
 * @param toastId - The unique ID of the toast to dismiss
 */
async function dismissToastInTab(tabId: number, toastId: string): Promise<void> {
  try {
    // Send dismiss message to content script
    await chrome.tabs.sendMessage(tabId, {
      action: "dismissToast",
      toastId: toastId,
    });
    console.log(`TOAST_DISMISS: Toast dismissed (${toastId})`);
  } catch (error) {
    // Tab may have navigated away or been closed - this is expected
    console.log("TOAST_DISMISS: Could not dismiss toast (tab may have navigated):", error);
  }
}

// Main upload handler
async function handleImageUpload(
  imageUrl: string,
  _pageUrl?: string,
  tab?: chrome.tabs.Tab
) {
  console.log("UPLOAD: Starting upload process...");

  // Generate unique toast ID for this upload
  const uploadToastId = `upload-${Date.now()}`;

  // Show loading toast if tab is available
  if (tab?.id) {
    try {
      await showToastInTab(
        tab.id,
        "loading",
        "Uploading to Google Photos...",
        uploadToastId
      );
    } catch (error) {
      console.error("TOAST_ERROR: Failed to show loading toast:", error);
      // Continue execution - toast failure shouldn't break the upload flow
    }
  }

  try {
    // Step 1: Get OAuth token
    const token = await getAuthToken();
    if (!token) {
      throw new Error(
        "Failed to obtain OAuth token. Please re-authorize the extension."
      );
    }

    // Step 2: Download image
    const { blob, filename } = await downloadImage(imageUrl);

    // Step 2.5: Strip EXIF metadata to ensure upload time is used by Google Photos
    const processedBlob = await stripExifMetadata(blob);

    // Step 3: Upload bytes to get upload token
    const uploadToken = await uploadImageBytes(processedBlob, token);

    const mediaItem = await createMediaItem(uploadToken, filename, token);

    try {
      await addUploadRecord({
        filename: filename,
        mediaItemId: mediaItem.id,
        productUrl: mediaItem.productUrl,
      });
      console.log("HISTORY: Upload record saved successfully");
    } catch (error) {
      console.error("HISTORY_ERROR: Failed to save upload record:", error);
    }

    // Step 4.6: Dismiss loading toast and show success toast
    if (tab?.id) {
      try {
        // Dismiss the loading toast first
        await dismissToastInTab(tab.id, uploadToastId);
        
        // Show success toast
        await showToastInTab(
          tab.id,
          "success",
          "Image uploaded to Google Photos"
        );
      } catch (error) {
        console.error("TOAST_ERROR: Failed to show toast notification:", error);
        // Continue execution - toast failure shouldn't break the upload flow
      }
    } else {
      console.log("TOAST_SKIP: No tab ID available, skipping web toast");
    }

    // Web toast is already shown in Step 4.6
    console.log("UPLOAD_SUCCESS: Media item created -", mediaItem.id);
    console.log("UPLOAD_SUCCESS: Product URL -", mediaItem.productUrl);
  } catch (error) {
    // Dismiss loading toast and show error instead
    if (tab?.id) {
      try {
        await dismissToastInTab(tab.id, uploadToastId);
      } catch {
        // Ignore dismiss errors
      }
    }
    console.error("UPLOAD_ERROR:", error);
    throw error;
  }
}

// Error notifications are now shown via web toast (showToastInTab)
// Windows notification (chrome.notifications) has been removed

// Download image from URL
async function downloadImage(
  imageUrl: string
): Promise<{ blob: Blob; filename: string }> {
  console.log("DOWNLOAD: Fetching image from:", imageUrl);

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to download image: ${response.status} ${response.statusText}`
      );
    }

    const blob = await response.blob();
    console.log(
      "DOWNLOAD: Image downloaded, size:",
      blob.size,
      "bytes, type:",
      blob.type
    );

    // Validate file size (200MB hard limit, 50MB recommended for best performance)
    const MAX_FILE_SIZE = 200 * 1024 * 1024;
    if (blob.size > MAX_FILE_SIZE) {
      throw new Error("Image size exceeds 200MB limit");
    }

    // Validate file type (formats supported by Google Photos)
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/bmp",
      "image/tiff",
      "image/webp",
      "image/heic",
      "image/avif",
      "image/x-icon",
    ];
    if (!validTypes.includes(blob.type)) {
      throw new Error(`Unsupported image format: ${blob.type}`);
    }

    const filename = extractFilename(imageUrl) || generateFilename(blob.type);

    return { blob, filename };
  } catch (error) {
    console.error("DOWNLOAD_ERROR:", error);
    throw new Error(
      `Failed to download image: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Extract filename from URL
function extractFilename(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const parts = pathname.split("/");
    const filename = parts[parts.length - 1];

    if (
      filename &&
      /\.(jpg|jpeg|png|gif|bmp|tiff|webp|heic|avif|ico)$/i.test(filename)
    ) {
      return filename;
    }
  } catch {
    // Invalid URL
  }

  return null;
}

// Generate filename based on MIME type
function generateFilename(mimeType: string): string {
  const timestamp = Date.now();
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/avif": "avif",
    "image/x-icon": "ico",
  };

  const ext = extensions[mimeType] || "jpg";
  return `meme-photo-${timestamp}.${ext}`;
}

// Get OAuth token (non-interactive for upload)
// Uses cached token from previous authentication (e.g., testAuth() or user login)
// Returns null if no cached token exists - caller should handle gracefully
async function getAuthToken(): Promise<string | null> {
  try {
    const result = await chrome.identity.getAuthToken({ interactive: false });

    if (!result.token) {
      console.warn("AUTH_WARNING: No cached token available");
      return null;
    }

    console.log("AUTH: Retrieved cached token");
    return result.token;
  } catch (error) {
    console.error("AUTH_ERROR: Failed to get auth token:", error);
    return null;
  }
}

// Upload image bytes (Phase 1)
async function uploadImageBytes(blob: Blob, token: string): Promise<string> {
  console.log("API_UPLOAD: Uploading bytes...");

  const response = await fetch(
    "https://photoslibrary.googleapis.com/v1/uploads",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "X-Goog-Upload-Content-Type": blob.type,
        "X-Goog-Upload-Protocol": "raw",
      },
      body: blob,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${error}`);
  }

  const uploadToken = await response.text();
  console.log("API_UPLOAD: Got upload token");

  return uploadToken;
}

// TypeScript interface for Google Photos MediaItem
interface GooglePhotosMediaItem {
  id: string;
  productUrl: string;
  baseUrl: string;
  mimeType: string;
  filename: string;
}

// Create media item (Phase 2)
async function createMediaItem(
  uploadToken: string,
  filename: string,
  token: string
): Promise<GooglePhotosMediaItem> {
  console.log("API_CREATE: Creating media item...");

  const response = await fetch(
    "https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        newMediaItems: [
          {
            simpleMediaItem: {
              fileName: filename,
              uploadToken: uploadToken,
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create media item: ${JSON.stringify(error)}`);
  }

  const result = await response.json();

  if (!result.newMediaItemResults || result.newMediaItemResults.length === 0) {
    throw new Error("No media item created");
  }

  const itemResult = result.newMediaItemResults[0];

  if (itemResult.status?.code) {
    throw new Error(`Media item creation failed: ${itemResult.status.message}`);
  }

  console.log("API_CREATE: Media item created successfully");

  return itemResult.mediaItem;
}

// Test OAuth authentication
// Listen for messages from popup
// Placeholder for future message handlers - currently no messages are handled
// Commented out to avoid unused parameter errors
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   return false;
// });

// Notification button clicks removed - using web toast notifications instead
