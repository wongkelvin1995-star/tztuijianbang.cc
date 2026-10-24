# 部署、Bing 验收与 IndexNow 操作手册

> 2026-10-24 技术 SEO 审核后整理。IndexNow 和 sitemap 只是“通知/发现”机制，不保证 Bing 抓取或收录。

## 1. 审核时发现的生产环境状态

| 项目 | 结论 | 证据 |
|---|---|---|
| 生产版本 | 线上是 2026-10-14 首个提交 `a1ab524` 的构建，之后 3 个提交（10-16 关键词扩展、10-21、10-22）**未上线** | 线上首页 title 为 `梯子推荐榜 - 2026梯子推荐、机场排行榜与套餐价格比较`，只存在于 `a1ab524` 的 `src/data/seo-profile.ts`；用当前代码构建对比，16/84 个页面 title/description 不同 |
| 部署方式 | GitHub 上任何提交都没有 Cloudflare Pages 的 check run / commit status，判断为 Direct Upload（手动上传 dist），而不是 Git 集成 | `gh api repos/.../commits/<sha>/check-runs` 全部为空 |
| www 主机 | `https://www.tztuijianbang.cc/*` 直接返回 200，不跳转（仅靠 canonical 指向主域） | 浏览器访问 `https://www.tztuijianbang.cc/reviews/sujie/?x=1` 地址栏保持 www |
| http | `http://tztuijianbang.cc/` → `https://tztuijianbang.cc/` 正常；`http://www.` 只升级到 `https://www.` | 同上 |

## 2. 部署（任选其一，**部署前先 `npm run build` 并确认全部测试通过**）

### A. 继续用 Direct Upload（与现有方式一致，风险最低）

```bash
npm ci
npm run build
npm run audit:site && npm run test:sitemap && npm run test:search && npm run test:airports
npx wrangler pages deploy dist --project-name <你的 Pages 项目名> --branch main
```
（或在 Cloudflare 后台 Workers & Pages → 项目 → Create deployment 上传 `dist` 目录。）

### B. 改为 Git 自动部署

Direct Upload 项目不能直接切换成 Git 集成。需要新建一个“Connect to Git”的 Pages 项目
（构建命令 `npm run build`，输出目录 `dist`，环境变量 `NODE_VERSION=24.19.0` 或与 `.node-version` 一致），
确认 `*.pages.dev` 预览无误后，再把自定义域名 `tztuijianbang.cc` / `www.tztuijianbang.cc` 从旧项目移到新项目。
切换域名的几分钟内可能出现短暂不可用，建议在低峰时段操作。

## 3. 部署后验收（在自己电脑上运行）

```bash
npm run build          # 生成本地 dist 作为“应当上线的版本”
npm run verify:live    # 输出 qa/live-verify.md / qa/live-verify.json
```
验收标准：P0 = 0；84/84 返回 200、canonical 指向自身、无 noindex/X-Robots-Tag；
“与当前构建一致”= 84；三个 sitemap 均 200；不存在路径返回 404；www/http 全部 301/308 到 `https://tztuijianbang.cc/`。

## 4. Cloudflare 后台必须人工核实的设置

1. **www → 主域 301**：Rules → Redirect Rules → 新建 Single Redirect：
   `(http.host eq "www.tztuijianbang.cc")` → Dynamic `concat("https://tztuijianbang.cc", http.request.uri.path)`，
   状态码 301，勾选 Preserve query string。（Pages 的 `_redirects` 不支持按主机名跳转，所以必须在这里做。）
   DNS 里 `www` 记录需保持橙色云（Proxied）。
2. **SSL/TLS → Edge Certificates**：Always Use HTTPS = On（审核时 http 已跳 https，但浏览器可能自动升级，需用 `curl -I http://tztuijianbang.cc/` 再确认）。
3. **Security → Bots**：Bot Fight Mode / Super Bot Fight Mode 中 “Verified bots” 必须为 Allow；
   “Block AI bots / AI Crawl Control” 只应针对 AI 爬虫，确认 Bingbot、BingPreview 未被列入阻止。
4. **Security → WAF → Custom rules / Rate limiting**：检查是否有按国家/地区（Bingbot 主要来自美国）、ASN（Microsoft AS8075）、User-Agent 或“非中国访问即质询”的规则；
   如有，增加 `cf.client.bot`（或 `cf.verified_bot_category eq "Search Engine Crawler"`）为 Skip 的例外，并放在最前。
5. **Security → Settings**：Security Level 不要长期设为 I'm Under Attack；Browser Integrity Check 一般无碍，但若有 challenge 记录要看 Events。
6. **Security → Events**：筛选 User-Agent 含 `bingbot`、过去 30 天，确认没有 Block / Managed Challenge / JS Challenge 记录。
7. **Managed robots.txt / Content Signals**：若开启，线上 robots.txt 会被追加内容；确认没有出现针对 `bingbot` 的 Disallow（`verify:live` 会提示）。
8. **Pages 项目 → Custom domains**：两个域名都为 Active；`*.pages.dev` 已由 `public/_headers` 输出 `X-Robots-Tag: noindex`。
9. **Bing Webmaster Tools**：用“URL 检查 → 实时 URL 测试”抽查首页和 1 篇测评，确认 Bingbot 实际获取到 200 及新标题；
   在 Sitemaps 里保留 `sitemap-index.xml`（`sitemap.xml` 现在是同样内容的索引，可保留也可删除提交记录）。

## 5. IndexNow

- Key：`9ff4d63c81a9a91c1198c88df4d08d24`，文件 `public/9ff4d63c81a9a91c1198c88df4d08d24.txt`（随构建发布到站点根目录，公开是设计如此）。
- 端点：默认 `https://api.indexnow.org/indexnow`（Bing 等参与方共享）。

### 首次接入（新版本部署并通过验收后执行一次）
```bash
npm run build
node scripts/indexnow.mjs --all            # 预演：检查 key 文件和 84 个 URL
node scripts/indexnow.mjs --all --submit   # 实际提交
```

### 日常更新
每次部署后，以“上一次通知时的提交”为基准，只通知变化的 URL：
```bash
npm run build
node scripts/indexnow.mjs --since <上次已通知的提交>            # 预演
node scripts/indexnow.mjs --since <上次已通知的提交> --submit   # 提交
```
映射规则：文章 Markdown → 该文章 + 所属栏目页；机场数据 → 首页、排行、价格、全部测评；FAQ → /faq/ 与首页；
栏目配置 → 首页与栏目页；模板/样式只提示不自动提交。删除的文章会以 404 状态一并通知。

护栏：key 文件不可访问、任何 URL 非 200 / canonical 不指向自身 / noindex、或线上版本与本地构建不一致（说明还没部署）时，脚本拒绝提交。
不要对未变化的页面重复提交，也不要把 IndexNow 当作排名或收录手段。
