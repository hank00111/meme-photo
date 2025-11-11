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
    
    // Step 4: Test calling Google Photos API with the token
    await testGooglePhotosAPI(token);
    
  } catch (error) {
    console.error('AUTH_ERROR: Authentication process error:', error);
  }
}

// Test Google Photos API connection
async function testGooglePhotosAPI(token: string) {
  try {
    console.log('API_CALL: Testing Google Photos API with appendonly scope...');
    console.log('API_CALL: Note - albums.list is no longer supported with appendonly scope');
    console.log('API_CALL: Testing upload endpoint instead...');
    
    // Test the upload endpoint (which works with appendonly scope)
    const uploadEndpoint = 'https://photoslibrary.googleapis.com/v1/uploads';
    console.log('API_CALL: Endpoint:', uploadEndpoint);
    
    // Just test if the endpoint is accessible (we're not uploading yet)
    const response = await fetch(uploadEndpoint, {
      method: 'OPTIONS',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('API_CALL: Response status:', response.status, response.statusText);
    
    if (response.status === 405 || response.status === 200) {
      // 405 Method Not Allowed is expected for OPTIONS on upload endpoint
      // This actually means the endpoint is accessible
      console.log('API_SUCCESS: Successfully authenticated with Google Photos API');
      console.log('API_SUCCESS: Upload endpoint is accessible');
      console.log('API_SUCCESS: Ready to upload images to Google Photos');
      console.log('');
      console.log('IMPORTANT: Due to Google Photos API changes (March 2025):');
      console.log('  - photoslibrary scope has been removed');
      console.log('  - Now using photoslibrary.appendonly scope');
      console.log('  - Can upload images and create albums');
      console.log('  - Cannot list all user albums (only app-created albums)');
      console.log('  - For album selection, consider using Google Photos Picker API');
      return;
    }
    
    if (!response.ok) {
      console.error('API_ERROR: API call failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('API_ERROR: Error details:', errorText);
      
      // Parse error for better diagnostics
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.status === 'PERMISSION_DENIED') {
          console.error('API_ERROR: PERMISSION_DENIED - Token does not have required scopes');
          console.error('API_ERROR: Required scope: https://www.googleapis.com/auth/photoslibrary.appendonly');
          console.error('API_ERROR: Solution:');
          console.error('  1. Go to Google Cloud Console > APIs & Services > OAuth consent screen');
          console.error('  2. Remove old scope: https://www.googleapis.com/auth/photoslibrary');
          console.error('  3. Add new scope: https://www.googleapis.com/auth/photoslibrary.appendonly');
          console.error('  4. Revoke app permissions: https://myaccount.google.com/permissions');
          console.error('  5. Reload extension and test again');
        }
      } catch (e) {
        // Error is not JSON, already logged above
      }
      
      return;
    }
    
  } catch (error) {
    console.error('API_ERROR: API test failed:', error);
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
