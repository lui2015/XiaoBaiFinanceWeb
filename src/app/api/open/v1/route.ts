import { NextResponse } from 'next/server';

/**
 * 开放接口能力索引（公开只读，不含任何密钥或业务数据）。
 * 便于第三方 / AI 自动发现可用端点与文档地址。
 */
export async function GET() {
  return NextResponse.json({
    code: 0,
    message: 'ok',
    data: {
      name: '小白财经开放平台接口',
      version: 'v1',
      basePath: '/XiaoBaiFinance',
      auth: '除索引与文档外均需 API Key：Authorization: Bearer <API_KEY> 或 X-API-Key: <API_KEY>',
      docs: '/api/open/docs?doc=data',
      endpoints: [
        { method: 'GET', path: '/api/open/v1', auth: false, desc: '本能力索引' },
        { method: 'GET', path: '/api/open/docs?doc=data', auth: false, desc: '完整接口文档（Markdown）' },
        { method: 'GET', path: '/api/open/v1/articles', auth: true, desc: '已发布文章列表，支持分页/分类/关键词/排序' },
        { method: 'GET', path: '/api/open/v1/articles/{idOrSlug}', auth: true, desc: '文章详情，含正文与标签' },
        { method: 'GET', path: '/api/open/v1/categories', auth: true, desc: '分类树（含 slug，供投稿选择分类）' },
        { method: 'POST', path: '/api/open/articles', auth: true, desc: '投稿发布文章' },
      ],
    },
  });
}
