#!/bin/bash
#
# strfry write policy plugin for BIES private relay.
# Reads events from stdin (JSON), checks if the pubkey is in the whitelist file.
# Outputs accept/reject JSON.
#
# Whitelist file: /app/data/whitelist.txt (one hex pubkey per line)
# The BIES backend appends pubkeys to this file on successful login.

WHITELIST_FILE="/app/data/whitelist.txt"

while read -r line; do
    # Extract the pubkey from the event JSON
    pubkey=$(echo "$line" | jq -r '.event.pubkey // empty')

    if [ -z "$pubkey" ]; then
        # No pubkey in event — reject
        echo '{"id":"","action":"reject","msg":"missing pubkey"}'
        continue
    fi

    # Check if pubkey is in whitelist
    if [ -f "$WHITELIST_FILE" ] && grep -qxF "$pubkey" "$WHITELIST_FILE"; then
        echo "{\"id\":\"$(echo "$line" | jq -r '.event.id')\",\"action\":\"accept\",\"msg\":\"\"}"
    else
        echo "{\"id\":\"$(echo "$line" | jq -r '.event.id')\",\"action\":\"reject\",\"msg\":\"pubkey not whitelisted on BIES relay\"}"
    fi
done
