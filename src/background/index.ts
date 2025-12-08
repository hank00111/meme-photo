import { addUploadRecord } from "../utils/uploadHistory";
import { stripExifMetadata } from "../utils/imageProcessor";

// Upload queue using Promise chain pattern to prevent concurrent write errors
let uploadQueue: Promise<void> = Promise.resolve();

const tabsWithInjectedCSS = new Set<number>();

chrome.tabs.onRemoved.addListener((tabId) => {
  tabsWithInjectedCSS.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    tabsWithInjectedCSS.delete(tabId);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    installedAt: new Date().toISOString(),
  });

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
        }
      }
    );
  });
});

chrome.runtime.onStartup.addListener(() => {});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "upload-to-google-photos" && info.srcUrl) {
    const imageUrl = info.srcUrl;
    const pageUrl = info.pageUrl;

    uploadQueue = uploadQueue
      .then(async () => {
        await handleImageUpload(imageUrl, pageUrl, tab);
      })
      .catch(async (error) => {
        console.error("QUEUE_ERROR: Upload failed in queue:", error);
        if (tab?.id) {
          try {
            await showToastInTab(
              tab.id,
              "error",
              error.message || "Upload failed"
            );
          } catch (toastError) {
            console.error(
              "TOAST_ERROR: Failed to show error toast:",
              toastError
            );
          }
        }
      })
      .finally(() => {});
  }
});

/** Toast type for content script notifications */
type ToastType = "success" | "error" | "info" | "warning" | "loading";

/** Check if URL is a restricted page where content scripts cannot be injected */
function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;

  const restrictedPrefixes = [
    "chrome://",
    "chrome-extension://",
    "edge://",
    "about:",
    "moz-extension://",
    "file://",
    "data:",
    "blob:",
  ];

  return restrictedPrefixes.some((prefix) => url.startsWith(prefix));
}

/** Inject toast CSS/JS into tab and display message */
async function showToastInTab(
  tabId: number,
  type: ToastType,
  message: string,
  toastId?: string
): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isRestrictedUrl(tab.url)) {
      return;
    }

    if (!tabsWithInjectedCSS.has(tabId)) {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["styles/toast-content-script.css"],
      });
      tabsWithInjectedCSS.add(tabId);
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/toast-injector.js"],
    });

    await chrome.tabs.sendMessage(tabId, {
      action: "showToast",
      type: type,
      message: message,
      toastId: toastId,
    });
  } catch (error) {
    console.error("TOAST_INJECT_ERROR: Failed to inject toast:", error);
    // Don't throw - toast injection failure shouldn't break the upload flow
  }
}

async function dismissToastInTab(
  tabId: number,
  toastId: string
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: "dismissToast",
      toastId: toastId,
    });
  } catch {
    // Tab may have navigated away or been closed - this is expected
  }
}

async function handleImageUpload(
  imageUrl: string,
  _pageUrl?: string,
  tab?: chrome.tabs.Tab
) {
  // Keep Service Worker alive during long upload operations
  // Service Worker can terminate after 30 seconds of inactivity
  const keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo();
  }, 25 * 1000);

  const uploadToastId = `upload-${Date.now()}`;

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
    const token = await getAuthToken();
    if (!token) {
      throw new Error(
        "Failed to obtain OAuth token. Please re-authorize the extension."
      );
    }

    const { blob, filename } = await downloadImage(imageUrl);

    // Strip EXIF to ensure Google Photos uses upload time, not original photo time
    const processedBlob = await stripExifMetadata(blob);

    const uploadToken = await uploadImageBytes(processedBlob, token);

    // Read selected album ID from storage (Phase 7.4)
    const storageResult = await chrome.storage.sync.get("selectedAlbumId");
    let albumId = (storageResult.selectedAlbumId as string | undefined) || null;

    // Validate albumId: ensure it's an app-created album
    // Since March 2025 API changes, only app-created albums are allowed
    if (albumId) {
      try {
        const { getOrCreateMemePhotoAlbum } = await import(
          "../utils/albumCache"
        );
        const memePhotoAlbum = await getOrCreateMemePhotoAlbum(token);

        // If stored albumId doesn't match app-created album, migrate to it
        if (albumId !== memePhotoAlbum.id) {
          albumId = memePhotoAlbum.id;

          // Update storage to prevent future errors
          await chrome.storage.sync.set({ selectedAlbumId: memePhotoAlbum.id });
        }
      } catch (error) {
        console.error(
          "UPLOAD: Failed to validate album ID, falling back to Main Library",
          error
        );
        albumId = null; // Fallback to Main Library on validation error

        // Clear invalid albumId from storage
        await chrome.storage.sync.remove("selectedAlbumId");
      }
    }

    const mediaItem = await createMediaItem(
      uploadToken,
      filename,
      token,
      albumId || undefined
    );

    try {
      await addUploadRecord({
        filename: filename,
        mediaItemId: mediaItem.id,
        productUrl: mediaItem.productUrl,
      });
    } catch (error) {
      console.error("HISTORY_ERROR: Failed to save upload record:", error);
    }

    // Dismiss loading toast and show success
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
    }

    // Web toast is already shown in Step 4.6
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
  } finally {
    // Always clean up keep-alive interval
    clearInterval(keepAliveInterval);
  }
}

