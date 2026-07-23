/**
 * 搜索服务抽象：SQLite 内存 / Elasticsearch
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
  search(opts: { keyword: string; categoryId?: number; page: number; size: number }): Promise<SearchResult>;
  upsertArticle(id: number): Promise<void>;
  removeArticle(id: number): Promise<void>;
}

/** 内存搜索：适用于 SQLite 单机场景，全部文章加载到内存做模糊匹配 */
class MemorySearch implements SearchService {
  private cache: Array<{
    id: number; title: string; summary: string | null; slug: string;
    categoryId: number; publishAt: Date | null; deletedAt?: Date | null; status: number;
  }> | null = null;
  private cacheTs = 0;
  private readonly CACHE_TTL = 5_000; // 5 秒缓存

  private async loadCache() {
    if (this.cache && Date.now() - this.cacheTs < this.CACHE_TTL) return;
    this.cache = await prisma.article.findMany({
      select: { id: true, title: true, summary: true, slug: true, categoryId: true, publishAt: true, deletedAt: true, status: true },
      where: { deletedAt: null },
    });
    this.cacheTs = Date.now();
  }

  private match(article: any, keyword: string) {
    const re = new RegExp(escapeReg(keyword), 'gi');
    const titleMatch = article.title.match(re);
    const summaryMatch = (article.summary || '').match(re);
    if (!titleMatch && !summaryMatch) return null;
    const score = titleMatch ? 100 : 50;
    return {
      id: String(article.id),
      title: article.title,
      summary: article.summary || '',
      slug: article.slug,
      categoryId: String(article.categoryId),
      publishAt: article.publishAt ? new Date(article.publishAt).toISOString() : null,
      highlight: {
        title: article.title.replace(re, (m: string) => `<em>${m}</em>`),
        content: (article.summary || '').replace(re, (m: string) => `<em>${m}</em>`),
      },
      _score: score,
    };
  }

  async search({ keyword, categoryId, page, size }: { keyword: string; categoryId?: number; page: number; size: number }) {
    await this.loadCache();
    let results = (this.cache || []).filter(a => a.status === 1 && !a.deletedAt);
    if (categoryId) results = results.filter(a => a.categoryId === Number(categoryId));
    results = results.filter(a => a.title.includes(keyword) || (a.summary || '').includes(keyword));
    // 简单排序：标题命中优先，按发布时间倒序
    results.sort((a, b) => {
      const sa = a.title.includes(keyword) ? 100 : 50;
      const sb = b.title.includes(keyword) ? 100 : 50;
      if (sb !== sa) return sb - sa;
      return (b.publishAt || new Date(0)).getTime() - (a.publishAt || new Date(0)).getTime();
    });
    const total = results.length;
    const offset = (page - 1) * size;
    const list = results.slice(offset, offset + size).map(r => ({
      id: String(r.id), title: r.title, summary: r.summary || '', slug: r.slug,
      categoryId: String(r.categoryId), publishAt: r.publishAt ? new Date(r.publishAt).toISOString() : null,
      highlight: this.match(r, keyword)?.highlight,
    })) as SearchHit[];
    return { total, list };
  }
  async upsertArticle() { this.cache = null; }
  async removeArticle() { this.cache = null; }
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
  async search({ keyword, categoryId, page, size }: { keyword: string; categoryId?: number; page: number; size: number }) {
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
  async upsertArticle(id: number) {
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
  async removeArticle(id: number) {
    const c = await this.getClient();
    await c.delete({ index: this.index, id: String(id) }).catch(() => {});
  }
}

function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

let _instance: SearchService | null = null;
export function getSearch(): SearchService {
  if (_instance) return _instance;
  const provider = process.env.SEARCH_PROVIDER || 'memory';
  _instance = provider === 'es' ? new ESSearch() : new MemorySearch();
  return _instance;
}
