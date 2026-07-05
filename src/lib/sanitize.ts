/**
 * HTML / Markdown 净化与提取
 * 与 PRD §4.8.2 对齐：白名单标签 + 协议白名单 + 危险内容拦截。
 */
import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';

const ALLOWED_TAGS = [
  'h1','h2','h3','h4','h5','h6','p','blockquote','ul','ol','li','strong','em','del','code','pre',
  'a','img','table','thead','tbody','tr','th','td','hr','br','span','div','figure','figcaption',
  'sup','sub','mark','iframe',
];
const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href','title','rel','target'],
    img: ['src','alt','title','width','height','loading'],
    span: ['class'],
    div: ['class'],
    code: ['class'],
    pre: ['class'],
    th: ['scope','colspan','rowspan','align'],
    td: ['colspan','rowspan','align'],
    iframe: ['src','width','height','allow','allowfullscreen','frameborder'],
    '*': ['id'],
  },
  allowedSchemes: ['http','https','mailto','tel'],
  allowedSchemesByTag: { img: ['http','https','data'] },
  allowProtocolRelative: false,
  // iframe 仅放行视频白名单（B 站 / 腾讯视频 / YouTube）
  allowedIframeHostnames: ['player.bilibili.com','v.qq.com','www.youtube.com','youtube.com'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: 'nofollow noopener noreferrer', target: '_blank' },
    }),
  },
  // 禁止任何 on* 事件、javascript: / data:text/html
  exclusiveFilter: (frame) => {
    if (frame.tag === 'a' && frame.attribs.href) {
      const href = String(frame.attribs.href).trim().toLowerCase();
      if (href.startsWith('javascript:') || href.startsWith('vbscript:') || href.startsWith('data:text/html')) return true;
    }
    return false;
  },
};

export function sanitizeHtmlContent(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html, SANITIZE_OPTS);
}

export function markdownToSanitizedHtml(md: string): string {
  if (!md) return '';
  marked.setOptions({ gfm: true, breaks: false });
  const rendered = marked.parse(md, { async: false }) as string;
  return sanitizeHtmlContent(rendered);
}

/** 判断是否为完整 HTML 文档（含 <html> 根） */
function isFullDocument(html: string): boolean {
  return /<html[\s>]/i.test(html);
}

/**
 * 富 HTML 净化：用于「上传/粘贴 HTML」路径。
 * 目标是「原封不动」保留原始设计（<style>、内联 style、class、语义/布局标签、表格等），
 * 仅剔除会导致 XSS 的危险内容（<script>、on* 事件、javascript:/vbscript:/data:text/html）。
 * 渲染侧配合 sandbox iframe 做样式隔离与脚本禁用，二者形成纵深防御。
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return '';
  const full = isFullDocument(html);
  const dom = new JSDOM(full ? html : `<!DOCTYPE html><html><head></head><body>${html}</body></html>`);
  const doc = dom.window.document;

  // 移除脚本类元素（内容一并丢弃）
  doc.querySelectorAll('script, noscript, template').forEach((el) => el.remove());

  // 清理危险属性
  const urlAttrs = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'background', 'poster']);
  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const val = (attr.value || '').trim().toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if (urlAttrs.has(name) && (val.startsWith('javascript:') || val.startsWith('vbscript:') || val.startsWith('data:text/html'))) {
        el.removeAttribute(attr.name);
      }
    });
  });

  if (full) return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  return doc.body.innerHTML;
}

/** 抽取纯文本（用于搜索索引、摘要）；剔除 style/script/head 避免 CSS 混入 */
export function htmlToText(html: string): string {
  if (!html) return '';
  const full = isFullDocument(html);
  const dom = new JSDOM(full ? html : `<!DOCTYPE html><html><head></head><body>${html}</body></html>`);
  const doc = dom.window.document;
  doc.querySelectorAll('script, style, noscript, head, template').forEach((el) => el.remove());
  const text = (doc.body && doc.body.textContent) || '';
  return text.replace(/\s+/g, ' ').trim();
}

/** 从 HTML 抽取目录（h2/h3），并为标题注入锚点 id；兼容完整文档与片段 */
export interface TocItem { id: string; text: string; level: 2 | 3 }
export function buildToc(html: string): { html: string; toc: TocItem[] } {
  const full = isFullDocument(html);
  const dom = new JSDOM(full ? html : `<!DOCTYPE html><html><head></head><body>${html}</body></html>`);
  const doc = dom.window.document;
  const toc: TocItem[] = [];
  const headings = doc.querySelectorAll('h2, h3');
  headings.forEach((h, idx) => {
    const text = (h.textContent || '').trim();
    const id = (h.getAttribute('id') || '') || `toc-${idx}-${text.replace(/[^\w\u4e00-\u9fa5]+/g, '-').slice(0, 32)}`;
    h.setAttribute('id', id);
    toc.push({ id, text, level: h.tagName.toLowerCase() === 'h2' ? 2 : 3 });
  });
  const out = full ? '<!DOCTYPE html>\n' + doc.documentElement.outerHTML : doc.body.innerHTML;
  return { html: out, toc };
}
