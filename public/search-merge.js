// Pagefind handles full text; phrase matching covers Chinese title and intent queries.
const normalize=value=>value.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
export function mergeSearchResults(query,brands,fulltext,articles=[]){
 const q=normalize(query.trim());if(!q)return [];
 const exact=[],mentioned=[],titleMatches=[],intentMatches=[];
 for(const brand of brands){const labels=brand.names.map(normalize);if(labels.some(n=>n===q))exact.push(brand);else if(labels.some(n=>n.length>=2&&q.includes(n)))mentioned.push(brand);}
 for(const article of articles){const title=normalize(article.title),intent=normalize(article.intent||'');if(title.includes(q))titleMatches.push(article);else if(intent.includes(q))intentMatches.push(article);}
 const rows=[...exact,...mentioned].map(b=>({url:b.url,meta:{title:b.title},excerpt:b.excerpt}));
 for(const article of [...titleMatches,...intentMatches].slice(0,20))rows.push({url:article.url,meta:{title:article.title},excerpt:article.excerpt});
 const seen=new Set(rows.map(r=>r.url));
 const unique=rows.filter((row,index)=>rows.findIndex(other=>other.url===row.url)===index);
 for(const row of fulltext){if(!seen.has(row.url)){unique.push(row);seen.add(row.url);}}
 return unique;
}
