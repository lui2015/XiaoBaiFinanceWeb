-- CreateTable
CREATE TABLE "open_api_key" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "name" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "last_used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,

    CONSTRAINT "open_api_key_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "open_api_key_key_hash_key" ON "open_api_key"("key_hash");

-- CreateIndex
CREATE INDEX "open_api_key_user_id_idx" ON "open_api_key"("user_id");

-- CreateTable
CREATE TABLE "open_api_call_stat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "date" TEXT NOT NULL,
    "call_count" BIGINT NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "open_api_call_stat_user_id_date_key" ON "open_api_call_stat"("user_id", "date");

-- CreateIndex
CREATE INDEX "open_api_call_stat_user_id_idx" ON "open_api_call_stat"("user_id");
