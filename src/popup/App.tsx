import { useState, useEffect } from 'react'
import '../styles/components.css'

function App() {
  const [status, setStatus] = useState<string>('Not tested yet')
  const [loading, setLoading] = useState(false)
  const [isDevelopment, setIsDevelopment] = useState(false)
  const [version, setVersion] = useState('')

  useEffect(() => {
    const manifest = chrome.runtime.getManifest()
    setIsDevelopment(!manifest.key)
    setVersion(manifest.version)
  }, [])

  const testAuth = async () => {
    setLoading(true)
    setStatus('Running authentication test...')
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'testAuth' })
      
      if (response.success) {
        setStatus('Authentication test successful! Check Service Worker Console')
      } else {
        setStatus('Authentication test failed: ' + response.error)
      }
    } catch (error) {
      setStatus('Error occurred: ' + (error as Error).message);
    } finally {
      setLoading(false)
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
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="avatar-placeholder"></div>
          <h1 className="app-title">Meme Photo</h1>
          <button className="btn-side-panel" onClick={openSidePanel}>
            Open Side Panel
          </button>
        </div>
        {isDevelopment && (
          <div className="dev-section">
            <button 
              className="btn-test-auth"
              onClick={testAuth}
              disabled={loading}
            >
              {loading ? 'Testing...' : 'Test OAuth Authentication'}
            </button>
            <div className="test-status">
              <strong>Status:</strong> {status}
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="app-content">
        <div className="upload-history">
          <p className="empty-state">Upload history will appear here</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <span className="version">Version {version}</span>
        <button className="btn-donate">Donate ❤️</button>
      </footer>
    </div>
  )
}

export default App
