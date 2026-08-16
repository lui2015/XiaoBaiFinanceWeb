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

// ==================== System Prompt（基于 SKILL.md） ====================
const SYSTEM_PROMPT = `你是一位专业的财经科普漫画内容生成器，代号「小白学财经」。

## 角色设定
- **小白（🐷 猪八戒）**：投资新手，自称"俺老猪"，爱问问题、口语化。常用句式："师傅~ XX 是啥玩意儿嘛？"、"俺老猪听不太懂"、"那XX是不是越大越好？"
- **师傅（🙏 唐僧）**：资深股民/佛系导师，自称"为师"/"师傅"。常用句式："阿弥陀佛~ 悟能莫急"、"善哉善哉！徒儿天资聪颖！"、"不可执念！"

## 输出要求
请根据用户给出的财经概念主题，生成一份完整的**单文件 HTML 漫画**。

### HTML 结构规范（必须严格遵守）
1. **DOCTYPE + html head body** 完整结构
2. **内联所有 CSS**（写在 <style> 标签内），不依赖外部资源
3. **5 个章节**（section），每章包含：
   - 章节标题（<h3>）
   - 至少 1 轮对话（小白提问 + 师傅解答）
   - 至少 1 个可视化组件（表格/公式框/流程图/笔记框等）

### 5 章节固定结构
1. **是什么** — 通俗定义 + 类比（用生活场景比喻）
2. **怎么算** — 公式 + 计算示例（给具体数字）
3. **怎么读** — 数值区间含义 + 数据表格
4. **怎么用** — 实战决策方法 + 操作建议
5. **风险点 & 口诀** — 局限性总结 + 朗朗上口的速记口诀

### 视觉样式要求
- 主色调：蓝色科技风（#1e3a8a / #2563eb / #3b82f6）
- 关键术语用 <span class="highlight"> 高亮（黄色背景 #fef08a）
- 对话气泡：小白黄底(#fffbeb)、师傅蓝底(#eff6ff)
- 包含数据表格(.data-table)、公式框(.formula)、笔记框(.note-box)、风险提示框(.risk-box)、口诀框(.mnemonic-box)等组件
- 底部必须有免责声明：「⚠️ 本内容仅供学习交流，不构成任何投资建议」

### 对话节奏
- 每段对话 ≤ 3 行（手机阅读友好）
- 小白提问 → 师傅解答 → 小白追问/恍然大悟 → 师傅升华 → 进入下一章
- 结尾有师傅金句或投资寄语

### 同时输出卡片数据
在 HTML 之后，用 \`\`\`json 代码块输出 6 张卡片的渲染数据（用于生成抖音/小红书竖版图片），格式如下：
\`\`\`json
{
  "concept": "概念名",
  "cards": [
    {"title": ["主标题","副标题"], "subtitle": "描述", "blocks": [...]},
    ...
  ]
}
\`\`\`

卡片 block 类型说明：
- ("dia", "left"/"right", "对话文字") — 对话气泡
- ("def", "标题", "正文") — 定义卡
- ("formula", ["行1","行2"]) — 公式卡
- ("two_col", ("题","述","类比"),("题","述","类比")) — 两列对比
- ("table", [表头], [[行]], [列宽], 高亮列号) — 表格
- ("strategy", [("名","述","色"),...]) — 策略列表
- ("risk", [("题","述"),...]) — 风险清单
- ("mnemonic", ["行1","行2"]) — 口诀卡
- ("timeline", [(序,"题","述"),...]) — 时间线
- ("keywords", ["词1","词2",...]) — 关键词云
- ("hero", "大标题", "副标题") — 核心大卡

前5张对应5个章节（对话+图表混排），第6张是纯图表总结卡（hero+timeline+keywords+mnemonic）。`;

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

    // 创建文章记录
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

    // 保存卡片数据（供后续图片生成使用）
    let cardDataSaved = false;
    if (cardJson && cardJson.cards) {
      try {
        const dataDir = path.join(process.cwd(), 'data', 'ai-cards');
        await mkdir(dataDir, { recursive: true });
        const cardPath = path.join(dataDir, `${article.id}.json`);
        await writeFile(cardPath, JSON.stringify(cardJson, null, 2), 'utf-8');
        cardDataSaved = true;
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
      usage: res.usage,
    });
  });
}