async function downloadImage(
  imageUrl: string
): Promise<{ blob: Blob; filename: string }> {
  // Validate URL protocol (only allow HTTP/HTTPS)
  try {
    const url = new URL(imageUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(
        `Unsupported protocol: ${url.protocol}. Only HTTP/HTTPS URLs are supported.`
      );
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Invalid URL: ${imageUrl}`);
    }
    throw error;
  }

  let response: Response;
  try {
    response = await fetch(imageUrl);
  } catch (error) {
    // TypeError is thrown for CORS errors and network failures
    console.error("DOWNLOAD_ERROR: Fetch failed:", error);
    if (error instanceof TypeError) {
      throw new Error(
        "Failed to download image: CORS restriction or network error. The image server may not allow cross-origin requests."
      );
    }
    throw new Error(
      `Failed to download image: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  try {
    if (!response.ok) {
      throw new Error(
        `Failed to download image: ${response.status} ${response.statusText}`
      );
    }

    const blob = await response.blob();

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
      // BUG-002 Mitigation: Provide user-friendly error messages
      if (!blob.type) {
        // Empty Content-Type from server - inform user about the issue
        console.warn("DOWNLOAD: Server returned empty Content-Type header");
        throw new Error(
          "Unable to determine image format. The image server may have incorrect configuration. " +
            "Try saving the image to your device first, then upload to Google Photos manually."
        );
      }
      // Unsupported format - list supported formats for clarity
      throw new Error(
        `Unsupported image format: ${blob.type}. ` +
          "Supported formats: JPEG, PNG, GIF, BMP, TIFF, WebP, HEIC, AVIF."
      );
    }

    const filename = extractFilename(imageUrl) || generateFilename(blob.type);

    return { blob, filename };
  } catch (error) {
    console.error("DOWNLOAD_ERROR:", error);
    throw error; // Re-throw as-is since we've already formatted the error
  }
}

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

/**
 * Validate OAuth token by calling tokeninfo endpoint.
 * Uses query parameter per Google OAuth2 documentation:
 * https://developers.google.com/identity/protocols/oauth2/openid-connect#validatinganidtoken
 */
async function validateToken(token: string): Promise<boolean> {
  try {
    // Use query parameter (official standard) instead of Authorization header
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    // Check if token expires within 5 minutes
    const expiresIn = parseInt(data.expires_in, 10);
    if (isNaN(expiresIn) || expiresIn < 300) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("AUTH: Token validation error:", error);
    return false;
  }
}

/** Get cached OAuth token (non-interactive). Returns null if unavailable. */
async function getAuthToken(): Promise<string | null> {
  try {
    const result = await chrome.identity.getAuthToken({ interactive: false });

    if (!result.token) {
      console.warn("AUTH_WARNING: No cached token available");
      return null;
    }

    // Validate token before returning
    const isValid = await validateToken(result.token);
    if (!isValid) {
      await chrome.identity.removeCachedAuthToken({ token: result.token });

      // Try to get a new token interactively
      const newResult = await chrome.identity.getAuthToken({
        interactive: true,
      });

      if (!newResult.token) {
        console.warn("AUTH_WARNING: Interactive token request failed");
        return null;
      }

      return newResult.token;
    }

    return result.token;
  } catch (error) {
    console.error("AUTH_ERROR: Failed to get auth token:", error);
    return null;
  }
}

async function uploadImageBytes(blob: Blob, token: string): Promise<string> {
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

  return uploadToken;
}

interface GooglePhotosMediaItem {
  id: string;
  productUrl: string;
  baseUrl: string;
  mimeType: string;
  filename: string;
}

async function createMediaItem(
  uploadToken: string,
  filename: string,
  token: string,
  albumId?: string
): Promise<GooglePhotosMediaItem> {
  const response = await fetch(
    "https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(albumId && { albumId }), // Add albumId to request body if provided
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

  return itemResult.mediaItem;
}
