import { config } from '../config';
import { cache, TTL, cacheKey } from './redis.service';

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

const TWITTER_API_BASE = 'https://api.twitter.com/2';

let warnedOnce = false;

export async function fetchTweetsByHandles(handles: string[]): Promise<Tweet[]> {
    if (!config.twitterBearerToken) {
        if (!warnedOnce) {
            console.warn('[Twitter] TWITTER_BEARER_TOKEN not set — X feed disabled');
            warnedOnce = true;
        }
        return [];
    }

    if (handles.length === 0) return [];

    // Check cache first
    const cached = await cache.getJson<Tweet[]>(cacheKey.twitterFeed());
    if (cached) return cached;

    try {
        const query = handles.map(h => `from:${h}`).join(' OR ');
        const params = new URLSearchParams({
            query,
            max_results: '30',
            'tweet.fields': 'created_at,public_metrics,author_id',
            expansions: 'author_id',
            'user.fields': 'name,username,profile_image_url',
        });

        const resp = await fetch(`${TWITTER_API_BASE}/tweets/search/recent?${params}`, {
            headers: { Authorization: `Bearer ${config.twitterBearerToken}` },
        });

        if (!resp.ok) {
            const body = await resp.text();
            console.error(`[Twitter] API error ${resp.status}: ${body}`);
            return [];
        }

        const json: any = await resp.json();

        if (!json.data || !Array.isArray(json.data)) return [];

        // Build a lookup of users by author_id
        const usersById: Record<string, any> = {};
        if (json.includes?.users) {
            for (const u of json.includes.users) {
                usersById[u.id] = u;
            }
        }

        const tweets: Tweet[] = json.data.map((t: any) => {
            const author = usersById[t.author_id] || {};
            return {
                id: t.id,
                text: t.text,
                createdAt: t.created_at,
                authorName: author.name || '',
                authorHandle: author.username || '',
                authorAvatar: author.profile_image_url || '',
                metrics: {
                    likes: t.public_metrics?.like_count || 0,
                    retweets: t.public_metrics?.retweet_count || 0,
                    replies: t.public_metrics?.reply_count || 0,
                },
            };
        });

        await cache.setJson(cacheKey.twitterFeed(), tweets, TTL.TWITTER_FEED);
        return tweets;
    } catch (err: any) {
        console.error('[Twitter] Fetch error:', err.message);
        return [];
    }
}
