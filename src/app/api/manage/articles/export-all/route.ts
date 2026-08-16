import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { requireManager } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 生成一份可独立打开的自包含 HTML 文件（与单篇导出一致） */
function buildHtml(a: any): string {
  const title = escapeHtml(a.title ?? '未命名');
  const cat = a.category?.name ?? '';
  const sub = a.subCategory?.name ?? '';
  const crumb = [cat, sub].filter(Boolean).join(' / ');
  const cover = a.coverUrl
    ? `<div class="cover"><img src="${escapeAttr(a.coverUrl)}" alt="封面"></div>`
    : '';
  const metaParts: string[] = [];
  if (crumb) metaParts.push(`<span>${escapeHtml(crumb)}</span>`);
  if (a.publishAt)
    metaParts.push(`<span>${new Date(a.publishAt).toLocaleString('zh-CN', { hour12: false })}</span>`);
  if (typeof a.viewCount === 'number') metaParts.push(`<span>阅读 ${a.viewCount}</span>`);
  const meta = metaParts.length
    ? `<div class="meta">${metaParts.join('<span class="dot"> · </span>')}</div>`
    : '';
  const body = a.contentHtml ?? '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root{--ink:#1f2328;--muted:#6b7280;--line:#e5e7eb;--brand:#2563eb;}
*{box-sizing:border-box;}
body{margin:0;background:#f7f8fa;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.75;}
.wrap{max-width:760px;margin:0 auto;padding:32px 20px 64px;background:#fff;}
.title{font-size:28px;line-height:1.35;font-weight:800;margin:0 0 12px;}
.meta{display:flex;flex-wrap:wrap;gap:6px;color:var(--muted);font-size:13px;margin-bottom:20px;}
.meta .dot{color:#d1d5db;}
.cover{margin:0 0 20px;}
.cover img{width:100%;border-radius:12px;display:block;}
.content{font-size:16px;}
.content h1,.content h2,.content h3,.content h4{line-height:1.3;margin:1.4em 0 .6em;font-weight:700;}
.content h1{font-size:24px;} .content h2{font-size:21px;} .content h3{font-size:18px;}
.content p{margin:.8em 0;}
.content img{max-width:100%;border-radius:8px;display:block;margin:12px auto;}
.content a{color:var(--brand);text-decoration:underline;}
.content ul,.content ol{padding-left:1.5em;margin:.8em 0;}
.content blockquote{margin:1em 0;padding:8px 16px;background:#f3f4f6;border-left:4px solid var(--brand);color:#374151;border-radius:0 8px 8px 0;}
.content pre{background:#0f172a;color:#e2e8f0;padding:14px 16px;border-radius:10px;overflow:auto;font-size:13px;}
.content code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
.content :not(pre) > code{background:#f1f5f9;color:#db2777;padding:2px 6px;border-radius:6px;font-size:.9em;}
.content table{border-collapse:collapse;width:100%;margin:1em 0;font-size:14px;}
.content th,.content td{border:1px solid var(--line);padding:8px 10px;}
.content th{background:#f9fafb;}
.content hr{border:none;border-top:1px solid var(--line);margin:1.5em 0;}
.foot{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:12px;text-align:center;}
</style>
</head>
<body>
<article class="wrap">
  <h1 class="title">${title}</h1>
  ${meta}
  ${cover}
  <div class="content">${body}</div>
  <div class="foot">本文由小白理财导出</div>
</article>
</body>
</html>`;
}

export async function GET(_req: NextRequest) {
  try {
    await requireManager();

    // 查询所有已发布文章（含草稿也一并导出，让用户有完整备份）
    const articles = await prisma.article.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' as any },
      include: {
        category: { select: { name: true } },
        subCategory: { select: { name: true } },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        contentHtml: true,
        coverUrl: true,
        viewCount: true,
        publishAt: true,
        status: true,
        category: { select: { name: true } },
        subCategory: { select: { name: true } },
      },
    });

    if (articles.length === 0) {
      return NextResponse.json({ code: 404, message: '暂无内容可导出' }, { status: 404 });
    }

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (const a of articles) {
      const filename = `${a.slug || String(a.id)}.html`;
      zip.file(filename, buildHtml(a));
    }

    // 添加索引页
    const indexItems = articles.map((a, i) => {
      const statusTag = a.status === 1 ? '' : ` <small>[${a.status === 0 ? '草稿' : '下架'}]</small>`;
      return `<li><a href="${a.slug || i}.html">${escapeHtml(a.title)}</a>${statusTag}</li>`;
    }).join('\n');

    const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>小白理财 - 全部文章导出</title>
<style>
body{margin:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;padding:24px 16px 48px;}
.wrap{max-width:720px;margin:0 auto;background:#fff;border-radius:14px;padding:28px 24px 36px;box-shadow:0 1px 3px rgba(0,0,0,.06);}
h1{margin:0 0 6px;font-size:22px;}
.meta{color:#6b7280;font-size:13px;margin-bottom:18px;}
ul{list-style:none;padding:0;margin:0;}
li{border-bottom:1px solid #eee;padding:10px 0;display:flex;gap:8px;align-items:baseline;}
li:last-child{border:none;}
li a{color:#2563eb;text-decoration:none;font-size:15px;word-break:break-all;}
li a:hover{text-decoration:underline;}
li small{color:#9ca3af;font-size:11px;white-space:nowrap;}
</style>
</head>
<body><div class="wrap">
<h1>📦 小白理财 — 全部文章 (${articles.length} 篇)</h1>
<p class="meta">导出时间：${new Date().toLocaleString('zh-CN', { hour12: false })}</p>
<ul>${indexItems}</ul>
</div></body></html>`;

    zip.file('index.html', indexHtml);

    const buffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `xiaobai-finance-export-${dateStr}.zip`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
