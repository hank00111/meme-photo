import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState<string>('Ready')
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    const manifest = chrome.runtime.getManifest()
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

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '20px',
        boxSizing: 'border-box'
      }}>
        <h1>Meme Photo Side Panel</h1>
        <p>Google Photos Upload Tool - Full Interface</p>
        
        <div style={{ marginTop: '20px' }}>
          <h2>Authentication</h2>
          <button 
            onClick={testAuth}
            disabled={loading}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              backgroundColor: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              width: '100%'
            }}
          >
            {loading ? 'Testing...' : 'Test OAuth Authentication'}
          </button>
        </div>
        
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
          <strong>Status:</strong> {status}
        </div>
        
        <div style={{ marginTop: '20px' }}>
          <h2>Features</h2>
          <div style={{ fontSize: '14px', color: '#666' }}>
            <p>Side Panel advantages:</p>
            <ul style={{ textAlign: 'left', paddingLeft: '20px' }}>
              <li>Stays open while browsing</li>
              <li>More space for album lists and upload progress</li>
              <li>Better for development with HMR</li>
              <li>Independent from page interactions</li>
            </ul>
          </div>
          
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
            <h3 style={{ marginTop: 0 }}>Coming Soon</h3>
            <ul style={{ textAlign: 'left', paddingLeft: '20px', fontSize: '14px' }}>
              <li>Album list and selection</li>
              <li>Image upload with progress tracking</li>
              <li>Batch upload support</li>
              <li>Upload history</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style={{ 
        padding: '12px 20px', 
        borderTop: '1px solid #ddd', 
        backgroundColor: '#f9f9f9',
        fontSize: '12px', 
        color: '#666',
        flexShrink: 0
      }}>
        <div style={{ marginBottom: '4px' }}>
          Check Service Worker Console for detailed logs
        </div>
        <div style={{ color: '#999', fontSize: '11px' }}>
          Version {version}
        </div>
      </div>
    </div>
  )
}

export default App
