import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// ─── Security: refuse to start in production with default secrets ───────
if (isProduction) {
    if (!process.env.JWT_SECRET) {
        throw new Error('FATAL: JWT_SECRET environment variable must be set in production');
    }
    if (!process.env.ENCRYPTION_SECRET) {
        throw new Error('FATAL: ENCRYPTION_SECRET environment variable must be set in production');
    }
}

// In development, generate a random secret per process instead of using a static default
const devJwtSecret = crypto.randomBytes(32).toString('hex');
const devEncryptionSecret = crypto.randomBytes(16).toString('hex') + crypto.randomBytes(16).toString('hex');

export const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

    // ─── Auth ───────────────────────────────────────────────────────────────
    jwtSecret: process.env.JWT_SECRET || devJwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    encryptionSecret: process.env.ENCRYPTION_SECRET || devEncryptionSecret,

    // ─── Redis (optional — falls back to in-memory) ─────────────────────────
    redisUrl: process.env.REDIS_URL || '',

    // ─── S3 Compatible Storage ───────────────────────────────────────────────
    s3: {
        endpoint: process.env.S3_ENDPOINT || '',
        region: process.env.S3_REGION || 'auto',
        accessKey: process.env.S3_ACCESS_KEY || '',
        secretKey: process.env.S3_SECRET_KEY || '',
        bucket: process.env.S3_BUCKET || 'bies-uploads',
        publicUrl: process.env.S3_PUBLIC_URL || '',
    },

    // ─── Admin ───────────────────────────────────────────────────────────────
    adminPubkeys: (process.env.ADMIN_PUBKEYS || '').split(',').filter(Boolean),

    // ─── Nostr ───────────────────────────────────────────────────────────────
    nostrPrivateRelay: process.env.NOSTR_PRIVATE_RELAY || '',
    nostrPublicRelay: process.env.NOSTR_PUBLIC_RELAY || 'wss://bies.sovit.xyz/relay',
    nostrRelays: (process.env.NOSTR_RELAYS || 'wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol').split(','),

    // ─── Twitter/X (gallery-dl + browser cookies) ──────────────────────────
    twitterCookiesPath: process.env.TWITTER_COOKIES_PATH || '',

    // ─── News Feed (gnews.io API) ───────────────────────────────────────────
    gnewsApiKey: process.env.GNEWS_API_KEY || '',

    // ─── Media Feeds (YouTube, etc.) ─────────────────────────────────────────
    youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID || '',

    // ─── Coinos (custodial Lightning wallet) ─────────────────────────────────
    coinosApiUrl: process.env.COINOS_API_URL || 'https://coinos.io/api',

    // ─── Email (optional, for notification emails) ───────────────────────────
    smtp: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'noreply@bies.io',
    },

    // ─── Web Push (VAPID) — optional, for offline push notifications ────────
    vapid: {
        publicKey: process.env.VAPID_PUBLIC_KEY || '',
        privateKey: process.env.VAPID_PRIVATE_KEY || '',
        subject: process.env.VAPID_SUBJECT || 'mailto:admin@bies.io',
    },
};
