-- AlterTable: Add non-custodial Lightning ticketing fields to events
ALTER TABLE "events" ADD COLUMN "price_sats" INTEGER;
ALTER TABLE "events" ADD COLUMN "ticket_capacity" INTEGER;
ALTER TABLE "events" ADD COLUMN "payout_lightning_address" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "amount_sats" INTEGER NOT NULL,
    "bolt11" TEXT NOT NULL,
    "payment_hash" TEXT NOT NULL,
    "preimage" TEXT NOT NULL DEFAULT '',
    "verify_url" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" DATETIME,
    "checked_in_at" DATETIME,
    CONSTRAINT "tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tickets_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_payment_hash_key" ON "tickets"("payment_hash");

-- CreateIndex
CREATE INDEX "tickets_event_id_idx" ON "tickets"("event_id");

-- CreateIndex
CREATE INDEX "tickets_buyer_id_idx" ON "tickets"("buyer_id");
