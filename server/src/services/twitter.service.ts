import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '../config';
import { cache, TTL, cacheKey } from './redis.service';

const execFileAsync = promisify(execFile);

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

let warnedOnce = false;

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

export async function fetchTweetsByHandles(handles: string[]): Promise<Tweet[]> {
    if (!config.twitterCookiesPath) {
        if (!warnedOnce) {
            console.warn('[Twitter] TWITTER_COOKIES_PATH not set — X feed disabled');
            warnedOnce = true;
        }
        return [];
    }

    if (handles.length === 0) return [];

    // Check cache first
    const cached = await cache.getJson<Tweet[]>(cacheKey.twitterFeed());
    if (cached && cached.length > 0) return cached;

    try {
        // Fetch all handles in parallel
        const results = await Promise.all(handles.map(h => fetchPostsForHandle(h)));
        const allTweets = results
            .flat()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 30);

        await cache.setJson(cacheKey.twitterFeed(), allTweets, TTL.TWITTER_FEED);
        return allTweets;
    } catch (err: any) {
        console.error('[Twitter] Fetch error:', err.message);
        return [];
    }
}
