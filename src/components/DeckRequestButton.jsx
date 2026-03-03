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
            } catch {
                // No deck or not requested yet — stay IDLE
            }
        };
        checkDeckStatus();
    }, [projectId]);

    const handleRequest = async () => {
        setState(STATES.REQUESTING);
        try {
            const result = await projectsApi.getDeck(projectId);
            if (result?.url) {
                setState(STATES.DOWNLOAD);
                setDeckUrl(result.url);
            } else {
                // Request access
                const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
                const token = localStorage.getItem('bies_token');
                const res = await fetch(`${BASE_URL}/projects/${projectId}/deck/request`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });
                if (res.ok) {
                    setState(STATES.PENDING);
                } else {
                    setState(STATES.IDLE);
                }
            }
        } catch {
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
                    background: white;
                    color: var(--color-gray-500);
                    border: 1px solid var(--color-gray-300);
                }
            `}</style>
        </>
    );
};

export default DeckRequestButton;
