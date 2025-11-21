import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        // Apply error-message styling for consistency
        <div className="error-message" style={{ display: 'block', padding: '20px', borderRadius: '8px' }}>
          <h3>⚠️ Something Went Terribly Wrong</h3>
          <p>{this.state.error?.message || 'An unrecoverable error occurred in the UI.'}</p>
          <button onClick={() => window.location.reload()} className="primary-button" style={{ marginTop: '10px' }}>
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;