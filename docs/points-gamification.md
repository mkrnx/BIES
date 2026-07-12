# Points & Gamification

In-app recognition points for community activity, with levels, NIP-58 badges,
a monthly leaderboard, and admin tooling. The **PointEvent ledger is
authoritative** — `UserScore` rows (totals, counters, level) are a cache that
can always be rebuilt from it (`POST /api/admin/points/recompute`).

Key code:

| Piece | File |
|---|---|
| Scoring core (classify, anti-gaming, apply, levels, recompute) | `server/src/services/points.service.ts` |
| Relay indexer + backfill + monthly rollover | `server/src/services/points.indexer.ts` |
| Badge catalog + level titles | `server/src/services/badges.catalog.ts` |
| NIP-58 publishing (definitions/awards/profile badges) | `server/src/services/badges.publisher.ts` |
| BIES issuer identity | `server/src/services/issuer.service.ts` |
| AI quality hook (stub) | `server/src/services/quality.service.ts` |
| Member API | `server/src/controllers/points.controller.ts` (`/api/points/*`) |
| Admin API | `server/src/controllers/admin.controller.ts` (`/api/admin/points/*`) |
| Admin UI | `src/pages/admin/AdminPoints.jsx` (`/admin/points`) |

## Scoring rules

The scorer subscribes to **the private BIES relay only** (`NOSTR_PRIVATE_RELAY`,
kinds 1 and 7) — public-feed cross-posts do not score. Events are matched to
members by hex pubkey → `User.nostrPubkey`; banned/deleted/unknown pubkeys are
skipped. "Stripped" content = URLs and `nostr:` refs removed, whitespace
collapsed.

| Action | Condition | Points |
|---|---|---|
| Post | kind 1, no e-tag, not machine-generated, stripped length ≥ 10 | +2 author |
| Reply | kind 1 with e-tag, stripped length ≥ 10, not a self-reply | +3 author |
| Length bonus | stripped content ≥ 120 chars | +1 (folded into the post/reply row) |
| Reaction given | kind 7, content ≠ `-`, not a self-like, first reaction to that target | +1 reactor |
| Reaction received | same event; target author is a different active member | +1 target |

### Anti-gaming

- **Note rate limit** — 1 scored note per 60 s, compared against **event**
  `created_at` (backfill-safe). Violations still write a **0-point audit row**
  with `meta.rateLimited: true`.
- **Reaction dedup** — only the first reaction by a user to a given target
  event scores; repeats (even with new event ids) are skipped entirely.
- **Daily caps** (UTC, event-time based) — 20 scored reactions given per day
  (when capped, the received side is skipped too), and 100 total points per
  day. Capped actions write 0-point rows with `meta.dailyCapped: true`.
- **Ledger dedup** — unique `(nostrEventId, userId, reason)` constraint makes
  replay/backfill idempotent.
- Self-replies and self-likes never score.

## Levels & titles

`level = floor(sqrt(lifetimePoints / 10))` — L1 = 10, L5 = 250, L10 = 1000,
L20 = 4000 lifetime points. Titles (i18n `points.levels.*`):

| Level | Title |
|---|---|
| 0 | Visitante |
| 1 | Novato |
| 2 | Vecino |
| 3 | Constructor |
| 5 | Emprendedor |
| 7 | Embajador |
| 10 | Pionero |
| 15 | Volcanero |
| 20 | Leyenda de El Zonte |

Level-ups create a `LEVEL_UP` notification and a global
`{type:'gamification', event:'level_up'}` WebSocket broadcast
(pubkey/name/level/titleKey only) rendered by `GamificationToast`.

## Badge catalog (16)

Code-defined in `badges.catalog.ts`; awards live in `UserBadge`
(`(userId, badgeId, month)` unique — `month: ''` = permanent). Artwork:
`public/badges/<id>.png`. Names/descriptions localize via i18n
`points.badges.*`.

