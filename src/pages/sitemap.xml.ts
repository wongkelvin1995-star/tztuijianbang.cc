import {getCollection} from 'astro:content';
import {categories} from '../data/categories';
export async function GET(){const routes=['/',...categories.map(c=>`/${c.slug}/`),'/faq/','/about/','/archives/',...(await getCollection('articles')).map(a=>`/${a.data.category}/${a.id}/`)];return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(r=>`<url><loc>https://tztuijianbang.cc${r}</loc></url>`).join('')+'</urlset>',{headers:{'Content-Type':'application/xml'}});}
