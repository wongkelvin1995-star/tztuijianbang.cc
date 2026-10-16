import { readdir,readFile,writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
async function walk(dir){const all=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())all.push(...await walk(p));else all.push(p);}return all;}
const files=await walk(root),html=files.filter(f=>f.endsWith('.html'));const map=new Map();
for(const file of files)map.set('/'+path.relative(root,file).replaceAll('\\','/'),file);
const errors=[],external=new Set();let links=0,anchors=0;
for(const f of html){const text=await readFile(f,'utf8');const route='/'+path.relative(root,f).replaceAll('\\','/').replace(/index\.html$/,'');
for(const [name,pattern] of Object.entries({title:/<title>[^<]+<\/title>/,description:/<meta\s+name="description"\s+content="[^"]+"/,canonical:/<link\s+rel="canonical"\s+href="https:\/\/tztuijianbang\.cc\//,language:/<html\s+lang="zh-CN"/,h1:/<h1[\s>]/}))if(!pattern.test(text))errors.push(`${route}: missing ${name}`);
for(const block of text.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs))if(/"@type":"(?:Review|AggregateRating)"/.test(block[1]))errors.push(`${route}: unsupported review schema`);
const h1=(text.match(/<h1[\s>]/g)||[]).length;if(h1!==1)errors.push(`${route}: ${h1} h1`);
for(const m of text.matchAll(/(?:href|src)="([^"]*)"/g)){
const raw=m[1].replaceAll('&amp;','&');if(!raw||raw.startsWith('data:')||raw.startsWith('mailto:'))continue;
const url=new URL(raw,'https://tztuijianbang.cc'+route);
if(url.origin!=='https://tztuijianbang.cc'){if(url.protocol==='https:')external.add(url.href);continue;}
let key=decodeURIComponent(url.pathname);if(key.endsWith('/'))key+='index.html';let target=map.get(key);if(!target&& !path.extname(key))target=map.get(key+'/index.html');links++;if(!target){errors.push(`${route}: missing ${url.pathname}`);continue;}
if(url.hash){const body=target===f?text:await readFile(target,'utf8');const id=decodeURIComponent(url.hash.slice(1));anchors++;if(!body.includes(`id="${id}"`))errors.push(`${route}: missing anchor ${url.pathname}#${id}`);}
}
for(const m of text.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g))if(!/rel="[^"]*noopener/.test(m[0]))errors.push(`${route}: unsafe new-window link`);
}
const faq=await readFile(path.join(root,'faq/index.html'),'utf8');const faqCount=(faq.match(/class="faq-item"/g)||[]).length;if(faqCount!==100)errors.push(`FAQ count ${faqCount}`);
const articleCount=(await readdir('src/content/articles')).filter(x=>x.endsWith('.md')).length;if(articleCount!==71)errors.push(`Article count ${articleCount}`);
for(const asset of ['robots.txt','sitemap.xml','sitemap-index.xml','rss.xml','404.html','brand-search.json','article-search.json','pagefind/pagefind.js'])if(!map.has('/'+asset))errors.push(`Missing ${asset}`);
const report={htmlPages:html.length,articleCount,faqCount,internalLinksChecked:links,anchorsChecked:anchors,externalSources:[...external],errors};await mkdir('qa',{recursive:true});await writeFile('qa/static-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
