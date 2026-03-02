import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Generic hook for fetching data from the BIES API.
 *
 * @param {Function} apiFn - The API function to call (e.g. projectsApi.list)
 * @param {*} params - Parameters to pass to the API function
 * @param {Object} options - { enabled: true, deps: [] }
 * @returns {{ data, loading, error, refetch }}
 */
export function useApiQuery(apiFn, params, options = {}) {
    const { enabled = true, deps = [] } = options;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);

    const fetch = useCallback(async () => {
        if (!enabled) return;
        setLoading(true);
        setError(null);

        try {
            const result = params !== undefined
                ? await apiFn(params)
                : await apiFn();

            if (mountedRef.current) {
                setData(result);
            }
        } catch (err) {
            if (mountedRef.current) {
                setError(err);
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [apiFn, enabled, JSON.stringify(params), ...deps]);

    useEffect(() => {
        mountedRef.current = true;
        fetch();
        return () => { mountedRef.current = false; };
    }, [fetch]);

    return { data, loading, error, refetch: fetch };
}

/**
 * Hook for API mutations (POST, PUT, DELETE).
 *
 * @param {Function} apiFn - The API mutation function
 * @returns {{ mutate, loading, error, data }}
 */
export function useApiMutation(apiFn) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const mutate = useCallback(async (...args) => {
        setLoading(true);
        setError(null);

        try {
            const result = await apiFn(...args);
            setData(result);
            return result;
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [apiFn]);

    return { mutate, loading, error, data };
}
