# BIES - Build In El Salvador

BIES is a decentralized ecosystem platform that connects entrepreneurs (builders) with investors, focused on Bitcoin and emerging markets in El Salvador. It uses the Nostr protocol for identity, messaging, and social features, with Lightning Network integration for payments.

## What It Does

- **Builders** create profiles, launch projects, upload pitch decks, track funding, and connect with investors
- **Investors** discover projects, track deals, manage watchlists, and commit funding directly to founders
- **Everyone** gets a Nostr-native social feed, encrypted messaging, Lightning zaps, and verifiable identity (NIP-05)

The platform is non-custodial by default: private keys are encrypted client-side using passkeys (WebAuthn) or NIP-49 keyfiles, and never touch the server.

## Architecture

```
Browser (React SPA)
    |
    |-- HTTPS / WebSocket
    |
    +-- Nginx (reverse proxy, static frontend)
    |       |
    |       +-- /api --> Express Backend (REST + WebSocket)
    |       |               |
    |       |               +-- SQLite (dev) / PostgreSQL (prod)
    |       |               +-- Redis (optional cache)
    |       |               +-- S3/R2/Spaces (file storage)
    |       |               +-- Coinos API (Lightning wallets)
    |       |
    |       +-- /relay --> NIP-42 Auth Proxy
    |                       |
    |                       +-- strfry (Nostr relay)
    |
    +-- Public Nostr Relays (relay.damus.io, etc.)
    |
    +-- LibreTranslate (EN/ES translation)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, React Router 6, styled-jsx, Recharts |
| Backend | Express 4, TypeScript, Prisma ORM, Zod validation |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | Nostr (NIP-42), Passkeys (WebAuthn), NIP-49 keyfiles, JWT |
| Payments | Lightning via Coinos API, NWC, WebLN, NIP-57 zaps |
| Relay | strfry with NIP-42 auth proxy |
| Cache | Redis (optional, in-memory fallback) |
| Storage | S3-compatible (R2, Spaces, AWS) or local uploads/ |
| Translation | LibreTranslate (EN/ES) |
| Deployment | Docker Compose, Nginx, multi-stage builds |
| Testing | Playwright E2E |

## Project Structure

```
BIES/
  src/                    # React frontend
    pages/                # Route pages (30+ components)
    components/           # Reusable UI (Navbar, ZapModal, Feed, etc.)
    context/              # Auth, Theme, UserMode providers
    services/             # API client, Nostr signer, passkeys, zaps
    hooks/                # useAuth, useWallet, useNostr
    config/               # Feature flags
    i18n/                 # English/Spanish translations
  server/                 # Express backend (TypeScript)
    src/
      controllers/        # Business logic (23 controllers)
      routes/             # REST API endpoints (22 route files)
      services/           # Nostr, Coinos, WebSocket, storage, etc.
      middleware/          # Auth, rate limiting, sanitization, audit
      config/             # Environment config
    prisma/               # Schema, migrations, seed data
  relay/                  # strfry Nostr relay (Dockerfile + config)
  relay-proxy/            # NIP-42 authentication proxy
  deploy/                 # Nginx config
  docs/                   # Technical documentation
  e2e/                    # Playwright test specs
  Dockerfile              # Multi-stage build (client, server, nginx)
  docker-compose.yml      # Full stack orchestration (6 services)
```

## Features

### Authentication
- **Passkeys (WebAuthn)** - PRF-based AES-256-GCM encryption of Nostr keys, with device-bound fallback
- **NIP-49 keyfiles** - Encrypted `.nostrkey` files (scrypt + XChaCha20-Poly1305) for backup/portability
- **Browser extensions** - NIP-46 support (Alby, nos2x, etc.)
- **Seed phrases** - BIP-39 (NIP-06) key generation and recovery
- **Email/password** - Legacy fallback via bcrypt

### Profiles & Discovery
- Builder and Investor role-based profiles with skills, social links, location
- NIP-05 identity verification (`username@bies.sovit.xyz`)
- Lightning address display
- Discover page with filtering by role, skills, and location
- Investor-specific fields: focus sectors, ticket sizes, portfolio tracking
- Builder-specific: "looking for" tags (funding, cofounder, team members)

### Projects
- Full project lifecycle: Idea, MVP, Growth, Scaling
- Categories: Energy, Fintech, Education, Agriculture, and more
- Funding goals with progress tracking and use-of-funds breakdown
- Pitch deck upload with access request/approval workflow
- Team management with roles (Founder, Cofounder, Advisor)
- Project updates (timeline)
- View analytics (impressions, unique viewers)
- Nostr event publishing

### Investments
- Investment commitments with status tracking (Pending, Committed, Completed, Withdrawn)
- Watchlist with private notes
- Deal terms and multi-currency support (USD, BTC, SATS)
- Investor role vetting with admin approval

### Social
- **Feed** - Real-time Nostr events (NIP-01) with media rendering
- **Messaging** - NIP-04 encrypted DMs with read receipts and real-time WebSocket delivery
- **Notifications** - Activity feed for follows, investments, messages, project updates
- **Zaps** - Lightning payments (NIP-57) with receipt tracking

### Events
- Event creation with visibility controls (Public, Limited, Invite Only, Private, Draft)
- RSVP management with attendee limits
- NIP-52 calendar event integration (kind:31923)
- Location and online URL support

### Lightning & Wallets
- **Coinos** - Optional custodial wallet with instant signup, balance, and payments
- **NWC** - Nostr Wallet Connect for non-custodial wallets
- **WebLN** - Browser-native Lightning support
- **Zaps** - Unified payment modal across all wallet types

### Content
- Articles and news with categories
- Video embeds with metadata
- Legal resources and compliance docs
- Social media aggregation (Twitter, YouTube, Instagram)

### Admin Dashboard
- Platform statistics overview
- Project and event moderation (approve, feature, publish)
- User management (role assignment, bans)
- Investor vetting workflow
- Full audit log (action, actor, resource, IP, timestamp)

## Getting Started

### Prerequisites
- Node.js 20+
- npm

### Development Setup

**1. Install dependencies:**

```bash
# Frontend
npm install

