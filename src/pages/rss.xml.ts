import rss from '@astrojs/rss';
import {getCollection} from 'astro:content';
export async function GET(){const posts=await getCollection('articles');return rss({title:'梯子推荐榜',description:'机场比较与技术资料',site:'https://tztuijianbang.cc',items:posts.map(a=>({title:a.data.title,description:a.data.description,pubDate:a.data.date,link:`/${a.data.category}/${a.id}/`}))});}
