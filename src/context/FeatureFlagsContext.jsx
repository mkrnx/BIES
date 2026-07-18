import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { flagsApi } from '../services/api';
import { DEFAULT_FLAGS } from '../config/featureSlugs';

/**
 * Runtime feature flags — admin-toggled, fetched from the public
 * GET /api/flags at app boot (works logged-out) and refreshed on window
 * focus. Fail-open: defaults to all-enabled while loading and keeps the
 * last known flags on fetch errors, so a flaky API never hides the app.
 * Unknown slugs default to enabled (`useFeature` treats only an explicit
 * `false` as disabled).
 */
const FeatureFlagsContext = createContext({
    flags: DEFAULT_FLAGS,
    loading: true,
    refresh: () => {},
});

export const FeatureFlagsProvider = ({ children }) => {
    const [flags, setFlags] = useState(DEFAULT_FLAGS);
    const [loading, setLoading] = useState(true);
    const inFlight = useRef(false);

    const refresh = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        try {
            const data = await flagsApi.get();
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                setFlags({ ...DEFAULT_FLAGS, ...data });
            }
        } catch {
            // fail-open: keep the last known flags (defaults on first load)
        } finally {
            inFlight.current = false;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const onFocus = () => refresh();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [refresh]);

    return (
        <FeatureFlagsContext.Provider value={{ flags, loading, refresh }}>
            {children}
        </FeatureFlagsContext.Provider>
    );
};

export const useFeatureFlags = () => useContext(FeatureFlagsContext);

/** True unless the slug is explicitly disabled (missing/unknown ⇒ enabled). */
export const useFeature = (slug) => {
    const { flags } = useFeatureFlags();
    return flags[slug] !== false;
};
