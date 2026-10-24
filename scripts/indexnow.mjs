// IndexNow 更新通知（Bing / Yandex / Seznam 等共享）。默认只做预演，不发送。
//
//   node scripts/indexnow.mjs --since <git提交>          预演：列出该提交之后变化的 URL 并做线上校验
//   node scripts/indexnow.mjs --since <git提交> --submit 校验通过后提交
//   node scripts/indexnow.mjs --all --submit             首次接入：提交 sitemap-0.xml 全部 URL（只需一次）
//   node scripts/indexnow.mjs --urls https://tztuijianbang.cc/a/,https://tztuijianbang.cc/b/ --submit
//
// 安全护栏（任何一项不满足都不会提交）：
//   1. 线上 /<key>.txt 必须返回与本地一致的 key；
//   2. 每个 URL 线上必须 200、canonical 指向自身、无 noindex；已删除文章允许 404/410；
//   3. 线上 title/description 必须与本地 dist 一致——防止在新版本尚未部署时提前通知；
//      （可用 --force 跳过第 3 项，但不建议）
// 只通知真实发生变化的 URL；IndexNow 只是“通知”，不保证抓取或收录。
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { SITE, HOST, INDEXNOW_KEY, fetchPage, distPage, distSitemapUrls, pool, arg } from './lib/site.mjs';

const submit = arg('submit', false) === true;
const force = arg('force', false) === true;
const endpoint = String(arg('endpoint', 'https://api.indexnow.org/indexnow'));
const since = arg('since', null);
const keyLocation = `${SITE}/${INDEXNOW_KEY}.txt`;
// --base 仅用于在本地 preview 上测试校验逻辑；提交时始终通知正式域名 URL。
const base = String(arg('base', SITE)).replace(/\/$/, '');
const at = (u) => base + new URL(u).pathname;
if (submit && base !== SITE) { console.error('--base 只能用于预演'); process.exit(2); }

const distUrls = await distSitemapUrls();
if (!distUrls) { console.error('未找到 dist/sitemap-0.xml，请先运行 npm run build'); process.exit(2); }
const all = new Set(distUrls);
const byPrefix = (p) => distUrls.filter((u) => u.startsWith(`${SITE}${p}`));

const urls = new Set();
const deleted = new Set();
const notes = [];

if (arg('all', false) === true) distUrls.forEach((u) => urls.add(u));
if (typeof arg('urls', null) === 'string') String(arg('urls')).split(',').map((s) => s.trim()).filter(Boolean).forEach((u) => urls.add(u));

if (typeof since === 'string') {
  const out = execFileSync('git', ['diff', '--name-status', '--no-renames', `${since}`, 'HEAD'], { encoding: 'utf8' });
  for (const line of out.trim().split('\n').filter(Boolean)) {
    const [status, file] = line.split('\t');
    const art = file.match(/^src\/content\/articles\/([^/]+)\.md$/);
    if (art) {
      const source = status === 'D' ? execFileSync('git', ['show', `${since}:${file}`], { encoding: 'utf8' }) : readFileSync(file, 'utf8');
      const cat = source.match(/^category:\s*"?([a-z0-9-]+)"?/m)?.[1];
      const u = `${SITE}/${cat}/${art[1]}/`;
      if (status === 'D') deleted.add(u); else urls.add(u);
      urls.add(`${SITE}/${cat}/`); // 栏目页列表随文章标题/描述变化
      continue;
    }
    if (/^src\/data\/(airports\.ts|airport-catalog\.json|ranking\.ts)$/.test(file) || /^src\/components\/(AirportReview|Ranking|Prices)\.astro$/.test(file)) {
      [`${SITE}/`, `${SITE}/ranking/`, `${SITE}/pricing/`, ...byPrefix('/reviews/')].forEach((u) => urls.add(u));
    } else if (file === 'src/data/faq.ts') {
      [`${SITE}/faq/`, `${SITE}/`].forEach((u) => urls.add(u));
    } else if (file === 'src/data/categories.ts') {
      [`${SITE}/`, ...distUrls.filter((u) => new URL(u).pathname.split('/').filter(Boolean).length === 1 && distUrls.some((x) => x !== u && x.startsWith(u)))].forEach((u) => urls.add(u));
    } else if (file === 'src/data/seo-profile.ts' || file === 'src/pages/index.astro' || file === 'src/components/HomeGuide.astro') {
      urls.add(`${SITE}/`);
    } else if (/^src\/pages\/(about|archives|faq)\.astro$/.test(file)) {
      urls.add(`${SITE}/${file.match(/pages\/(\w+)\.astro/)[1]}/`);
    } else if (/^src\/(layouts|styles|pages\/\[category\])\//.test(file) || file === 'astro.config.mjs') {
      notes.push(`${file}：模板/样式改动会影响多页，但通常不属于内容更新，未自动加入；若改动影响正文或标题，请用 --all 或 --urls 指定`);
    }
  }
}

