/**
 * 搜索服务抽象：MySQL FULLTEXT 或 Elasticsearch
 */
import { prisma } from './prisma';

export interface SearchHit {
  id: string;
  title: string;
  summary: string;
  slug: string;
  categoryId: string;
  publishAt: string | null;
  highlight?: { title?: string; content?: string };
}

export interface SearchResult {
  total: number;
  list: SearchHit[];
}

export interface SearchService {
  search(opts: { keyword: string; categoryId?: bigint; page: number; size: number }): Promise<SearchResult>;
  upsertArticle(id: bigint): Promise<void>;
  removeArticle(id: bigint): Promise<void>;
}

class MysqlSearch implements SearchService {
  async search({ keyword, categoryId, page, size }: { keyword: string; categoryId?: bigint; page: number; size: number }) {
    const offset = (page - 1) * size;
    const kw = `%${keyword}%`;
    const where: string[] = [`status = 1`, `deleted_at IS NULL`];
    const params: unknown[] = [];
    if (categoryId) { where.push(`category_id = ?`); params.push(categoryId); }
    where.push(`(title LIKE ? OR content_text LIKE ?)`);
    params.push(kw, kw);

    const sql = `
      SELECT id, title, slug, summary, category_id, publish_at,
             CASE WHEN title LIKE ? THEN 100 ELSE 50 END AS score
      FROM article
      WHERE ${where.join(' AND ')}
      ORDER BY score DESC, publish_at DESC
      LIMIT ? OFFSET ?`;
    const countSql = `SELECT COUNT(*) AS c FROM article WHERE ${where.join(' AND ')}`;

    const rows = await prisma.$queryRawUnsafe<any[]>(sql, kw, ...params, size, offset);
    const totalRows = await prisma.$queryRawUnsafe<any[]>(countSql, ...params);
    const total = Number(totalRows[0]?.c || 0);
    const re = new RegExp(escapeReg(keyword), 'gi');
    const list: SearchHit[] = rows.map((r) => ({
      id: String(r.id),
      title: r.title,
      summary: r.summary || '',
      slug: r.slug,
      categoryId: String(r.category_id),
      publishAt: r.publish_at ? new Date(r.publish_at).toISOString() : null,
      highlight: {
        title: r.title.replace(re, (m: string) => `<em>${m}</em>`),
        content: (r.summary || '').replace(re, (m: string) => `<em>${m}</em>`),
      },
    }));
    return { total, list };
  }
  async upsertArticle() { /* MySQL 不需要单独同步 */ }
  async removeArticle() { /* 同上 */ }
}

class ESSearch implements SearchService {
  private client: any;
  private index = process.env.ES_INDEX_ARTICLE || 'xb_article';
  private async getClient() {
    if (this.client) return this.client;
    const { Client } = await import('@elastic/elasticsearch');
    this.client = new Client({
      node: process.env.ES_NODE,
      auth: process.env.ES_USERNAME ? { username: process.env.ES_USERNAME!, password: process.env.ES_PASSWORD! } : undefined,
    });
    return this.client;
  }
  async search({ keyword, categoryId, page, size }: { keyword: string; categoryId?: bigint; page: number; size: number }) {
    const c = await this.getClient();
    const must: any[] = [
      { multi_match: { query: keyword, fields: ['title^3', 'summary^2', 'content_text'] } },
      { term: { status: 1 } },
    ];
    if (categoryId) must.push({ term: { categoryId: String(categoryId) } });
    const resp = await c.search({
      index: this.index,
      from: (page - 1) * size,
      size,
      query: { bool: { must } },
      highlight: { fields: { title: {}, summary: {}, content_text: {} } },
      sort: [{ _score: 'desc' }, { publishAt: { order: 'desc' } }],
    });
    const list: SearchHit[] = resp.hits.hits.map((h: any) => ({
      id: String(h._source.id),
      title: h._source.title,
      summary: h._source.summary || '',
      slug: h._source.slug,
      categoryId: String(h._source.categoryId),
      publishAt: h._source.publishAt,
      highlight: { title: h.highlight?.title?.[0], content: h.highlight?.summary?.[0] || h.highlight?.content_text?.[0] },
    }));
    return { total: resp.hits.total.value, list };
  }
  async upsertArticle(id: bigint) {
    const c = await this.getClient();
    const a = await prisma.article.findUnique({ where: { id } });
    if (!a) return;
    if (a.status !== 1 || a.deletedAt) {
      await c.delete({ index: this.index, id: String(a.id) }).catch(() => {});
      return;
    }
    await c.index({
      index: this.index,
      id: String(a.id),
      document: {
        id: String(a.id), title: a.title, slug: a.slug, summary: a.summary,
        content_text: a.contentText, status: a.status,
        categoryId: String(a.categoryId), publishAt: a.publishAt,
      },
    });
  }
  async removeArticle(id: bigint) {
    const c = await this.getClient();
    await c.delete({ index: this.index, id: String(id) }).catch(() => {});
  }
}

function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

let _instance: SearchService | null = null;
export function getSearch(): SearchService {
  if (_instance) return _instance;
  const provider = process.env.SEARCH_PROVIDER || 'mysql';
  _instance = provider === 'es' ? new ESSearch() : new MysqlSearch();
  return _instance;
}
