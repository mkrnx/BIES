import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { config } from '../config';
import prisma from '../lib/prisma';

const execFileAsync = promisify(execFile);

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const CACHE_FILE = path.join(process.cwd(), 'data', 'twitter-cache.json');

interface Tweet {
    id: string;
    text: string;
    createdAt: string;
    authorName: string;
    authorHandle: string;
    authorAvatar: string;
    images: string[];
    videos: string[];
    metrics: {
        likes: number;
        retweets: number;
        replies: number;
    };
}

let refreshing = false;

async function readCache(): Promise<Tweet[]> {
    try {
        const data = await readFile(CACHE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function writeCache(tweets: Tweet[]): Promise<void> {
    await writeFile(CACHE_FILE, JSON.stringify(tweets), 'utf-8');
}

async function fetchPostsForHandle(handle: string): Promise<Tweet[]> {
    const args = [
        '--cookies', config.twitterCookiesPath,
        '--dump-json',
        '--range', '1-10',
        `https://x.com/${handle}/tweets`,
    ];

    try {
        const { stdout } = await execFileAsync('gallery-dl', args, {
            timeout: 120000,
            maxBuffer: 5 * 1024 * 1024,
        });

        if (!stdout.trim()) return [];

        // gallery-dl --dump-json outputs a single JSON array of entries
        // Each entry is [type_id, url_or_metadata, metadata?]
        // Tweet IDs exceed Number.MAX_SAFE_INTEGER — quote them before parsing
        const safeStdout = stdout.replace(/:\s*(\d{16,})/g, ': "$1"');
        const entries = JSON.parse(safeStdout);
        if (!Array.isArray(entries)) return [];

        const tweetsMap = new Map<string, Tweet>();
        const mediaByTweet = new Map<string, { images: string[]; videos: string[] }>();

        for (const entry of entries) {
            if (!Array.isArray(entry)) continue;
            const meta = entry[entry.length - 1];
            if (!meta || typeof meta !== 'object') continue;

            const id = String(meta.tweet_id || meta.id || '');
            if (!id) continue;

            // Collect media URLs (entries with extension have URL at position 1)
            if (meta.extension && typeof entry[1] === 'string') {
                if (!mediaByTweet.has(id)) mediaByTweet.set(id, { images: [], videos: [] });
                const media = mediaByTweet.get(id)!;

                if (meta.type === 'photo' && entry[1].includes('pbs.twimg.com')) {
                    media.images.push(entry[1].replace('name=orig', 'name=small'));
                } else if (meta.extension === 'mp4') {
                    media.videos.push(entry[1]);
                }
                continue;
            }

            if ((!meta.content && !meta.text) || tweetsMap.has(id)) continue;

            tweetsMap.set(id, {
                id,
                text: meta.content || meta.text || '',
                createdAt: meta.date ? new Date(meta.date).toISOString() : '',
                authorName: meta.author?.nick || meta.user?.name || handle,
                authorHandle: meta.author?.name || meta.user?.screen_name || handle,
                authorAvatar: meta.author?.profile_image || meta.user?.profile_image_url_https || '',
                images: [],
                videos: [],
                metrics: {
                    likes: meta.favorite_count ?? meta.like_count ?? 0,
                    retweets: meta.retweet_count ?? 0,
                    replies: meta.reply_count ?? 0,
                },
            });
        }

        // Attach media to their tweets
        for (const [id, media] of mediaByTweet) {
            const tweet = tweetsMap.get(id);
            if (tweet) {
                tweet.images = media.images.slice(0, 4);
                tweet.videos = media.videos.slice(0, 1);
            }
        }

        return Array.from(tweetsMap.values());
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
        // Fetch sequentially to avoid rate limits
        const results: Tweet[][] = [];
        for (const handle of handles) {
            results.push(await fetchPostsForHandle(handle));
        }
        const allTweets = results
            .flat()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 30);

        // Only update cache if we got results — keep stale data otherwise
        if (allTweets.length > 0) {
            await writeCache(allTweets);
            console.log(`[Twitter] Cached ${allTweets.length} tweets to disk`);
        }
    } catch (err: any) {
        console.error('[Twitter] Refresh error:', err.message);
    } finally {
        refreshing = false;
    }
}

/** Returns cached tweets from disk — never blocks on gallery-dl */
export async function fetchTweetsByHandles(_handles: string[]): Promise<Tweet[]> {
    return readCache();
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
