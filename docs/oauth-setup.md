# OAuth 2.0 Setup Guide

This guide will help you set up Google OAuth 2.0 credentials for the Meme Photo extension.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project details:
   - **Project name**: `meme-photo-extension` (or your preferred name)
   - **Organization**: (leave default or select)
4. Click **Create**

## Step 2: Enable Google Photos Library API

1. In your project, go to **APIs & Services** → **Library**
2. Search for **"Google Photos Library API"**
3. Click on it and press **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type
3. Click **Create**
4. Fill in the required information:
   - **App name**: `Meme Photo`
   - **User support email**: Your email
   - **Developer contact email**: Your email
5. Click **Save and Continue**
6. In **Scopes** section, click **Add or Remove Scopes**
7. Add these scopes:
   ```
   https://www.googleapis.com/auth/photoslibrary.appendonly
   https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata
   https://www.googleapis.com/auth/userinfo.profile
   ```
8. Click **Update** → **Save and Continue**
9. Add test users (your Gmail account)
10. Click **Save and Continue**

## Step 4: Create OAuth 2.0 Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Select **Application type**: **Chrome Extension**
4. Enter **Name**: `Meme Photo Extension`
5. Enter **Item ID**: 
   - If published: Your Chrome Web Store extension ID
   - If local: Leave blank or use local extension ID (found in `chrome://extensions/`)
6. Click **Create**
7. **Copy the Client ID** (format: `xxxxx.apps.googleusercontent.com`)

## Step 5: Update manifest.json

1. Open `manifest.json` in your project
2. Find the `oauth2` section:
   ```json
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID_HERE.apps.googleusercontent.com",
     "scopes": [
       "https://www.googleapis.com/auth/photoslibrary.appendonly",
       "https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata",
       "https://www.googleapis.com/auth/userinfo.profile"
     ]
   }
   ```
3. Replace `YOUR_CLIENT_ID_HERE.apps.googleusercontent.com` with your actual Client ID
4. Save the file

## Step 6: Rebuild and Test

1. Rebuild the extension:
   ```bash
   npm run build
   ```

2. Reload the extension in Chrome:
   - Go to `chrome://extensions/`
   - Click the reload icon for Meme Photo

3. Test authentication:
   - Click the extension icon
   - Click "Sign In" or the authentication button
   - Complete the Google OAuth flow
   - Verify your profile appears

## Troubleshooting

### "Access blocked: This app's request is invalid"

- **Cause**: Invalid Client ID or Item ID mismatch
- **Solution**: 
  1. Double-check Client ID in manifest.json
  2. Verify Item ID matches your extension ID in Chrome
  3. Rebuild and reload extension

### "This app isn't verified"

- **Cause**: App in testing mode
- **Solution**: 
  1. Click "Advanced"
  2. Click "Go to [App Name] (unsafe)"
  3. This is normal for unpublished extensions

### Scopes not showing in consent screen

- **Cause**: OAuth consent screen not configured
- **Solution**: Revisit Step 3 and add all required scopes

### Token expires frequently

- **Cause**: Normal OAuth behavior
- **Solution**: The extension handles token refresh automatically via `chrome.identity` API

## Security Notes

> **Never commit your Client ID to public repositories**

- Use environment variables for sensitive data
- Add `manifest.json` to `.gitignore` if needed
- Rotate credentials if accidentally exposed

## Further Reading

- [Google Photos Library API Documentation](https://developers.google.com/photos/library/guides/overview)
- [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/identity/)
- [OAuth 2.0 for Extensions](https://developer.chrome.com/docs/extensions/mv3/tut_oauth/)
