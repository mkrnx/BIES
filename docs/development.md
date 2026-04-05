# Development Guide

## Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm** (comes with Node.js)
- **Git**

Optional for full stack:
- **Docker** and **Docker Compose** (for relay, translation, and production builds)
- **PostgreSQL** (production database — dev uses SQLite)

## Quick Start

### 1. Clone and Install

```bash
git clone <repo-url>
cd BIES

# Frontend dependencies
npm install

# Backend dependencies
cd server && npm install
```

### 2. Configure Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` — two values are required:

| Variable | How to Generate |
|----------|----------------|
| `JWT_SECRET` | `openssl rand -base64 64` |
| `ENCRYPTION_SECRET` | Any 32-character string |

Everything else has sensible defaults for local development.

### 3. Set Up Database

```bash
cd server

# Apply Prisma schema to SQLite
npm run db:push

# Optional: populate with test data
npm run db:seed
```

### 4. Start Dev Servers

Open two terminals:

```bash
# Terminal 1 — Backend (Express, port 3001)
cd server && npm run dev

# Terminal 2 — Frontend (Vite, port 5173)
npm run dev
```

Open `http://localhost:5173`. Vite proxies all API calls automatically.

## Proxy Configuration

Vite dev server proxies these paths to the backend (`vite.config.js`):

| Path | Target | Protocol |
|------|--------|----------|
| `/api/*` | `http://localhost:3001` | HTTP |
| `/ws` | `ws://localhost:3001` | WebSocket |
| `/relay` | `ws://localhost:7777` | WebSocket |
| `/uploads/*` | `http://localhost:3001` | HTTP |

The `/relay` proxy only works if you're running the strfry relay locally (via Docker or standalone). Without it, the private relay features won't function in dev, but everything else works.

## Available Scripts

### Frontend (`package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Start dev server with HMR (port 5173) |
| `build` | `vite build` | Production build to `dist/` |
| `preview` | `vite preview` | Preview production build locally |
| `lint` | `eslint .` | Run ESLint on all JS/JSX files |
| `version:show` | `bash scripts/version.sh` | Display current version |
| `version:patch` | `bash scripts/version.sh patch` | Bump patch version (0.3.0 → 0.3.1) |
| `version:minor` | `bash scripts/version.sh minor` | Bump minor version (0.3.0 → 0.4.0) |
| `version:major` | `bash scripts/version.sh major` | Bump major version (0.3.0 → 1.0.0) |

### Backend (`server/package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `npx tsx watch src/index.ts` | Start backend with hot reload |
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `start` | `node dist/index.js` | Run compiled backend |
| `db:push` | `prisma db push` | Sync schema to database (no migration) |
| `db:generate` | `prisma generate` | Regenerate Prisma client |
| `db:migrate` | `prisma migrate dev` | Create and apply a migration |
| `db:seed` | `npx tsx prisma/seed.ts` | Populate database with test data |
| `db:studio` | `prisma studio` | Open visual database browser (port 5555) |
| `db:reset` | `prisma migrate reset --force` | Drop all data and re-apply migrations |

## Project Layout

### Frontend (`src/`)

```
src/
├── pages/                # Route components (34 pages)
│   ├── Feed.jsx          # Nostr social feed (private + explore tabs)
│   ├── Discover.jsx      # Member and project directory
│   ├── Login.jsx         # Multi-method login (passkey, extension, keyfile, nsec, seed)
│   ├── Signup.jsx        # 4-step signup (keys → backup → passkey → profile)
│   ├── ProfileEdit.jsx   # Profile editor with drag-and-drop sections
│   ├── Messages.jsx      # NIP-04 encrypted DM inbox
│   ├── Settings.jsx      # Wallet connections, exports, preferences
│   └── admin/            # Admin dashboard pages
│
├── components/           # Reusable UI (34 components)
│   ├── Navbar.jsx        # Top navigation
│   ├── MobileBottomNav.jsx # Mobile tab bar
│   ├── NostrFeed.jsx     # Feed event renderer
│   ├── Note.jsx          # Single note card (reactions, zaps, replies)
│   ├── ZapModal.jsx      # Unified payment dialog
│   ├── WalletConnect.jsx # NWC + Coinos wallet UI
│   └── ...
│
├── services/             # Protocol and API layer
│   ├── api.js            # HTTP client — all REST endpoints with JWT injection
│   ├── nostrService.js   # Relay connections, subscriptions, profile cache
│   ├── nostrSigner.js    # Unified signing (memory, extension, passkey)
│   ├── authService.js    # Login/logout, session restore, challenge-response
│   ├── keytrService.js   # Passkey encryption via @sovit.xyz/keytr
│   ├── keyfileService.js # NIP-49 encrypted keyfile handling
│   ├── lightningService.js # LUD-16 LNURL-pay resolution
│   ├── nwcService.js     # NIP-47 Nostr Wallet Connect
│   └── blossomService.js # Media upload (Blossom protocol)
│
├── context/              # React Context providers
│   ├── AuthContext.jsx   # User state, JWT, login/logout
│   ├── ThemeContext.jsx  # Light/dark mode
│   └── UserModeContext.jsx # Builder vs. Investor view
│
├── hooks/                # Custom React hooks
│   ├── useAuth.js        # Auth context consumer
│   ├── useWallet.js      # Unified wallet (Coinos + NWC)
│   ├── useNostr.js       # Nostr operations
│   └── useZap.js         # Zap modal state
│
├── config/
│   └── featureFlags.js   # Runtime feature toggles
│
├── i18n/                 # Internationalization
│   ├── en.json           # English strings
│   └── es.json           # Spanish strings
│
└── utils/                # Shared utilities
```

