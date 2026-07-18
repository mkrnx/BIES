#!/bin/sh
# Boot-time database migration for the bies-server container.
#
# Replaces the old `prisma db push --accept-data-loss` boot step with
# `prisma migrate deploy`. Existing databases that predate migration
# tracking (schema was applied via db push, so `_prisma_migrations` is
# missing or lacks the baseline row) are baselined exactly once with
# `prisma migrate resolve --applied` — a bookkeeping-only step that
# never touches application tables. See docs/deployment.md (Migrations).
#
# Handled states:
#   1. Fresh/empty database          -> migrate deploy applies everything
#   2. Existing db-push-created DB   -> baseline once, then migrate deploy
#      (only after verifying the DB schema actually matches schema.prisma —
#      a restored old backup aborts loudly instead of being mis-baselined)
#   3. Already-migrated DB           -> migrate deploy is a no-op
# Any other state — including a failed/partial baseline row from an
# interrupted first boot — makes `migrate deploy` fail loudly with
# Prisma's own error (P3009) rather than being auto-"healed".
set -eu

BASELINE_MIGRATION="20260704000000_baseline"
SCHEMA_PATH="${PRISMA_SCHEMA_PATH:-/app/prisma/schema.prisma}"
SCHEMA_DIR=$(dirname "$SCHEMA_PATH")

log() { echo "[entrypoint] $*"; }

# Emergency escape hatch: DB_BOOT_MODE=push restores the legacy behavior.
if [ "${DB_BOOT_MODE:-migrate}" = "push" ]; then
  log "DB_BOOT_MODE=push — using legacy 'prisma db push' (no migration tracking)"
  npx prisma db push --skip-generate --accept-data-loss --schema "$SCHEMA_PATH"
else
  # Resolve the SQLite file path from DATABASE_URL. Relative paths are
  # relative to the schema directory (Prisma's own resolution rule).
  DB_PATH=""
  case "${DATABASE_URL:?DATABASE_URL is required}" in
    file:*)
      DB_PATH="${DATABASE_URL#file:}"
      DB_PATH="${DB_PATH%%\?*}"
      case "$DB_PATH" in
        /*) : ;;
        *) DB_PATH="$SCHEMA_DIR/$DB_PATH" ;;
      esac
      ;;
    *)
      log "DATABASE_URL is not a SQLite file: URL — skipping baseline detection"
      ;;
  esac

  if [ -n "$DB_PATH" ] && [ -s "$DB_PATH" ]; then
    tables=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations';")
    if [ "$tables" -gt 0 ]; then
      has_migrations_table=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations';")
      if [ "$has_migrations_table" = "0" ]; then
        baseline_rows=0
      else
        # Count rows in ANY state: a failed baseline row (finished_at NULL)
        # from an interrupted first boot must NOT be auto-resolved to
        # "applied" — migrate deploy below will fail loudly with P3009.
        baseline_rows=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM _prisma_migrations WHERE migration_name = '$BASELINE_MIGRATION';")
      fi
      if [ "$baseline_rows" = "0" ]; then
        log "Existing database without baseline record — verifying its schema matches schema.prisma before baselining"
        set +e
        diff_out=$(npx prisma migrate diff --from-url "file:$DB_PATH" --to-schema-datamodel "$SCHEMA_PATH" --exit-code 2>&1)
        diff_rc=$?
        set -e
        if [ "$diff_rc" -ne 0 ]; then
          log "ERROR: refusing to baseline — database schema does not match the expected baseline (or the check failed, rc=$diff_rc)."
          log "This usually means an old backup was restored or the DB predates the current schema."
          log "Options: restore the correct database file, or boot once with DB_BOOT_MODE=push to converge the schema, then remove it."
          log "See docs/deployment.md (Migrations). Schema diff follows:"
          echo "$diff_out"
          exit 1
        fi
        log "Schema matches — marking $BASELINE_MIGRATION as applied (bookkeeping only, no schema/data changes)"
        npx prisma migrate resolve --applied "$BASELINE_MIGRATION" --schema "$SCHEMA_PATH"
      fi
    fi
  fi

  log "Running prisma migrate deploy"
  npx prisma migrate deploy --schema "$SCHEMA_PATH"
fi

if [ "${1:-}" = "migrate-only" ]; then
  log "migrate-only requested — not starting the server"
  exit 0
fi

exec node dist/src/index.js
