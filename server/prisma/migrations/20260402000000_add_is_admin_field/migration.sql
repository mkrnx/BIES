-- Add is_admin boolean column (separate from role)
ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing ADMIN-role users: set is_admin flag and revert role to MEMBER
UPDATE "users" SET "is_admin" = true WHERE "role" = 'ADMIN';
UPDATE "users" SET "role" = 'MEMBER' WHERE "role" = 'ADMIN';
