import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const LightboxContext = createContext();

export const useLightbox = () => useContext(LightboxContext);

export const LightboxProvider = ({ children }) => {
    const [src, setSrc] = useState(null);
    const [gallery, setGallery] = useState([]);
    const [index, setIndex] = useState(0);
    const imgRef = useRef(null);

    const open = useCallback((imageSrc, imageGallery = []) => {
        setSrc(imageSrc);
        setGallery(imageGallery);
        setIndex(imageGallery.length > 0 ? imageGallery.indexOf(imageSrc) : 0);
    }, []);

    const close = useCallback(() => {
        setSrc(null);
        setGallery([]);
        setIndex(0);
    }, []);

    const prev = useCallback(() => {
        if (gallery.length < 2) return;
        const i = (index - 1 + gallery.length) % gallery.length;
        setIndex(i);
        setSrc(gallery[i]);
    }, [gallery, index]);

    const next = useCallback(() => {
        if (gallery.length < 2) return;
        const i = (index + 1) % gallery.length;
        setIndex(i);
        setSrc(gallery[i]);
    }, [gallery, index]);

    /* Lock body scroll while lightbox is open — prevents touch events from being
       consumed by page scrolling on mobile. */
    useEffect(() => {
        if (!src) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [src]);

    /* Keyboard navigation */
    useEffect(() => {
        if (!src) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [src, close, prev, next]);

    /* Pinch-to-zoom (mobile), double-tap zoom (mobile), pan when zoomed (mobile),
       and scroll-wheel zoom (desktop). All handled via native event listeners on the
       <img> element so we can call preventDefault() on touch/wheel events. */
    useEffect(() => {
        const img = imgRef.current;
        if (!img) return;

        let scale = 1, posX = 0, posY = 0;
        let startDist = 0, startScale = 1;
        let panX = 0, panY = 0, panPosX = 0, panPosY = 0;
        let pinching = false, lastTap = 0;

        const apply = () => {
            img.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        };
        apply(); // reset on image change

        const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

        const onTouchStart = (e) => {
            if (e.touches.length === 2) {
                pinching = true;
                startDist = dist(e.touches[0], e.touches[1]);
                startScale = scale;
                e.preventDefault();
            } else if (e.touches.length === 1) {
                const now = Date.now();
                if (now - lastTap < 300) {
                    e.preventDefault();
                    scale = scale > 1 ? 1 : 2.5;
                    if (scale === 1) { posX = 0; posY = 0; }
                    apply();
                    lastTap = 0;
                    return;
                }
                lastTap = now;
                if (scale > 1) {
                    panX = e.touches[0].clientX;
                    panY = e.touches[0].clientY;
                    panPosX = posX;
                    panPosY = posY;
                }
            }
        };

        const onTouchMove = (e) => {
            if (pinching && e.touches.length === 2) {
                e.preventDefault();
                const d = dist(e.touches[0], e.touches[1]);
                scale = Math.min(Math.max(startScale * (d / startDist), 1), 5);
                if (scale <= 1) { posX = 0; posY = 0; }
                apply();
            } else if (!pinching && e.touches.length === 1 && scale > 1) {
                e.preventDefault();
                posX = panPosX + (e.touches[0].clientX - panX);
                posY = panPosY + (e.touches[0].clientY - panY);
                apply();
            }
        };

        const onTouchEnd = (e) => {
            if (e.touches.length < 2) pinching = false;
        };

        const onWheel = (e) => {
            e.preventDefault();
            scale = Math.min(Math.max(scale * (e.deltaY > 0 ? 0.9 : 1.1), 1), 5);
            if (scale <= 1) { posX = 0; posY = 0; }
            apply();
        };

        img.addEventListener('touchstart', onTouchStart, { passive: false });
        img.addEventListener('touchmove', onTouchMove, { passive: false });
        img.addEventListener('touchend', onTouchEnd);
        img.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            img.removeEventListener('touchstart', onTouchStart);
            img.removeEventListener('touchmove', onTouchMove);
            img.removeEventListener('touchend', onTouchEnd);
            img.removeEventListener('wheel', onWheel);
        };
    }, [src, index]);

    return (
        <LightboxContext.Provider value={{ open }}>
            {children}
            {src && (
                <div
                    data-testid="lightbox-overlay"
                    onClick={close}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.95)', zIndex: 999999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', touchAction: 'manipulation',
                    }}
                >
                    <button
                        data-testid="lightbox-close"
                        onClick={(e) => { e.stopPropagation(); close(); }}
                        style={{
                            position: 'absolute', top: 'max(env(safe-area-inset-top, 0.75rem), 0.75rem)', right: '0.75rem',
                            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                            width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', cursor: 'pointer', fontSize: '1.5rem', zIndex: 10,
                            touchAction: 'manipulation',
                        }}
                    >
                        ✕
                    </button>
                    {gallery.length > 1 && (
                        <button
                            data-testid="lightbox-prev"
                            onClick={(e) => { e.stopPropagation(); prev(); }}
                            style={{
                                position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                                background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                                width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', cursor: 'pointer', fontSize: '1.5rem', zIndex: 10,
                                touchAction: 'manipulation',
                            }}
                        >
                            ‹
                        </button>
                    )}
                    <img
                        ref={imgRef}
                        data-testid="lightbox-image"
                        src={src}
                        alt=""
                        onClick={(e) => e.stopPropagation()}
                        draggable={false}
                        style={{
                            maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain',
                            borderRadius: '8px', cursor: 'default',
                            touchAction: 'none', transformOrigin: 'center center',
                            userSelect: 'none', WebkitUserSelect: 'none',
                        }}
                    />
                    {gallery.length > 1 && (
                        <button
                            data-testid="lightbox-next"
                            onClick={(e) => { e.stopPropagation(); next(); }}
                            style={{
                                position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                                background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                                width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', cursor: 'pointer', fontSize: '1.5rem', zIndex: 10,
                                touchAction: 'manipulation',
                            }}
                        >
                            ›
                        </button>
                    )}
                    {gallery.length > 1 && (
                        <div style={{
                            position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
                            color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, zIndex: 10,
                        }}>
                            {index + 1} / {gallery.length}
                        </div>
                    )}
                </div>
            )}
        </LightboxContext.Provider>
    );
};
