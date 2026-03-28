/**
 * Translation service — tries local LibreTranslate first, falls back to MyMemory API.
 */

const cache = new Map();

const LIBRE_URL = '/translate/translate';
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

/**
 * Try LibreTranslate first (self-hosted), fall back to MyMemory (free public API).
 */
async function callTranslateApi(text, source, target, format = 'text') {
    // Try LibreTranslate first
    try {
        const res = await fetch(LIBRE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: text, source, target, format }),
            signal: AbortSignal.timeout(3000), // 3s timeout
        });
        if (res.ok) {
            const data = await res.json();
            if (data.translatedText) return data.translatedText;
        }
    } catch {
        // LibreTranslate not available, try fallback
    }

    // Fallback: MyMemory API (free, no key needed)
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MyMemory API error: ${res.status}`);
    const data = await res.json();
    if (data.responseStatus !== 200 && data.responseStatus !== '200') {
        throw new Error(data.responseDetails || 'Translation failed');
    }
    return data.responseData?.translatedText || text;
}

/**
 * Translate plain text.
 */
export async function translateText(text, source = 'en', target = 'es') {
    if (!text || !text.trim()) return text;

    const cacheKey = `${source}|${target}|${text}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const translated = await callTranslateApi(text, source, target, 'text');
    cache.set(cacheKey, translated);
    return translated;
}

/**
 * Translate HTML content. Strips tags for MyMemory, keeps tags for LibreTranslate.
 */
export async function translateHtml(html, source = 'en', target = 'es') {
    if (!html || !html.trim()) return html;

    const cacheKey = `html|${source}|${target}|${html}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    // Extract plain text from HTML for translation
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const plainText = temp.textContent || temp.innerText || '';

    if (!plainText.trim()) return html;

    const translated = await callTranslateApi(plainText, source, target, 'text');
    // Wrap in a paragraph since we lost HTML formatting — escape to prevent injection
    const escaped = translated.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const result = `<p>${escaped}</p>`;
    cache.set(cacheKey, result);
    return result;
}

export function clearCache() {
    cache.clear();
}

export default { translateText, translateHtml, clearCache };
