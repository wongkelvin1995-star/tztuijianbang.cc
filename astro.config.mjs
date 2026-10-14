import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
export default defineConfig({ site: 'https://tztuijianbang.cc', output: 'static', trailingSlash: 'always', integrations: [sitemap({filter: page => !page.endsWith('/search/') && !page.includes('/404')})], markdown: { shikiConfig: { theme: 'github-dark' } } });
