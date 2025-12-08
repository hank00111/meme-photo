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
      await clearThumbnailCache()
      console.log('AUTH: Thumbnail cache cleared')
      await clearAlbumCache()
      console.log('AUTH: Album cache cleared')
      await clearUploadHistory()
      console.log('AUTH: Upload history cleared')
      await chrome.storage.sync.remove('selectedAlbumId')
      console.log('AUTH: Selected album ID cleared')
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
