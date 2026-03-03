import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for GET-style API queries with loading/error states.
 *
 * @param {Function} apiFn  – API function to call, e.g. projectsApi.list
 * @param {*}        params – Single param or object passed to apiFn (optional)
 * @param {Object}   options
 * @param {Array}    options.deps   – Extra dependencies that trigger refetch
 * @param {boolean}  options.skip   – Skip the initial fetch
 */
export function useApiQuery(apiFn, params, options = {}) {
    const { deps = [], skip = false } = options;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(!skip);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = params !== undefined ? await apiFn(params) : await apiFn();
            if (mountedRef.current) setData(result);
        } catch (err) {
            if (mountedRef.current) setError(err.message || 'Request failed');
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [apiFn, JSON.stringify(params), ...deps]);

    useEffect(() => {
        mountedRef.current = true;
        if (!skip) fetch();
        return () => { mountedRef.current = false; };
    }, [fetch, skip]);

    return { data, loading, error, refetch: fetch };
}

/**
 * Hook for POST/PUT/DELETE mutations.
 *
 * @param {Function} apiFn – API function, e.g. projectsApi.create
 */
export function useApiMutation(apiFn) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const mutate = useCallback(async (...args) => {
        setLoading(true);
        setError(null);
        try {
            const result = await apiFn(...args);
            setData(result);
            return result;
        } catch (err) {
            setError(err.message || 'Request failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [apiFn]);

    return { mutate, loading, error, data };
}
