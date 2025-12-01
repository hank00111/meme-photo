interface AuthOverlayProps {
  onAuthorize: () => void;
  isLoading?: boolean;
}

export default function AuthOverlay({ onAuthorize, isLoading = false }: AuthOverlayProps) {
  return (
    <div className="auth-overlay">
      <div className="auth-overlay-content">
        <h2>Welcome to Meme Photo</h2>
        <p>Please authorize access to your Google Photos to start using the extension</p>
        
        <button 
          className="btn-authorize" 
          onClick={onAuthorize}
          disabled={isLoading}
        >
          {isLoading ? 'Authorizing...' : 'Authorize Google Photos'}
        </button>
        
        <p className="privacy-notice">
          We only access photos you authorize for upload. We do not read your existing albums.
        </p>
      </div>
    </div>
  );
}