| Badge | Rarity | Earned by |
|---|---|---|
| `first-post` | common | 1st post |
| `first-reply` | common | 1st reply |
| `first-reaction` | common | 1st reaction given |
| `posts-25` | uncommon | 25 posts |
| `replies-50` | uncommon | 50 replies |
| `received-25` | uncommon | 25 reactions received |
| `streak-7` | uncommon | 7-day activity streak |
| `level-5` | uncommon | reach level 5 |
| `received-100` | rare | 100 reactions received |
| `streak-30` | rare | 30-day activity streak |
| `level-10` | rare | reach level 10 |
| `level-15` | rare | reach level 15 |
| `monthly-top3` | rare | monthly leaderboard top 3 (rollover only) |
| `monthly-first` (Corona del Volcán) | legendary | monthly leaderboard #1 (rollover only) |
| `level-20` | legendary | reach level 20 |
| `genesis` | legendary | account created on/before `GENESIS_CUTOFF` — **dormant until that env var is set** |

`checkBadges` runs after every scored event (idempotent); monthly badges are
awarded exclusively by the rollover job.

## Monthly rollover

A maintenance loop (boot + every 15 min) calls `runMonthlyRollover()`, which
is a cheap no-op except at a month boundary. When the previous month is open
(stale `UserScore.currentMonth` and no snapshot yet) it:

1. Snapshots the ranked monthly leaderboard into `LeaderboardSnapshot` in one
   atomic `createMany` — the **claim**: the `(month, userId)` unique
   constraint lets exactly one invocation insert the snapshot, even across
   concurrent/horizontally-scaled instances. Ranking uses the same tie-break
   as the live leaderboard (points DESC, `updatedAt` ASC, `userId` ASC), so
   frozen ranks match what users saw live.
2. **Claim winner only:** awards `monthly-top3` to ranks 1–3 and
   `monthly-first` to rank 1, then broadcasts
   `{type:'gamification', event:'monthly_winners', …}` — **in-app only**, no
   auto kind-1 winner note in v1. Losing invocations stand down without
   awarding or broadcasting.
3. Zeros the stale monthly buckets and evicts the leaderboard cache. (The
   scorer and read API also lazily normalize stale months per user.)

Lifetime points are never reset. Past months: `GET /api/points/months/:month`
(YYYY-MM). Idempotency: a later re-run short-circuits on the existing
snapshot; badge rows are additionally deduped by their own unique constraint.

## NIP-58 badge publishing

Badges are mirrored to Nostr so they show up in Amethyst/Primal/etc., signed
by a shared platform identity (`issuer.service.ts`):

- **Kind 30009** (replaceable) — one badge *definition* per catalog entry,
  published on server boot (`['d', badgeId]`, name, description,
  image/thumb = `<APP_PUBLIC_URL>/badges/<id>.png`). Republishing replaces by
  d-tag, so boot-time publishing is idempotent.
- **Kind 8** — an *award* per `UserBadge` insert
  (`['a','30009:<issuerPubkey>:<badgeId>'], ['p', memberPubkey]`); the event id
  is stored in `UserBadge.nostrAwardEventId`.
- **Kind 30008** — custodial users' *Profile Badges* lists are auto-maintained
  via the existing server-signing path, so their badges are visible in other
  clients without a manual "accept" step. Nostr-native users accept
  client-side as usual.

### Issuer key setup (`BIES_ISSUER_PRIVKEY`)

```bash
# generate once, keep out of version control
openssl rand -hex 32
```

Set it (hex or nsec) in the server environment (`.env` / docker-compose). On
boot the issuer pubkey is added to the relay write whitelist automatically.
When **unset**, everything in-app keeps working: awards are stored with a null
`nostrAwardEventId` and a single warning is logged. Awards with a null event
id (disabled issuer, publish failure, or backfill suppression) are retried by
`publishPendingAwards`, which runs after backfill and on every
maintenance-loop tick — so setting the key later back-publishes all existing
awards.

## Backfill & restart semantics

