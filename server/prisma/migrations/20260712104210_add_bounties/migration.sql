-- CreateTable
CREATE TABLE "bounties" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poster_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "reward_type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "winner_submission_id" TEXT,
    "nostr_event_id" TEXT,
    "deadline" DATETIME,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "awarded_at" DATETIME,
    "paid_at" DATETIME,
    "paid_via" TEXT,
    "zap_receipt_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "bounties_poster_id_fkey" FOREIGN KEY ("poster_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bounties_winner_submission_id_fkey" FOREIGN KEY ("winner_submission_id") REFERENCES "bounty_submissions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bounty_submissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bounty_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "bounty_submissions_bounty_id_fkey" FOREIGN KEY ("bounty_id") REFERENCES "bounties" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bounty_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_scores" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "monthly_points" INTEGER NOT NULL DEFAULT 0,
    "lifetime_points" INTEGER NOT NULL DEFAULT 0,
    "bounty_points" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "current_month" TEXT NOT NULL,
    "last_scored_note_at" DATETIME,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "last_active_day" TEXT,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "reactions_given" INTEGER NOT NULL DEFAULT 0,
    "reactions_received" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_scores" ("current_month", "last_active_day", "last_scored_note_at", "level", "lifetime_points", "monthly_points", "post_count", "reactions_given", "reactions_received", "reply_count", "streak_days", "updated_at", "user_id") SELECT "current_month", "last_active_day", "last_scored_note_at", "level", "lifetime_points", "monthly_points", "post_count", "reactions_given", "reactions_received", "reply_count", "streak_days", "updated_at", "user_id" FROM "user_scores";
DROP TABLE "user_scores";
ALTER TABLE "new_user_scores" RENAME TO "user_scores";
CREATE INDEX "user_scores_monthly_points_idx" ON "user_scores"("monthly_points");
CREATE INDEX "user_scores_lifetime_points_idx" ON "user_scores"("lifetime_points");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "bounties_winner_submission_id_key" ON "bounties"("winner_submission_id");

-- CreateIndex
CREATE INDEX "bounties_status_created_at_idx" ON "bounties"("status", "created_at");

-- CreateIndex
CREATE INDEX "bounties_poster_id_idx" ON "bounties"("poster_id");

-- CreateIndex
CREATE INDEX "bounty_submissions_user_id_idx" ON "bounty_submissions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bounty_submissions_bounty_id_user_id_key" ON "bounty_submissions"("bounty_id", "user_id");
