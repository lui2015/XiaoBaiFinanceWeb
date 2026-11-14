/**
 * 文章分享图（SVG）生成 —— 供站内「导出为图片」按钮与开放接口共用。
 *
 * 设计约束：
 *  - 纯字符串拼装，零第三方依赖、不启动浏览器、不执行 Python/外部命令，容器内可直接运行。
 *  - 所有文章字段都经过 XML 转义，SVG 内不引用任何外部资源、不含脚本，避免 XSS / SSRF。
 *  - 固定 1080×1440 竖版，浏览器端可直接转 PNG（前端按钮已实现）。
 */
import { prisma } from '@/lib/prisma';

export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1440;
export const SHARE_IMAGE_MIME = 'image/svg+xml; charset=utf-8';

export const ID_OR_SLUG_RE = /^[a-zA-Z0-9\u4e00-\u9fa5_-]{1,80}$/;

/** 开放接口中返回给调用方的图片地址（带站点 basePath，需同样携带 API Key 访问） */
export function openImageUrl(articleId: number): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return `${base}/api/open/v1/articles/${articleId}/image`;
}

export interface ShareImageArticle {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  publishAt: Date | null;
  categoryName: string | null;
}

/** 只查已发布且未删除的文章，字段白名单，避免泄露内部数据 */
export async function findPublicArticle(idOrSlug: string): Promise<ShareImageArticle | null> {
  if (!ID_OR_SLUG_RE.test(idOrSlug)) return null;
  const a = await prisma.article.findFirst({
    where: {
      ...(/^\d+$/.test(idOrSlug) ? { id: Number(idOrSlug) } : { slug: idOrSlug }),
      status: 1,
      deletedAt: null,
    },
    select: {
      id: true, title: true, slug: true, summary: true, publishAt: true,
      category: { select: { name: true } },
    },
  });
  if (!a) return null;
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    summary: a.summary,
    publishAt: a.publishAt,
    categoryName: a.category?.name ?? null,
  };
}

/** XML 转义：动态文本一律经过此处，杜绝 SVG 注入 */
function esc(input: string): string {
  return String(input)
    // 去掉 XML 1.0 不允许的控制字符
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 按中英文混排的视觉宽度折行；全角计 1、半角计 0.55 单位 */
function wrapText(text: string, maxUnits: number, maxLines: number): string[] {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const lines: string[] = [];
  let line = '';
  let units = 0;
  for (const ch of clean) {
    const w = ch.charCodeAt(0) < 128 ? 0.55 : 1;
    if (units + w > maxUnits && line) {
      lines.push(line);
      line = '';
      units = 0;
    }
    line += ch;
    units += w;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = last.length > 1 ? last.slice(0, -1) + '…' : '…';
  return kept;
}

function textLines(
  lines: string[], x: number, y: number, lineHeight: number,
  fontSize: number, fill: string, weight = '400', anchor: 'start' | 'end' = 'start',
): string {
  return lines
    .map((line, i) => `<text x="${x}" y="${y + i * lineHeight}" font-size="${fontSize}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${esc(line)}</text>`)
    .join('\n  ');
}

function beijingDate(d: Date | null): string {
  if (!d || isNaN(new Date(d).getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(d)).replace(/\//g, '.');
}

const FONT = "'PingFang SC','Microsoft YaHei','Noto Sans CJK SC','Hiragino Sans GB',sans-serif";

/** 生成一张 1080×1440 的文章分享卡（深色品牌头 + 白底内容 + 风险提示） */
export function buildShareImageSvg(a: ShareImageArticle): string {
  const titleLines = wrapText(a.title, 13, 4);
  const summaryLines = wrapText(a.summary || '读懂一个财经知识点，从这篇开始。', 25, 5);
  const category = a.categoryName || '财经知识';
  const date = beijingDate(a.publishAt);
  const tagWidth = Math.min(420, category.length * 28 + 52);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_IMAGE_WIDTH}" height="${SHARE_IMAGE_HEIGHT}" viewBox="0 0 ${SHARE_IMAGE_WIDTH} ${SHARE_IMAGE_HEIGHT}" font-family="${esc(FONT)}">
  <defs>
    <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="2" fill="#E9E1D1"/>
    </pattern>
    <clipPath id="cardClip">
      <rect x="64" y="64" width="952" height="1312" rx="36"/>
    </clipPath>
  </defs>

  <rect width="${SHARE_IMAGE_WIDTH}" height="${SHARE_IMAGE_HEIGHT}" fill="#FAF7F0"/>
  <rect width="${SHARE_IMAGE_WIDTH}" height="${SHARE_IMAGE_HEIGHT}" fill="url(#dots)"/>

  <rect x="64" y="64" width="952" height="1312" rx="36" fill="#FFFFFF" stroke="#E6DFD2" stroke-width="2"/>

  <g clip-path="url(#cardClip)">
    <rect x="64" y="64" width="952" height="330" fill="#1F2937"/>
  </g>
  <rect x="110" y="116" width="46" height="46" rx="13" fill="#FBBF24"/>
  <text x="133" y="149" font-size="28" fill="#1F2937" font-weight="700" text-anchor="middle">白</text>
  <text x="172" y="150" font-size="36" fill="#FFFFFF" font-weight="700">小白学财经</text>
  <text x="110" y="222" font-size="26" fill="#C7CFDA">关注我们，股票市场不迷路</text>
  <line x1="110" y1="262" x2="970" y2="262" stroke="#3B4657" stroke-width="2"/>
  <circle cx="118" cy="310" r="6" fill="#FBBF24"/>
  <text x="136" y="318" font-size="24" fill="#E5E7EB">通俗易懂</text>
  <circle cx="408" cy="310" r="6" fill="#6EE7B7"/>
  <text x="426" y="318" font-size="24" fill="#E5E7EB">实战导向</text>
  <circle cx="698" cy="310" r="6" fill="#93C5FD"/>
  <text x="716" y="318" font-size="24" fill="#E5E7EB">风险可控</text>

  <rect x="110" y="438" width="${tagWidth}" height="52" rx="26" fill="#FEF3C7"/>
  <text x="${110 + tagWidth / 2}" y="473" font-size="26" fill="#92400E" font-weight="600" text-anchor="middle">${esc(category)}</text>

  <g font-weight="700" fill="#1F2937">
  ${textLines(titleLines, 110, 566, 88, 62, '#1F2937', '700')}
  </g>

  <line x1="110" y1="${566 + Math.max(titleLines.length, 1) * 88}" x2="970" y2="${566 + Math.max(titleLines.length, 1) * 88}" stroke="#E6DFD2" stroke-width="2"/>

  <g fill="#4B5563">
  ${textLines(summaryLines, 110, 940, 54, 34, '#4B5563')}
  </g>

  <rect x="110" y="1200" width="860" height="96" rx="18" fill="#FFFBEB" stroke="#FDE68A" stroke-width="2"/>
  <text x="136" y="1239" font-size="24" fill="#92400E">内容仅供学习交流，不构成任何投资建议</text>
  <text x="136" y="1274" font-size="24" fill="#B45309">投资有风险，决策需谨慎</text>

  <line x1="110" y1="1320" x2="970" y2="1320" stroke="#F0EBE1" stroke-width="2"/>
  <text x="110" y="1354" font-size="22" fill="#9CA3AF">小白财经 · 看得懂的财经知识</text>
  ${date ? `<text x="970" y="1354" font-size="22" fill="#9CA3AF" text-anchor="end">${esc(date)}</text>` : ''}
</svg>`;
}
