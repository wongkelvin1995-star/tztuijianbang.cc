import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const airports=JSON.parse(await readFile('src/data/airport-catalog.json','utf8'));
const contract=JSON.parse(await readFile('docs/airport-affiliate-contract.json','utf8'));
assert.equal(airports.length,29);assert.equal(new Set(airports.map(a=>a.id)).size,29);assert.equal(new Set(airports.map(a=>a.name)).size,29);
assert.deepEqual(airports.slice(0,5).map(a=>a.name),['灵动云','暮光加速','飞猫云','大佬云','微风网络']);
const statuses=['官网已核实','用户提供并确认','公开资料参考','来源存在冲突','缺少资料'];
for(const [i,a]of airports.entries()){
 assert.equal(a.rank,i+1);assert.equal(a.officialUrl,contract[i]);assert.equal(a.reviewUrl,`/reviews/${a.id}/`);assert.ok(a.plans.length);
 assert.ok(statuses.includes(a.verificationStatus));
 for(const p of a.plans){assert.ok(p.price>0);assert.ok(p.cycleMonths>=0);assert.ok(['month','year','days30','total','unspecified'].includes(p.trafficReset));assert.ok(p.sourceUrl.startsWith('https://'));assert.ok(statuses.includes(p.verificationStatus));assert.ok(p.trafficGB===null||p.trafficGB>0);if(p.cycleMonths===0)assert.equal(p.trafficReset,'total');}
 const html=await readFile(`dist/reviews/${a.id}/index.html`,'utf8');assert.ok(html.includes(a.officialUrl));assert.ok(html.includes('rel="sponsored nofollow noopener"'));assert.ok(html.includes('id="plans"'));
 for(const phrase of ['资料档案：','价格 / 待核验','线路 / 待核验','服务资料档案','资料与缺口','核验记录','记录日期','尚未提供官方价格'])assert.ok(!html.includes(phrase),`${a.name}: ${phrase}`);
}
const get=(id,name)=>airports.find(a=>a.id===id).plans.find(p=>p.name===name);
assert.equal(get('feimaoyun','学生版').price,84);assert.equal(get('feimaoyun','学生版').cycleMonths,12);assert.equal(get('feimaoyun','学生版').trafficReset,'month');
assert.equal(get('muguang','年付轻量版').trafficReset,'year');assert.equal(get('lingdong','灵动·穿云').trafficReset,'year');assert.equal(get('kosing','年付套餐').trafficReset,'year');
assert.equal(get('dalaoyun','初云·入门版').trafficGB,null);assert.equal(get('dalaoyun','初云·入门版').priceComparisonEligible,true);
assert.ok(airports.find(a=>a.id==='flashleap').conflicts.some(x=>x.includes('422/442')));
const home=await readFile('dist/index.html','utf8'),price=await readFile('dist/pricing/index.html','utf8');
const rows=[...home.matchAll(/<div class="rank-row" data-airport-id="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(rows,airports.map(a=>a.id));
const priceRows=[...price.matchAll(/<tr data-airport-id="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(priceRows,airports.map(a=>a.id));
for(const phrase of ['服务资料档案','资料与缺口','价格 / 待核验','线路 / 待核验','核验记录','记录日期']){assert.ok(!home.includes(phrase));assert.ok(!price.includes(phrase));}
const titles=[];const descriptions=[];
for(const a of airports){const t=await readFile(`dist/reviews/${a.id}/index.html`,'utf8');titles.push(t.match(/<title>(.*?)<\/title>/)[1]);descriptions.push(t.match(/<meta name="description" content="([^"]+)"/)[1]);}
assert.equal(new Set(titles).size,29);assert.equal(new Set(descriptions).size,29);
const report={brands:29,planRecords:airports.reduce((n,a)=>n+a.plans.length,0),firstFive:airports.slice(0,5).map(a=>a.name),homeRows:rows.length,pricingRows:priceRows.length,reviewRoutes:29,affiliateCodesPreserved:29,uniqueReviewTitles:29,uniqueReviewDescriptions:29,errors:[]};
await writeFile('qa/airport-data-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
