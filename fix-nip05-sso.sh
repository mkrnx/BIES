#!/usr/bin/env bash
# fix-nip05-sso.sh — Make /.well-known/nostr.json publicly reachable on YunoHost
#
# Problem: YunoHost's SSOwat runs `access_by_lua_file /usr/share/ssowat/access.lua`
# at the server level in /etc/nginx/conf.d/buildinelsalvador.com.conf, which
# intercepts every request BEFORE location blocks execute their content phase.
# Even though /etc/nginx/conf.d/buildinelsalvador.com.d/nostr.conf declares the
# correct `location = /.well-known/nostr.json` proxy to the BIES Docker backend
# on 127.0.0.1:8082, SSOwat returns a 302 to /yunohost/sso first, so external
# Nostr clients (Damus, Amethyst, noStrudel, Iris, Coracle) get HTML instead of
# the JSON they need for NIP-05 verification and silently fail.
#
# Fix: add a new public permission entry `bies_nip05` to SSOwat's persistent
# config at /etc/ssowat/conf.json.persistent. SSOwat's config loader
# (/usr/share/ssowat/config.lua:75-101) deep-merges the persistent file over
# the main conf.json at request time, so adding a NEW top-level permission
# name under `permissions` adds it without overwriting any existing entry
# (editing `core_skipped` directly would REPLACE its entire uris list — don't).
#
# Note: BIES is NOT a YunoHost-packaged app — it's a custom Docker stack
# (bies-bies-nginx-1 bound to 127.0.0.1:8082, bies-bies-server-1, etc.).
# So `yunohost app setting` and `yunohost user permission` do not apply.
# Editing conf.json.persistent is the correct YunoHost-native override.
#
# Idempotent: re-run safely after YunoHost upgrades that may rewrite ssowat
# config (same pattern as brandkit/deploy-theme.sh for the theme).
#
# Usage:
#   sudo ./fix-nip05-sso.sh                     # default domain
#   sudo BIES_DOMAIN=buildinelsalvador.com ./fix-nip05-sso.sh

set -euo pipefail

DOMAIN="${BIES_DOMAIN:-buildinelsalvador.com}"
PERSIST_FILE="/etc/ssowat/conf.json.persistent"
PERMISSION_NAME="bies_nip05"

# ─── Sanity ──────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "!! Must run as root (use sudo)." >&2
  exit 1
fi

if ! command -v yunohost >/dev/null 2>&1; then
  echo "!! 'yunohost' command not found — this script must run on the YunoHost host." >&2
  exit 1
fi

if [[ ! -f "$PERSIST_FILE" ]]; then
  echo "!! $PERSIST_FILE does not exist — is SSOwat installed?" >&2
  exit 1
fi

# Confirm the backend nginx location block exists — without it, making the
# path public would just hit the apex `/ -> www` redirect.
NOSTR_CONF="/etc/nginx/conf.d/${DOMAIN}.d/nostr.conf"
if [[ ! -f "$NOSTR_CONF" ]]; then
  echo "!! $NOSTR_CONF not found — the nginx location block is missing." >&2
  echo "   Without it, /.well-known/nostr.json would fall through to the" >&2
  echo "   apex-to-www redirect even after the SSO bypass. Create it first." >&2
  exit 1
fi

# ─── Merge bies_nip05 into persistent SSOwat config ──────────────────────
echo ">> Backing up $PERSIST_FILE"
cp -a "$PERSIST_FILE" "${PERSIST_FILE}.bak.$(date +%s)"

echo ">> Injecting $PERMISSION_NAME permission for domain $DOMAIN"
python3 - "$PERSIST_FILE" "$DOMAIN" "$PERMISSION_NAME" <<'PY'
import json, sys, pathlib, re
path, domain, name = sys.argv[1], sys.argv[2], sys.argv[3]
p = pathlib.Path(path)
raw = p.read_text().strip() or "{}"
try:
    data = json.loads(raw)
except json.JSONDecodeError as e:
    sys.exit(f"!! {path} is not valid JSON: {e}")
data.setdefault("permissions", {})
domain_re = re.escape(domain).replace("/", r"\/")
data["permissions"][name] = {
    "auth_header": False,
    "public": True,
    "uris": [
        f"re:^{domain_re}/\\.well-known/nostr\\.json.*$"
    ],
    "users": []
}
tmp = p.with_suffix(p.suffix + ".tmp")
tmp.write_text(json.dumps(data, indent=4, sort_keys=True) + "\n")
tmp.replace(p)
print(p.read_text())
PY

# ─── Reload nginx (also invalidates SSOwat's shared-dict cache) ─────────
echo ">> Testing nginx config..."
nginx -t

echo ">> Reloading nginx..."
systemctl reload nginx

# ─── Verify ──────────────────────────────────────────────────────────────
echo ">> Verifying public access..."
STATUS_FILE="$(mktemp)"
trap 'rm -f "$STATUS_FILE"' EXIT

STATUS="$(curl -sS -o "$STATUS_FILE" -w '%{http_code}' \
  "https://${DOMAIN}/.well-known/nostr.json?name=__probe__" || true)"

if [[ "$STATUS" == "200" ]] && head -c1 "$STATUS_FILE" | grep -q '{'; then
  echo "   OK — HTTP $STATUS, JSON body:"
  head -c 300 "$STATUS_FILE"
  echo
  echo ""
  echo ">> NIP-05 endpoint is public."
  echo "   External check:  curl -i 'https://${DOMAIN}/.well-known/nostr.json?name=<user>'"
else
  echo "!! Verification failed — HTTP $STATUS" >&2
  echo "   Response preview:" >&2
  head -c 500 "$STATUS_FILE" >&2
  echo >&2
  echo "   Check /var/log/nginx/${DOMAIN}-error.log for details." >&2
  exit 1
fi
