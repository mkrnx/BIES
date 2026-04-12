-- Add Bolt12 offer to profiles
ALTER TABLE "profiles" ADD COLUMN "bolt12_offer" TEXT NOT NULL DEFAULT '';

-- Add Bolt12 invoice to zap receipts
ALTER TABLE "zap_receipts" ADD COLUMN "bolt12" TEXT NOT NULL DEFAULT '';
