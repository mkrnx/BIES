import React, { useState, useRef, useCallback, useEffect } from 'react';

const THRESHOLD = 80;
const MAX_PULL = 120;

const PullToRefresh = ({ children, onRefresh }) => {
    const [pulling, setPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const startY = useRef(0);
    const currentY = useRef(0);
    const containerRef = useRef(null);

    const isAtTop = useCallback(() => {
        return window.scrollY <= 0;
    }, []);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            if (onRefresh) {
                await onRefresh();
            } else {
                window.location.reload();
            }
        } catch {
            // fallback reload on error
            window.location.reload();
        }
        // If onRefresh didn't reload, reset state after a delay
        setTimeout(() => {
            setRefreshing(false);
            setPullDistance(0);
        }, 500);
    }, [onRefresh]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let isPulling = false;

        const onTouchStart = (e) => {
            if (refreshing) return;
            if (!isAtTop()) return;
            startY.current = e.touches[0].clientY;
            isPulling = true;
        };

        const onTouchMove = (e) => {
            if (!isPulling || refreshing) return;
            currentY.current = e.touches[0].clientY;
            const distance = currentY.current - startY.current;

            if (distance > 0 && isAtTop()) {
                // Apply resistance curve
                const dampened = Math.min(distance * 0.5, MAX_PULL);
                setPullDistance(dampened);
                setPulling(true);

                if (dampened > 10) {
                    e.preventDefault();
                }
            } else {
                setPulling(false);
                setPullDistance(0);
            }
        };

        const onTouchEnd = () => {
            if (!isPulling) return;
            isPulling = false;

            if (pullDistance >= THRESHOLD && !refreshing) {
                handleRefresh();
            } else {
                setPulling(false);
                setPullDistance(0);
            }
        };

        container.addEventListener('touchstart', onTouchStart, { passive: true });
        container.addEventListener('touchmove', onTouchMove, { passive: false });
        container.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', onTouchStart);
            container.removeEventListener('touchmove', onTouchMove);
            container.removeEventListener('touchend', onTouchEnd);
        };
    }, [isAtTop, refreshing, pullDistance, handleRefresh]);

    const progress = Math.min(pullDistance / THRESHOLD, 1);
    const rotation = progress * 360;
    const showIndicator = pulling || refreshing;

    return (
        <div ref={containerRef} className="pull-to-refresh-container">
            <div
                className="ptr-indicator"
                style={{
                    height: showIndicator ? `${Math.max(pullDistance, refreshing ? 50 : 0)}px` : '0px',
                    opacity: showIndicator ? 1 : 0,
                    transition: pulling ? 'none' : 'height 0.3s ease, opacity 0.3s ease',
                }}
            >
                <div
                    className={`ptr-spinner ${refreshing ? 'ptr-spinning' : ''}`}
                    style={{
                        transform: refreshing ? undefined : `rotate(${rotation}deg)`,
                        opacity: progress,
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                </div>
            </div>
            {children}

            <style jsx>{`
                .pull-to-refresh-container {
                    position: relative;
                    min-height: 100%;
                }
                .ptr-indicator {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    width: 100%;
                    color: var(--color-primary, #0047AB);
                }
                .ptr-spinner {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--color-gray-100, #F1F5F9);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .ptr-spinning {
                    animation: ptr-spin 0.8s linear infinite;
                }
                @keyframes ptr-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @media (min-width: 769px) {
                    .ptr-indicator {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default PullToRefresh;
