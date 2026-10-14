import {airports} from '../data/airports';
import {getCollection} from 'astro:content';
export async function GET(){const posts=await getCollection('articles');return new Response(JSON.stringify(airports.map(a=>({names:[a.name,...a.aliases],url:a.reviewUrl,title:posts.find(p=>p.id===a.id)?.data.title??a.name,excerpt:a.summary}))),{headers:{'Content-Type':'application/json; charset=utf-8'}});}