# Backend
cd server && npm install
```

**2. Configure environment:**

```bash
cp server/.env.example server/.env
# Edit server/.env with your values (JWT_SECRET and ENCRYPTION_SECRET are required)
```

**3. Set up database:**

```bash
cd server
npm run db:push      # Apply schema to SQLite
npm run db:seed      # Optional: populate test data
```

**4. Start dev servers:**

```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
npm run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:3001`. Vite proxies `/api`, `/ws`, `/relay`, and `/uploads` to the backend automatically.

### Production (Docker)

```bash
# Create and configure server/.env for production
# Then:
docker compose up -d
```

This starts 6 services:

| Service | Purpose |
|---------|---------|
| `bies-server` | Express backend (port 3001) |
| `bies-relay` | strfry Nostr relay |
| `bies-auth-proxy` | NIP-42 authentication proxy |
| `bies-translate` | LibreTranslate (EN/ES) |
| `bies-nginx` | Reverse proxy + static frontend (port 8082) |
| `bies-bugs` | Bug tracking |

Access the app at `http://localhost:8082`.

## Environment Variables

See [server/.env.example](server/.env.example) for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes (prod) | 64-char base64 string for token signing |
| `ENCRYPTION_SECRET` | Yes | 32-char string for AES-256-GCM encryption |
| `DATABASE_URL` | Yes | SQLite file path or PostgreSQL connection string |
| `CORS_ORIGIN` | Yes | Comma-separated allowed origins |
| `ADMIN_PUBKEYS` | No | Nostr hex pubkeys auto-promoted to admin |
| `NOSTR_RELAYS` | No | Public relays for reading events |
| `REDIS_URL` | No | Redis for distributed caching (falls back to in-memory) |
| `S3_ENDPOINT` | No | S3-compatible storage (falls back to local uploads/) |
| `COINOS_API_URL` | No | Coinos API for Lightning wallet integration |
| `SMTP_HOST` | No | SMTP server for email notifications |

## Feature Flags

Configured in [src/config/featureFlags.js](src/config/featureFlags.js):

| Flag | Default | Description |
|------|---------|-------------|
| `PASSKEY_ENABLED` | `true` | WebAuthn passkey registration and login |
| `NIP46_ENABLED` | `true` | Browser extension (NIP-46) signing support |
| `COINOS_SIGNUP_WALLET` | `true` | Offer instant Coinos wallet during signup |
| `COINOS_ENABLED` | `true` | Show Coinos wallet tab in Settings |

## API Endpoints

The backend exposes REST APIs under `/api`:

- `/api/auth` - Login, signup, Nostr challenge-response, JWT sessions
- `/api/profiles` - Profile CRUD, follow/unfollow, avatar upload
- `/api/projects` - Project CRUD, team management, deck requests, view tracking
- `/api/investments` - Investment commitments, watchlist
- `/api/events` - Event CRUD, RSVP
- `/api/messages` - Encrypted DMs, read receipts
- `/api/notifications` - Activity feed
- `/api/wallet` - Coinos wallet create/connect/pay/balance
- `/api/admin` - User/project/event moderation, audit logs
- `/api/search` - Full-text search across projects, profiles, events
- `/api/nip05` - NIP-05 identity management
- `/api/content` - Articles, videos, legal resources

WebSocket at `/ws` handles real-time messaging and notifications.

## Nostr Integration

BIES implements these Nostr NIPs:

| NIP | Purpose |
|-----|---------|
| NIP-01 | Events and relay protocol (social feed) |
| NIP-04 | Encrypted direct messages |
| NIP-05 | DNS-based identity verification |
| NIP-06 | BIP-39 seed phrase key generation |
| NIP-19 | Bech32 key encoding (npub, nsec) |
| NIP-42 | Relay authentication (auth proxy) |
| NIP-46 | Remote signing (browser extensions) |
| NIP-49 | Encrypted keyfile format (.nostrkey) |
| NIP-52 | Calendar events (kind:31923) |
| NIP-57 | Lightning zaps with receipts |

## Database

Prisma ORM with 30+ models. Key entities:

- **User** - Auth identity (Nostr pubkey, email, role, ban status)
- **Profile** - Display info (name, bio, avatar, skills, social links, NIP-05, Lightning address)
- **Project** - Builder projects (funding stage, category, deck, team, analytics)
- **Investment** - Investor commitments (amount, status, terms)
- **Event** - Calendar events (RSVP, attendees, NIP-52)
- **Message** - Encrypted DMs (NIP-04 reference, read receipts)
- **Notification** - Activity feed entries
- **ZapReceipt** - NIP-57 Lightning payment tracking
- **AuditLog** - Admin action history

Run `npx prisma studio` from `server/` to browse the database visually.

## Security

- Client-side key encryption (keys never sent to server)
- AES-256-GCM for stored tokens (Coinos JWT)
- Helmet.js with CSP and HSTS headers
- Rate limiting: 300 req/15min general, 20/15min auth, 30/15min uploads
- Input sanitization via DOMPurify
- Nostr event signature verification
- Browser fingerprinting for ban evasion detection
- Full audit logging of admin actions

## Testing

```bash
# Run E2E tests (requires running dev servers)
npx playwright test

# Run against production build
npx playwright test --config=playwright.prod.config.js
```

## License

Private - All rights reserved.
