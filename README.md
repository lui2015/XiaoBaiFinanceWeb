# 小白财经（XiaoBaiFinance Web）

面向财经初学者的财经知识平台。C 端按需登录浏览，B 端管理员维护内容；支持分类、搜索、收藏、点赞、阅读历史与反馈。

## 功能概览

### C 端
- 首页轮播 + 推荐 + 分类入口
- 财经知识分类（基本面 / 技术面 / 行业研究 / 宏观经济 / 投资者心理 / 风险与合规 / 名词手册）
- 文章详情：HTML / Markdown 渲染、目录导航、字号调整、收藏 / 点赞 / 反馈
- 全站搜索（关键词高亮、热搜词、按分类筛选）
- 我的中心：收藏、阅读历史、反馈、账号设置（手机号、注销）
- 移动端响应式
- 按需登录：浏览免登录，互动（收藏/点赞/反馈）触发登录引导

### B 端
- 管理员登录（含密码错误锁定）
- 控制台（文章/用户/反馈统计 + TOP 10 文章/搜索词）
- 文章管理：HTML 上传、Markdown 上传、在线编辑三种创作方式；自动净化、自动 TOC、定时发布、推荐位、状态管理（草稿/发布/下架）
- 分类、标签、用户、反馈、Banner、推荐位、操作日志
- 多管理员（仅超级管理员可新增）

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 14 (App Router, RSC + Route Handler) |
| 语言 | TypeScript 5 |
| ORM / DB | Prisma 5 + MySQL 8.0 (utf8mb4 + ngram FULLTEXT) |
| 鉴权 | jose (Access JWT 短期 + Refresh HttpOnly Cookie) |
| 内容净化 | sanitize-html + jsdom + marked + shiki |
| PII 加密 | AES-256-GCM + HMAC-SHA256（双存：cipher + hash + masked） |
| 短信 | 腾讯云 SMS（mock 双轨） |
| 对象存储 | 腾讯云 COS（本地磁盘双轨） |
| 搜索 | MySQL LIKE / Elasticsearch 8（双轨，可切换） |
| 样式 | Tailwind CSS 3 |
| 限流 | 进程内令牌桶 + 固定窗口 |

## 目录结构

```
.
├── docker-compose.yml         # 本地 MySQL + ES
├── docs/                      # 需求/接口/线框/DDL
├── prisma/
│   ├── schema.prisma          # 17 张核心表
│   └── seed.ts                # 默认管理员 + 7 大类 + 8 篇示例文章
├── scripts/
│   ├── es-sync.ts             # ES 全量同步
│   └── scheduler.ts           # 定时发布执行器
└── src/
    ├── lib/                   # api/auth/jwt/prisma/sanitize/crypto/sms/storage/search/...
    ├── components/            # 通用组件
    ├── middleware.ts          # /admin/* 鉴权拦截
    └── app/
        ├── api/               # C/B 端 API（Route Handlers）
        ├── admin/             # B 端管理后台页面
        ├── (C 端首页/分类/文章/搜索/我的等)
        └── globals.css
```

## 快速开始

### 1. 准备环境
- Node.js 20+
- MySQL 8.0+（可使用 `docker-compose up -d mysql`）
- 可选：Elasticsearch 8（`docker-compose up -d es`）

### 2. 安装依赖
```bash
npm install
```

### 3. 配置 .env
```bash
cp .env.example .env
# 修改 DATABASE_URL、JWT_*_SECRET、PII_ENC_KEY
# PII_ENC_KEY 生成：node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 4. 初始化数据库
```bash
npm run prisma:generate
npm run prisma:migrate -- --name init   # 首次
npm run prisma:seed                     # 写入默认管理员 + 示例数据
```

默认账号：
- 管理员：`admin` / `Admin@12345`（首次登录请立即修改）

### 5. 启动
```bash
npm run dev                  # 开发
# 或：
npm run build && npm start   # 生产

# 可选：定时发布执行器（独立进程或 crontab）
npm run scheduler

# 可选：使用 Elasticsearch
SEARCH_PROVIDER=es npm run es:sync   # 一次性全量同步
```

访问：
- C 端：http://localhost:3000
- B 端：http://localhost:3000/admin/login

## 安全要点

- **HTML/Markdown 净化**：`src/lib/sanitize.ts` 白名单策略，移除脚本/事件属性/危险协议；外链统一加 `rel="noopener nofollow ugc"`、`target="_blank"`。
- **PII 双存**：手机号 / 邮箱以 `hash`（HMAC-SHA256，用于查找）+ `cipher`（AES-256-GCM，用于回显）+ `masked`（脱敏展示）三列存储；秘钥仅来自环境变量。
- **JWT**：Access 短期（15min），Refresh HttpOnly + SameSite=lax + Secure（生产）；登出走撤销。
- **CSP / 头部**：`next.config.mjs` 配置 CSP、X-Frame-Options、Referrer-Policy、Permissions-Policy 等。
- **限流**：登录、短信、搜索、点赞/反馈均有限流；短信附手机号日上限。
- **文件上传**：双重校验（MIME + 魔数），大小限制；存储桶私有读取，封面通过 CDN base URL。
- **SQL 注入**：Prisma 参数化；动态搜索 SQL 仅使用 `?` 占位与白名单字段。
- **SSRF / RCE**：本项目不做服务端拉取外链；所有命令均不走 shell。
- **越权**：`requireUser` / `requireAdmin` 二级会话 + 资源 ownership 检查。

## 常见运维操作

| 操作 | 命令 |
| --- | --- |
| Prisma Studio | `npm run prisma:studio` |
| 重新构建 ES 索引 | `npm run es:sync` |
| 单次扫描定时发布 | `ONESHOT=1 npm run scheduler` |
| 重新种子 | `npm run prisma:seed`（幂等：已有用户名跳过） |

## 开发约定

- 所有 API 统一返回 `{ code, message, data, traceId }`；BigInt 经 `jsonSafe()` 处理。
- Server Component 优先；客户端 hooks 仅用于交互组件。
- 不在 `middleware.ts` 中访问数据库（Edge Runtime 限制）。
- 提交前：`npm run lint`。

## 许可
内部项目。

