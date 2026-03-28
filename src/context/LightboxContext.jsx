import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LightboxContext = createContext();

export const useLightbox = () => useContext(LightboxContext);

export const LightboxProvider = ({ children }) => {
    const [src, setSrc] = useState(null);
    const [gallery, setGallery] = useState([]);
    const [index, setIndex] = useState(0);

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

    return (
        <LightboxContext.Provider value={{ open }}>
            {children}
            {src && (
                <div
                    onClick={close}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.95)', zIndex: 999999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                    }}
                >
                    <button
                        onClick={close}
                        style={{
                            position: 'absolute', top: '1.5rem', right: '1.5rem',
                            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
                            width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', cursor: 'pointer', fontSize: '1.25rem',
                        }}
                    >
                        ✕
                    </button>
                    {gallery.length > 1 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); prev(); }}
                            style={{
                                position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                                background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                                width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', cursor: 'pointer', fontSize: '1.5rem',
                            }}
                        >
                            ‹
                        </button>
                    )}
                    <img
                        src={src}
                        alt=""
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', cursor: 'default' }}
                    />
                    {gallery.length > 1 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); next(); }}
                            style={{
                                position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                                background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                                width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', cursor: 'pointer', fontSize: '1.5rem',
                            }}
                        >
                            ›
                        </button>
                    )}
                    {gallery.length > 1 && (
                        <div style={{
                            position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
                            color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600,
                        }}>
                            {index + 1} / {gallery.length}
                        </div>
                    )}
                </div>
            )}
        </LightboxContext.Provider>
    );
};
