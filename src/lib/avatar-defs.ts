/**
 * 文章对话头像素材：SVG symbol 定义。
 *
 * 背景：AI 生成/外部投稿的「小白 vs 师傅」对话文章用
 * <svg><use href="#zhu-bajie"></use></svg> 引用头像，但模型可能漏写
 * <symbol> 定义，导致头像显示为空心圆。这里提供权威定义，供服务端
 * 在落库前强制补齐，不依赖生成方忠实复制 prompt。
 */
export const AVATAR_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
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

/**
 * 若 HTML 引用了头像 symbol 却没有定义，则把 AVATAR_DEFS 补到 <body> 开头。
 * 已存在任一 symbol 定义则不改动（尊重内容自带的头像资源，如 base64 版本）。
 * 返回处理后的 HTML（无引用或无需修复时原样返回）。
 */
export function ensureAvatarDefs(html: string): string {
  if (!html) return html;
  // 没有 <use href="#zhu-bajie|#tang-seng"> 引用则无需处理
  if (!/<use\b[^>]*href=["']#(?:zhu-bajie|tang-seng)["']/i.test(html)) return html;
  // 已有任一 symbol 定义则视为已提供头像
  if (/<symbol\b[^>]*id=["'](?:zhu-bajie|tang-seng)["']/i.test(html)) return html;
  // 注入到 <body> 之后；无 body 则放到末尾
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>${AVATAR_DEFS}`);
  }
  return AVATAR_DEFS + html;
}
