'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * 以隔离的 sandbox iframe「原封不动」渲染上传的 HTML。
 * - 完整保留原文档的 <style>、内联样式与布局，且与站点样式互不干扰。
 * - sandbox 仅授予 allow-scripts / allow-popups（不含 allow-same-origin），
 *   使内容处于「隔离来源」，无法访问站点 Cookie/DOM，脚本已在入库时剔除，形成纵深防御。
 * - 通过内置探针脚本上报内容高度实现自适应（仅防抖）。
 * - 多层防护杜绝底部空白逐渐增大：
 *   ① iframe 内全局强制重置所有 vh/vmax 相关属性
 *   ② 探针脚本内置高度上限检测（不超过可视区 3 倍）
 *   ③ 父组件记录首次稳定高度，后续只允许单向缩小或合理增长
 */
export default function ArticleHtml({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(480);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 高度安全阀：记录历史最大值，防止无限增长
  const stableHeightRef = useRef<number | null>(null);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (ref.current && e.source !== ref.current.contentWindow) return;
      const d = e.data;
      if (d && d.type === 'xbf-article-height' && typeof d.height === 'number') {
        let h = Math.max(200, Math.ceil(d.height) + 4);
        // 安全阀：如果已有稳定高度，新高度不允许超过稳定值的 1.5 倍（防止正反馈循环）
        if (stableHeightRef.current !== null && h > stableHeightRef.current * 1.5) {
          h = stableHeightRef.current;
        }
        // 纯防抖：合并短时间多次上报为一次更新
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setHeight(prev => {
            const next = h;
            // 首次稳定（连续上报不再暴涨）后锁定基准
            if (stableHeightRef.current === null || next > stableHeightRef.current) {
              if (next <= 10000) stableHeightRef.current = next; // 合理范围内才更新基准
            }
            return next;
          });
        }, 120);
      }
    }
    window.addEventListener('message', onMsg);
    (window as unknown as Record<string, unknown>).__xbfScrollArticle = (id: string) => {
      ref.current?.contentWindow?.postMessage({ type: 'xbf-scroll-to', id }, '*');
    };
    return () => {
      window.removeEventListener('message', onMsg);
      delete (window as unknown as Record<string,unknown>).__xbfScrollArticle;
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

const PROBE = `<script>(function(){var _t=null,_prev=0,_stable=0,_count=0;function m(){var de=document.documentElement,b=document.body;var h=Math.max(de?de.scrollHeight:0,de?de.offsetHeight:0,b?b.scrollHeight:0,b?b.offsetHeight:0);var limit=(innerHeight||800)*3;if(h>limit)h=limit;return h}function r(){if(_t)return;_t=setTimeout(function(){_t=null;var h=m();if(_stable>0&&h>_stable*1.8)h=_stable;if(h===_prev&&_count++>3)_stable=h||_stable;else if(Math.abs(h-_prev)<3)_count++;else{_prev=h;_count=0}try{parent.postMessage({type:'xbf-article-height',height:h},'*')}catch(e){}},80)}window.addEventListener('load',r);window.addEventListener('resize',r);if(window.ResizeObserver){try{new ResizeObserver(r).observe(document.body||document.documentElement)}catch(e){}}document.addEventListener('DOMContentLoaded',r);var imgs=document.images||[];for(var i=0;i<imgs.length;i++){imgs[i].addEventListener('load',r);imgs[i].addEventListener('error',r)}window.addEventListener('message',function(e){var d=e.data;if(d&&d.type==='xbf-scroll-to'){var el=document.getElementById(d.id);if(el){el.scrollIntoView({behavior:'smooth',block:'start'})}}});setTimeout(r,300);setTimeout(r,1000);setTimeout(r,2500)})();<\/script>`;

const BASE_TAG = '<base target="_blank">';

// 三层高度重置防御：
// 1. HEAD 注入：基础重置（优先级中等）
// 2. BODY 末尾注入：最终兜底（最高优先级，覆盖所有内容自带样式）
// 全面清除 vh/vmax/vmin/百分比高度 + flex/grid 撑开问题
const HEIGHT_RESET_HEAD = `<style>html,body{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}*,:before,:after{min-height:0!important;max-height:none!important}</style>`;

const HEIGHT_RESET_BODY = `<style>html,body{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}*,:before,:after{min-height:0!important;height:auto!important;max-height:none!important;flex:none!important;flex-basis:auto!important;align-self:flex-start!important}.xiaoBaiFinanceWeb-root,.root,#root,#app,[id=root],[class*=container],[class*=wrapper]{min-height:0!important;height:auto!important;max-height:none!important}</style>`;

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
    // 注入头部高度解耦样式
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `${HEIGHT_RESET_HEAD}</head>`);
    } else if (/<body[^>]*>/i.test(out)) {
      out = out.replace(/(<body[^>]*>)/i, `${HEIGHT_RESET_HEAD}$1`);
    }
    // 注入探针脚本到 body 末尾（带最终兜底样式）
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${HEIGHT_RESET_BODY}${PROBE}</body>`);
    } else {
      out += `${HEIGHT_RESET_BODY}${PROBE}`;
    }
    return out;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${BASE_TAG}${FRAGMENT_STYLE}${HEIGHT_RESET_HEAD}</head><body>${inner}${HEIGHT_RESET_BODY}${PROBE}</body></html>`;
}
