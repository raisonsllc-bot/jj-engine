import {momentWeights} from './feature-weighting.js';
const WheelMath=(()=>{
const VERSION='wheel-2',BETS=[.5,1,2,5,10];
const WHEELS={"low":[{"m":0,"w":0.124},{"m":1,"w":0.099},{"m":0,"w":0.124},{"m":1.5,"w":0.02666666666666667},{"m":0,"w":0.124},{"m":2,"w":0.02},{"m":0,"w":0.124},{"m":1,"w":0.099},{"m":0,"w":0.124},{"m":3,"w":0.0006666666666666666},{"m":5,"w":0.10800000000000001,"gold":true},{"m":1.5,"w":0.02666666666666667}],"std":[{"m":0,"w":0.14616666666666664},{"m":1,"w":0.05},{"m":0,"w":0.14616666666666664},{"m":2,"w":0.02},{"m":0,"w":0.14616666666666664},{"m":5,"w":0.09},{"m":0,"w":0.14616666666666664},{"m":1,"w":0.05},{"m":0,"w":0.14616666666666664},{"m":3,"w":0.02666666666666667},{"m":12,"w":0.012499999999999999,"gold":true},{"m":2,"w":0.02}],"high":[{"m":0,"w":0.16653333333333334},{"m":1,"w":0.02},{"m":0,"w":0.16653333333333334},{"m":3,"w":0.013333333333333334},{"m":0,"w":0.16653333333333334},{"m":10,"w":0.036},{"m":0,"w":0.16653333333333334},{"m":1,"w":0.02},{"m":0,"w":0.16653333333333334},{"m":5,"w":0.05600000000000001},{"m":50,"w":0.002,"gold":true},{"m":2,"w":0.02}]};
const LINES=[[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[0,6,12,8,4],[0,1,7,3,4],[5,11,12,13,4],[10,6,2,8,14],[10,11,6,13,14],[0,6,2,8,4],[0,6,7,8,4],[5,1,2,3,9],[10,6,7,8,14],[5,6,2,8,9],[5,1,7,3,9],[5,11,7,13,9],[10,6,11,8,14],[0,11,2,13,4],[5,1,12,3,9],[5,6,12,8,9],[10,1,12,3,14],[0,11,12,13,4],[0,1,12,3,4],[5,11,12,13,9],[10,11,2,13,14],[0,1,2,8,9],[0,11,7,13,4],[0,1,2,3,14],[10,1,7,3,14],[5,6,12,13,14],[10,11,7,3,4]];
const PAYS=[.5,1,1.5,2,3,5,10,12,50],MODES=Object.keys(WHEELS);
const total=vol=>(WHEELS[vol]||WHEELS.std).reduce((a,s)=>a+s.w,0);
function expected(vol='std'){return (WHEELS[vol]||WHEELS.std).reduce((a,s)=>a+s.m*s.w,0)/total(vol);}
function prng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function evaluate(g){const lines=[];for(let i=0;i<LINES.length;i++){const a=LINES[i].map(p=>g[p]),s=a.find(v=>v!=='W');if(Number.isInteger(s)&&s>=0&&s<PAYS.length&&a.every(v=>v===s||v==='W'))lines.push({line:i,symbol:s,win:PAYS[s]});}return {lines,win:lines.reduce((v,l)=>v+l.win,0)};}
function grid(win,rnd){const target=PAYS.indexOf(win),li=Math.floor(rnd()*LINES.length);for(let attempt=0;attempt<120;attempt++){const g=Array.from({length:15},()=>Math.floor(rnd()*9));if(win>0){if(target<0)throw Error('Unsupported line award');for(const p of LINES[li])g[p]=target;if(rnd()<.4)g[LINES[li][2]]='W';}const e=evaluate(g);if(e.win===win&&(win===0||e.lines.length===1))return {g,...e};}
 const g=Array.from({length:15},(_,i)=>i%5);if(win>0)for(const p of LINES[li])g[p]=target;const e=evaluate(g);if(e.win!==win)throw Error('Grid construction failed');return {g,...e};}
function featureKind(m,q){if(m.win<5)return 'base';if(m.bonus)return m.win<10&&q<.4?'free':'wheel';return m.win>=10&&q<.35?'wheel':'free';}
function splitFree(total,count,rnd){
 const choices=[1,2,3,4,6,10],target=Math.round(total*2),memo=new Map();
 function possible(sum,n){if(n===0)return sum===0;if(sum<n||sum>n*10)return false;const k=sum+':'+n;if(!memo.has(k))memo.set(k,choices.some(v=>v<=sum&&possible(sum-v,n-1)));return memo.get(k);}
 const options=Array.from({length:count},(_,i)=>i+1).filter(n=>n>=Math.min(3,target)&&possible(target,n));
 const useful=options.filter(n=>n<=6),candidates=useful.length?useful:options;
 if(!candidates.length)throw Error('Unsupported free-game budget');
 const n=candidates[Math.floor(rnd()*candidates.length)],parts=[];let left=target;
 for(let i=0;i<n;i++){const valid=choices.filter(v=>v<=left&&possible(left-v,n-i-1)),v=valid[Math.floor(rnd()*valid.length)];parts.push(v/2);left-=v;}
 const positions=Array.from({length:count},(_,i)=>i);for(let i=count-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[positions[i],positions[j]]=[positions[j],positions[i]];}
 const awards=Array(count).fill(0);parts.forEach((v,i)=>awards[positions[i]]=v);return awards;
}
function decorate(m,seed,force){const rnd=prng(seed),q=rnd(),kind=force==='free-retrigger'?'free':force||featureKind(m,q);
 const view={v:2,policy:"feature-experience-v2",kind,base:null,free:[],wheel:null};
 if(kind==='free'){
  view.base=grid(0,rnd);for(const p of [0,7,14])view.base.g[p]='S';
  const retrigger=force==='free-retrigger'||(!force&&m.win>=10&&rnd()<.18),retriggerAt=retrigger?4+Math.floor(rnd()*3):-1;
  const extra=retrigger?(rnd()<.5?3:4):0;
  const awards=splitFree(m.win-extra,8,rnd);
  if(retrigger)awards.push(extra/2,extra/2);
  for(let i=0;i<awards.length;i++){const f=grid(awards[i],rnd);f.retrigger=0;if(i===retriggerAt){f.retrigger=2;const open=f.g.map((v,p)=>p).filter(p=>!f.lines.some(l=>LINES[l.line].includes(p)));for(const p of open.slice(0,2))f.g[p]='S';}view.free.push(f);}
  view.awarded=8;
 }else if(kind==='wheel'){
  view.base=grid(0,rnd);view.base.g[6]='C';view.base.g[8]='B';
  const factors=m.win===12?[2,2,3]:m.win===1.5||m.win===3?[3,1,1]:[2,1,m.win===2||m.win>=10?2:1];
  const product=factors.reduce((n,x)=>n*x,1);let bank=m.win/product;
  view.wheel={initial:bank,steps:factors.map((multiplier,i)=>{bank*=multiplier;const tier=2-i,angle=([[0,45,315],[0,270,90],[135,45,225]][tier])[multiplier-1];return {tier,outer:i,angle,multiplier,bank,action:multiplier===1?(tier===0?'collect':'advance'):'multiply'};})};
 }else view.base=grid(m.win,rnd);
 return {...m,version:VERSION,view};}
const varietyCache=new Map();
function distribution(vol='std'){
 if(!MODES.includes(vol))throw Error('Invalid Wheel mode');if(varietyCache.has(vol))return varietyCache.get(vol);
 const rows=[],groups=[['base',[0,1,2,3],[.85,.09,.04,.02],.9],['free',[5,10,12,30],[.88,.09,.025,.005],.05],['wheel',[5,10,12,50],[.88,.09,.025,.005],.05]];
 const featureReturn=groups.slice(1).reduce((n,[kind,values,p,mass])=>n+mass*values.reduce((s,v,i)=>s+v*p[i],0),0),baseTarget=(.86-featureReturn)/.9;
 const hit=baseTarget/(groups[0][1].reduce((s,v,i)=>s+v*groups[0][2][i],0));groups[0][2]=groups[0][2].map((p,i)=>i?p*hit:1-(1-groups[0][2][0])*hit);
 for(const [kind,values,weights,mass]of groups){
  if(kind==='base'){
   rows.push({kind,win:0,p:mass*weights[0],retrigger:false});const hit=1-weights[0],p=momentWeights(values.slice(1),weights.slice(1),vol);values.slice(1).forEach((win,i)=>rows.push({kind,win,p:mass*hit*p[i],retrigger:false}));
  }else{const p=momentWeights(values,weights,vol);values.forEach((win,i)=>{if(kind==='free'){rows.push({kind,win,p:mass*p[i]*.9,retrigger:false},{kind,win,p:mass*p[i]*.1,retrigger:true});}else rows.push({kind,win,p:mass*p[i],retrigger:false});});}
 }
 const expected=rows.reduce((s,r)=>s+r.p*r.win,0);if(Math.abs(expected-.86)>1e-10)throw Error('Wheel expectation');const out={rows,expected,featureP:.1,variance:rows.reduce((s,r)=>s+r.p*r.win*r.win,0)-expected**2};varietyCache.set(vol,out);return out;
}
function round(vol='std',rnd=Math.random){if(typeof rnd!=='function')throw Error('Server RNG required');const d=distribution(vol);let u=rnd(),row=d.rows.at(-1);for(const r of d.rows)if((u-=r.p)<0){row=r;break;}return decorate({mode:vol,seg:0,win:row.win,bonus:row.kind!=='base',mathVersion:'wheel-variety-1'},Math.floor(rnd()*4294967296),row.retrigger?'free-retrigger':row.kind);}

function fixture(kind='wheel'){const win=kind==='loss'?0:kind==='big'?50:kind==='free'?5:kind==='free-retrigger'?12:kind==='wheel'?12:3;return decorate({mode:kind==='big'?'high':'std',seg:10,win,bonus:false},12345,kind==='big'?'wheel':kind==='loss'?'base':kind);}
return {VERSION,BETS,VOLATILITY:true,BANK_FULL:10,WHEELS,MODES,LINES,PAYS,round,expected:()=>.86,distribution,total,evaluate,fixture,featureKind};
})();
export {WheelMath};



