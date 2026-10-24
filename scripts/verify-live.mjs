// 部署后线上验收：主机收敛、robots、三个 sitemap、每个 sitemap URL 的状态码/
// canonical/robots/X-Robots-Tag、线上与本地 dist 是否为同一版本、404 行为、IndexNow key。
// 用法：
//   npm run build && npm run verify:live
//   node scripts/verify-live.mjs --base http://127.0.0.1:4321   (对本地 preview 做同样检查，跳过主机收敛)
// 结果写入 qa/live-verify.json 与 qa/live-verify.md；存在 P0 问题时退出码为 1。
import { mkdir, writeFile } from 'node:fs/promises';
import { SITE, HOST, INDEXNOW_KEY, UA, locs, fetchPage, redirectChain, distPage, distSitemapUrls, pool, arg } from './lib/site.mjs';

const base = String(arg('base', SITE)).replace(/\/$/, '');
const local = base !== SITE;
const at = (u) => base + new URL(u, SITE).pathname + new URL(u, SITE).search;
const issues = [];
const add = (level, area, msg) => issues.push({ level, area, msg });

// 1. 主机收敛（只对正式域名有意义）
const hostChecks = [];
if (!local) {
  const starts = [
    ['http://tztuijianbang.cc/', `${SITE}/`],
    ['http://www.tztuijianbang.cc/', `${SITE}/`],
    ['https://www.tztuijianbang.cc/', `${SITE}/`],
    ['https://www.tztuijianbang.cc/reviews/sujie/?from=check', `${SITE}/reviews/sujie/?from=check`],
    ['http://tztuijianbang.cc/reviews/sujie/', `${SITE}/reviews/sujie/`],
    [`${SITE}/reviews/sujie`, `${SITE}/reviews/sujie/`],
    [`${SITE}/index.html`, `${SITE}/`],
  ];
  for (const [start, expect] of starts) {
    const c = await redirectChain(start);
    const permanent = c.hops.slice(0, -1).every((h) => [301, 308].includes(h.status));
    const ok = c.final === expect && c.finalStatus === 200 && permanent;
    hostChecks.push({ start, expect, ...c, ok });
    if (!ok) add(start.includes('www.') ? 'P0' : 'P1', 'host', `${start} → ${c.final} (${c.finalStatus})，期望 301/308 到 ${expect}`);
  }
}

// 2. robots.txt
const robotsRes = await fetch(at('/robots.txt'), { headers: { 'user-agent': UA } }).catch((e) => ({ status: 0, text: async () => String(e) }));
const robots = await robotsRes.text();
if (robotsRes.status !== 200) add('P0', 'robots', `robots.txt 状态 ${robotsRes.status}`);
if (/^\s*Disallow:\s*\/\s*$/im.test(robots)) add('P0', 'robots', 'robots.txt 存在 Disallow: /，请确认没有屏蔽 Bingbot');
if (!/Sitemap:\s*https:\/\/tztuijianbang\.cc\/sitemap-index\.xml/i.test(robots)) add('P1', 'robots', 'robots.txt 未声明 sitemap-index.xml');
if (/Content-Signal|BEGIN Cloudflare Managed/i.test(robots)) add('P2', 'robots', '线上 robots.txt 含 Cloudflare 托管内容，请在后台确认其规则不针对 bingbot');

// 3. sitemaps
const sm = {};
for (const name of ['sitemap-index.xml', 'sitemap.xml', 'sitemap-0.xml']) {
  const r = await fetch(at('/' + name), { headers: { 'user-agent': UA } }).catch(() => null);
  const xml = r ? await r.text() : '';
  sm[name] = { status: r?.status ?? 0, contentType: r?.headers.get('content-type'), locs: locs(xml), isIndex: xml.includes('<sitemapindex') };
  if (sm[name].status !== 200) add('P0', 'sitemap', `${name} 状态 ${sm[name].status}`);
  if (!/xml/.test(sm[name].contentType || '')) add('P1', 'sitemap', `${name} Content-Type 为 ${sm[name].contentType}`);
}
for (const name of ['sitemap-index.xml', 'sitemap.xml']) {
  if (sm[name].isIndex && !sm[name].locs.includes(`${SITE}/sitemap-0.xml`)) add('P0', 'sitemap', `${name} 未指向 sitemap-0.xml`);
}
const urls = sm['sitemap-0.xml'].locs;
const dupes = urls.filter((u, i) => urls.indexOf(u) !== i);
if (dupes.length) add('P1', 'sitemap', `sitemap-0.xml 重复 URL：${dupes.join(', ')}`);
const nonCanonicalForm = urls.filter((u) => !u.startsWith(`${SITE}/`) || !new URL(u).pathname.endsWith('/') || new URL(u).search);
if (nonCanonicalForm.length) add('P0', 'sitemap', `非规范 URL：${nonCanonicalForm.join(', ')}`);
if (!sm['sitemap.xml'].isIndex) {
  const a = new Set(urls), b = new Set(sm['sitemap.xml'].locs);
  const diff = [...a].filter((u) => !b.has(u)).concat([...b].filter((u) => !a.has(u)));
  add(diff.length ? 'P1' : 'P2', 'sitemap', `sitemap.xml 仍是独立 urlset（旧版本），与 sitemap-0.xml 差异 ${diff.length} 条`);
}
const distUrls = await distSitemapUrls();
let missingVsBuild = [], extraVsBuild = [];
if (distUrls) {
  missingVsBuild = distUrls.filter((u) => !urls.includes(u));
  extraVsBuild = urls.filter((u) => !distUrls.includes(u));
  if (missingVsBuild.length || extraVsBuild.length) add('P0', 'deploy', `线上 sitemap 与本地构建不一致：缺少 ${missingVsBuild.length}，多出 ${extraVsBuild.length}`);
}