for (const u of urls) if (!all.has(u) && !deleted.has(u)) { notes.push(`跳过不在 sitemap 中的 URL：${u}`); urls.delete(u); }
for (const u of [...urls, ...deleted]) if (new URL(u).host !== HOST) { console.error(`URL 不属于 ${HOST}：${u}`); process.exit(2); }

const list = [...urls, ...deleted];
if (!list.length) { console.log('没有需要通知的 URL。', notes.join('\n')); process.exit(0); }

// 护栏 1：key 文件
const keyRes = await fetch(at(keyLocation), { cache: 'no-store' }).catch(() => null);
const keyText = keyRes ? (await keyRes.text()).trim() : '';
const blockers = [];
if (keyRes?.status !== 200 || keyText !== INDEXNOW_KEY) blockers.push(`key 文件不可用：${keyLocation}（状态 ${keyRes?.status ?? 0}）`);

// 护栏 2、3：逐个 URL 校验线上状态与版本
const checks = await pool(list, 6, async (u) => {
  const live = await fetchPage(at(u));
  const built = deleted.has(u) ? null : await distPage(u);
  const why = [];
  if (deleted.has(u)) { if (![404, 410].includes(live.status)) why.push(`已删除但线上仍返回 ${live.status}`); }
  else {
    if (live.status !== 200) why.push(`状态 ${live.status}`);
    if (live.canonical !== u) why.push(`canonical=${live.canonical}`);
    if (/noindex/i.test(`${live.robots} ${live.xRobotsTag}`)) why.push('noindex');
    if (!force && built && (built.title !== live.title || built.description !== live.description)) why.push('线上版本与当前构建不同（尚未部署？）');
  }
  return { url: u, status: live.status, ok: why.length === 0, why };
});
const bad = checks.filter((c) => !c.ok);
if (bad.length) blockers.push(...bad.map((c) => `${c.url}：${c.why.join('；')}`));

const payload = { host: HOST, key: INDEXNOW_KEY, keyLocation, urlList: list };
console.log(`待通知 URL：${list.length}（其中已删除 ${deleted.size}）`);
list.forEach((u) => console.log('  ' + u));
notes.forEach((n) => console.log('注意：' + n));

let result = { submitted: false };
if (blockers.length) {
  console.error('\n未提交，原因：\n- ' + blockers.join('\n- '));
  process.exitCode = 1;
} else if (!submit) {
  console.log('\n预演通过。加 --submit 实际提交到', endpoint);
} else {
  const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload) });
  const text = await res.text();
  const meaning = { 200: '已接收', 202: '已接收，key 验证待完成', 400: '请求格式错误', 403: 'key 无效或 key 文件不可访问', 422: 'URL 不属于该 host 或 key 不匹配', 429: '请求过多，稍后再试' }[res.status] || '未知响应';
  console.log(`\nIndexNow 响应：${res.status} ${meaning} ${text.slice(0, 200)}`);
  result = { submitted: [200, 202].includes(res.status), status: res.status, meaning };
  if (!result.submitted) process.exitCode = 1;
}

await mkdir('qa', { recursive: true });
await writeFile('qa/indexnow-last.json', JSON.stringify({ at: new Date().toISOString(), since, endpoint, dryRun: !submit, count: list.length, urls: list, deleted: [...deleted], blockers, notes, result }, null, 2));
if (!existsSync(`public/${INDEXNOW_KEY}.txt`)) console.warn(`警告：public/${INDEXNOW_KEY}.txt 不存在`);