### Backend (`server/`)

```
server/
├── src/
│   ├── index.ts          # Express app setup, route mounting, WebSocket
│   ├── controllers/      # Business logic (23 controllers)
│   │   ├── auth.controller.ts
│   │   ├── profile.controller.ts
│   │   ├── project.controller.ts
│   │   ├── event.controller.ts
│   │   ├── message.controller.ts
│   │   ├── wallet.controller.ts
│   │   └── admin.controller.ts
│   │
│   ├── routes/           # REST API endpoints (22 files)
│   │   ├── auth.routes.ts
│   │   ├── profile.routes.ts
│   │   ├── project.routes.ts
│   │   └── ...
│   │
│   ├── services/         # External integrations
│   │   ├── nostr.service.ts    # Server-side Nostr client
│   │   ├── coinos.service.ts   # Lightning wallet API
│   │   ├── websocket.service.ts # Real-time notifications
│   │   ├── redis.service.ts    # Caching (optional)
│   │   └── storage.service.ts  # S3-compatible file uploads
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts   # JWT verification
│   │   ├── rateLimit.middleware.ts
│   │   └── sanitize.middleware.ts
│   │
│   └── config/
│       └── index.ts      # Environment variable parsing
│
├── prisma/
│   ├── schema.prisma     # Database schema (30+ models)
│   ├── migrations/       # Migration history
│   └── seed.ts           # Test data
│
└── package.json
```

## Feature Flags

Toggle features without code changes in `src/config/featureFlags.js`:

| Flag | Default | Controls |
|------|---------|---------|
| `PASSKEY_ENABLED` | `true` | WebAuthn passkey login and registration |
| `NIP46_ENABLED` | `true` | Browser extension (NIP-46) signing |
| `COINOS_SIGNUP_WALLET` | `false` | Auto-provision Coinos wallet during signup |
| `COINOS_ENABLED` | `false` | Coinos wallet tab in Settings |

## Database

### Schema

The Prisma schema is in `server/prisma/schema.prisma`. Key models:

- **User** — Auth identity (pubkey, email, role, ban status)
- **Profile** — Display info, skills, social links, Lightning address
- **Project** — Builder projects with funding, team, analytics
- **Investment** — Funding commitments with status tracking
- **Event** — Calendar events with RSVP
- **Message** — DM metadata (content is NIP-04 encrypted, not stored)
- **Notification** — Activity feed entries
- **Follow** — Social graph

### Browsing

```bash
cd server && npx prisma studio
```

Opens a visual database browser at `http://localhost:5555`.

### Migrations

For development (SQLite), `db:push` is usually sufficient — it syncs the schema without creating migration files. For production schema changes:

```bash
cd server
npm run db:migrate    # Creates a migration file and applies it
```

## Testing

### E2E Tests (Playwright)

```bash
# Install browsers (first time)
npx playwright install

# Run tests (requires dev servers running)
npx playwright test

# Run with UI mode
npx playwright test --ui

# Run a specific test
npx playwright test e2e/full-site-test.spec.js
```

Test specs are in `e2e/`. Screenshots from test runs go to `e2e/screenshots/`.

### Linting

```bash
npm run lint
```

ESLint with React plugin rules. Zero-warning policy enforced.

## Versioning

Version is tracked in `version.json` at the project root. The `scripts/version.sh` script handles semver bumps and changelog generation.

```bash
npm run version:show     # Display current version
npm run version:patch    # 0.3.0 → 0.3.1
npm run version:minor    # 0.3.0 → 0.4.0
npm run version:major    # 0.3.0 → 1.0.0
```

The version is injected into the frontend build via Vite's `define` config (`__APP_VERSION__` and `__BUILD_TIME__` globals).

## Common Tasks

### Add a new API endpoint

1. Create route file in `server/src/routes/`
2. Create controller in `server/src/controllers/`
3. Mount route in `server/src/index.ts`
4. Add frontend API method in `src/services/api.js`

### Add a new page

1. Create component in `src/pages/`
2. Add route in `src/App.jsx`
3. Add nav link in `src/components/Navbar.jsx` and/or `MobileBottomNav.jsx`

### Modify the database schema

1. Edit `server/prisma/schema.prisma`
2. Run `cd server && npm run db:push` (dev) or `npm run db:migrate` (prod)
3. Prisma client regenerates automatically

### Add a translation

1. Add English string to `src/i18n/en.json`
2. Add Spanish string to `src/i18n/es.json`
3. Use in components via `const { t } = useTranslation(); t('key.path')`
