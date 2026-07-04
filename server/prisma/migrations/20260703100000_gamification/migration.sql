-- CreateTable
CREATE TABLE "point_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "nostr_event_id" TEXT,
    "kind" INTEGER,
    "reason" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "target_event_id" TEXT,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "point_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_scores" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "monthly_points" INTEGER NOT NULL DEFAULT 0,
    "lifetime_points" INTEGER NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "month" TEXT NOT NULL DEFAULT '',
    "nostr_award_event_id" TEXT,
    "awarded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leaderboard_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "point_events_user_id_month_idx" ON "point_events"("user_id", "month");

-- CreateIndex
CREATE INDEX "point_events_user_id_target_event_id_idx" ON "point_events"("user_id", "target_event_id");

-- CreateIndex
CREATE INDEX "point_events_user_id_reason_created_at_idx" ON "point_events"("user_id", "reason", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "point_events_nostr_event_id_user_id_reason_key" ON "point_events"("nostr_event_id", "user_id", "reason");

-- CreateIndex
CREATE INDEX "user_scores_monthly_points_idx" ON "user_scores"("monthly_points");

-- CreateIndex
CREATE INDEX "user_scores_lifetime_points_idx" ON "user_scores"("lifetime_points");

-- CreateIndex
CREATE INDEX "user_badges_user_id_idx" ON "user_badges"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_id_month_key" ON "user_badges"("user_id", "badge_id", "month");

-- CreateIndex
CREATE INDEX "leaderboard_snapshots_month_rank_idx" ON "leaderboard_snapshots"("month", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_snapshots_month_user_id_key" ON "leaderboard_snapshots"("month", "user_id");

