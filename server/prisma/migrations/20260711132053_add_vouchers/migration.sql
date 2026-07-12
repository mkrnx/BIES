-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'RELAY_ACCESS',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "label" TEXT NOT NULL DEFAULT '',
    "price_sats" INTEGER NOT NULL DEFAULT 0,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" DATETIME,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "vouchers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "voucher_redemptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voucher_id" TEXT NOT NULL,
    "pubkey" TEXT,
    "user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "invoice_hash" TEXT,
    "bolt11" TEXT NOT NULL DEFAULT '',
    "amount_sats" INTEGER NOT NULL DEFAULT 0,
    "ip_address" TEXT,
    "redeemed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voucher_redemptions_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "voucher_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE INDEX "vouchers_type_idx" ON "vouchers"("type");

-- CreateIndex
CREATE INDEX "vouchers_status_idx" ON "vouchers"("status");

-- CreateIndex
CREATE INDEX "voucher_redemptions_voucher_id_idx" ON "voucher_redemptions"("voucher_id");

-- CreateIndex
CREATE INDEX "voucher_redemptions_pubkey_idx" ON "voucher_redemptions"("pubkey");

-- CreateIndex
CREATE INDEX "voucher_redemptions_status_idx" ON "voucher_redemptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_redemptions_voucher_id_pubkey_key" ON "voucher_redemptions"("voucher_id", "pubkey");
