/**
 * Strips HTML tags from a string and decodes basic entities.
 * Useful for providing plain-text previews of rich-text content in thumbnails/cards.
 */
export const stripHtml = (html) => {
    if (!html || typeof html !== 'string') return '';
    
    try {
        if (typeof DOMParser !== 'undefined') {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return doc.body.textContent || "";
        }
    } catch (e) {
        // Fallback
    }
    
    return html.replace(/<[^>]*>?/gm, '');
};
