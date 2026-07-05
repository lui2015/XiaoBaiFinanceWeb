// 客户端请求工具：Next.js 的 basePath 不会自动作用于 fetch，
// 这里统一为以 "/" 开头的接口路径拼接 basePath 前缀。
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** 为以 "/" 开头的路径拼接 basePath（绝对 URL 或已带前缀的路径原样返回）。 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  if (!path.startsWith('/')) return path;
  if (BASE_PATH && path.startsWith(BASE_PATH + '/')) return path;
  return `${BASE_PATH}${path}`;
}

/** 带 basePath 的 fetch 封装。 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(input), init);
}
