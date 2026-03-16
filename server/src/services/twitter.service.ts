import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '../config';
import prisma from '../lib/prisma';

const execFileAsync = promisify(execFile);

const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

interface Tweet {
    id: string;
    text: string;
    createdAt: string;
    authorName: string;
    authorHandle: string;
    authorAvatar: string;
    metrics: {
        likes: number;
        retweets: number;
        replies: number;
    };
}

// In-memory store — always available, never expires on its own
let cachedTweets: Tweet[] = [];
let refreshing = false;

async function fetchPostsForHandle(handle: string): Promise<Tweet[]> {
    const args = [
        '--cookies', config.twitterCookiesPath,
        '--dump-json',
        '--range', '1-10',
        `https://x.com/${handle}/tweets`,
    ];

    try {
        const { stdout } = await execFileAsync('gallery-dl', args, {
            timeout: 60000,
            maxBuffer: 5 * 1024 * 1024,
        });

        if (!stdout.trim()) return [];

        // gallery-dl --dump-json outputs a single JSON array of entries
        // Each entry is [type_id, url_or_metadata, metadata?]
        const entries = JSON.parse(stdout);
        if (!Array.isArray(entries)) return [];

        const tweets: Tweet[] = [];
        const seen = new Set<string>();

        for (const entry of entries) {
            const meta = Array.isArray(entry) ? entry[entry.length - 1] : entry;
            if (!meta || typeof meta !== 'object' || (!meta.content && !meta.text)) continue;

            const id = String(meta.tweet_id || meta.id || '');
            if (!id || seen.has(id)) continue;
            seen.add(id);

            tweets.push({
                id,
                text: meta.content || meta.text || '',
                createdAt: meta.date ? new Date(meta.date).toISOString() : '',
                authorName: meta.author?.nick || meta.user?.name || handle,
                authorHandle: meta.author?.name || meta.user?.screen_name || handle,
                authorAvatar: meta.author?.profile_image || meta.user?.profile_image_url_https || '',
                metrics: {
                    likes: meta.favorite_count ?? meta.like_count ?? 0,
                    retweets: meta.retweet_count ?? 0,
                    replies: meta.reply_count ?? 0,
                },
            });
        }

        return tweets;
    } catch (err: any) {
        console.error(`[Twitter] gallery-dl error for @${handle}:`, err.message);
        return [];
    }
}

async function getHandles(): Promise<string[]> {
    try {
        const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
        return settings ? JSON.parse(settings.twitterHandles || '[]') : [];
    } catch {
        return [];
    }
}

async function refreshFeed(): Promise<void> {
    if (refreshing || !config.twitterCookiesPath) return;
    refreshing = true;
    try {
        const handles = await getHandles();
        if (handles.length === 0) return;

        console.log(`[Twitter] Refreshing feed for ${handles.length} handles...`);
        const results = await Promise.all(handles.map(h => fetchPostsForHandle(h)));
        const allTweets = results
            .flat()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 30);

        // Only update cache if we got results — keep stale data otherwise
        if (allTweets.length > 0) {
            cachedTweets = allTweets;
            console.log(`[Twitter] Cached ${allTweets.length} tweets`);
        }
    } catch (err: any) {
        console.error('[Twitter] Refresh error:', err.message);
    } finally {
        refreshing = false;
    }
}

/** Returns cached tweets instantly — never blocks on gallery-dl */
export async function fetchTweetsByHandles(_handles: string[]): Promise<Tweet[]> {
    return cachedTweets;
}

/** Start background refresh loop — call once at server startup */
export function startTwitterRefreshLoop(): void {
    if (!config.twitterCookiesPath) {
        console.warn('[Twitter] TWITTER_COOKIES_PATH not set — X feed disabled');
        return;
    }

    // First fetch 10s after startup (let DB initialize)
    setTimeout(() => refreshFeed(), 10_000);

    // Then refresh every 15 minutes
    setInterval(() => refreshFeed(), REFRESH_INTERVAL);
    console.log(`[Twitter] Background refresh scheduled every ${REFRESH_INTERVAL / 60000} min`);
}
