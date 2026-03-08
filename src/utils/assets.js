/**
 * Utility to resolve asset URLs.
 * Corrects relative paths by stripping /api from VITE_API_URL
 * since static files are served from the root /uploads directory.
 */
export const getAssetUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;

    // Relative path (e.g. /uploads/...)
    const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
    if (!baseUrl) return path;

    // If path already starts with the base path, don't double-prefix
    if (path.startsWith(baseUrl)) return path;

    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
};
