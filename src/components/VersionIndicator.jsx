import React, { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 30_000;

const VersionIndicator = () => {
    const [version, setVersion] = useState(null);
    const [flash, setFlash] = useState(false);
    const prevCommitRef = useRef(null);
    const flashTimerRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        let intervalId = null;

        const fetchVersion = async () => {
            try {
                const res = await fetch('/api/version');
                if (!res.ok || cancelled) return;
                const next = await res.json();
                if (cancelled || !next) return;

                const prev = prevCommitRef.current;
                if (prev && prev !== next.commitShort) {
                    setFlash(true);
                    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
                    flashTimerRef.current = setTimeout(() => setFlash(false), 2000);
                }
                prevCommitRef.current = next.commitShort;
                setVersion(next);
            } catch {
                /* non-critical */
            }
        };

        const startPolling = () => {
            if (intervalId) return;
            intervalId = setInterval(fetchVersion, POLL_INTERVAL_MS);
        };

        const stopPolling = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchVersion();
                startPolling();
            } else {
                stopPolling();
            }
        };

        fetchVersion();
        startPolling();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            cancelled = true;
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        };
    }, []);

    if (!version) return null;

    const handleCopy = () => {
        if (version.commit && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(version.commit).catch(() => {});
        }
    };

    const title = [
        version.commit,
        version.committedAt ? `Deployed ${version.committedAt}` : null,
        'Click to copy full SHA',
    ]
        .filter(Boolean)
        .join('\n');

    return (
        <>
            <div className="version-indicator">
                <button
                    className={`version-badge${flash ? ' flash' : ''}`}
                    title={title}
                    onClick={handleCopy}
                >
                    {version.branch} &middot; {version.commitShort}
                </button>
            </div>
            <style jsx>{`
                .version-indicator {
                    position: fixed;
                    bottom: 6px;
                    right: 10px;
                    z-index: 10;
                    pointer-events: none;
                    font-size: 10px;
                    font-family: 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
                    opacity: 0.5;
                    transition: opacity 0.2s;
                }
                .version-indicator:hover {
                    opacity: 1;
                }
                .version-badge {
                    pointer-events: auto;
                    padding: 2px 8px;
                    border-radius: 4px;
                    background: var(--color-neutral-dark, #0A192F);
                    color: var(--color-gray-400, #94A3B8);
                    border: 1px solid var(--color-gray-600, #475569);
                    cursor: pointer;
                    user-select: none;
                    transition: color 0.3s, border-color 0.3s;
                    line-height: 1.4;
                }
                .version-badge:hover {
                    color: var(--color-gray-200, #E2E8F0);
                }
                .version-badge.flash {
                    color: var(--color-primary, #0047AB);
                    border-color: var(--color-primary, #0047AB);
                }
            `}</style>
        </>
    );
};

export default VersionIndicator;
