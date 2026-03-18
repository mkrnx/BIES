import axios from 'axios';
import Parser from 'rss-parser';
import { config } from '../config';
import { cache, TTL, cacheKey } from './redis.service';

interface NewsArticle {
    id: string;
    title: string;
    description: string;
    url: string;
    image?: string;
    source: string;
    publishedAt: string;
    country?: string;
}

const parser = new Parser();

/**
 * Fetch news from gnews.io API
 * Filters for El Salvador news
 */
async function fetchFromGnews(): Promise<NewsArticle[]> {
    if (!config.gnewsApiKey) {
        console.warn('[NewsFeed] GNEWS_API_KEY not configured, skipping gnews fetch');
        return [];
    }

    try {
        const response = await axios.get('https://gnews.io/api/v4/search', {
            params: {
                q: 'El Salvador',
                lang: 'en',
                sortby: 'publishedAt',
                limit: 20,
                apikey: config.gnewsApiKey,
            },
            timeout: 10000,
        });

        return (response.data.articles || []).map((article: any) => ({
            id: `gnews-${article.url}`,
            title: article.title,
            description: article.description,
            url: article.url,
            image: article.image,
            source: article.source?.name || 'GNews',
            publishedAt: article.publishedAt,
            country: 'El Salvador',
        }));
    } catch (error: any) {
        console.error('[NewsFeed] GNews fetch error:', error.message);
        return [];
    }
}

/**
 * Fetch news from El Salvador government RSS feeds
 * Fallback source for news
 */
async function fetchFromRSS(): Promise<NewsArticle[]> {
    const feeds = [
        // Official El Salvador news sources
        'https://www.presidencia.gob.sv/rss/',
        'https://www.casapres.gob.sv/rss/',
        // Alternative news sources covering El Salvador
        'https://www.elfaro.net/rss',
    ];

    const allArticles: NewsArticle[] = [];

    for (const feedUrl of feeds) {
        try {
            const feed = await parser.parseURL(feedUrl);
            const articles = (feed.items || [])
                .slice(0, 10)
                .map((item) => ({
                    id: `rss-${item.link || item.title}`,
                    title: item.title || 'Untitled',
                    description: item.content || item.contentSnippet || item.summary || '',
                    url: item.link || '',
                    image: item.enclosure?.url || extractImageFromContent(item.content || ''),
                    source: feed.title || 'RSS Feed',
                    publishedAt: item.pubDate || new Date().toISOString(),
                    country: 'El Salvador',
                }));

            allArticles.push(...articles);
        } catch (error: any) {
            console.error(`[NewsFeed] RSS fetch error for ${feedUrl}:`, error.message);
        }
    }

    return allArticles;
}

/**
 * Extract image URL from HTML content
 */
function extractImageFromContent(content: string): string | undefined {
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/);
    return imgMatch ? imgMatch[1] : undefined;
}

/**
 * Get live news feed - tries gnews first, falls back to RSS
 */
export async function getLiveNewsFeed(): Promise<NewsArticle[]> {
    try {
        // Try cache first
        const cached = await cache.getJson<NewsArticle[]>(cacheKey.liveNewsFeed());
        if (cached && cached.length > 0) {
            return cached;
        }

        // Try gnews first
        let articles = await fetchFromGnews();

        // If gnews returns nothing or fails, try RSS
        if (articles.length === 0) {
            console.log('[NewsFeed] GNews returned no results, trying RSS feeds...');
            articles = await fetchFromRSS();
        }

        // Merge with RSS as supplementary (if gnews worked)
        if (articles.length > 0 && config.gnewsApiKey) {
            const rssArticles = await fetchFromRSS();
            // Avoid duplicates by checking URLs
            const urls = new Set(articles.map((a) => a.url));
            articles = [
                ...articles,
                ...rssArticles.filter((a) => !urls.has(a.url)),
            ];
        }

        // Sort by date descending and limit to 50
        articles = articles
            .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
            .slice(0, 50);

        // Cache for 15 minutes
        await cache.setJson(cacheKey.liveNewsFeed(), articles, TTL.CONTENT_LIST);

        return articles;
    } catch (error: any) {
        console.error('[NewsFeed] Fatal error:', error.message);
        // Return empty array on complete failure — don't throw
        return [];
    }
}

/**
 * Filter articles by country (El Salvador)
 */
export function filterByCountry(articles: NewsArticle[], country: string = 'El Salvador'): NewsArticle[] {
    return articles.filter((a) => a.country === country);
}

/**
 * Filter articles by keyword
 */
export function filterByKeyword(articles: NewsArticle[], keyword: string): NewsArticle[] {
    const lower = keyword.toLowerCase();
    return articles.filter(
        (a) =>
            a.title.toLowerCase().includes(lower) ||
            a.description.toLowerCase().includes(lower),
    );
}
