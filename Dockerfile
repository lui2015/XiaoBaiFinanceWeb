# syntax=docker/dockerfile:1.6
# ---------- 1. deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
# 切换 alpine 到腾讯云镜像源 + npm 阿里源（国内构建加速）
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.tencent.com|g' /etc/apk/repositories && \
    apk add --no-cache libc6-compat openssl && \
    npm config set registry https://registry.npmmirror.com
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi

# ---------- 2. builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.tencent.com|g' /etc/apk/repositories && \
    apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# ---------- 3. runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.tencent.com|g' /etc/apk/repositories && \
    apk add --no-cache libc6-compat openssl tini && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8093
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 8093
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && if [ \"$RUN_SEED\" = \"1\" ]; then node node_modules/tsx/dist/cli.mjs prisma/seed.ts || true; fi && node node_modules/next/dist/bin/next start -p 8093 -H 0.0.0.0"]
