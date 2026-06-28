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

/** 抽取纯文本（用于搜索索引、摘要） */
export function htmlToText(html: string): string {
  if (!html) return '';
  const dom = new JSDOM(`<body>${html}</body>`);
  const text = dom.window.document.body.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
}

/** 从 HTML 抽取目录（h2/h3） */
export interface TocItem { id: string; text: string; level: 2 | 3 }
export function buildToc(html: string): { html: string; toc: TocItem[] } {
  const dom = new JSDOM(`<body>${html}</body>`);
  const doc = dom.window.document;
  const toc: TocItem[] = [];
  const headings = doc.querySelectorAll('h2, h3');
  headings.forEach((h, idx) => {
    const text = (h.textContent || '').trim();
    const id = (h.getAttribute('id') || '') || `toc-${idx}-${text.replace(/[^\w\u4e00-\u9fa5]+/g, '-').slice(0, 32)}`;
    h.setAttribute('id', id);
    toc.push({ id, text, level: h.tagName.toLowerCase() === 'h2' ? 2 : 3 });
  });
  return { html: doc.body.innerHTML, toc };
}
