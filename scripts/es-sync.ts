/**
 * Elasticsearch 全量同步脚本
 *
 * 用法：
 *   1. 设置 .env：SEARCH_PROVIDER=es、ES_NODE 等
 *   2. 执行：  npm run es:sync
 *
 * 行为：
 *   - 创建/重建 xb_article 索引（含 IK 分词器，缺失时回退 standard）
 *   - 全量导入 status=1 且未删除的文章
 *   - 使用 bulk 分批写入（每批 200 条）
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const INDEX = process.env.ES_INDEX_ARTICLE || 'xb_article';
const BATCH = 200;

async function main() {
  if ((process.env.SEARCH_PROVIDER || 'mysql') !== 'es') {
    console.warn('[es-sync] SEARCH_PROVIDER != es，仍将尝试连接 ES。');
  }
  const { Client } = await import('@elastic/elasticsearch');
  const client = new Client({
    node: process.env.ES_NODE!,
    auth: process.env.ES_USERNAME
      ? { username: process.env.ES_USERNAME!, password: process.env.ES_PASSWORD! }
      : undefined,
  });

  // 探测 IK 分词
  let analyzer = 'standard';
  try {
    await client.indices.analyze({ body: { analyzer: 'ik_max_word', text: '探测' } });
    analyzer = 'ik_max_word';
    console.log('[es-sync] 使用 ik_max_word 分词器');
  } catch {
    console.log('[es-sync] 未检测到 IK 分词器，回退 standard');
  }

  const exists = await client.indices.exists({ index: INDEX });
  if (exists) {
    console.log(`[es-sync] 删除已存在索引 ${INDEX}`);
    await client.indices.delete({ index: INDEX });
  }
  console.log(`[es-sync] 创建索引 ${INDEX}`);
  await client.indices.create({
    index: INDEX,
    body: {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: {
        properties: {
          id:           { type: 'keyword' },
          title:        { type: 'text', analyzer, search_analyzer: analyzer },
          slug:         { type: 'keyword' },
          summary:      { type: 'text', analyzer, search_analyzer: analyzer },
          content_text: { type: 'text', analyzer, search_analyzer: analyzer },
          status:       { type: 'short' },
          categoryId:   { type: 'keyword' },
          publishAt:    { type: 'date' },
        },
      },
    },
  });

  let cursor: number | null = null;
  let total = 0;
  while (true) {
    const rows: any[] = await prisma.article.findMany({
      where: {
        status: 1,
        deletedAt: null,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: BATCH,
      select: {
        id: true, title: true, slug: true, summary: true,
        contentText: true, status: true, categoryId: true, publishAt: true,
      },
    });
    if (rows.length === 0) break;

    const operations = rows.flatMap((a) => [
      { index: { _index: INDEX, _id: String(a.id) } },
      {
        id: String(a.id),
        title: a.title,
        slug: a.slug,
        summary: a.summary,
        content_text: a.contentText,
        status: a.status,
        categoryId: String(a.categoryId),
        publishAt: a.publishAt,
      },
    ]);
    const resp: any = await client.bulk({ refresh: false, operations });
    if (resp.errors) {
      const firstErr = resp.items.find((it: any) => it.index?.error)?.index?.error;
      console.error('[es-sync] bulk 部分失败：', firstErr);
    }
    total += rows.length;
    cursor = rows[rows.length - 1].id;
    console.log(`[es-sync] 已同步 ${total} 篇`);
  }

  await client.indices.refresh({ index: INDEX });
  console.log(`[es-sync] 完成，共同步 ${total} 篇文章。`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
