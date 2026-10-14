// Pagefind handles full text; exact brand matching handles unfamiliar Chinese names.
const normalize=value=>value.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
export function mergeSearchResults(query,brands,fulltext){
 const q=normalize(query.trim());if(!q)return [];
 const exact=[],mentioned=[];
 for(const brand of brands){const labels=brand.names.map(normalize);if(labels.some(n=>n===q))exact.push(brand);else if(labels.some(n=>n.length>=2&&q.includes(n)))mentioned.push(brand);}
 const rows=[...exact,...mentioned].map(b=>({url:b.url,meta:{title:b.title},excerpt:b.excerpt}));
 const seen=new Set(rows.map(r=>r.url));
 for(const row of fulltext){if(!seen.has(row.url)){rows.push(row);seen.add(row.url);}}
 return rows;
}
