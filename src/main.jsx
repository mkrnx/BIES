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
        const div = document.createElement('div');
        div.style.cssText = 'color: red; padding: 20px; border: 1px solid red; margin: 20px; background: #fff0f0;';

        const h3 = document.createElement('h3');
        h3.textContent = 'Global Error Caught';
        div.appendChild(h3);

        const pMsg = document.createElement('p');
        pMsg.innerHTML = '<strong>Message:</strong> ';
        pMsg.appendChild(document.createTextNode(String(message)));
        div.appendChild(pMsg);

        const pSrc = document.createElement('p');
        pSrc.innerHTML = '<strong>Source:</strong> ';
        pSrc.appendChild(document.createTextNode(`${source}:${lineno}:${colno}`));
        div.appendChild(pSrc);

        const pErr = document.createElement('p');
        pErr.innerHTML = '<strong>Error:</strong> ';
        pErr.appendChild(document.createTextNode(error ? error.stack : 'N/A'));
        div.appendChild(pErr);

        root.appendChild(div);
    }
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>,
)
