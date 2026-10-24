// /sitemap.xml 保留为可访问地址（可能已提交到 Bing / 其他搜索引擎），
// 但不再单独维护一份 URL 列表：改为指向 @astrojs/sitemap 生成的子 sitemap，
// 避免两份列表日后出现不一致。URL 清单唯一来源为 sitemap-0.xml。
export async function GET() {
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    '<sitemap><loc>https://tztuijianbang.cc/sitemap-0.xml</loc></sitemap>' +
    '</sitemapindex>';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
