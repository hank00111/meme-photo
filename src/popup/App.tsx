import { useState, useEffect } from 'react'
import '../styles/components.css'
import ErrorBoundary from '../components/ErrorBoundary'
import AuthOverlay from '../components/AuthOverlay'
import UserAvatar from '../components/UserAvatar'
import AlbumSelector from '../components/AlbumSelector'
import AlbumSelectorModal from '../components/AlbumSelectorModal'
import UploadHistory from '../components/UploadHistory'
import { getUserProfile, clearUserProfile } from '../utils/userProfile'
import { clearThumbnailCache } from '../utils/thumbnailCache'
import { clearAlbumCache } from '../utils/albumCache'
import { clearUploadHistory } from '../utils/uploadHistory'
import { showError } from '../utils/toast'
import type { UserProfile } from '../types/storage'

function App() {
  const [version, setVersion] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    const manifest = chrome.runtime.getManifest()
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
    } catch {
      // Silent failure - user not authorized yet
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleAuthorize = async () => {
    setIsAuthLoading(true)
    try {
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
        const revokeResponse = await fetch(`https://oauth2.googleapis.com/revoke?token=${result.token}`, {
          method: 'POST'
        })
        if (revokeResponse.ok) {
          // Token revoked successfully
        } else {
          console.warn('AUTH: Token revocation may have failed:', revokeResponse.status)
        }
      }
      await chrome.identity.clearAllCachedAuthTokens();
      await clearUserProfile();
      await clearThumbnailCache();
      await clearAlbumCache();
      await clearUploadHistory();
      await chrome.storage.sync.remove('selectedAlbumId');
      await chrome.storage.local.set({ isManuallyLoggedOut: true });
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

  const handleConfigureAlbum = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
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
            <header className="app-header">
              <div className="header-content">
                <h1 className="app-title">Meme Photo</h1>
                <UserAvatar 
                  userProfile={userProfile}
                  onRefresh={handleRefreshProfile}
                  isLoading={isProfileLoading}
                  onLogout={handleLogout}
                />
              </div>
            </header>

          <AlbumSelector onConfigureClick={handleConfigureAlbum} />

          <main className="app-content">
            <UploadHistory />
          </main>

          <footer className="app-footer">
            <span className="version">v{version}</span>
            {/* <button className="btn-donate">Donate ❤️</button> */}
          </footer>

          <AlbumSelectorModal 
            isOpen={isModalOpen}
            onClose={handleCloseModal}
          />
        </>
      )}
      </div>
    </ErrorBoundary>
  )
}

export default App
