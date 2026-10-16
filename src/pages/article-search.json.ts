import {getCollection} from 'astro:content';

export async function GET(){
  const articles=await getCollection('articles');
  const index=articles.map(article=>({
    url:`/${article.data.category}/${article.id}/`,
    title:article.data.title,
    intent:article.data.intent,
    excerpt:article.data.description
  }));
  return new Response(JSON.stringify(index),{headers:{'Content-Type':'application/json; charset=utf-8'}});
}
