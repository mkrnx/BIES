import React, { createContext, useContext, useState, useCallback } from 'react';
import { sanitizeTabs, DEFAULT_BOTTOM_NAV } from '../config/navPages';
import { preferencesApi } from '../services/api';

const STORAGE_KEY = 'bies_bottom_nav';

const BottomNavContext = createContext({
    tabs: DEFAULT_BOTTOM_NAV,
    updateTabs: () => {},
    applyServerTabs: () => {},
    resetTabs: () => {},
    isCustomized: false,
});

export const BottomNavProvider = ({ children }) => {
    const [tabs, setTabs] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) return sanitizeTabs(JSON.parse(stored));
        } catch {
            // corrupt JSON → fall back to defaults
        }
        return [...DEFAULT_BOTTOM_NAV];
    });

    // User-initiated change: persist to localStorage AND the backend preference.
    const updateTabs = useCallback((ids) => {
        const clean = sanitizeTabs(ids);
        setTabs(clean);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        preferencesApi.save({ bottomNavTabs: clean }).catch(() => {});
    }, []);

    // Server-initiated restore (login): localStorage only — no echo back to the server.
    const applyServerTabs = useCallback((ids) => {
        const clean = sanitizeTabs(ids);
        setTabs(clean);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    }, []);

    const resetTabs = useCallback(() => {
        updateTabs(DEFAULT_BOTTOM_NAV);
    }, [updateTabs]);

    const isCustomized = JSON.stringify(tabs) !== JSON.stringify(DEFAULT_BOTTOM_NAV);

    return (
        <BottomNavContext.Provider value={{ tabs, updateTabs, applyServerTabs, resetTabs, isCustomized }}>
            {children}
        </BottomNavContext.Provider>
    );
};

export const useBottomNav = () => useContext(BottomNavContext);
