-- Replace showNostrFeed boolean with nostrFeedMode string
-- Migrate existing data: true -> "combined", false -> "off"

-- Add new column with default
ALTER TABLE "profiles" ADD COLUMN "nostr_feed_mode" TEXT NOT NULL DEFAULT 'combined';

-- Migrate existing values
UPDATE "profiles" SET "nostr_feed_mode" = CASE
    WHEN "show_nostr_feed" = 0 THEN 'off'
    ELSE 'combined'
END;

-- Drop old column
ALTER TABLE "profiles" DROP COLUMN "show_nostr_feed";
