console.log('✅ Meme Photo extension loaded');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('📦 Extension installed:', details.reason);
  
  chrome.storage.local.set({
    installedAt: new Date().toISOString()
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('🚀 Extension started');
});
