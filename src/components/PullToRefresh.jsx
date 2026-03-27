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
    const pullDistanceRef = useRef(0);
    const refreshingRef = useRef(false);
    const onRefreshRef = useRef(onRefresh);

    useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
    useEffect(() => { refreshingRef.current = refreshing; }, [refreshing]);

    const doRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            if (onRefreshRef.current) {
                await onRefreshRef.current();
            } else {
                window.location.reload();
            }
        } catch {
            window.location.reload();
        }
        setTimeout(() => {
            setRefreshing(false);
            setPullDistance(0);
            pullDistanceRef.current = 0;
        }, 500);
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let isPulling = false;

        const onTouchStart = (e) => {
            if (refreshingRef.current) return;
            if (window.scrollY > 0) return;
            startY.current = e.touches[0].clientY;
            isPulling = true;
        };

        const onTouchMove = (e) => {
            if (!isPulling || refreshingRef.current) return;
            currentY.current = e.touches[0].clientY;
            const distance = currentY.current - startY.current;

            if (distance > 0 && window.scrollY <= 0) {
                const dampened = Math.min(distance * 0.5, MAX_PULL);
                pullDistanceRef.current = dampened;
                setPullDistance(dampened);
                setPulling(true);

                if (dampened > 10) {
                    e.preventDefault();
                }
            } else {
                pullDistanceRef.current = 0;
                setPulling(false);
                setPullDistance(0);
            }
        };

        const onTouchEnd = () => {
            if (!isPulling) return;
            isPulling = false;

            if (pullDistanceRef.current >= THRESHOLD && !refreshingRef.current) {
                doRefresh();
            } else {
                pullDistanceRef.current = 0;
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
    }, [doRefresh]);

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
