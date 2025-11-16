console.log('INFO: Meme Photo extension loaded');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('INFO: Extension installed:', details.reason);
  
  chrome.storage.local.set({
    installedAt: new Date().toISOString()
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('INFO: Extension started');
});

// Test OAuth authentication
async function testAuth() {
  try {
    console.log('AUTH: Starting OAuth authentication test...');
    
    // Step 1: Clear any cached tokens to force fresh authentication
    console.log('AUTH: Clearing cached tokens...');
    try {
      const cachedResult = await chrome.identity.getAuthToken({ interactive: false });
      if (cachedResult.token) {
        await chrome.identity.removeCachedAuthToken({ token: cachedResult.token });
        console.log('AUTH: Cached token removed successfully');
      }
    } catch (e) {
      console.log('AUTH: No cached token to remove');
    }
    
    // Step 2: Request new token with interactive consent
    console.log('AUTH: Requesting new access token with interactive consent...');
    const result = await chrome.identity.getAuthToken({ interactive: true });
    
    if (chrome.runtime.lastError) {
      console.error('AUTH_ERROR: Authentication failed:', chrome.runtime.lastError);
      return;
    }
    
    if (!result.token) {
      console.error('AUTH_ERROR: Failed to obtain access token');
      return;
    }
    
    const token = result.token;
    console.log('AUTH: Successfully obtained access token');
    console.log('Token length:', token.length);
    console.log('Token prefix:', token.substring(0, 20) + '...');
    
    // Step 3: Log granted scopes
    if (result.grantedScopes) {
      console.log('AUTH: Granted scopes:', result.grantedScopes.join(', '));
      
      // Check if we have the required scope
      const requiredScope = 'https://www.googleapis.com/auth/photoslibrary.appendonly';
      const hasRequiredScope = result.grantedScopes.some(scope => 
        scope === requiredScope || scope.startsWith('https://www.googleapis.com/auth/photoslibrary')
      );
      
      if (!hasRequiredScope) {
        console.error('AUTH_ERROR: Missing required scope:', requiredScope);
        console.error('AUTH_ERROR: This usually means the OAuth consent screen is not configured correctly');
        console.error('AUTH_ERROR: Please check Google Cloud Console OAuth configuration');
        return;
      }
      
      console.log('AUTH: Required scope verified - photoslibrary.appendonly scope is granted');
    } else {
      console.warn('AUTH_WARNING: No granted scopes information available');
    }
    
    // Authentication successful - ready to use API
    console.log('AUTH_SUCCESS: OAuth authentication completed successfully');
    console.log('AUTH_SUCCESS: Token is ready for Google Photos API calls');
    console.log('');
    console.log('IMPORTANT: Google Photos API Usage Notes:');
    console.log('  - Using photoslibrary.appendonly scope');
    console.log('  - Can upload images via POST to /v1/uploads endpoint');
    console.log('  - Can create media items via /v1/mediaItems:batchCreate');
    console.log('  - Can create and manage app-created albums');
    console.log('  - Cannot list user albums (use Picker API for album selection)');
    
  } catch (error) {
    console.error('AUTH_ERROR: Authentication process error:', error);
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'testAuth') {
    testAuth().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open
  }
});
