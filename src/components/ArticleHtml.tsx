'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * 以隔离的 sandbox iframe「原封不动」渲染上传的 HTML。
 * - 完整保留原文档的 <style>、内联样式与布局，且与站点样式互不干扰。
 * - sandbox 仅授予 allow-scripts / allow-popups（不含 allow-same-origin），
 *   使内容处于「隔离来源」，无法访问站点 Cookie/DOM，脚本已在入库时剔除，形成纵深防御。
 * - 通过内置探针脚本上报内容高度实现自适应（带防抖 & 突变过滤）。
 */
export default function ArticleHtml({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(480);
  const heightRef = useRef(480);
  // 防抖 timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (ref.current && e.source !== ref.current.contentWindow) return;
      const d = e.data;
      if (d && d.type === 'xbf-article-height' && typeof d.height === 'number') {
        const raw = Math.max(200, Math.ceil(d.height) + 4);
        // 突变过滤：不允许单次跳变超过当前高度的 3 倍或增加超过 2000px
        const prev = heightRef.current;
        if (raw > prev * 3 || raw > prev + 2000) return;
        // 只允许适度回缩（不低于当前的 50%），防止异常缩小后内容被截断
        const next = raw < prev * 0.5 ? prev : raw;

        // 100ms 防抖：合并短时间内多次上报
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          heightRef.current = next;
          setHeight(next);
        }, 100);
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

const PROBE = `<script>(function(){var _t=null;function r(){if(_t)return;_t=setTimeout(function(){_t=null;try{parent.postMessage({type:'xbf-article-height',height:Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0)},'*')}catch(e){}},120)}window.addEventListener('load',r);window.addEventListener('resize',r);if(window.ResizeObserver){try{new ResizeObserver(r).observe(document.documentElement)}catch(e){}}document.addEventListener('DOMContentLoaded',r);var imgs=document.images||[];for(var i=0;i<imgs.length;i++){imgs[i].addEventListener('load',r);imgs[i].addEventListener('error',r)}window.addEventListener('message',function(e){var d=e.data;if(d&&d.type==='xbf-scroll-to'){var el=document.getElementById(d.id);if(el){el.scrollIntoView({behavior:'smooth',block:'start'})}}});setTimeout(r,200);setTimeout(r,800);setTimeout(r,2000)})();<\/script>`;

const BASE_TAG = '<base target="_blank">';

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
    // 注入探针脚本到 body 末尾
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${PROBE}</body>`);
    } else {
      out += PROBE;
    }
    return out;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${BASE_TAG}${FRAGMENT_STYLE}</head><body>${inner}${PROBE}</body></html>`;
}