// 4. 每个 sitemap URL
const pages = await pool(urls, 6, async (u) => {
  const live = await fetchPage(at(u));
  const built = await distPage(u);
  const problems = [];
  if (live.status !== 200) problems.push(`状态 ${live.status}${live.location ? ' → ' + live.location : ''}`);
  if (live.xRobotsTag && /noindex|none/i.test(live.xRobotsTag)) problems.push(`X-Robots-Tag: ${live.xRobotsTag}`);
  if (live.robots && /noindex|none/i.test(live.robots)) problems.push(`meta robots: ${live.robots}`);
  if (live.status === 200 && live.canonical !== u) problems.push(`canonical=${live.canonical}`);
  if (live.status === 200 && live.h1 !== 1) problems.push(`h1×${live.h1}`);
  const sameAsBuild = built ? built.title === live.title && built.description === live.description : null;
  return { url: u, ...live, problems, sameAsBuild, builtTitle: built?.title };
});
for (const p of pages) if (p.problems.length) add('P0', 'url', `${p.url}：${p.problems.join('；')}`);
const stale = pages.filter((p) => p.sameAsBuild === false);
if (stale.length) add('P0', 'deploy', `${stale.length}/${pages.length} 个页面的线上 title/description 与当前构建不同，生产环境不是当前代码版本（例：${stale[0].url}）`);

// 5. 404 / 软 404
const missing = await fetchPage(at(`/__not-found-check-${Date.now()}/`));
if (missing.status !== 404) add('P0', 'soft404', `不存在的路径返回 ${missing.status}（应为 404）`);

// 6. IndexNow key
const keyRes = await fetch(at(`/${INDEXNOW_KEY}.txt`), { headers: { 'user-agent': UA } }).catch(() => null);
const keyText = keyRes ? (await keyRes.text()).trim() : '';
const keyOk = keyRes?.status === 200 && keyText === INDEXNOW_KEY;
if (!keyOk) add('P1', 'indexnow', `IndexNow key 文件不可用（状态 ${keyRes?.status ?? 0}）`);

const report = {
  checkedAt: new Date().toISOString(), base, host: HOST,
  summary: {
    sitemapUrls: urls.length,
    ok200: pages.filter((p) => p.status === 200).length,
    withProblems: pages.filter((p) => p.problems.length).length,
    matchesCurrentBuild: distUrls ? pages.filter((p) => p.sameAsBuild).length : 'dist 不存在，未比较',
    p0: issues.filter((i) => i.level === 'P0').length,
    p1: issues.filter((i) => i.level === 'P1').length,
    p2: issues.filter((i) => i.level === 'P2').length,
  },
  issues, hostChecks,
  sitemaps: Object.fromEntries(Object.entries(sm).map(([k, v]) => [k, { status: v.status, contentType: v.contentType, isIndex: v.isIndex, count: v.locs.length }])),
  missingVsBuild, extraVsBuild,
  notFoundStatus: missing.status, indexNowKey: keyOk,
  pages: pages.map(({ url, status, canonical, robots, xRobotsTag, title, sameAsBuild, problems }) => ({ url, status, canonical, robots, xRobotsTag, title, sameAsBuild, problems })),
};

const md = [
  `# 线上 URL / Sitemap 验收报告`, ``, `- 检查时间：${report.checkedAt}`, `- 检查对象：${base}`,
  `- sitemap-0.xml URL 数：${urls.length}；200：${report.summary.ok200}；有问题：${report.summary.withProblems}；与当前构建一致：${report.summary.matchesCurrentBuild}`,
  `- 不存在路径状态码：${missing.status}；IndexNow key：${keyOk ? '可用' : '不可用'}`, ``,
  `## 问题（${issues.length}）`, ...(issues.length ? issues.map((i) => `- **${i.level}** [${i.area}] ${i.msg}`) : ['- 无']), ``,
  ...(hostChecks.length ? [`## 主机收敛`, `| 起点 | 链路 | 结果 |`, `|---|---|---|`, ...hostChecks.map((h) => `| ${h.start} | ${h.hops.map((x) => x.status ?? x.error).join(' → ')} → ${h.final} | ${h.ok ? '✅' : '❌'} |`), ``] : []),
  `## Sitemap`, `| 文件 | 状态 | 类型 | 条目 |`, `|---|---|---|---|`,
  ...Object.entries(report.sitemaps).map(([k, v]) => `| ${k} | ${v.status} | ${v.isIndex ? 'index' : 'urlset'} | ${v.count} |`), ``,
  `> 说明：本报告只证明 URL 可被抓取且信号一致，不代表 Bing 已抓取或收录。`,
].join('\n');

await mkdir('qa', { recursive: true });
await writeFile('qa/live-verify.json', JSON.stringify(report, null, 2));
await writeFile('qa/live-verify.md', md + '\n');
console.log(md);
process.exitCode = report.summary.p0 ? 1 : 0;
