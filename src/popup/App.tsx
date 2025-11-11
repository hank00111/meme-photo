import { useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState<string>('Not tested yet')
  const [loading, setLoading] = useState(false)

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
    <div style={{ padding: '20px', minWidth: '300px' }}>
      <h1>Meme Photo</h1>
      <p>Google Photos Upload Tool</p>
      
      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={testAuth}
          disabled={loading}
          style={{
            padding: '10px 20px',
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

      <div style={{ marginTop: '10px' }}>
        <button 
          onClick={openSidePanel}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: 'pointer',
            backgroundColor: '#34a853',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            width: '100%'
          }}
        >
          Open Side Panel
        </button>
      </div>
      
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <strong>Status:</strong> {status}
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <p>Tips:</p>
        <ul style={{ textAlign: 'left', paddingLeft: '20px' }}>
          <li>Click to test OAuth authentication</li>
          <li>Open Side Panel for full interface</li>
          <li>Check Service Worker Console for logs</li>
        </ul>
      </div>
    </div>
  )
}

export default App
