-- AlterTable: Add Coinos custodial wallet fields to profiles
ALTER TABLE "profiles" ADD COLUMN "coinos_username" TEXT;
ALTER TABLE "profiles" ADD COLUMN "coinos_token" TEXT;

-- CreateIndex: Unique constraint on coinos_username
CREATE UNIQUE INDEX "profiles_coinos_username_key" ON "profiles"("coinos_username");
