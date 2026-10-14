import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve('dist/pagefind');
// 离线单元测试：只允许加载dist/pagefind内部文件，不访问HTTP或浏览器。
globalThis.document={currentScript:null,querySelector:()=>({getAttribute:()=> 'zh-CN'})};
globalThis.fetch=async resource=>{
 const url=new URL(String(resource));if(url.protocol!=='file:')throw new Error('Offline test refuses network');
 const file=path.resolve(fileURLToPath(url));if(!file.startsWith(root+path.sep))throw new Error('Outside search index');
 return new Response(await readFile(file),{headers:{'Content-Type':file.endsWith('.json')?'application/json':'application/octet-stream'}});
};
const pf=await import(pathToFileURL(path.join(root,'pagefind.js')).href);
await pf.options({basePath:pathToFileURL(root).href+'/',baseUrl:'/'});
const cases=[['梯子云','/reviews/laddercloud/'],['LadderCloud','/reviews/laddercloud/'],['WaveNet','/reviews/wavenet/'],['流量','/pricing/traffic-cost/'],['订阅','/tutorials/clash-import/'],['IEPL','/network/line-labels/'],['Clash','/tutorials/clash-import/'],['飞猫云','/reviews/feimaoyun/'],['有一说一','/reviews/u1s1/'],['Breezenet','/reviews/breezenet/'],['Firefly','/reviews/firefly/'],['飞V','/reviews/feiv/'],['84','/reviews/feimaoyun/'],['137','/reviews/breezenet/'],['学生版','/reviews/feimaoyun/'],['zzqqxynonexistent9182',null]];
const {mergeSearchResults}=await import(pathToFileURL(path.resolve('public/search-merge.js')).href);
const brands=JSON.parse(await readFile('dist/brand-search.json','utf8'));
for(const brand of brands)for(const name of brand.names)if(!cases.some(c=>c[0]===name))cases.push([name,brand.url]);
const report=[];let failed=false;
for(const [query,expected]of cases){const result=await pf.search(query);const raw=await Promise.all(result.results.map(r=>r.data()));const data=mergeSearchResults(query,brands,raw);const urls=data.map(r=>r.url);const pass=expected?urls.includes(expected):urls.length===0;report.push({query,expected,count:urls.length,rawPagefindCount:raw.length,exactBrandAdded:expected?(!raw.some(r=>r.url===expected)&&urls.includes(expected)):false,pass,urls:urls.slice(0,10)});if(!pass)failed=true;}
await writeFile('qa/search-index-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await pf.destroy();if(failed)process.exitCode=1;
