-- CreateTable
CREATE TABLE "cowork_venues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "area" TEXT NOT NULL DEFAULT '',
    "lat" REAL,
    "lng" REAL,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cowork_venues_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cowork_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "host_id" TEXT NOT NULL,
    "venue_id" TEXT,
    "location_name" TEXT NOT NULL DEFAULT '',
    "lat" REAL,
    "lng" REAL,
    "note" TEXT NOT NULL DEFAULT '',
    "amenities" TEXT NOT NULL DEFAULT '[]',
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cowork_sessions_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cowork_sessions_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "cowork_venues" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cowork_attendees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cowork_attendees_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "cowork_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cowork_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "cowork_venues_name_area_key" ON "cowork_venues"("name", "area");

-- CreateIndex
CREATE INDEX "cowork_venues_area_idx" ON "cowork_venues"("area");

-- CreateIndex
CREATE INDEX "cowork_sessions_status_idx" ON "cowork_sessions"("status");

-- CreateIndex
CREATE INDEX "cowork_sessions_host_id_idx" ON "cowork_sessions"("host_id");

-- CreateIndex
CREATE INDEX "cowork_sessions_venue_id_idx" ON "cowork_sessions"("venue_id");

-- CreateIndex
CREATE UNIQUE INDEX "cowork_attendees_session_id_user_id_key" ON "cowork_attendees"("session_id", "user_id");

-- CreateIndex
CREATE INDEX "cowork_attendees_user_id_idx" ON "cowork_attendees"("user_id");
