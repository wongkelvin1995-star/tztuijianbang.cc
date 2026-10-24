// 构建产物检查：sitemap 覆盖所有可索引页面、无重复/非规范 URL、不收录 noindex 页、
// lastmod 只来自文章 frontmatter、sitemap.xml 与 sitemap-index.xml 都指向 sitemap-0.xml。
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { SITE, INDEXNOW_KEY, locs, parseHtml } from './lib/site.mjs';

const root = path.resolve('dist');
const errors = [];
async function walk(dir) { const out = []; for (const e of await readdir(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) out.push(...await walk(p)); else out.push(p); } return out; }

const sm0 = await readFile(path.join(root, 'sitemap-0.xml'), 'utf8');
const urls = locs(sm0);
const set = new Set(urls);
if (set.size !== urls.length) errors.push('sitemap-0.xml 有重复 URL');
for (const u of urls) if (!u.startsWith(`${SITE}/`) || !u.endsWith('/') || u.includes('?')) errors.push(`非规范 URL：${u}`);

for (const name of ['sitemap-index.xml', 'sitemap.xml']) {
  const xml = await readFile(path.join(root, name), 'utf8');
  if (!xml.includes('<sitemapindex') || JSON.stringify(locs(xml)) !== JSON.stringify([`${SITE}/sitemap-0.xml`])) errors.push(`${name} 应为只指向 sitemap-0.xml 的 sitemap 索引`);
}

const indexable = [], noindexed = [];
for (const f of (await walk(root)).filter((f) => f.endsWith('.html'))) {
  const rel = '/' + path.relative(root, f).replaceAll('\\', '/');
  if (rel.startsWith('/pagefind/')) continue;
  const meta = parseHtml(await readFile(f, 'utf8'));
  const url = SITE + rel.replace(/index\.html$/, '');
  if (meta.robots?.includes('noindex')) { noindexed.push(url); if (set.has(url)) errors.push(`noindex 页面出现在 sitemap：${url}`); if (meta.canonical) errors.push(`noindex 页面不应声明 canonical：${url}`); continue; }
  indexable.push(url);
  if (!set.has(url)) errors.push(`可索引页面未进入 sitemap：${url}`);
  if (meta.canonical !== url) errors.push(`canonical 不指向自身：${url} → ${meta.canonical}`);
}
for (const u of urls) if (!indexable.includes(u)) errors.push(`sitemap URL 没有对应 HTML：${u}`);

// lastmod 与 frontmatter 一致
const entries = [...sm0.matchAll(/<url><loc>(.*?)<\/loc>(?:<lastmod>(.*?)<\/lastmod>)?/g)].map((m) => ({ loc: m[1], lastmod: m[2] }));
let withLastmod = 0;
for (const file of (await readdir('src/content/articles')).filter((f) => f.endsWith('.md'))) {
  const fm = (await readFile(path.join('src/content/articles', file), 'utf8')).split('---')[1];
  const cat = fm.match(/^category:\s*"?([a-z0-9-]+)"?/m)[1];
  const day = (fm.match(/^updated:\s*"?([\d-]+)"?/m) || fm.match(/^date:\s*"?([\d-]+)"?/m))[1];
  const e = entries.find((x) => x.loc === `${SITE}/${cat}/${file.slice(0, -3)}/`);
  if (!e) { errors.push(`文章未进入 sitemap：${file}`); continue; }
  if (!e.lastmod?.startsWith(day)) errors.push(`lastmod 与 frontmatter 不符：${e.loc} ${e.lastmod} ≠ ${day}`); else withLastmod++;
}
const nonArticleLastmod = entries.filter((e) => e.lastmod && new URL(e.loc).pathname.split('/').filter(Boolean).length < 2);
if (nonArticleLastmod.length) errors.push(`非文章页不应输出 lastmod：${nonArticleLastmod.map((e) => e.loc).join(', ')}`);

const robots = await readFile(path.join(root, 'robots.txt'), 'utf8');
if (!robots.includes(`Sitemap: ${SITE}/sitemap-index.xml`)) errors.push('robots.txt 未声明 sitemap-index.xml');
if ((await readFile(path.join(root, `${INDEXNOW_KEY}.txt`), 'utf8')).trim() !== INDEXNOW_KEY) errors.push('IndexNow key 文件内容不符');

const report = { sitemapUrls: urls.length, indexablePages: indexable.length, noindexPages: noindexed, articlesWithLastmod: withLastmod, errors };
await mkdir('qa', { recursive: true });
await writeFile('qa/sitemap-test.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
