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

## 角色设定（严格遵循视觉规范）
- **小白（猪八戒形象）**：
  - 外貌：粉红色圆脸、大耳朵、小眼睛、笑眯眯的表情
  - 性格：投资新手，憨厚可爱、爱问问题
  - 口语风格：自称"俺老猪"，句式如"师傅~ XX 是啥玩意儿嘛？"、"俺老猪听不太懂"、"那XX是不是越大越好？"
  - 气泡颜色：**暖黄色背景 #fffbeb**，橙色边框 #f59e0b
- **师傅（唐僧形象）**：
  - 外貌：慈祥面容、光头（有佛珠）、温和眼神
  - 性格：资深股民/佛系导师，沉稳睿智
  - 口语风格：自称"为师"/"师傅"，句式如"阿弥陀佛~ 悟能莫急"、"善哉善哉！徒儿天资聪颖！"、"不可执念！"
  - 气泡颜色：**淡蓝色背景 #eff6ff**，蓝色边框 #2563eb

## 输出要求
请根据用户给出的财经概念主题，生成一份完整的**单文件 HTML 漫画**。

### HTML 结构规范（必须严格遵守）
1. **DOCTYPE + html head body** 完整结构，charset=utf-8
2. **内联所有 CSS**（写在 <style> 标签内），不依赖外部资源
3. **viewport meta**：<meta name="viewport" content="width=device-width, initial-scale=1">
4. **5 个章节**（<section>），每章包含：
   - 章节标题（<h2> 带编号）
   - 至少 1 轮对话（小白提问 + 师傅解答）
   - 至少 1 个可视化组件（表格/公式框/流程图/笔记框等）

### 5 章节固定结构
1. **是什么** — 通俗定义 + 类比（用生活场景比喻）
2. **怎么算** — 公式 + 计算示例（给具体数字）
3. **怎么读** — 数值区间含义 + 数据表格
4. **怎么用** — 实战决策方法 + 操作建议
5. **风险点 & 口诀** — 局限性总结 + 朗朗上口的速记口诀

### 视觉样式要求（重要！必须严格遵守）
- **整体布局**：max-width: 800px; margin: 0 auto; padding: 20px; background: #f8fafc;
- **主色调**：蓝色科技风（#1e3a8a / #2563eb / #3b82f6）
- **对话气泡样式**（关键！）：
  - 使用 flexbox 布局，左侧显示角色头像区域 + 右侧气泡
  - 小白气泡：background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 12px;
  - 师傅气泡：background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 12px;
  - 角色名标签：小白用橙色 #f59e0b，师傅用蓝色 #2563eb
- **头像实现**：使用 CSS 绘制的圆形头像（不是emoji文字）：
  - 小白：粉色圆形背景(#fbcfe8) + 猪耳朵CSS形状 + 简笔画表情(用CSS/SVG)
  - 师傅：米色圆形背景(#fef3c7) + 佛珠装饰 + 慈祥表情(用CSS/SVG)
- **高亮术语**：<span class="highlight"> 样式：background: #fef08a; padding: 2px 6px; border-radius: 4px;
- **组件样式**：
  - 数据表格(.data-table)：蓝色表头 + 斑马纹行
  - 公式框(.formula)：深蓝渐变背景 + 白色文字 + 居中
  - 笔记框(.note-box)：浅蓝背景 + 左侧蓝色边框
  - 风险提示框(.risk-box)：浅红背景 + 红色警告图标
  - 口诀框(.mnemonic-box)：深蓝渐变背景 + 橙色标题 + 白色文字
- **底部免责声明**：「⚠️ 本内容仅供学习交流，不构成任何投资建议」（红色警示框）

### 对话节奏
- 每段对话 ≤ 3 行（手机阅读友好）
- 小白提问 → 师傅解答 → 小白追问/恍然大悟 → 师傅升华 → 进入下一章
- 结尾有师傅金句或投资寄语

### 同时输出卡片数据（放在HTML之后）
在完整的 HTML </html> 结束标签之后，**另起一行**，严格按照如下标记输出 6 张卡片的渲染数据：

===CARDS_JSON_START===
{
  "concept": "概念名",
  "cards": [
    {"title": ["主标题","副标题"], "subtitle": "描述", "blocks": [...]},
    ...
  ]
}
===CARDS_JSON_END===

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

前5张对应5个章节（对话+图表混排），第6张是纯图表总结卡（hero+timeline+keywords+mnemonic）。
注意：JSON 中不要使用 Python 元组语法，所有数据用合法 JSON（数组/对象/字符串）。`;

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
