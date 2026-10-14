import catalog from './airport-catalog.json';
export type VerificationStatus='官网已核实'|'用户提供并确认'|'公开资料参考'|'来源存在冲突'|'缺少资料';
export interface Plan {name:string;price:number;currency:string;cycleMonths:number;billingCycle:string;trafficGB:number|null;trafficReset:'month'|'year'|'days30'|'total'|'unspecified';note:string;sourceUrl:string;trafficSourceUrl?:string;verificationStatus:VerificationStatus;observedAt:string;priceComparisonEligible:boolean;}
export interface Airport {id:string;name:string;aliases:string[];rank:number;officialUrl:string;reviewUrl:string;summary:string;plans:Plan[];routes:string[];protocols:string[];regions:string[];aiSupport:string[];streamingSupport:string[];supportedClients:string;subscriptionSupport:string;sourceUrl:string;verificationStatus:VerificationStatus;sourceObservedAt:string;directAccess:string;conflicts:string[];missing:string[];evidence:{url:string;level:string;observedAt:string;scope:string}[];}
export const airports=(catalog as Airport[]).toSorted((a,b)=>a.rank-b.rank);
export function eligiblePlans(a:Airport){return a.plans.filter(p=>p.priceComparisonEligible&&p.price>0);}
export function cheapest(a:Airport,cycle?:number){return eligiblePlans(a).filter(p=>cycle===undefined||p.cycleMonths===cycle).toSorted((a,b)=>a.price-b.price)[0];}
export function money(p:Plan){return `¥${p.price.toLocaleString('zh-CN',{maximumFractionDigits:2})}`;}
export function payment(p:Plan){return p.cycleMonths===0?'一次性':p.cycleMonths===1?'月':p.cycleMonths===3?'季':p.cycleMonths===6?'半年':p.cycleMonths===12?'年':`${p.cycleMonths}个月`;}
export function traffic(p:Plan){if(p.trafficGB===null)return '';const suffix=p.trafficReset==='month'?'/月':p.trafficReset==='year'?'/年':p.trafficReset==='days30'?'/30天':p.trafficReset==='total'?' 总量':' 额度（重置条件见详情）';return `${p.trafficGB.toLocaleString('zh-CN')}GB${suffix}`;}
