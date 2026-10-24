// 线上验收与 IndexNow 共用的小工具。只使用 Node 内置 fetch，不引入新依赖。
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const SITE = 'https://tztuijianbang.cc';
export const HOST = 'tztuijianbang.cc';
export const INDEXNOW_KEY = '9ff4d63c81a9a91c1198c88df4d08d24';
export const UA = 'tztuijianbang-site-check/1.0 (+https://tztuijianbang.cc/)';

export const locs = (xml) => [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g)].map((m) => m[1].replaceAll('&amp;', '&'));
const unescape = (s) => s?.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const pick = (html, re) => unescape(html.match(re)?.[1]);

export function parseHtml(html) {
  return {
    title: pick(html, /<title>(.*?)<\/title>/s),
    description: pick(html, /<meta name="description" content="([^"]*)"/),
    canonical: pick(html, /<link rel="canonical" href="([^"]*)"/),
    robots: pick(html, /<meta name="robots" content="([^"]*)"/),
    h1: (html.match(/<h1[\s>]/g) || []).length,
  };
}

/** 读取本地 dist 中某个 URL 对应的 HTML 元信息（不存在则返回 null）。 */
export async function distPage(url, dist = 'dist') {
  const p = new URL(url).pathname;
  const file = path.join(dist, decodeURIComponent(p), p.endsWith('/') ? 'index.html' : '');
  if (!existsSync(file)) return null;
  return parseHtml(await readFile(file, 'utf8'));
}

export async function distSitemapUrls(dist = 'dist') {
  const file = path.join(dist, 'sitemap-0.xml');
  if (!existsSync(file)) return null;
  return locs(await readFile(file, 'utf8'));
}

/** 不自动跟随跳转，返回每一跳，便于核对 301/308 链路。 */
export async function redirectChain(start, maxHops = 6) {
  const hops = [];
  let url = start;
  for (let i = 0; i < maxHops; i++) {
    try {
      const r = await fetch(url, { redirect: 'manual', headers: { 'user-agent': UA } });
      const loc = r.headers.get('location');
      hops.push({ url, status: r.status, location: loc ? new URL(loc, url).href : null });
      if (r.status >= 300 && r.status < 400 && loc) { url = new URL(loc, url).href; continue; }
      return { hops, final: url, finalStatus: r.status };
    } catch (e) {
      hops.push({ url, error: String(e.cause?.code || e.message) });
      return { hops, final: url, finalStatus: 0 };
    }
  }
  return { hops, final: url, finalStatus: -1 };
}

/** 抓取单个 URL（不跟随跳转），返回状态码、关键响应头和 HTML 元信息。 */
export async function fetchPage(url) {
  try {
    const r = await fetch(url, { redirect: 'manual', headers: { 'user-agent': UA }, cache: 'no-store' });
    const type = r.headers.get('content-type') || '';
    const body = type.includes('html') ? await r.text() : '';
    return {
      url, status: r.status,
      location: r.headers.get('location'),
      xRobotsTag: r.headers.get('x-robots-tag'),
      contentType: type,
      cfRay: r.headers.get('cf-ray'),
      ...(body ? parseHtml(body) : {}),
    };
  } catch (e) {
    return { url, status: 0, error: String(e.cause?.code || e.message) };
  }
}

export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
