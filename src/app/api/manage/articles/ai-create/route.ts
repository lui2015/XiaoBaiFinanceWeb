import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { requireManager } from '@/lib/auth';
import { sanitizeRichHtml, htmlToText } from '@/lib/sanitize';
import { slugify } from '@/lib/utils';
import { getSearch } from '@/lib/search';
import { callHunyuan, extractHtml, extractJson } from '@/lib/hunyuan';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

// ==================== 自动选题池 ====================
const AUTO_TOPICS = [
  '量比', 'MACD', '市盈率(PE)', '换手率', 'ROE', '归母净利润',
  '委比', '北向资金', '融资融券', 'ETF', '可转债', 'K线图',
  '均线系统(MA)', '布林带(BOLL)', '量价关系', '龙头股', '打板',
  '龙虎榜', '市净率(PB)', '每股收益(EPS)', '资产负债率',
  '现金流', '股息率(DY)', 'Beta系数', 'Alpha收益', '夏普比率',
  '最大回撤', '波动率', 'PEG指标', 'PSR市销率', 'EBITDA',
  '商誉减值', '股权质押', '限售解禁', '除权除息', 'T+1制度',
  '涨跌停板', '集合竞价', '大宗交易', '回购注销', '分红派息',
];

function pickAutoTopic(): string {
  return AUTO_TOPICS[Math.floor(Math.random() * AUTO_TOPICS.length)];
}

// ==================== 头像 SVG 符号（与参考文章一致的矢量头像） ====================
const AVATAR_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="zhu-bajie" viewBox="0 0 120 120">
    <ellipse cx="18" cy="52" rx="13" ry="20" fill="#f9a8d4"/>
    <ellipse cx="102" cy="52" rx="13" ry="20" fill="#f9a8d4"/>
    <circle cx="60" cy="62" r="44" fill="#fbcfe8"/>
    <ellipse cx="60" cy="82" rx="26" ry="19" fill="#f9a8d4"/>
    <circle cx="51" cy="82" r="4.5" fill="#db2777"/>
    <circle cx="69" cy="82" r="4.5" fill="#db2777"/>
    <circle cx="45" cy="52" r="7" fill="#ffffff"/><circle cx="45" cy="52" r="3.5" fill="#1f2937"/>
    <circle cx="75" cy="52" r="7" fill="#ffffff"/><circle cx="75" cy="52" r="3.5" fill="#1f2937"/>
    <path d="M48 96 Q60 104 72 96" stroke="#db2777" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M28 40 Q60 16 92 40 Q60 34 28 40" fill="#c4b5fd"/>
  </symbol>
  <symbol id="tang-seng" viewBox="0 0 120 120">
    <circle cx="60" cy="56" r="40" fill="#fde9d3"/>
    <ellipse cx="50" cy="44" rx="9" ry="6" fill="#ffffff" opacity="0.55"/>
    <path d="M40 50 Q48 46 56 50" stroke="#92400e" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M64 50 Q72 46 80 50" stroke="#92400e" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <circle cx="48" cy="58" r="4.5" fill="#1f2937"/>
    <circle cx="72" cy="58" r="4.5" fill="#1f2937"/>
    <path d="M50 72 Q60 80 70 72" stroke="#92400e" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <g fill="#fbbf24" stroke="#d97706" stroke-width="1">
      <circle cx="44" cy="96" r="5"/><circle cx="58" cy="101" r="5"/><circle cx="72" cy="101" r="5"/><circle cx="86" cy="96" r="5"/>
    </g>
  </symbol>
