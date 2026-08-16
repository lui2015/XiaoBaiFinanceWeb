/**
 * 腾讯 MaaS 大模型（TokenHub）API 客户端
 * 用于调用大模型生成财经科普漫画内容（当前默认 deepseek-v4-pro-202606）
 */

const HUNYUAN_API = 'https://tokenhub.tencentmaas.com/v1/chat/completions';
// 安全：密钥仅通过环境变量注入，不硬编码
const HUNYUAN_KEY = process.env.HUNYUAN_API_KEY || '';

export interface HunyuanMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface HunyuanOptions {
  messages: HunyuanMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface HunyuanResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 调用混元大模型
 */
export async function callHunyuan(options: HunyuanOptions): Promise<HunyuanResponse> {
  if (!HUNYUAN_KEY) {
    throw new Error('HUNYUAN_API_KEY 环境变量未配置');
  }

  const { messages, model = 'deepseek-v4-pro-202606', temperature = 0.7, maxTokens = 16384 } = options;

  const res = await fetch(HUNYUAN_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUNYUAN_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`混元API错误 ${res.status}: ${text.slice(0, 500)}`);
  }

  const data: HunyuanResponse = await res.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('混元返回内容为空');
  }

  return data;
}

/**
 * 从 LLM 响应中提取 HTML 内容（去除可能的 markdown 代码块包裹）
 */
export function extractHtml(raw: string): string {
  let html = raw.trim();
  // 去除 ```html ... ``` 包裹
  const codeBlockMatch = html.match(/```(?:html)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    html = codeBlockMatch[1].trim();
  }
  return html;
}

/**
 * 从 LLM 响应中提取 JSON 数据（用于卡片生成数据）
 */
export function extractJson<T>(raw: string): T | null {
  // 尝试匹配 ```json ... ```
  const jsonMatch = raw.match(/```json\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1].trim()); } catch { /* fall through */ }
  }
  // 尝试直接解析
  try { return JSON.parse(raw); } catch { return null; }
}
