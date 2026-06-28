-- ============================================================================
-- 小白财经 数据库 DDL
-- 引擎: InnoDB | 字符集: utf8mb4 | 排序: utf8mb4_0900_ai_ci
-- 适用: MySQL 8.0+
-- 设计原则:
--   1) 所有表带 created_at / updated_at；多数主表带 deleted_at（软删）
--   2) 主键 BIGINT 自增；外键不强制约束（业务层保证），用索引保证查询
--   3) 时间字段统一 DATETIME(3)，应用层使用 UTC 或带时区写入
--   4) 敏感字段（手机/邮箱）密文存储 + 哈希查询，详见注释
-- ============================================================================

-- 建议会话级
SET NAMES utf8mb4;
SET time_zone = '+08:00';

-- 库
CREATE DATABASE IF NOT EXISTS `xiaobai_finance`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE `xiaobai_finance`;

-- ============================================================================
-- 1. 分类
-- ============================================================================
DROP TABLE IF EXISTS `category`;
CREATE TABLE `category` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `parent_id`  BIGINT       NOT NULL DEFAULT 0      COMMENT '父分类 ID，0=一级',
  `name`       VARCHAR(64)  NOT NULL                COMMENT '名称',
  `code`       VARCHAR(64)  NOT NULL                COMMENT '英文 code，全局唯一',
  `icon`       VARCHAR(255) NULL                    COMMENT '图标 URL/emoji',
  `sort`       INT          NOT NULL DEFAULT 0      COMMENT '排序权重，小在前',
  `enabled`    TINYINT      NOT NULL DEFAULT 1      COMMENT '0停用 1启用',
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_category_code` (`code`),
  KEY `idx_category_parent_sort` (`parent_id`, `sort`),
  KEY `idx_category_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分类（最多两级）';

