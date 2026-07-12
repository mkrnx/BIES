-- Runtime feature toggles: JSON map of { [featureSlug]: boolean } on the
-- SiteSettings singleton. Missing slugs default to enabled, so existing rows
-- and future features need no backfill.
ALTER TABLE "site_settings" ADD COLUMN "feature_flags" TEXT NOT NULL DEFAULT '{}';
