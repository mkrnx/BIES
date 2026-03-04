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
        `https://x.com/${handle}`,
    ];

    try {
        const { stdout } = await execFileAsync('gallery-dl', args, {
            timeout: 30000,
            maxBuffer: 5 * 1024 * 1024,
        });

        if (!stdout.trim()) return [];

        const tweets: Tweet[] = [];
        for (const line of stdout.trim().split('\n')) {
            try {
                const entry = JSON.parse(line);
                // gallery-dl outputs arrays: [directory_info, metadata]
                // We want the metadata objects that have tweet content
                const meta = Array.isArray(entry) ? entry[entry.length - 1] : entry;
                if (!meta || (!meta.content && !meta.text)) continue;

                tweets.push({
                    id: String(meta.tweet_id || meta.id || ''),
                    text: meta.content || meta.text || '',
                    createdAt: meta.date ? new Date(meta.date).toISOString() : '',
                    authorName: meta.author?.name || meta.user?.name || handle,
                    authorHandle: meta.author?.nick || meta.user?.screen_name || handle,
                    authorAvatar: meta.author?.profile_image || meta.user?.profile_image_url_https || '',
                    metrics: {
                        likes: meta.favorite_count ?? meta.like_count ?? 0,
                        retweets: meta.retweet_count ?? 0,
                        replies: meta.reply_count ?? 0,
                    },
                });
            } catch {
                // Skip unparseable lines
            }
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
    if (cached) return cached;

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
