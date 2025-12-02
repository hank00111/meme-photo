import { useState, useEffect } from 'react'
import '../styles/components.css'
import ErrorBoundary from '../components/ErrorBoundary'
import AuthOverlay from '../components/AuthOverlay'
import UserAvatar from '../components/UserAvatar'
import UploadHistory from '../components/UploadHistory'
import { getUserProfile, clearUserProfile } from '../utils/userProfile'
import { showError } from '../utils/toast'
import type { UserProfile } from '../types/storage'

function App() {
  const [isDevelopment, setIsDevelopment] = useState(false)
  const [version, setVersion] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)

  useEffect(() => {
    const manifest = chrome.runtime.getManifest()
    setIsDevelopment(!manifest.key)
    setVersion(manifest.version)
    checkAuthStatus()
  }, [])

  useEffect(() => {
    if (isAuthorized) {
      let ignore = false
      
      const loadProfile = async () => {
        setIsProfileLoading(true)
        try {
          const result = await chrome.identity.getAuthToken({ interactive: false })
          if (result.token && !ignore) {
            const profile = await getUserProfile(result.token)
            if (profile && !ignore) {
              setUserProfile(profile)
            }
          }
        } finally {
          if (!ignore) setIsProfileLoading(false)
        }
      }
      
      loadProfile()
      return () => { ignore = true }
    }
  }, [isAuthorized])

  const checkAuthStatus = async () => {
    try {
      // Check if user manually logged out
      const { isManuallyLoggedOut } = await chrome.storage.local.get('isManuallyLoggedOut')
      if (isManuallyLoggedOut) {
        setIsAuthorized(false)
        setIsAuthLoading(false)
        return
      }

      const result = await chrome.identity.getAuthToken({ interactive: false })
      if (result.token) {
        setIsAuthorized(true)
      }
    } catch (error) {
      console.log('Not authorized yet:', error)
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleAuthorize = async () => {
    setIsAuthLoading(true)
    try {
      // Clear manual logout flag
      await chrome.storage.local.remove('isManuallyLoggedOut')
      
      const result = await chrome.identity.getAuthToken({ interactive: true })
      if (result.token) {
        setIsAuthorized(true)
      }
    } catch (error) {
      console.error('Authorization failed:', error)
      showError('AUTH_FAILED')
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const result = await chrome.identity.getAuthToken({ interactive: false })
      if (result.token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${result.token}`, {
          method: 'POST'
        })
        console.log('AUTH: OAuth access revoked from Google Account')
      }
      await chrome.identity.clearAllCachedAuthTokens()
      console.log('AUTH: All cached tokens cleared')
      await clearUserProfile()
      await chrome.storage.local.set({ isManuallyLoggedOut: true })
      setUserProfile(null)
      setIsAuthorized(false)
      setIsAuthLoading(false)
    } catch (error) {
      console.error('AUTH: Logout failed:', error)
    }
  }

  const handleRefreshProfile = async () => {
    const result = await chrome.identity.getAuthToken({ interactive: false })
    if (result.token) {
      const profile = await getUserProfile(result.token, true)
      if (profile) setUserProfile(profile)
    }
  }

  const openSidePanel = async () => {
    try {
      const windowId = (await chrome.windows.getCurrent()).id
      if (windowId) {
        await chrome.sidePanel.open({ windowId })
      }
    } catch (error) {
      console.error('Error opening side panel:', error)
    }
  }

  return (
    <ErrorBoundary>
      <div className="app-container">
        {!isAuthorized ? (
          <AuthOverlay 
            onAuthorize={handleAuthorize} 
            isLoading={isAuthLoading} 
          />
        ) : (
          <>
            {/* Header */}
            <header className="app-header">
            <div className="header-content">
              <UserAvatar 
                userProfile={userProfile}
                onRefresh={handleRefreshProfile}
                isLoading={isProfileLoading}
              />
              <h1 className="app-title">Meme Photo</h1>
              <button className="btn-side-panel" onClick={openSidePanel}>
                Open Side Panel
              </button>
            </div>
            {isDevelopment && (
              <div className="dev-section">
                <button 
                  className="btn-test-auth"
                  onClick={handleLogout}
                  style={{ backgroundColor: '#ff9800' }}
                >
                  Logout
                </button>
              </div>
            )}
          </header>

          {/* Content */}
          <main className="app-content">
            <UploadHistory />
          </main>

          {/* Footer */}
          <footer className="app-footer">
            <span className="version">Version {version}</span>
            <button className="btn-donate">Donate ❤️</button>
          </footer>
        </>
      )}
      </div>
    </ErrorBoundary>
  )
}

export default App
