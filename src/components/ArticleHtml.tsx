'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * 以隔离的 sandbox iframe「原封不动」渲染上传的 HTML。
 * - 完整保留原文档的 <style>、内联样式与布局，且与站点样式互不干扰。
 * - sandbox 仅授予 allow-scripts / allow-popups（不含 allow-same-origin），
 *   使内容处于「隔离来源」，无法访问站点 Cookie/DOM，脚本已在入库时剔除，形成纵深防御。
 * - 通过内置探针脚本上报内容高度实现自适应（仅防抖）。
 */
export default function ArticleHtml({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(480);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (ref.current && e.source !== ref.current.contentWindow) return;
      const d = e.data;
      if (d && d.type === 'xbf-article-height' && typeof d.height === 'number') {
        const h = Math.max(200, Math.ceil(d.height) + 4);
        // 纯防抖：合并短时间多次上报为一次更新
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setHeight(h), 120);
      }
    }
    window.addEventListener('message', onMsg);
    (window as unknown as Record<string, unknown>).__xbfScrollArticle = (id: string) => {
      ref.current?.contentWindow?.postMessage({ type: 'xbf-scroll-to', id }, '*');
    };
    return () => {
      window.removeEventListener('message', onMsg);
      delete (window as unknown as Record<string, unknown>).__xbfScrollArticle;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <iframe
      ref={ref}
      title="article-content"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      scrolling="no"
      className={className}
      style={{ width: '100%', height, border: 'none', display: 'block', overflow: 'hidden' }}
      srcDoc={buildSrcDoc(html)}
    />
  );
}

const PROBE = `<script>(function(){var _t=null;function m(){var de=document.documentElement,b=document.body;return Math.max(de?de.scrollHeight:0,de?de.offsetHeight:0,b?b.scrollHeight:0,b?b.offsetHeight:0)}function r(){if(_t)return;_t=setTimeout(function(){_t=null;try{parent.postMessage({type:'xbf-article-height',height:m()},'*')}catch(e){}},80)}window.addEventListener('load',r);window.addEventListener('resize',r);if(window.ResizeObserver){try{new ResizeObserver(r).observe(document.body||document.documentElement)}catch(e){}}document.addEventListener('DOMContentLoaded',r);var imgs=document.images||[];for(var i=0;i<imgs.length;i++){imgs[i].addEventListener('load',r);imgs[i].addEventListener('error',r)}window.addEventListener('message',function(e){var d=e.data;if(d&&d.type==='xbf-scroll-to'){var el=document.getElementById(d.id);if(el){el.scrollIntoView({behavior:'smooth',block:'start'})}}});setTimeout(r,300);setTimeout(r,1000);setTimeout(r,2500)})();<\/script>`;

const BASE_TAG = '<base target="_blank">';

// 关键：中和内容里所有可能的视口相对高度（如 min-height:100vh）。
// 在 iframe 中 100vh = iframe 自身高度，会与探针上报的高度耦合成循环，
// 导致高度不稳定（越滚越大 / 展示不全）。解耦后所有元素高度纯由内容决定。
const HEIGHT_RESET = `<style>html,body{height:auto!important;min-height:0!important;max-height:none!important}*{min-height:0!important;height:auto!important}</style>`;

const FRAGMENT_STYLE = `<style>html,body{margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#1f2937;line-height:1.85;font-size:16px;padding:4px;word-break:break-word}img{max-width:100%;height:auto}table{border-collapse:collapse;max-width:100%}</style>`;

/** 组装可注入 iframe 的完整 srcDoc：兼容完整文档与片段，并注入高度探针 */
function buildSrcDoc(inner: string): string {
  const isFull = /<html[\s>]/i.test(inner);
  if (isFull) {
    let out = inner;
    // 注入 <base> 到 head
    if (/<head[\s>]/i.test(out)) {
      out = out.replace(/<head([^>]*)>/i, `<head$1>${BASE_TAG}`);
    } else if (/<html[^>]*>/i.test(out)) {
      out = out.replace(/<html([^>]*)>/i, `<html$1><head>${BASE_TAG}</head>`);
    }
    // 注入高度解耦样式：放在 </head> 前，确保覆盖内容自带的 min-height:100vh 等
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `${HEIGHT_RESET}</head>`);
    } else if (/<body[^>]*>/i.test(out)) {
      out = out.replace(/(<body[^>]*>)/i, `${HEIGHT_RESET}$1`);
    }
    // 注入探针脚本到 body 末尾
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${PROBE}</body>`);
    } else {
      out += PROBE;
    }
    return out;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${BASE_TAG}${FRAGMENT_STYLE}${HEIGHT_RESET}</head><body>${inner}${PROBE}</body></html>`;
}
