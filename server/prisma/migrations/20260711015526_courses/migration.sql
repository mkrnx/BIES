-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "level" TEXT NOT NULL DEFAULT 'BEGINNER',
    "format" TEXT NOT NULL DEFAULT 'SELF_PACED',
    "cover_image" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "price_sats" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "review_note" TEXT NOT NULL DEFAULT '',
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "nostr_event_id" TEXT,
    "nostr_publish" TEXT NOT NULL DEFAULT 'bies',
    "badge_def_event_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "courses_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL DEFAULT '{}',
    "quiz_answer_key" TEXT,
    "duration_sec" INTEGER,
    "is_free_preview" BOOLEAN NOT NULL DEFAULT false,
    "nostr_event_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "course_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "completed_at" DATETIME,
    "certificate_event_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollment_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "completed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "lesson_progress_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollment_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "answers" TEXT NOT NULL DEFAULT '{}',
    "score_pct" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quiz_attempts_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "quiz_attempts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "course_purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "course_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_sats" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "zap_receipt_ids" TEXT NOT NULL DEFAULT '[]',
    "payment_hash" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_purchases_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "course_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_zap_receipts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "sender_pubkey" TEXT NOT NULL,
    "recipient_pubkey" TEXT NOT NULL,
    "amount_msats" BIGINT NOT NULL,
    "amount_sats" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "zapped_event_id" TEXT,
    "project_id" TEXT,
    "course_id" TEXT,
    "bolt11" TEXT NOT NULL DEFAULT '',
    "bolt12" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "zap_receipts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "zap_receipts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_zap_receipts" ("amount_msats", "amount_sats", "bolt11", "bolt12", "comment", "created_at", "event_id", "id", "project_id", "recipient_pubkey", "sender_pubkey", "zapped_event_id") SELECT "amount_msats", "amount_sats", "bolt11", "bolt12", "comment", "created_at", "event_id", "id", "project_id", "recipient_pubkey", "sender_pubkey", "zapped_event_id" FROM "zap_receipts";
DROP TABLE "zap_receipts";
ALTER TABLE "new_zap_receipts" RENAME TO "zap_receipts";
CREATE UNIQUE INDEX "zap_receipts_event_id_key" ON "zap_receipts"("event_id");
CREATE INDEX "zap_receipts_recipient_pubkey_idx" ON "zap_receipts"("recipient_pubkey");
CREATE INDEX "zap_receipts_project_id_idx" ON "zap_receipts"("project_id");
CREATE INDEX "zap_receipts_course_id_idx" ON "zap_receipts"("course_id");
CREATE INDEX "zap_receipts_sender_pubkey_idx" ON "zap_receipts"("sender_pubkey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "courses_status_is_published_idx" ON "courses"("status", "is_published");

-- CreateIndex
CREATE INDEX "courses_author_id_idx" ON "courses"("author_id");

-- CreateIndex
CREATE INDEX "lessons_course_id_position_idx" ON "lessons"("course_id", "position");

-- CreateIndex
CREATE INDEX "enrollments_user_id_idx" ON "enrollments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_course_id_user_id_key" ON "enrollments"("course_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_enrollment_id_lesson_id_key" ON "lesson_progress"("enrollment_id", "lesson_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_enrollment_id_lesson_id_idx" ON "quiz_attempts"("enrollment_id", "lesson_id");

-- CreateIndex
CREATE INDEX "course_purchases_user_id_idx" ON "course_purchases"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_purchases_course_id_user_id_key" ON "course_purchases"("course_id", "user_id");

