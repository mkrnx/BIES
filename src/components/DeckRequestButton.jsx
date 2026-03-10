import React, { useState, useEffect } from 'react';
import { Download, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { projectsApi } from '../services/api';

const STATES = {
    IDLE: 'idle',
    REQUESTING: 'requesting',
    PENDING: 'pending',
    APPROVED: 'approved',
    DOWNLOAD: 'download',
};

const DeckRequestButton = ({ projectId, className = '' }) => {
    const [state, setState] = useState(STATES.IDLE);
    const [deckUrl, setDeckUrl] = useState(null);
    const [showDeckModal, setShowDeckModal] = useState(false);
    const [customMessage, setCustomMessage] = useState('');
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

    useEffect(() => {
        const checkDeckStatus = async () => {
            try {
                const result = await projectsApi.getDeck(projectId);
                if (result?.status === 'approved' && result?.url) {
                    setState(STATES.DOWNLOAD);
                    setDeckUrl(result.url);
                } else if (result?.status === 'pending') {
                    setState(STATES.PENDING);
                } else if (result?.url) {
                    // Public deck, no request needed
                    setState(STATES.DOWNLOAD);
                    setDeckUrl(result.url);
                }
            } catch (err) {
                if (err?.data?.requestStatus === 'PENDING') {
                    setState(STATES.PENDING);
                }
            }
        };
        checkDeckStatus();
    }, [projectId]);

    const handleRequest = async () => {
        // First check if a request is actually needed by calling getDeck
        setState(STATES.REQUESTING);
        try {
            const result = await projectsApi.getDeck(projectId);
            if (result?.url) {
                setState(STATES.DOWNLOAD);
                setDeckUrl(result.url);
            } else {
                // It requires a formal request, so open the modal
                setState(STATES.IDLE);
                setShowDeckModal(true);
                setShowSuccessAnimation(false);
                setCustomMessage('');
            }
        } catch (err) {
            if (err?.data?.requestStatus === 'PENDING') {
                setState(STATES.PENDING);
            } else {
                setState(STATES.IDLE);
                setShowDeckModal(true);
                setShowSuccessAnimation(false);
                setCustomMessage('');
            }
        }
    };

    const confirmDeckRequest = async () => {
        setState(STATES.REQUESTING);
        try {
            await projectsApi.requestDeck(projectId, { message: customMessage });
            setShowSuccessAnimation(true);
            setTimeout(() => {
                setShowDeckModal(false);
                setShowSuccessAnimation(false);
                setState(STATES.PENDING);
            }, 2000);
        } catch (err) {
            alert(err?.data?.error || 'Failed to request deck access. Please try again.');
            setState(STATES.IDLE);
        }
    };

    const handleDownload = () => {
        if (deckUrl && (deckUrl.startsWith('https://') || deckUrl.startsWith('http://') || deckUrl.startsWith('/'))) {
            window.open(deckUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const config = {
        [STATES.IDLE]: {
            icon: <Download size={16} />,
            label: 'Request Pitch Deck',
            onClick: handleRequest,
            style: 'btn-secondary',
        },
        [STATES.REQUESTING]: {
            icon: <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />,
            label: 'Requesting...',
            onClick: null,
            style: 'btn-secondary',
            disabled: true,
        },
        [STATES.PENDING]: {
            icon: <Clock size={16} />,
            label: 'Request Pending',
            onClick: null,
            style: 'btn-outline',
            disabled: true,
        },
        [STATES.DOWNLOAD]: {
            icon: <Download size={16} />,
            label: 'Download Deck',
            onClick: handleDownload,
            style: 'btn-primary',
        },
    };

    const current = config[state];

    return (
        <>
            <button
                className={`deck-request-btn ${current.style} ${className}`}
                onClick={current.onClick}
                disabled={current.disabled}
            >
                {current.icon}
                <span style={{ marginLeft: 6 }}>{current.label}</span>
            </button>

            {/* Deck Request Modal */}
            {showDeckModal && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        {showSuccessAnimation ? (
                            <div className="success-animation-container">
                                <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                                    <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                                    <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                                </svg>
                                <h3>Request Sent!</h3>
                                <p>The builder has been notified.</p>
                            </div>
                        ) : (
                            <>
                                <div className="modal-header">
                                    <h2 className="modal-title">Request Pitch Deck</h2>
                                </div>
                                <div className="modal-body">
                                    <p style={{ margin: 0, color: 'var(--color-gray-600)', lineHeight: '1.5', marginBottom: '1rem' }}>
                                        Would you like to request access to the pitch deck? The Builder will be notified immediately.
                                    </p>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-gray-600)', marginBottom: '0.4rem' }}>
                                        Add a message (optional)
                                    </label>
                                    <textarea
                                        value={customMessage}
                                        onChange={(e) => setCustomMessage(e.target.value)}
                                        placeholder="Hi, I'm interested in learning more about your project..."
                                        style={{
                                            width: '100%',
                                            minHeight: '80px',
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            border: '1px solid #d1d5db',
                                            fontSize: '0.95rem',
                                            fontFamily: 'inherit',
                                            resize: 'vertical',
                                            marginBottom: '1rem'
                                        }}
                                    />
                                </div>
                                <div className="modal-footer" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                    <button
                                        className="btn btn-outline"
                                        style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'transparent', cursor: 'pointer' }}
                                        onClick={() => setShowDeckModal(false)}
                                        disabled={state === STATES.REQUESTING}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        onClick={confirmDeckRequest}
                                        disabled={state === STATES.REQUESTING}
                                    >
                                        {state === STATES.REQUESTING ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Send Request'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                .deck-request-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    padding: 0.75rem 1.5rem;
                    border-radius: var(--radius-full);
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                }
                .deck-request-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                .deck-request-btn.btn-primary {
                    background: var(--color-primary);
                    color: white;
                }
                .deck-request-btn.btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
                .deck-request-btn.btn-secondary {
                    background: var(--color-secondary);
                    color: white;
                }
                .deck-request-btn.btn-secondary:hover:not(:disabled) { filter: brightness(1.1); }
                .deck-request-btn.btn-outline {
                    background: var(--color-surface);
                    color: var(--color-gray-500);
                    border: 1px solid var(--color-gray-300);
                }

                /* Modal & Animations (Same as ProjectDetails) */
                .modal-backdrop {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center; z-index: 9999;
                    animation: fadeIn 0.2s ease-out;
                }
                .modal-content {
                    background: var(--color-surface); border-radius: 16px; padding: 2rem;
                    width: 90%; max-width: 440px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
                    animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    text-align: left;
                }
                .modal-header { margin-bottom: 1rem; }
                .modal-title { font-size: 1.25rem; font-weight: 700; color: var(--color-gray-900); margin: 0; }
                .success-animation-container {
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    text-align: center; padding: 1rem 0;
                }
                .success-animation-container h3 { margin: 1rem 0 0.5rem; font-size: 1.25rem; color: var(--color-gray-900); }
                .success-animation-container p { margin: 0; color: var(--color-gray-500); font-size: 0.95rem; }

                /* Checkmark SVG Animation */
                .checkmark { width: 56px; height: 56px; border-radius: 50%; display: block; stroke-width: 2; stroke: #fff; stroke-miterlimit: 10; margin: 0 auto; box-shadow: inset 0px 0px 0px var(--color-success, #22c55e); animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both; }
                .checkmark-circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 2; stroke-miterlimit: 10; stroke: var(--color-success, #22c55e); fill: none; animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
                .checkmark-check { transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards; }
                
                @keyframes stroke { 100% { stroke-dashoffset: 0; } }
                @keyframes scale { 0%, 100% { transform: none; } 50% { transform: scale3d(1.1, 1.1, 1); } }
                @keyframes fill { 100% { box-shadow: inset 0px 0px 0px 30px var(--color-success, #22c55e); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleUp { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                
                textarea:focus { outline: none; border-color: var(--color-primary) !important; box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2); }
            `}</style>
        </>
    );
};

export default DeckRequestButton;
