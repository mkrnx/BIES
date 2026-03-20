/**
 * Strips HTML tags from a string and decodes basic entities.
 * Useful for providing plain-text previews of rich-text content in thumbnails/cards.
 */
export const stripHtml = (html) => {
    if (!html) return '';
    
    // Remove HTML tags
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = doc.body.textContent || "";
    
    // If DOMParser isn't available or fails (e.g. non-browser environment), fallback to regex
    if (!text && html.includes('<')) {
        return html.replace(/<[^>]*>?/gm, '');
    }
    
    return text;
};