-- ============================================================================
-- 2. 文章
-- ============================================================================
DROP TABLE IF EXISTS `article`;
CREATE TABLE `article` (
  `id`               BIGINT        NOT NULL AUTO_INCREMENT,
  `title`            VARCHAR(120)  NOT NULL                COMMENT '标题',
  `slug`             VARCHAR(160)  NOT NULL                COMMENT 'URL 友好串，唯一',
  `summary`          VARCHAR(255)  NOT NULL DEFAULT ''     COMMENT '摘要 ≤120 字',
  `cover_url`        VARCHAR(512)  NOT NULL DEFAULT ''     COMMENT '封面图（站内 CDN）',
  `category_id`      BIGINT        NOT NULL                COMMENT '一级分类 ID',
  `sub_category_id`  BIGINT        NULL                    COMMENT '二级分类 ID',
  `source_type`      TINYINT       NOT NULL DEFAULT 0      COMMENT '0 HTML 1 Markdown 2 在线编辑',
  `content_md`       MEDIUMTEXT    NULL                    COMMENT '原始 Markdown（source_type=1）',
  `content_html`     MEDIUMTEXT    NOT NULL                COMMENT '净化后的 HTML（统一渲染口径）',
  `content_text`     MEDIUMTEXT    NOT NULL                COMMENT '抽取的纯文本，用于全文搜索',
  `tags_text`        VARCHAR(255)  NOT NULL DEFAULT ''     COMMENT '标签拼接（冗余，便于搜索高亮）',
  `status`           TINYINT       NOT NULL DEFAULT 0      COMMENT '0草稿 1已发布 2已下架',
  `pinned`           TINYINT       NOT NULL DEFAULT 0      COMMENT '是否置顶',
  `pin_sort`         INT           NOT NULL DEFAULT 0      COMMENT '置顶排序，越小越前',
  `view_count`       INT           NOT NULL DEFAULT 0      COMMENT '阅读量（最终一致）',
  `like_count`       INT           NOT NULL DEFAULT 0      COMMENT '点赞量',
  `favorite_count`   INT           NOT NULL DEFAULT 0      COMMENT '收藏量',
  `author_admin_id`  BIGINT        NULL                    COMMENT '创建管理员',
  `editor_admin_id`  BIGINT        NULL                    COMMENT '最近编辑管理员',
  `publish_at`       DATETIME(3)   NULL                    COMMENT '发布时间（status=1 时使用）',
  `created_at`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`       DATETIME(3)   NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_article_slug` (`slug`),
  KEY `idx_article_status_publish` (`status`, `publish_at` DESC),
  KEY `idx_article_category_status_publish` (`category_id`, `status`, `publish_at` DESC),
  KEY `idx_article_subcategory_status_publish` (`sub_category_id`, `status`, `publish_at` DESC),
  KEY `idx_article_pinned` (`pinned`, `pin_sort`),
  KEY `idx_article_deleted` (`deleted_at`),
  -- 全文索引（兜底方案；推荐生产用 ES 同步）
  FULLTEXT KEY `ftx_article_text` (`title`, `summary`, `content_text`, `tags_text`) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章';

-- ============================================================================
-- 3. 标签 & 文章标签
-- ============================================================================
DROP TABLE IF EXISTS `tag`;
CREATE TABLE `tag` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(32)  NOT NULL,
  `usage_count` INT         NOT NULL DEFAULT 0      COMMENT '冗余统计，引用数',
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tag_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签';

DROP TABLE IF EXISTS `article_tag`;
CREATE TABLE `article_tag` (
  `article_id` BIGINT      NOT NULL,
  `tag_id`     BIGINT      NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`article_id`, `tag_id`),
  KEY `idx_at_tag` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章-标签';

-- ============================================================================
-- 4. 管理员
-- ============================================================================
DROP TABLE IF EXISTS `admin_user`;
CREATE TABLE `admin_user` (
  `id`               BIGINT       NOT NULL AUTO_INCREMENT,
  `username`         VARCHAR(32)  NOT NULL                COMMENT '登录名',
  `password_hash`    VARCHAR(128) NOT NULL                COMMENT 'BCrypt 哈希',
  `password_must_change` TINYINT  NOT NULL DEFAULT 0      COMMENT '是否首次登录强制修改密码',
  `nickname`         VARCHAR(32)  NOT NULL DEFAULT ''     COMMENT '显示名',
  `role`             VARCHAR(16)  NOT NULL DEFAULT 'admin' COMMENT 'super/admin',
  `status`           TINYINT      NOT NULL DEFAULT 0      COMMENT '0正常 1禁用',
  `failed_attempts`  INT          NOT NULL DEFAULT 0      COMMENT '近期失败次数',
  `locked_until`     DATETIME(3)  NULL                    COMMENT '锁定到何时',
  `last_login_at`    DATETIME(3)  NULL,
  `last_login_ip`    VARCHAR(45)  NULL,
  `created_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`       DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员账号';

-- ============================================================================
-- 5. C 端用户
--   说明:
--     - phone_hash / email_hash: SHA-256(规范化值 + 应用盐) → 用于唯一索引与登录查询
--     - phone_cipher / email_cipher: AES-GCM 加密后的密文（含 nonce + tag），仅业务读取
--     - 严禁在日志/响应中明文输出
-- ============================================================================
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT,
  `phone_hash`     CHAR(64)     NULL                    COMMENT 'sha256(phone+salt)',
  `phone_cipher`   VARBINARY(255) NULL                  COMMENT 'AES-GCM(phone)',
  `phone_masked`   VARCHAR(20)  NULL                    COMMENT '展示用掩码 138****8821',
  `email_hash`     CHAR(64)     NULL                    COMMENT 'sha256(email_lower+salt)',
  `email_cipher`   VARBINARY(255) NULL                  COMMENT 'AES-GCM(email)',
  `email_masked`   VARCHAR(64)  NULL                    COMMENT '展示用掩码 a***@x.com',
  `password_hash`  VARCHAR(128) NULL                    COMMENT 'BCrypt（仅邮箱密码方式）',
  `nickname`       VARCHAR(32)  NOT NULL                COMMENT '默认 小白用户_xxxx',
  `avatar_url`     VARCHAR(512) NOT NULL DEFAULT ''     COMMENT '站内 CDN',
  `status`         TINYINT      NOT NULL DEFAULT 0      COMMENT '0正常 1封禁 2注销中 3已注销',
  `ban_reason`     VARCHAR(255) NULL,
  `ban_until`      DATETIME(3)  NULL,
  `cancel_at`      DATETIME(3)  NULL                    COMMENT '注销申请时间',
  `cancel_purge_at` DATETIME(3) NULL                    COMMENT '冷静期到期、PII 清理时间',
  `last_login_at`  DATETIME(3)  NULL,
  `last_login_ip`  VARCHAR(45)  NULL,
  `registered_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_phone_hash` (`phone_hash`),
  UNIQUE KEY `uk_user_email_hash` (`email_hash`),
  KEY `idx_user_status` (`status`),
  KEY `idx_user_registered` (`registered_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='C 端用户';

-- ============================================================================
-- 6. 收藏
-- ============================================================================
DROP TABLE IF EXISTS `user_favorite`;
CREATE TABLE `user_favorite` (
  `id`         BIGINT      NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT      NOT NULL,
  `article_id` BIGINT      NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_uf_user_article` (`user_id`, `article_id`),
  KEY `idx_uf_article` (`article_id`),
  KEY `idx_uf_user_created` (`user_id`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户收藏';

-- ============================================================================
-- 7. 点赞
-- ============================================================================
DROP TABLE IF EXISTS `user_like`;
CREATE TABLE `user_like` (
  `id`         BIGINT      NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT      NOT NULL,
  `article_id` BIGINT      NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ul_user_article` (`user_id`, `article_id`),
  KEY `idx_ul_article` (`article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户点赞';

-- ============================================================================
-- 8. 浏览历史 （单用户保留 200 条，超出由应用层滚动淘汰）
-- ============================================================================
DROP TABLE IF EXISTS `user_history`;
CREATE TABLE `user_history` (
  `id`         BIGINT      NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT      NOT NULL,
  `article_id` BIGINT      NOT NULL,
  `viewed_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_uh_user_article` (`user_id`, `article_id`),
  KEY `idx_uh_user_viewed` (`user_id`, `viewed_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户浏览历史';

-- ============================================================================
-- 9. 内容反馈
-- ============================================================================
DROP TABLE IF EXISTS `user_feedback`;
CREATE TABLE `user_feedback` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT       NOT NULL,
  `article_id`   BIGINT       NOT NULL,
  `type`         TINYINT      NOT NULL              COMMENT '0有用 1没用 2报错',
  `content`      VARCHAR(500) NOT NULL DEFAULT ''   COMMENT '描述（type=2 必填，前端 ≤200 字）',
  `status`       TINYINT      NOT NULL DEFAULT 0    COMMENT '0待处理 1处理中 2已采纳 3已修复 4已关闭',
  `handler_id`   BIGINT       NULL                  COMMENT '处理管理员 id',
  `remark`       VARCHAR(500) NULL                  COMMENT '处理备注',
  `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `handled_at`   DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  KEY `idx_uf_user_created` (`user_id`, `created_at` DESC),
  KEY `idx_uf_article_type` (`article_id`, `type`),
  KEY `idx_uf_status_created` (`status`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户内容反馈';

-- ============================================================================
-- 10. 短信验证码日志
-- ============================================================================
DROP TABLE IF EXISTS `sms_log`;
CREATE TABLE `sms_log` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT,
  `phone_hash` CHAR(64)     NOT NULL              COMMENT 'sha256(phone+salt)',
  `scene`      VARCHAR(16)  NOT NULL              COMMENT 'login/bind/cancel',
  `code_hash`  VARCHAR(128) NOT NULL              COMMENT 'BCrypt 或 sha256，禁止明文',
  `ip`         VARCHAR(45)  NULL,
  `ua`         VARCHAR(255) NULL,
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expired_at` DATETIME(3)  NOT NULL,
  `used`       TINYINT      NOT NULL DEFAULT 0    COMMENT '是否已使用',
  `used_at`    DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sms_phone_scene_created` (`phone_hash`, `scene`, `created_at` DESC),
  KEY `idx_sms_expired` (`expired_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='短信验证码日志';

-- ============================================================================
-- 11. 刷新 Token（可选，若使用服务端会话/旋转方案）
-- ============================================================================
DROP TABLE IF EXISTS `refresh_token`;
CREATE TABLE `refresh_token` (
  `id`         BIGINT      NOT NULL AUTO_INCREMENT,
  `subject_type` TINYINT   NOT NULL              COMMENT '0 user 1 admin',
  `subject_id` BIGINT      NOT NULL,
  `jti`        CHAR(36)    NOT NULL              COMMENT 'token 唯一 ID',
  `token_hash` CHAR(64)    NOT NULL              COMMENT 'sha256(token)',
  `ip`         VARCHAR(45) NULL,
  `ua`         VARCHAR(255) NULL,
  `revoked`    TINYINT     NOT NULL DEFAULT 0,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rt_jti` (`jti`),
  KEY `idx_rt_subject` (`subject_type`, `subject_id`),
  KEY `idx_rt_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='刷新 Token / 会话';

-- ============================================================================
-- 12. 管理员操作日志
-- ============================================================================
DROP TABLE IF EXISTS `operation_log`;
CREATE TABLE `operation_log` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `admin_id`     BIGINT       NOT NULL,
  `admin_name`   VARCHAR(32)  NOT NULL,
  `action`       VARCHAR(64)  NOT NULL              COMMENT '如 article.create',
  `target_type`  VARCHAR(32)  NULL,
  `target_id`    BIGINT       NULL,
  `payload`      JSON         NULL                  COMMENT '关键参数快照',
  `ip`           VARCHAR(45)  NULL,
  `ua`           VARCHAR(255) NULL,
  `result`       TINYINT      NOT NULL DEFAULT 1    COMMENT '0失败 1成功',
  `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_op_admin_created` (`admin_id`, `created_at` DESC),
  KEY `idx_op_action_created` (`action`, `created_at` DESC),
  KEY `idx_op_target` (`target_type`, `target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员操作日志（保留 ≥180 天）';

-- ============================================================================
-- 13. 搜索日志（用于热门搜索词、效果分析）
-- ============================================================================
DROP TABLE IF EXISTS `search_log`;
CREATE TABLE `search_log` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `keyword`      VARCHAR(64)  NOT NULL,
  `keyword_norm` VARCHAR(64)  NOT NULL              COMMENT '归一化后的关键词',
  `category_id`  BIGINT       NULL,
  `result_count` INT          NOT NULL DEFAULT 0,
  `user_id`      BIGINT       NULL,
  `ip`           VARCHAR(45)  NULL,
  `ua`           VARCHAR(255) NULL,
  `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_search_norm_created` (`keyword_norm`, `created_at` DESC),
  KEY `idx_search_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='搜索日志';

-- ============================================================================
-- 14. 文章浏览原始日志（防刷 + PV/UV 来源）
--   注意: 高写入量，建议按月分表或迁移至时序/数仓
-- ============================================================================
DROP TABLE IF EXISTS `article_view_log`;
CREATE TABLE `article_view_log` (
  `id`         BIGINT      NOT NULL AUTO_INCREMENT,
  `article_id` BIGINT      NOT NULL,
  `user_id`    BIGINT      NULL                COMMENT '未登录为 NULL',
  `session_id` CHAR(36)    NULL                COMMENT '前端会话 ID（防刷维度）',
  `ip`         VARCHAR(45) NULL,
  `ua`         VARCHAR(255) NULL,
  `referer`    VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_avl_article_created` (`article_id`, `created_at` DESC),
  KEY `idx_avl_session_article` (`session_id`, `article_id`),
  KEY `idx_avl_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章浏览日志';

-- ============================================================================
-- 15. Banner / 推荐位（运营可配置；一期可仅放 banner）
-- ============================================================================
DROP TABLE IF EXISTS `banner`;
CREATE TABLE `banner` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `title`       VARCHAR(64)  NOT NULL DEFAULT '',
  `image_url`   VARCHAR(512) NOT NULL,
  `link_url`    VARCHAR(512) NOT NULL DEFAULT ''   COMMENT '仅允许站内或白名单',
  `sort`        INT          NOT NULL DEFAULT 0,
  `enabled`     TINYINT      NOT NULL DEFAULT 1,
  `start_at`    DATETIME(3)  NULL,
  `end_at`      DATETIME(3)  NULL,
  `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`  DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  KEY `idx_banner_enabled_sort` (`enabled`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='首页 Banner';

-- ============================================================================
-- 16. 文章「编辑必读」推荐池（首页 8 篇）
-- ============================================================================
DROP TABLE IF EXISTS `home_recommend`;
CREATE TABLE `home_recommend` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT,
  `article_id` BIGINT       NOT NULL,
  `sort`       INT          NOT NULL DEFAULT 0,
  `enabled`    TINYINT      NOT NULL DEFAULT 1,
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_home_recommend_article` (`article_id`),
  KEY `idx_home_recommend_enabled_sort` (`enabled`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='首页推荐文章池';

-- ============================================================================
-- 17. 系统配置（KV，支撑后台可配置项）
-- ============================================================================
DROP TABLE IF EXISTS `sys_config`;
CREATE TABLE `sys_config` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT,
  `cfg_key`    VARCHAR(64)  NOT NULL,
  `cfg_value`  TEXT         NOT NULL,
  `remark`     VARCHAR(255) NULL,
  `updated_by` BIGINT       NULL,
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_cfg_key` (`cfg_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置';

-- ============================================================================
-- 初始化数据 (DML, 仅参考)
-- ============================================================================
INSERT INTO `category` (`id`, `parent_id`, `name`, `code`, `icon`, `sort`, `enabled`) VALUES
  (1, 0, '基础概念',  'basic',        '📘', 1, 1),
  (2, 0, '基本面分析','fundamental',  '📊', 2, 1),
  (3, 0, '技术面分析','technical',    '📈', 3, 1),
  (4, 0, '宏观经济',  'macro',        '🌐', 4, 1),
  (5, 0, '投资品种',  'instrument',   '💰', 5, 1),
  (6, 0, '理财规划',  'planning',     '🗓️', 6, 1),
  (7, 0, '行为金融',  'behavioral',   '🧠', 7, 1);

INSERT INTO `category` (`parent_id`, `name`, `code`, `sort`, `enabled`) VALUES
  (1, '股票常识', 'basic-stock', 1, 1),
  (1, '基金常识', 'basic-fund',  2, 1),
  (1, '债券常识', 'basic-bond',  3, 1),
  (2, '财报解读', 'fundamental-report',    1, 1),
  (2, '估值方法', 'fundamental-valuation', 2, 1),
  (3, 'K 线入门', 'technical-kline',       1, 1),
  (3, '均线 & 量价', 'technical-ma',       2, 1);

-- 默认超级管理员（密码请上线前由运维通过脚本生成 BCrypt 哈希后写入）
-- INSERT INTO `admin_user` (`username`, `password_hash`, `role`, `password_must_change`)
-- VALUES ('admin', '$2b$10$REPLACE_ME', 'super', 1);

-- 系统配置示例
INSERT INTO `sys_config` (`cfg_key`, `cfg_value`, `remark`) VALUES
  ('site.name',           '小白财经',                              '站点名称'),
  ('site.disclaimer',     '内容仅供学习参考，不构成投资建议。',    '免责声明'),
  ('user.history.max',    '200',                                   '单用户云端历史上限'),
  ('user.favorite.max',   '1000',                                  '单用户收藏上限'),
  ('sms.cooldown.seconds','60',                                    '短信验证码冷却'),
  ('sms.daily.limit',     '10',                                    '同号每日上限'),
  ('upload.html.max.kb',  '2048',                                  'HTML 上传上限'),
  ('upload.md.max.kb',    '1024',                                  'Markdown 上传上限'),
  ('upload.cover.max.kb', '500',                                   '封面图上限');

-- ============================================================================
-- 索引/性能补充建议（不写入 DDL，仅注释）
-- ----------------------------------------------------------------------------
--   * 高频读：article 详情走主键；列表走 idx_article_category_status_publish。
--   * 全文搜索：MySQL 8 ngram 兜底；生产建议 ES，文档结构同 article 主表字段。
--   * 计数字段（view/like/favorite_count）热点写：Redis incr 累加，定期回写。
--   * 浏览历史 user_history：按 user_id 哈希分库或归档冷数据；保留近 90 天热数据。
--   * article_view_log 高写入：建议按月分表 article_view_log_yyyymm 或迁数仓。
--   * 软删扫描：deleted_at 单列索引；查询条件统一加 `deleted_at IS NULL`。
-- ============================================================================
