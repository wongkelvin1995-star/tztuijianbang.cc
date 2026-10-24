import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';

const SITE = 'https://tztuijianbang.cc';

// lastmod 只取文章 frontmatter 中真实的 updated / date，不使用构建时间，
// 栏目页、首页等没有可靠修改日期的页面不输出 lastmod。
const articleLastmod = new Map();
const articleDir = new URL('./src/content/articles/', import.meta.url);
for (const file of readdirSync(articleDir)) {
  if (!file.endsWith('.md')) continue;
  const fm = readFileSync(new URL(file, articleDir), 'utf8').split('---')[1] ?? '';
  const pick = (key) => fm.match(new RegExp(`^${key}:\\s*"?([0-9]{4}-[0-9]{2}-[0-9]{2})"?`, 'm'))?.[1];
  const category = fm.match(/^category:\s*"?([a-z0-9-]+)"?/m)?.[1];
  const day = pick('updated') ?? pick('date');
  if (category && day) articleLastmod.set(`${SITE}/${category}/${file.slice(0, -3)}/`, day);
}

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.endsWith('/search/') && !page.includes('/404'),
      serialize(item) {
        const day = articleLastmod.get(item.url);
        if (day) item.lastmod = day;
        return item;
      },
    }),
  ],
  markdown: { shikiConfig: { theme: 'github-dark' } },
});
