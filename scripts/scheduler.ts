/**
 * 定时发布执行器
 *
 * 行为：
 *   每 INTERVAL_SEC 秒扫描 article（status=0 草稿 或 status=2 下架），
 *   若 scheduledAt <= now 则发布：
 *     - status = 1
 *     - publishAt = scheduledAt（若未设置 publishAt）
 *     - 调用搜索引擎 upsert
 *
 * 使用：
 *   npm run scheduler         # 常驻进程
 *   ONESHOT=1 npm run scheduler  # 仅扫描一次（适合 crontab）
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { getSearch } from '../src/lib/search';

const INTERVAL_SEC = Number(process.env.SCHEDULER_INTERVAL_SEC || 30);
const search = getSearch();

async function tick() {
  const now = new Date();
  const list = await prisma.article.findMany({
    where: {
      status: { in: [0, 2] },
      deletedAt: null,
      scheduledAt: { lte: now, not: null },
    },
    select: { id: true, scheduledAt: true, publishAt: true, title: true },
    take: 100,
  });
  if (list.length === 0) return;

  for (const a of list) {
    try {
      await prisma.article.update({
        where: { id: a.id },
        data: {
          status: 1,
          publishAt: a.publishAt || a.scheduledAt || now,
          scheduledAt: null,
        },
      });
      await search.upsertArticle(a.id).catch(() => {});
      console.log(`[scheduler] 已发布 #${a.id} ${a.title}`);
    } catch (e) {
      console.error(`[scheduler] 发布失败 #${a.id}:`, e);
    }
  }
}

async function main() {
  console.log(`[scheduler] 启动，扫描间隔 ${INTERVAL_SEC}s`);
  await tick();
  if (process.env.ONESHOT === '1') return;
  setInterval(() => { tick().catch(console.error); }, INTERVAL_SEC * 1000);
  // 保持进程
  process.stdin.resume();
}

main().catch((e) => { console.error(e); process.exit(1); });