- **Empty ledger** (first boot / after a wipe): the indexer pages backwards
  through the relay's full kind-1/7 history, then processes everything in
  ascending event-time order with notifications, broadcasts and award
  publishing suppressed (`silent`), then recomputes all scores, sweeps badges,
  and bulk-publishes the pending NIP-58 awards. The result is deterministic:
  wiping the point tables and restarting rebuilds identical totals.
- **Restart with data**: resumes the live subscription from the last ledger
  row's event time minus a one-hour overlap; the ledger unique constraint
  absorbs the replayed window, so restarts never double-score.
- An unreachable relay is retried with capped exponential backoff.

## API

Member endpoints (`/api/points`, authenticated):
`GET /leaderboard?scope=monthly|lifetime`, `GET /me`, `GET /user/:pubkey`,
`GET /badges`, `GET /months/:month`. Leaderboards are cached for 60 s; the
cache is evicted on every live scoring apply, on the monthly rollover's
bucket reset, and on admin adjust/recompute, so fresh ranks never wait out
the TTL.

Admin endpoints (`/api/admin/points`, MOD/admin-gated, Zod-validated,
audit-logged, leaderboard cache invalidated on mutation):

| Endpoint | Purpose |
|---|---|
| `POST /adjust` | signed `ADMIN_ADJUST` ledger row (±1–1000, reason note required) — counters are never mutated directly |
| `GET /events` | browse the ledger (userId/reason filters, paginated) |
| `POST /recompute` | rebuild every `UserScore` from the ledger |
| `POST /badges/grant` | manually award a catalog badge (optional `month`) |
| `DELETE /badges/:userId/:badgeId` | revoke a **permanent** badge (monthly badges are rollover-owned) |

All of this is exposed in the admin panel at **`/admin/points`**.

## AI quality hook (deferred — how to implement later)

The scorer already calls `getQualityBonus(content): Promise<number|null>`
(`quality.service.ts`) for every scored post/reply. Today it is a no-op stub
returning `null`. The plumbing that already exists: the `QUALITY_BONUS`
ledger reason, `meta.aiScore`, and daily-cap enforcement on the bonus row —
so the future implementation is a **single-file drop-in**:

1. Gate behind an env flag (`AI_QUALITY_SCORING=true`) plus
   `ANTHROPIC_API_KEY`; when either is missing, keep returning `null`.
2. Call the Claude API (suggested model: `claude-haiku-4-5`) with a short
   rubric prompt rating the note's contribution quality; map the rating to an
   integer bonus of **0–3** and return it (`null` on any API error — fail
   open, never block scoring).
3. Only score notes worth evaluating: scored kind-1 posts/replies with
   stripped length ≥ 80 chars.
4. **Never call the API during backfill** (the scorer's `silent` option marks
   backfill; alternatively check it before calling) and add a daily API-call
   cap to bound spend.
5. The scorer then records the bonus as a `QUALITY_BONUS` row with
   `meta.aiScore`, subject to the existing 100-point daily cap — no scorer
   changes needed.

## Defaults chosen (changeable)

- Points count **private-relay activity only** — public-feed cross-posts
  don't score.
- Leaderboard is a standalone `/leaderboard` page with a Navbar trophy link.
- Monthly winners are announced **in-app only** (notification + toast); no
  automatic kind-1 note in v1.
- The `genesis` badge stays dormant until `GENESIS_CUTOFF` is set.
- Anti-gaming thresholds (60 s note rate limit, 20 reactions/day,
  100 points/day) are constants in `points.service.ts`.

## Environment variables

| Var | Purpose |
|---|---|
| `NOSTR_PRIVATE_RELAY` | relay the scorer subscribes to (private BIES relay) |
| `BIES_ISSUER_PRIVKEY` | platform Nostr key for NIP-58 publishing (blank = disabled, in-app unaffected) |
| `APP_PUBLIC_URL` | origin for badge artwork URLs in Nostr events |
| `GENESIS_CUTOFF` | ISO date; members created on/before it earn the Genesis badge (unset = dormant) |
