/**
 * Seed 脚本：默认管理员 + 分类 + 8 篇示例文章 + 默认配置
 * 运行：pnpm prisma:seed  或  npx tsx prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { sanitizeHtmlContent, htmlToText } from '../src/lib/sanitize';

const prisma = new PrismaClient();

async function ensureAdmin() {
  const username = process.env.SEED_SUPER_ADMIN_USERNAME || 'admin';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD || 'Admin@12345';
  const exists = await prisma.adminUser.findUnique({ where: { username } });
  if (exists) return;
  await prisma.adminUser.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 10),
      role: 2,
      realName: '超级管理员',
    },
  });
  console.log(`[seed] admin created: ${username} / ${password}`);
}

const CATEGORIES: Array<{ name: string; slug: string; sort: number; children?: { name: string; slug: string }[] }> = [
  { name: '基础概念', slug: 'basics', sort: 1, children: [{ name: '名词解释', slug: 'glossary' }, { name: '入门指南', slug: 'getting-started' }] },
  { name: '基本面分析', slug: 'fundamental', sort: 2, children: [{ name: '财报解读', slug: 'financial-report' }, { name: '行业分析', slug: 'industry' }] },
  { name: '技术面分析', slug: 'technical', sort: 3, children: [{ name: 'K线形态', slug: 'kline' }, { name: '指标', slug: 'indicators' }] },
  { name: '宏观经济', slug: 'macro', sort: 4 },
  { name: '投资品种', slug: 'instruments', sort: 5, children: [{ name: '股票', slug: 'stocks' }, { name: '基金', slug: 'funds' }, { name: '债券', slug: 'bonds' }] },
  { name: '理财规划', slug: 'planning', sort: 6 },
  { name: '行为金融', slug: 'behavioral', sort: 7 },
];

async function ensureCategories() {
  for (const c of CATEGORIES) {
    const parent = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, sortOrder: c.sort, status: 1 },
      create: { name: c.name, slug: c.slug, sortOrder: c.sort, status: 1 },
    });
    if (c.children) {
      for (const sub of c.children) {
        await prisma.category.upsert({
          where: { slug: sub.slug },
          update: { name: sub.name, parentId: parent.id, status: 1 },
          create: { name: sub.name, slug: sub.slug, parentId: parent.id, status: 1 },
        });
      }
    }
  }
}

const SAMPLES: Array<{ title: string; slug: string; categorySlug: string; subSlug?: string; html: string; summary?: string; recommend?: boolean }> = [
  {
    title: '什么是股票？小白入门第一课', slug: 'what-is-stock', categorySlug: 'basics', subSlug: 'getting-started', recommend: true,
    summary: '一文读懂股票的本质、买卖逻辑与常见误区。',
    html: `<h2>股票到底是什么</h2><p>股票是公司发行的<strong>所有权凭证</strong>，持有它意味着你成为这家公司的股东之一。</p><h2>为什么股价会涨跌</h2><p>从根本上看，股价反映市场对公司未来现金流的预期；短期内还会被情绪、流动性等因素左右。</p><h3>新手常见误区</h3><ul><li>把股票当彩票</li><li>追涨杀跌</li><li>满仓单只</li></ul>`,
  },
  {
    title: '基金到底有几种？一张图理清', slug: 'fund-types', categorySlug: 'instruments', subSlug: 'funds', recommend: true,
    summary: '货币、债券、混合、股票、指数、QDII，按风险与收益梳理。',
    html: `<h2>按投资标的分类</h2><p>基金按投资标的可分为：货币基金、债券基金、混合基金、股票基金、指数基金、QDII。</p><h3>风险与预期收益</h3><p>从低到高大致是：货币 &lt; 债券 &lt; 混合 &lt; 股票 &lt; QDII（视市场而定）。</p>`,
  },
  {
    title: '读懂三大财务报表', slug: 'three-statements', categorySlug: 'fundamental', subSlug: 'financial-report', recommend: true,
    summary: '资产负债表、利润表、现金流量表的核心阅读顺序。',
    html: `<h2>三张表的关系</h2><p>资产负债表是<em>快照</em>，利润表与现金流量表是<em>录像</em>。</p><h2>新手阅读顺序</h2><ol><li>先看现金流量表是否健康</li><li>再看利润表的真实质量</li><li>最后看资产负债表的结构</li></ol>`,
  },
  {
    title: 'K线入门：这 6 种形态先认识', slug: 'kline-6-patterns', categorySlug: 'technical', subSlug: 'kline',
    summary: '锤子线、十字星、吞没、孕线、长上影、长下影。',
    html: `<h2>K线的本质</h2><p>K线只是把开高低收四个价格画成图形，它本身不会预测未来。</p><h2>需要先熟记的形态</h2><p>锤子线、十字星、吞没、孕线、长上影、长下影。</p>`,
  },
  {
    title: 'CPI、PPI、GDP 你需要看什么', slug: 'cpi-ppi-gdp', categorySlug: 'macro',
    summary: '宏观三大指标对资产价格的传导路径。',
    html: `<h2>CPI</h2><p>衡量居民消费品价格水平。</p><h2>PPI</h2><p>衡量工业生产端价格，常领先 CPI。</p><h2>GDP</h2><p>经济总量与增速，决定长期估值锚。</p>`,
  },
  {
    title: '债券是怎么赚钱的', slug: 'how-bond-earn', categorySlug: 'instruments', subSlug: 'bonds',
    summary: '票息、资本利得、再投资三种来源。',
    html: `<h2>三种收益来源</h2><ul><li>票息收入</li><li>资本利得（价格波动）</li><li>再投资收益</li></ul>`,
  },
  {
    title: '理财金字塔：先做哪一层', slug: 'finance-pyramid', categorySlug: 'planning',
    summary: '应急金 → 保险 → 稳健配置 → 进取配置。',
    html: `<h2>金字塔结构</h2><ol><li>底层：应急金 3-6 个月</li><li>第二层：保险（医疗/重疾/意外）</li><li>第三层：稳健配置</li><li>顶层：进取配置</li></ol>`,
  },
  {
    title: '为什么你总在高点买入：处置效应', slug: 'disposition-effect', categorySlug: 'behavioral',
    summary: '行为金融学最常见的小白陷阱之一。',
    html: `<h2>处置效应</h2><p>赚钱时急着卖，亏钱时舍不得割，是人类的天性偏差。</p>`,
  },
];

async function ensureArticles() {
  for (const s of SAMPLES) {
    const cat = await prisma.category.findUnique({ where: { slug: s.categorySlug } });
    if (!cat) continue;
    const sub = s.subSlug ? await prisma.category.findUnique({ where: { slug: s.subSlug } }) : null;
    const html = sanitizeHtmlContent(s.html);
    const text = htmlToText(html);
    await prisma.article.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        title: s.title,
        slug: s.slug,
        summary: s.summary,
        sourceType: 0,
        contentHtml: html,
        contentText: text,
        categoryId: cat.id,
        subCategoryId: sub?.id,
        status: 1,
        isRecommend: !!s.recommend,
        publishAt: new Date(),
      },
    });
  }
}

async function ensureSysConfig() {
  const defaults: Array<[string, string, string]> = [
    ['site.name', '小白财经', '站点名称'],
    ['site.slogan', '让财经知识看得懂、找得到、读得顺', '副标题'],
    ['site.icp', '', '备案号'],
    ['policy.terms_version', '2026-06-01', '用户协议版本'],
    ['policy.privacy_version', '2026-06-01', '隐私政策版本'],
    ['sms.daily_limit', '10', '同一手机号单日短信上限'],
    ['sms.cooldown_sec', '60', '同一手机号短信发送冷却'],
    ['login.fail_lock_count', '5', '登录失败锁定阈值'],
    ['login.fail_lock_minutes', '10', '登录失败锁定时长（分）'],
  ];
  for (const [k, v, remark] of defaults) {
    await prisma.sysConfig.upsert({ where: { k }, update: { v, remark }, create: { k, v, remark } });
  }
}

async function main() {
  await ensureAdmin();
  await ensureCategories();
  await ensureArticles();
  await ensureSysConfig();
  console.log('[seed] done');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
