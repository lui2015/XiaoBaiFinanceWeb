-- CreateTable
CREATE TABLE "category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parent_id" BIGINT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "category" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "article" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "source_type" INTEGER NOT NULL DEFAULT 0,
    "content_md" TEXT,
    "content_html" TEXT NOT NULL,
    "content_text" TEXT NOT NULL,
    "cover_url" TEXT,
    "category_id" BIGINT NOT NULL,
    "sub_category_id" BIGINT,
    "status" INTEGER NOT NULL DEFAULT 0,
    "is_recommend" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "author_admin_id" BIGINT,
    "publish_at" DATETIME,
    "scheduled_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "article_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "article_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "article_tag" (
    "article_id" BIGINT NOT NULL,
    "tag_id" BIGINT NOT NULL,

    PRIMARY KEY ("article_id", "tag_id"),
    CONSTRAINT "article_tag_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_user" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "real_name" TEXT,
    "role" INTEGER NOT NULL DEFAULT 1,
    "status" INTEGER NOT NULL DEFAULT 1,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" DATETIME,
    "last_login_at" DATETIME,
    "last_login_ip" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone_hash" TEXT,
    "phone_cipher" TEXT,
    "phone_masked" TEXT,
    "email_hash" TEXT,
    "email_cipher" TEXT,
    "email_masked" TEXT,
    "password_hash" TEXT,
    "username" TEXT,
    "nickname" TEXT NOT NULL,
    "avatar_url" TEXT,
    "status" INTEGER NOT NULL DEFAULT 0,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "cancel_at" DATETIME,
    "registered_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" DATETIME,
    "last_login_ip" TEXT,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" DATETIME,
    "wechat_openid" TEXT,
    "wechat_unionid" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_favorite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "article_id" BIGINT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_favorite_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_like" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "article_id" BIGINT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_like_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_history" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "article_id" BIGINT NOT NULL,
    "viewed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_history_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_feedback" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "article_id" BIGINT NOT NULL,
    "type" INTEGER NOT NULL,
    "content" TEXT,
    "status" INTEGER NOT NULL DEFAULT 0,
    "handler_id" BIGINT,
    "handled_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_feedback_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sms_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone_hash" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "ip" TEXT,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expired_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" BIGINT NOT NULL,
    "jti" TEXT NOT NULL,
    "ua" TEXT,
    "ip" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "expired_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "operation_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "admin_id" BIGINT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "payload" TEXT,
    "ip" TEXT,
    "ua" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "search_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyword" TEXT NOT NULL,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "ua" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "article_view_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "article_id" BIGINT NOT NULL,
    "user_id" BIGINT,
    "ip" TEXT,
    "ua" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "banner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "link_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "start_at" DATETIME,
    "end_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "home_recommend" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "article_id" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sys_config" (
    "k" TEXT NOT NULL PRIMARY KEY,
    "v" TEXT NOT NULL,
    "remark" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE INDEX "category_parent_id_idx" ON "category"("parent_id");

-- CreateIndex
CREATE INDEX "category_status_sort_order_idx" ON "category"("status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "article_slug_key" ON "article"("slug");

-- CreateIndex
CREATE INDEX "article_status_publish_at_idx" ON "article"("status", "publish_at");

-- CreateIndex
CREATE INDEX "article_category_id_status_publish_at_idx" ON "article"("category_id", "status", "publish_at");

-- CreateIndex
CREATE INDEX "article_sub_category_id_idx" ON "article"("sub_category_id");

-- CreateIndex
CREATE INDEX "article_scheduled_at_idx" ON "article"("scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "tag_name_key" ON "tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tag_slug_key" ON "tag"("slug");

-- CreateIndex
CREATE INDEX "article_tag_tag_id_idx" ON "article_tag"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_username_key" ON "admin_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_hash_key" ON "user"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_hash_key" ON "user"("email_hash");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_wechat_openid_key" ON "user"("wechat_openid");

-- CreateIndex
CREATE INDEX "user_status_idx" ON "user"("status");

-- CreateIndex
CREATE INDEX "user_favorite_article_id_idx" ON "user_favorite"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_favorite_user_id_article_id_key" ON "user_favorite"("user_id", "article_id");

-- CreateIndex
CREATE INDEX "user_like_article_id_idx" ON "user_like"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_like_user_id_article_id_key" ON "user_like"("user_id", "article_id");

-- CreateIndex
CREATE INDEX "user_history_user_id_viewed_at_idx" ON "user_history"("user_id", "viewed_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_history_user_id_article_id_key" ON "user_history"("user_id", "article_id");

-- CreateIndex
CREATE INDEX "user_feedback_article_id_type_idx" ON "user_feedback"("article_id", "type");

-- CreateIndex
CREATE INDEX "user_feedback_user_id_created_at_idx" ON "user_feedback"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_feedback_status_idx" ON "user_feedback"("status");

-- CreateIndex
CREATE INDEX "sms_log_phone_hash_created_at_idx" ON "sms_log"("phone_hash", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_jti_key" ON "refresh_token"("jti");

-- CreateIndex
CREATE INDEX "refresh_token_user_id_idx" ON "refresh_token"("user_id");

-- CreateIndex
CREATE INDEX "operation_log_admin_id_created_at_idx" ON "operation_log"("admin_id", "created_at");

-- CreateIndex
CREATE INDEX "search_log_keyword_idx" ON "search_log"("keyword");

-- CreateIndex
CREATE INDEX "search_log_created_at_idx" ON "search_log"("created_at");

-- CreateIndex
CREATE INDEX "article_view_log_article_id_created_at_idx" ON "article_view_log"("article_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "home_recommend_article_id_key" ON "home_recommend"("article_id");
