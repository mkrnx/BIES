import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Error Boundary for debugging white screen
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: 'red', fontFamily: 'monospace' }}>
                    <h1>Something went wrong.</h1>
                    <h3>{this.state.error && this.state.error.toString()}</h3>
                    <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
                </div>
            );
        }

        return this.props.children;
    }
}

// Global error trap
window.onerror = function (message, source, lineno, colno, error) {
    const root = document.getElementById('root');
    if (root) {
        root.innerHTML += `
            <div style="color: red; padding: 20px; border: 1px solid red; margin: 20px; background: #fff0f0;">
                <h3>Global Error Caught</h3>
                <p><strong>Message:</strong> ${message}</p>
                <p><strong>Source:</strong> ${source}:${lineno}:${colno}</p>
                <p><strong>Error:</strong> ${error ? error.stack : 'N/A'}</p>
            </div>
        `;
    }
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>,
)
