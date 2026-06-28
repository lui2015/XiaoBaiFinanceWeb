import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { sanitizeHtmlContent, markdownToSanitizedHtml, htmlToText } from '@/lib/sanitize';

const ALLOWED = new Set(['text/html', 'text/markdown', 'text/plain', 'application/octet-stream']);
const MAX_HTML = 2 * 1024 * 1024;
const MAX_MD = 1 * 1024 * 1024;

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    await requireAdmin();
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const kind = (form.get('kind') as string) || 'html'; // html | md
    if (!file) throw ApiErrors.badRequest('file 必填');
    if (!ALLOWED.has(file.type) && file.type !== '') throw ApiErrors.badRequest('文件类型不允许');
    const buf = Buffer.from(await file.arrayBuffer());
    if (kind === 'html' && buf.length > MAX_HTML) throw ApiErrors.badRequest('HTML 文件超过 2MB');
    if (kind === 'md' && buf.length > MAX_MD) throw ApiErrors.badRequest('Markdown 文件超过 1MB');
    const raw = buf.toString('utf8');
    const cleaned = kind === 'md' ? markdownToSanitizedHtml(raw) : sanitizeHtmlContent(raw);
    const text = htmlToText(cleaned);
    const blocked = /<script|on\w+=|javascript:/i.test(raw) && !/<script|on\w+=|javascript:/i.test(cleaned);
    return jsonSafe({
      kind, size: buf.length,
      cleanedHtml: cleaned,
      contentText: text,
      stats: {
        rawLen: raw.length,
        cleanedLen: cleaned.length,
        textLen: text.length,
        suspectStripped: blocked,
      },
    });
  });
}
