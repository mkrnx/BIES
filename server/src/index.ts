import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { sanitize } from './middleware/sanitize';
import { auditLog } from './middleware/audit';
import { attachWebSocketServer } from './services/websocket.service';
import { startTwitterRefreshLoop } from './services/twitter.service';
import { initWebPush, cleanupStaleSubscriptions } from './services/webpush.service';

// ─── Version ─────────────────────────────────────────────────────────────────
const versionFile = path.resolve(__dirname, '..', '..', 'version.json');
const appVersion: string = fs.existsSync(versionFile)
    ? JSON.parse(fs.readFileSync(versionFile, 'utf8')).version
    : process.env.APP_VERSION || '0.0.0';

// ─── Route imports ────────────────────────────────────────────────────────────
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import projectRoutes from './routes/project.routes';
import uploadRoutes from './routes/upload.routes';
import messageRoutes from './routes/message.routes';
import watchlistRoutes from './routes/watchlist.routes';
import investmentRoutes from './routes/investment.routes';
import notificationRoutes from './routes/notification.routes';
import eventRoutes from './routes/events.routes';
import analyticsRoutes from './routes/analytics.routes';
import searchRoutes from './routes/search.routes';
import adminRoutes from './routes/admin.routes';
import investorRoutes from './routes/investor.routes';
import contactRoutes from './routes/contact.routes';
import statsRoutes from './routes/stats.routes';
import settingsRoutes from './routes/settings.routes';
import contentRoutes from './routes/content.routes';
import newsRoutes from './routes/news.routes';
import mediaRoutes from './routes/media.routes';
import matchRoutes from './routes/match.routes';
import nip05Routes from './routes/nip05.routes';
import walletRoutes from './routes/wallet.routes';

const app = express();

// ─── Trust proxy (for correct IP behind Nginx / load balancer) ───────────────
app.set('trust proxy', 1);

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'wss:', 'https:'],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false, // Allow media loading from S3
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
}));

// ─── Health check (before CORS so Docker healthchecks work) ──────────────────
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        version: appVersion,
        timestamp: new Date().toISOString(),
    });
});

// ─── Version endpoint ────────────────────────────────────────────────────────
app.get('/api/version', (_req, res) => {
    res.json({
        version: appVersion,
        environment: config.nodeEnv,
    });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = config.corsOrigin.split(',').map((o) => o.trim());
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no Origin (same-origin browser requests and server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // Reject with false instead of throwing — avoids triggering the 500
        // error handler for simple CORS mismatches (returns 403-like with no
        // Access-Control-Allow-Origin header, so the browser blocks it).
        callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Compression (gzip) ───────────────────────────────────────────────────────
app.use(compression());

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Input sanitization ───────────────────────────────────────────────────────
app.use(sanitize);

// ─── Rate limiting ────────────────────────────────────────────────────────────
// General: 300 req / 15 min per IP
// At 500 concurrent users each making ~1 req/3s = ~167 req/s sustained
// 300 per 15 min = 20/min per IP which is generous but safe
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
    skip: (req) => req.method === 'OPTIONS',
});

// Strict auth: 20 attempts / 15 min per IP (brute force protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many auth attempts, please try again later' },
});

// Upload: 30 per 15 min
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Upload limit reached, please try again later' },
});

// Search / autocomplete: 120 per minute (frequent UI calls)
const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    message: { error: 'Search rate limit reached' },
});

// Contact form: 5 per hour
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Too many contact submissions. Please try again later.' },
});

app.use('/api/', generalLimiter);
app.use('/api/upload', uploadLimiter);
app.use('/api/search', searchLimiter);
app.use('/api/contact', contactLimiter);

// ─── NIP-05 identity (must be before other routes) ───────────────────────────
app.use('/.well-known', nip05Routes);

// ─── Static files (local upload fallback) ────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Audit logging (runs after auth middleware attaches req.user) ─────────────
app.use(auditLog);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/investors', investorRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/wallet', walletRoutes);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ─── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

// ─── HTTP server + WebSocket ──────────────────────────────────────────────────
const server = http.createServer(app);
attachWebSocketServer(server);

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                  BIES Backend Server v${appVersion.padEnd(39)}║
╠══════════════════════════════════════════════════════════════════╣
║  Server:   http://localhost:${config.port}                              ║
║  WS:       ws://localhost:${config.port}/ws                            ║
║  Health:   http://localhost:${config.port}/api/health                  ║
║  ENV:      ${config.nodeEnv.padEnd(55)}║
╠══════════════════════════════════════════════════════════════════╣
║  Routes: auth | profiles | projects | upload | messages          ║
║          watchlist | investments | notifications | events        ║
║          analytics | search | admin | contact | stats            ║
║          settings | content | news | match | websocket           ║
╚══════════════════════════════════════════════════════════════════╝
  `);

    // Start background Twitter feed refresh
    startTwitterRefreshLoop();

    // Initialize Web Push notifications
    initWebPush();
    cleanupStaleSubscriptions().catch(() => {});
});

export default app;