</svg>`;

// ==================== 视觉模板 CSS（与参考文章「标准化合约」完全一致） ====================
const TEMPLATE_CSS = `<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #f0f4f8; font-family: 'PingFang SC','Microsoft YaHei',-apple-system,sans-serif; padding: 20px; min-height: 100vh; color: #1a202c; }
.comic-container { max-width: 760px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08); }
.header { background: linear-gradient(135deg,#1e3a8a 0%,#2563eb 50%,#3b82f6 100%); padding: 35px 30px 30px; text-align: center; color: white; position: relative; }
.header-content { position: relative; z-index: 1; }
.header h1 { font-size: 32px; font-weight: 800; margin-bottom: 8px; letter-spacing: 1px; }
.header .subtitle { font-size: 16px; opacity: 0.95; font-weight: 300; margin-bottom: 4px; }
.header .tag { display: inline-block; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); padding: 4px 14px; border-radius: 20px; font-size: 12px; margin-top: 10px; }
.characters-bar { background: linear-gradient(to right,#dbeafe,#eff6ff,#dbeafe); padding: 20px; display: flex; justify-content: space-around; align-items: center; border-bottom: 2px dashed #93c5fd; }
.char-intro { text-align: center; }
.char-intro .avatar { width: 70px; height: 70px; margin: 0 auto 8px; background: white; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden; }
.char-intro .name { font-size: 14px; font-weight: 700; color: #1e3a8a; }
.char-intro .role { font-size: 12px; color: #6b7280; margin-top: 2px; }
.vs { font-size: 24px; color: #2563eb; font-weight: bold; }
.section { padding: 30px 25px; border-bottom: 1px solid #e5e7eb; }
.section:last-child { border-bottom: none; }
.section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.section-number { background: linear-gradient(135deg,#2563eb,#1e40af); color: white; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; box-shadow: 0 3px 8px rgba(37,99,235,0.3); }
.section-title { font-size: 20px; font-weight: 700; color: #1e3a8a; }
.dialogue-block { display: flex; gap: 12px; margin-bottom: 16px; align-items: flex-start; }
.dialogue-block.reverse { flex-direction: row-reverse; }
.dialogue-avatar { width: 56px; height: 56px; border-radius: 50%; flex-shrink: 0; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
.bubble { flex: 1; background: #f3f4f6; border-radius: 14px; padding: 14px 16px; position: relative; border: 1px solid #e5e7eb; }
.dialogue-block:not(.reverse) .bubble { background: linear-gradient(135deg,#fef3c7 0%,#fde68a 100%); border-color: #f59e0b; }
.dialogue-block.reverse .bubble { background: linear-gradient(135deg,#dbeafe 0%,#bfdbfe 100%); border-color: #3b82f6; }
.bubble-label { display: inline-block; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-bottom: 6px; }
.dialogue-block:not(.reverse) .bubble-label { background: #f59e0b; color: white; }
.dialogue-block.reverse .bubble-label { background: #2563eb; color: white; }
.bubble-text { font-size: 15px; line-height: 1.65; color: #1f2937; }
.concept-box { background: linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%); border-left: 4px solid #2563eb; padding: 18px 20px; border-radius: 8px; margin: 20px 0; }
.concept-box .title { font-size: 14px; font-weight: 700; color: #1e40af; margin-bottom: 8px; }
.concept-box .content { font-size: 15px; line-height: 1.7; color: #1f2937; }
.formula-box { background: linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%); color: white; padding: 24px; border-radius: 12px; text-align: center; margin: 20px 0; box-shadow: 0 8px 20px rgba(37,99,235,0.25); }
.formula-box .formula { font-size: 20px; font-weight: 700; letter-spacing: 1px; }
.formula-box .note { font-size: 13px; opacity: 0.85; margin-top: 10px; }
.data-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.data-table th { background: linear-gradient(135deg,#1e3a8a,#2563eb); color: white; padding: 12px 14px; font-size: 13px; text-align: left; }
.data-table td { padding: 11px 14px; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
.data-table tr:nth-child(even) td { background: #f8fafc; }
.flow-diagram { background: #f9fafb; padding: 20px; border-radius: 10px; margin: 20px 0; }
.flow-step { display: flex; align-items: center; gap: 12px; background: white; padding: 12px 16px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #2563eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.flow-step.alt { border-left-color: #f59e0b; }
.flow-step.warn { border-left-color: #dc2626; }
.flow-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.flow-icon.blue { background: #dbeafe; color: #2563eb; }
.flow-icon.orange { background: #fef3c7; color: #f59e0b; }
.flow-icon.red { background: #fee2e2; color: #dc2626; }
.flow-text { flex: 1; font-size: 14px; color: #1f2937; }
.flow-arrow { text-align: center; color: #9ca3af; font-size: 18px; margin: -4px 0; }
.tip-box { background: linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%); border: 2px dashed #f59e0b; border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
.tip-box .tip-header { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #92400e; margin-bottom: 8px; }
.tip-box .tip-content { font-size: 14px; line-height: 1.7; color: #78350f; }
.risk-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 18px 20px; border-radius: 8px; margin: 20px 0; }
.risk-box .title { font-size: 14px; font-weight: 700; color: #dc2626; margin-bottom: 8px; }
.risk-box ul { padding-left: 20px; font-size: 13px; line-height: 1.8; color: #7f1d1d; }
.summary-box { background: linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%); color: white; padding: 25px; border-radius: 12px; margin: 20px 0; text-align: center; }
.summary-box .title { font-size: 16px; font-weight: 700; margin-bottom: 15px; }
.summary-box .line { font-size: 17px; line-height: 2; font-weight: 500; }
.footer { background: #1f2937; color: white; padding: 25px; text-align: center; }
.footer .brand { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
.footer .disclaimer { font-size: 12px; opacity: 0.7; line-height: 1.6; margin-top: 10px; }
.footer .footer-icons { display: flex; justify-content: center; gap: 30px; margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); }
.footer .footer-icons div { font-size: 12px; opacity: 0.8; }
@media (max-width: 768px) { .header h1 { font-size: 26px; } .section { padding: 25px 18px; } .bubble-text { font-size: 14px; } .formula-box .formula { font-size: 18px; } }
</style>`;

// ==================== System Prompt（基于参考文章视觉规范） ====================
const SYSTEM_PROMPT = `你是一位专业的财经科普漫画内容生成器，代号「小白学财经」。
你必须生成一份与下面「视觉模板」风格完全一致的单文件 HTML 漫画（蓝色科技风、师徒对话漫画）。

## 角色设定
- **小白（猪八戒）**：投资新手，憨厚可爱、爱问问题。自称"俺老猪"，句式如"师傅~ XX 是啥玩意儿嘛？"、"俺老猪听不太懂"。由头像符号 #zhu-bajie 表示。
- **师傅（唐僧）**：资深股民/佛系导师，沉稳睿智。自称"为师"/"师傅"，句式如"阿弥陀佛~ 悟能莫急"、"善哉善哉！徒儿天资聪颖！"。由头像符号 #tang-seng 表示。

## 必须严格遵守的视觉模板（直接复制使用，不要修改样式）
### 1) 头部放这段 CSS（放在 <head> 内的 <style> 中，原样复制）：
${TEMPLATE_CSS}

### 2) 头像符号（放在 <body> 最前面，原样复制，小白用 #zhu-bajie，师傅用 #tang-seng）：
${AVATAR_DEFS}

### 3) 角色区（放在 comic-container 内、章节之前，原样复制）：
<div class="characters-bar">
  <div class="char-intro"><div class="avatar"><svg viewBox="0 0 120 120" width="100%" height="100%"><use href="#zhu-bajie"></use></svg></div><div class="name">小白（猪八戒）</div><div class="role">投资新手 · 爱提问</div></div>
  <div class="vs">VS</div>
  <div class="char-intro"><div class="avatar"><svg viewBox="0 0 120 120" width="100%" height="100%"><use href="#tang-seng"></use></svg></div><div class="name">师傅（唐僧）</div><div class="role">资深股民 · 佛系导师</div></div>
</div>

### 4) 对话结构示例（小白在左、师傅在右，原样照此写）：
<div class="dialogue-block">
  <div class="dialogue-avatar"><svg viewBox="0 0 120 120" width="100%" height="100%"><use href="#zhu-bajie"></use></svg></div>
  <div class="bubble"><span class="bubble-label">小白</span><div class="bubble-text">师傅~ XX 是啥玩意儿嘛？</div></div>
</div>
<div class="dialogue-block reverse">
  <div class="dialogue-avatar"><svg viewBox="0 0 120 120" width="100%" height="100%"><use href="#tang-seng"></use></svg></div>
  <div class="bubble"><span class="bubble-label">师傅</span><div class="bubble-text">徒儿莫急，为师这就讲给你听……</div></div>
</div>

## 整体结构（必须完整）
<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>小白学财经 - XX知识科普</title>${TEMPLATE_CSS}</head>
<body>
${AVATAR_DEFS}
<div class="comic-container">
  <div class="header"><div class="header-content"><h1>XX 一图读懂</h1><div class="subtitle">小白学财经 · 师徒对话漫画</div><div class="tag">#财经科普 #XX</div></div></div>
  ${'<!-- characters-bar 角色区（见上方第3点） -->'}
  <div class="section">…5个章节…</div>
  <div class="footer"><div class="brand">小白学财经</div><div class="disclaimer">⚠️ 本内容仅供学习交流，不构成任何投资建议</div><div class="footer-icons"><div>📚 看得懂</div><div>💡 学得会</div><div>🤝 不荐股</div></div></div>
</div>
</body></html>

## 5 个固定章节（每个 .section 内都要有 section-header + 至少1轮对话 + 至少1个可视化组件）
1. **是什么** — 通俗定义 + 生活场景类比（用 concept-box）
2. **怎么算** — 公式 + 具体数字计算示例（用 formula-box）
3. **怎么读** — 数值区间含义 + 数据表格（用 data-table）
4. **怎么用** — 实战决策方法（用 flow-diagram 流程图）+ 操作建议（tip-box）
5. **风险点 & 口诀** — 局限性总结（risk-box）+ 速记口诀（summary-box）

## 对话节奏
每段对话 ≤ 3 行；小白提问 → 师傅解答 → 小白恍然大悟 → 师傅升华。结尾有师傅金句。

## 同时输出卡片数据（放在 </html> 之后，另起一行，务必用这两个标记包裹合法 JSON）
===CARDS_JSON_START===
{
  "concept": "概念名",
  "cards": [
    {"title": ["主标题","副标题"], "subtitle": "描述", "blocks": [...]},
    ...
  ]
}
===CARDS_JSON_END===
卡片 block 类型：("dia","left"/"right","对话文字") 对话气泡、("def","标题","正文") 定义卡、("formula",["行1","行2"]) 公式卡、("two_col",("题","述","类比"),("题","述","类比")) 两列对比、("table",[表头],[[行]],[列宽],高亮列号) 表格、("strategy",[("名","述","色"),...]) 策略列表、("risk",[("题","述"),...]) 风险清单、("mnemonic",["行1","行2"]) 口诀卡、("timeline",[(序,"题","述"),...]) 时间线、("keywords",["词1","词2",...]) 关键词云、("hero","大标题","副标题") 核心大卡。
前5张对应5个章节，第6张是纯图表总结卡（hero+timeline+keywords+mnemonic）。JSON 必须合法（数组/对象/字符串，不要用 Python 元组语法）。`;

const schema = z.object({
  mode: z.enum(['custom', 'auto']),
  topic: z.string().max(50).optional(),
  categoryId: z.string().regex(/^\d+$/).optional(),
});

async function uniqueSlug(title: string): Promise<string> {
  let base = slugify(title);
  let slug = base;
  let i = 1;
  while (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

/**
 * 从 LLM 响应中分离 HTML 和 JSON 卡片数据
 */
function parseResponse(content: string): { html: string; cardJson: any } {
  const html = extractHtml(content);
  const cardJson = extractJson<any>(content);
  return { html, cardJson };
}

/** 默认分类 ID（基础概念） */
const DEFAULT_CATEGORY_ID = '1';

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const u = await requireManager();
    const managerId = Number(u.id);
    const body = schema.parse(await req.json().catch(() => ({})));

    // 确定主题
    const topic = body.mode === 'custom'
      ? (body.topic?.trim() || pickAutoTopic())
      : pickAutoTopic();

    // 调用混元大模型生成内容
    const userMessage = `请为以下财经概念生成完整的科普漫画HTML：${topic}

要求：
1. 生成完整可独立打开的单文件HTML（含内联CSS）
2. 严格遵循5章节结构（是什么→怎么算→怎么读→怎么用→风险点&口诀）
3. 内容要生动有趣，符合师徒对话风格
4. 最后附上6张卡片的JSON数据`;

    const res = await callHunyuan({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.8,
      maxTokens: 16384,
    });

    const rawContent = res.choices[0].message.content;
    const { html: rawHtml, cardJson } = parseResponse(rawContent);

    if (!rawHtml || !rawHtml.includes('<html')) {
      throw new Error('AI 未返回有效的 HTML 内容');
    }

    // 净化并存储 HTML
    const sanitizedHtml = sanitizeRichHtml(rawHtml);
    const text = htmlToText(sanitizedHtml);
    if (!text.trim()) throw new Error('AI 生成的内容为空');

    const title = `${topic} - 小白一图读懂`;
    const slug = await uniqueSlug(title);
    const summary = text.slice(0, 120);
    const categoryId = Number(body.categoryId || DEFAULT_CATEGORY_ID);

    // 创建文章记录（时间统一存 UTC，展示层按 Asia/Shanghai 格式化）
    const article = await prisma.article.create({
      data: {
        title,
        slug,
        summary,
        sourceType: 0, // HTML
        contentHtml: sanitizedHtml,
        contentText: text,
        categoryId,
        status: 1, // AI 生成的直接发布
        publishAt: new Date(),
        createdBy: managerId,
      },
    });

    // 更新搜索索引
    try { await getSearch().upsertArticle(article.id); } catch { /* 不阻断 */ }

    // 保存卡片数据并尝试自动生成图片
    let cardDataSaved = false;
    let cardsGenerated = false;
    if (cardJson && cardJson.cards) {
      try {
        const dataDir = path.join(process.cwd(), 'data', 'ai-cards');
        await mkdir(dataDir, { recursive: true });
        const cardPath = path.join(dataDir, `${article.id}.json`);
        await writeFile(cardPath, JSON.stringify(cardJson, null, 2), 'utf-8');
        cardDataSaved = true;

        // 尝试自动生成卡片图片（需要 Python3 + Pillow，失败不阻断）
        try {
          const { execFile: ef } = await import('child_process');
          const { promisify: p } = await import('util');
          const execAsync = p(ef);
          const outputDir = path.join(process.cwd(), 'public', 'uploads', 'cards', String(article.id));
          await mkdir(outputDir, { recursive: true });
          // 复用 generate-cards 的 Python 脚本构建逻辑
          const { buildPythonScript } = await import('../generate-cards/route');
          const pythonScript = buildPythonScript(cardJson.concept || topic, cardJson.cards, outputDir);
          const scriptPath = path.join(dataDir, `_gen_${article.id}.py`);
          await writeFile(scriptPath, pythonScript, 'utf-8');
          const { stdout, stderr } = await execAsync('python3', [scriptPath], {
            timeout: 120000,
            cwd: process.cwd(),
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
          });
          console.log(`卡片图片生成完成: ${stdout.slice(-200)}`);
          cardsGenerated = true;
          // 清理临时脚本
          try { const { unlink: ul } = await import('fs/promises'); await ul(scriptPath); } catch {}
        } catch (genErr: any) {
          console.warn(`[AI创建] 卡片图片生成跳过: ${genErr.code === 'ENOENT' ? '服务器未安装Python3' : genErr.message?.slice(0, 120)}`);
        }
      } catch (e) {
        console.error('保存卡片数据失败:', e);
      }
    }

    return jsonSafe({
      id: String(article.id),
      slug: article.slug,
      title: article.title,
      topic,
      cardsReady: cardDataSaved,
      cardsGenerated,
      usage: res.usage,
    });
  });
}
