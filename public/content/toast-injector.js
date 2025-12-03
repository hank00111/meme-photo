(() => {
  // src/utils/toastContentScript.ts
  function showToast(message, type = "info", options = {}) {
    const { duration = 3e3, toastId } = options;
    let container = document.getElementById("meme-photo-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "meme-photo-toast-container";
      document.body.appendChild(container);
    }
    if (toastId) {
      const existingToast = container.querySelector(`[data-toast-id="${toastId}"]`);
      if (existingToast) {
        existingToast.remove();
      }
    }
    const toast = document.createElement("div");
    toast.className = `meme-photo-toast meme-photo-toast-${type}`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "polite");
    if (toastId) {
      toast.setAttribute("data-toast-id", toastId);
    }
    if (type === "loading") {
      const spinner = document.createElement("span");
      spinner.className = "meme-photo-toast-spinner";
      toast.appendChild(spinner);
      const messageSpan = document.createElement("span");
      messageSpan.textContent = message;
      toast.appendChild(messageSpan);
    } else {
      toast.textContent = message;
    }
    container.appendChild(toast);
    void toast.offsetWidth;
    toast.classList.add("meme-photo-toast-visible");
    if (duration > 0 && type !== "loading") {
      setTimeout(() => {
        removeToastElement(toast, container);
      }, duration);
    }
  }
  function removeToastElement(toast, container) {
    toast.classList.remove("meme-photo-toast-visible");
    toast.classList.add("meme-photo-toast-hiding");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      if (container && container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }
  function dismissToast(toastId) {
    const container = document.getElementById("meme-photo-toast-container");
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
  function showLoading(message, toastId, failsafeTimeout = 3e4) {
    showToast(message, "loading", { duration: 0, toastId });
    if (failsafeTimeout > 0) {
      setTimeout(() => {
        dismissToast(toastId);
      }, failsafeTimeout);
    }
  }

  // src/content/toast-injector.ts
  if (window.__memePhotoToastInitialized) {
    console.log("[Meme Photo] Toast injector already initialized, skipping duplicate registration");
  } else {
    window.__memePhotoToastInitialized = true;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === "showToast") {
        const type = message.type;
        const toastId = message.toastId;
        if (type === "loading" && toastId) {
          showLoading(message.message, toastId);
        } else {
          showToast(message.message, type, { toastId });
        }
        sendResponse({ success: true });
        return true;
      }
      if (message.action === "dismissToast") {
        const toastId = message.toastId;
        if (toastId) {
          const dismissed = dismissToast(toastId);
          sendResponse({ success: true, dismissed });
        } else {
          sendResponse({ success: false, error: "Missing toastId" });
        }
        return true;
      }
      return false;
    });
    console.log("[Meme Photo] Toast injector initialized successfully");
  }
})();
