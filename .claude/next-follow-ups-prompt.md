# Prompt: BIES Follow-up Work (post directories + points launch)

Copy everything below into a new Claude Code session in `/home/meshgod/SovITservices/BIES`.

---

Main now contains the directories feature (PR #327), the points/gamification system (PR #329), and the cowork/customizable-navbar feature (PR #328). Work through the follow-up items below as ordered sessions — each on its own branch off a freshly synced main, each ending with runtime verification, a security check, a push, and a PR. Repo rules: conventional commits; NEVER add Co-Authored-By, "Generated with Claude Code", or Claude-Session lines to any commit or PR; don't bump version.json; check `git stash list` at start and report (there are ~28 old stashes — do not touch them).

Read `docs/points-gamification.md` and skim `docs/architecture.md` before starting.

## Known codebase facts (verified this month; re-locate by symbol, not line number)

- **Deploy footgun**: `deploy/auto-deploy.sh` rebuilds containers on new main commits; the server container CMD (Dockerfile, ~line 81) runs `npx prisma db push --skip-data-loss... --accept-data-loss` on EVERY boot instead of `prisma migrate deploy`. The Prisma migration history has drift: several tables/columns (feedback, investor_requests, users/site_settings/user_settings/profiles changes) were only ever applied via `db push` and have no migration files; the two new features' migrations (`20260703000000_add_directory_listings`, `20260703100000_gamification`) exist as files but were applied to running DBs via db push, so they're not in `_prisma_migrations` either.
- **Issuer infrastructure exists**: `server/src/services/issuer.service.ts` (`getIssuerKeys()` from env `BIES_ISSUER_PRIVKEY` hex/nsec, `publishAsIssuer(template)`, `getIssuerPubkey()`, `ensureIssuerWhitelisted()`) and `server/src/services/badges.publisher.ts` (kind-30009 definitions on boot, kind-8 awards, kind-30008 auto-accept for custodial users, `publishPendingAwards()` retry sweep in the maintenance loop). Deliberately badge-agnostic issuer so certification labels can reuse it.
- **Directory certification hooks exist**: `DirectoryListing` model has `certificationEventId String?`; `server/src/services/directoryReputation.service.ts` `recomputeListingScore()` handles the isCertified false→true transition (sets certifiedAt) and true→false (nulls it) — the phase-2 publish/revoke calls go exactly there. Listings are mirrored as kind-30402 via `publishDirectoryListing` in `server/src/services/nostr.service.ts`, signed by `memberUserId ?? ownerId`. Known caveat: when a listing's signing identity changes, the old kind-30402 remains on the relay under the old pubkey (needs a kind-5 delete).
- **AI quality hook is stubbed**: `server/src/services/quality.service.ts` `getQualityBonus(content): Promise<number|null>` returns null; it is ALREADY wired into `processEvent` in `server/src/services/points.service.ts` with the `QUALITY_BONUS` ledger reason, `meta.aiScore`, and daily-cap plumbing in place. Implementation spec lives in `docs/points-gamification.md` (env flag `AI_QUALITY_SCORING` + `ANTHROPIC_API_KEY`, cheap Haiku-class model, only scored kind-1 with stripped length ≥80, never during backfill, daily call cap ~200, graceful null on any error/unset key). No LLM SDK is currently a dependency.
- **Feed level chips were deferred**: `src/components/feed/NoteHeader.jsx` renders author name/avatar; adding a level chip needs a batch endpoint (`GET /api/points/levels?pubkeys=a,b,c` — cap ~50, cached) to avoid per-note fetches. Points API conventions: `server/src/controllers/points.controller.ts` + `points.routes.ts` (authenticate router-wide, redis `cacheKey`/`TTL` helpers in `server/src/services/redis.service.ts`). Level-chip visual language (from `src/pages/Leaderboard.jsx`): `var(--color-blue-tint)` bg + `var(--color-primary)` text, `Lv {n}`, radius-full.
- Dev/test gotchas: never use the stale `server/prisma/prisma/dev.db` — fresh scratch DB + `db push` for harnesses; dev strfry relay via `docker compose -f docker-compose.dev.yml up -d bies-relay` (port 7777, gitignored dev whitelist file); styled-jsx doesn't scope classes on React components nor JSX from statement-declared helper closures (`.page-root :global(.cls)` pattern); es.json is mostly unaccented; e2e harness pattern in `e2e/discover-mobile-tabs.spec.js`; never `git add` the untracked `e2e/screenshots/` leftovers; docker-compose `environment:` overrides `env_file` — never add empty-default secret entries.

## Session 1 — Deploy hardening (branch `fix/prisma-migrate-deploy`)

Replace the boot-time `db push --accept-data-loss` with a proper migration flow:
1. Reconcile history: generate baseline migration(s) for the drifted schema so a fresh `prisma migrate deploy` produces the current schema exactly (use `prisma migrate diff` against the real schema; verify by migrating a fresh scratch DB and diffing it against a `db push`-created one).
2. Change the server container CMD/entrypoint to `npx prisma migrate deploy` (keep `--skip-generate` semantics; generate at build time). For EXISTING deployed DBs, the entrypoint must baseline once: detect an unbaselined DB (tables exist but `_prisma_migrations` missing/incomplete) and run `prisma migrate resolve --applied <migration>` for each pre-existing migration before `migrate deploy`. Make this idempotent and safe on a brand-new empty DB too.
3. Verify all three paths on scratch DBs: fresh empty DB → full migrate; current-production-shaped DB (simulate: db push the schema, empty `_prisma_migrations`) → baseline + deploy without data loss (seed a row first and prove it survives); already-migrated DB → no-op.
4. Document in `docs/deployment.md`. This is the highest-risk change — be conservative, and call out in the PR that the first deploy after merge should be watched.

## Session 2 — Protocol-native certification (branch `feat/certification-protocol-events`)

Implement Feature A phase 2 using the existing issuer:
1. In `nostr.service.ts` (or a small `certification.publisher.ts` beside badges.publisher.ts): `publishCertificationLabel(listing)` → NIP-32 kind-1985 label signed by the issuer: `['L','xyz.sovit.bies.certification']`, `['l','certified','xyz.sovit.bies.certification']`, `['a','30402:<listingAuthorPubkey>:<listingId>']`, `['p',<memberPubkey>]` when linked; content = JSON `{score, computedAt}`. Store event id in `certificationEventId`.
2. One-time NIP-58 certified badge: definition kind-30009 `d='bies-network-certified'` (add artwork `public/badges/bies-network-certified.png` matching the existing generated set) + kind-8 award to the member pubkey when a LINKED listing is certified (skip when no memberUser).
3. Revocation: on isCertified true→false, publish kind-5 deletion of the stored label event (and the kind-8 if one was issued); null `certificationEventId`.
4. Also fix the identity-change caveat: when `updateListing`/admin changes `memberUserId` on an active listing, kind-5 the old kind-30402 before republishing under the new signer.
5. All best-effort (issuer key unset → silent skip, retry via a null-eventId sweep like `publishPendingAwards`). Verify end-to-end on the dev relay: certify → 1985 + 30009/8 events with correct tags; decertify → kind-5s; identity change → old 30402 deleted.

## Session 3 — AI quality scoring (branch `feat/ai-quality-scoring`)

Implement the stub per `docs/points-gamification.md`. BEFORE writing code, load the `claude-api` skill (if available in the session) or check current Anthropic docs for the correct cheap model id and SDK usage — do not trust stale model names. Then: add the official Anthropic SDK to `server/package.json`; config keys `aiQualityScoring` (env `AI_QUALITY_SCORING === 'true'`) + `anthropicApiKey`; implement `getQualityBonus` — single short completion scoring 0–3 against a rubric (substance/insight/relevance to a builder community; ignore length, links, greetings), 5s timeout, null on any error, no calls when flag/key unset, respect the existing daily-cap plumbing; never called during backfill (verify the call site already guarantees this — it does via the silent flag, confirm). Document cost expectations in the doc. Verify: flag on + key set → a long post gains a `QUALITY_BONUS` ledger row with `meta.aiScore`; flag off → zero API calls (assert via a mock/log); malformed API response → null, post still scores normally. Ship flag-off by default.

## Session 4 — Feed level chips (branch `feat/feed-level-chips`)

1. Batch endpoint `GET /api/points/levels?pubkeys=<csv>` (≤50 pubkeys, returns `{pubkey: {level, titleKey}}` for known scored users only, 60s cache keyed on the sorted set) in points.controller/routes.
2. Frontend: collect visible note author pubkeys in the feed (see how `src/pages/Feed.jsx` batches profile fetches — mirror that), fetch levels once per batch, render a small level chip in `NoteHeader.jsx` next to the author name (only when level ≥ 1; Leaderboard visual language above; must not shift layout on slow load).
3. Verify in the browser with seeded scored users; check dark mode; make sure ungated (this precedes the feature-toggle system — if the `points` runtime flag system from `.claude/feature-toggles-prompt.md` has been built by the time you run this, gate the chips on it).

## Also remind the user at the end (ops, not code)

- Set `BIES_ISSUER_PRIVKEY` on the production server (`openssl rand -hex 32` → `server/.env`) — pending NIP-58 awards auto-publish once set.
- Decide `GENESIS_CUTOFF` (Génesis badge stays dormant until set).
- A separate prompt exists for the runtime feature-toggle system: `.claude/feature-toggles-prompt.md`.
- ~28 old git stashes are accumulating (`git stash list`).

---
