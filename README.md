# 梯子推荐榜 / Airport Ranking Lab

独立 Astro 静态项目，正式地址 https://tztuijianbang.cc/。深色科技主题、Markdown Content Collections 与 Pagefind Extended 中文分词搜索。当前包含42篇保留的指南、29篇机场套餐测评、100个独立FAQ；套餐来自可回溯公开参考，不属于本站实测。29篇机场页面约1500—1800中文字（含正文、标题、套餐表与公共使用说明）。其他36篇原简明指南保留，未删除完整内容。

## 本地运行

使用 Node.js 24 LTS（本次24.19.0），安装带 npm 的正常 Node.js发行版。

```sh
npm install
npm run check
npm run build
npm run audit:site
npm run test:search
npm run test:airports
npm run preview
```

开发时用 `npm run dev`。搜索依赖构建索引，在 `npm run build` 后通过 `npm run preview` 测试；不要用文件协议打开dist。此环境使用系统提供的pnpm临时调用npm，但项目保留标准npm脚本和package-lock.json。

## 新增文章

在 `src/content/articles/` 添加Markdown文件。文件名是URL末段；例如 `plan-example.md` 对应 `/pricing/plan-example/`。前置信息至少包含：

```yaml
---
title: "一个具体问题的标题"
description: "准确、独立的摘要"
category: "pricing"
date: "2026-10-12"
intent: "一个独立搜索意图"
kind: "guide"
---
```

正文使用二级标题，目录自动生成。日期用真实编辑日期，不要复制此示例日期。类别见 `src/data/categories.ts`。更新 `docs/keyword-intents.json`，检查是否已有同意图页面，避免同义词重复页面。新增内容后执行build、check和audit。

## 更新机场资料

品牌事实修改 `src/data/airport-catalog.json`；`src/data/airports.ts`定义类型、排序与价格/流量显示函数。每个事实先有原始来源，再填写。`sourceObservedAt`只代表本项目读取来源时间，不是官网实核；`verificationStatus`区分官网、用户、公开参考、冲突与缺少资料。plans内记录价格、币种、完整付款月数、流量、刷新口径、来源与读取时间；同时在来源说明中明确重置、倍率、方向与结转条件。详情、榜单和价格表读取相同数据。没有证据时保留null或空数组，未知不写0。

目前29家已填入240条有来源套餐记录和指定服务入口；缺口和冲突详见`docs/airport-data-audit.md`。本项目没有从其他博客搬用文案和邀请码。

## 修改推广链接与排序

在对应机场的 `officialUrl`保留用户指定原始AFF地址，保留完整参数。链接按钮自动使用 `target="_blank" rel="sponsored nofollow noopener"`。站内详情链接不添加sponsored。若确认有合作关系，更新公开披露与source说明。排序修改统一数据库的`rank`，`src/data/ranking.ts`从其派生，编号仍是编辑位置，不得改成未经测试的客观排名。

## 添加测速截图和记录

只添加真实、已脱敏截图到 `public/evidence/<airport-id>/`。遮挡令牌、账户、订单与个人网络信息。原始记录至少包含日期、时区、接入网络、设备/客户端版本、节点、目标、工具、协议、线程和样本数。在对应品牌Markdown中引用截图与原始输出地址，内部evidence记录来源、时间与范围；如果需要结构化的测试指标表，应先扩展Airport类型和展示组件，不把单条延迟当成完整性能结论。第三方资料注明归属。截图可在对应Markdown用 `/evidence/...` 路径引用；未有真实记录时不绘制成绩图。

## 搜索与索引

build脚本先生成静态HTML，再执行 `pagefind --site dist`。Pagefind Extended对zh-CN进行中文分词，索引文章正文、机场名、英文别名、套餐和教程内容。每次修改正文或资料都重建，发布完整dist，包括pagefind目录。`/search/`只有访问时才加载搜索脚本。搜索页与404不参与索引。`npm run test:search`以纯文件加载方式测试真实索引，拒绝HTTP网络请求；它验证中文及英文别名的结果路由，不替代浏览器和移动端操作验收。

## Cloudflare Pages / GitHub

将本目录作为独立Git仓库内容推送到你自己的GitHub项目，生产分支main。Cloudflare Pages连接该仓库，选择静态构建：

- 根目录：如果仓库直接包含本项目，留空；若仓库为上层目录，填tztuijianbang。
- 构建命令：`npm run build`
- 输出目录：`dist`
- Node版本：24（`.node-version`固定本次使用版本）
- 生产分支：`main`

本项目不需要持续Node服务和服务器适配器。Pages部署后先检查默认域名，再在Custom domains中添加`tztuijianbang.cc`，根据Cloudflare给出的DNS验证流程完成绑定。正式域名验证、DNS和GitHub远端均需要账户授权；本次尚未执行。不要手动猜测CNAME目的地址。

检查 `/`、`/ranking/`、`/pricing/`、文章地址、未知路由404、资源、`/robots.txt`、`/sitemap.xml`、`/sitemap-index.xml`和`/rss.xml`。`_headers`提供基础响应头。对真实生产域名做移动导航、搜索和链接复验。

## 文件布局与资料原则

- `src/data/`：统一机场资料、排序、SEO品牌、FAQ和栏目定义。
- `src/content/articles/`：71个Markdown条目。
- `src/layouts/Base.astro`：导航、Meta、Canonical、OG、Article和面包屑。
- `src/components/`：榜单、价格与首页导读。
- `src/pages/`：静态路由、搜索、RSS、sitemap与404。
- `scripts/audit.mjs`：产物路由、内链、锚点、SEO与FAQ检查。
- `docs/keyword-intents.json`：候选关键词聚类，不声称已验证搜索量。
- `qa/`：本次验收记录。

不要提交.env、密钥、完整订阅、未脱敏订单或凭证。README不包含私密令牌。Open Graph分享图片为1200×630 PNG，位于public/og.png。用户提供的Telegram入口已加入首页与页脚，修改时同步检查两处。

## 29家品牌维护与搜索

所有榜单、价格、测评及归档从统一rank读取顺序。前五名固定为灵动云、暮光加速、飞猫云、大佬云、微风网络。大佬云不合并大哥云，飞V不合并飞为。缺失容量保持null，不写0；trafficReset可选month、year、days30、total、unspecified，不从付款周期推断刷新。priceComparisonEligible只决定是否参与最低实付筛选，例如初云价格23元明确但容量有差异，仍可列价格；速界88/90元体验包不参与最低价。

Pagefind全文搜索之外，`/brand-search.json`只导出名字、别名、摘要和测评URL，配合`public/search-merge.js`解决中文专有名词分词漏检并优先精确品牌。不会公开内部审计状态。源码 tests使用与前台相同的合并函数。运行test:search覆盖全部品牌与别名、金额、教程及无结果查询。

本机预览可使用`npm run preview -- --port 18080`，先检查端口是否被占用，不停止其他项目服务。本次当前页面由只读取dist的静态HTTP服务提供，修改后先build再刷新。

项目没有配置Lint脚本，现有验证为Astro类型检查、静态产物检查、品牌数据与中文搜索测试。没有引入新的Lint依赖。原GitHub/Cloudflare配置与域名保持原样，仍需明确仓库和账户后发布。
