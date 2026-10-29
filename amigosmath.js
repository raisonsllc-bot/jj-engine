import {equalAccessDistribution} from './feature-weighting.js';
const AmigosMath=(()=>{
const LINES=[[1,4,7,10,13],[0,3,6,9,12],[2,5,8,11,14],[0,4,8,10,12],[2,4,6,10,14],[1,3,6,9,13],[1,5,8,11,13],[0,3,7,11,14],[2,5,7,9,12],[1,5,7,9,13],[1,3,7,11,13],[0,4,7,10,12],[2,4,7,10,14],[0,4,6,10,12],[2,4,8,10,14],[1,4,6,10,13],[1,4,8,10,13],[0,3,8,9,12],[2,5,6,11,14],[0,5,8,11,12],[2,3,6,9,14],[1,5,6,11,13],[1,3,8,9,13],[0,5,6,11,12],[2,3,8,9,14]];
const PAY={"5001":{"3":"25","4":"100","5":"500"},"5002":{"3":"25","4":"75","5":"200"},"5003":{"3":"20","4":"50","5":"150"},"5004":{"3":"15","4":"40","5":"100"},"5005":{"3":"10","4":"20","5":"50"},"5006":{"3":"10","4":"20","5":"50"},"5007":{"3":"5","4":"10","5":"25"},"5008":{"3":"5","4":"10","5":"25"}};
const INIT=[5002,5002,5002,5003,4004,5003,5001,4003,5001,5003,4004,5003,5002,5002,5002];
const TYPES=['multi','mystery','collect'];
const IDS={super:1001,multi:1002,mystery:1003,collect:1004,pinata:1005,coin:2001,wild:3001};
const JACKPOT_MULT={mini:2,minor:5,major:25,grand:100};
function random(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const copy=x=>structuredClone(x);
const sum=a=>a.reduce((x,y)=>x+y,0);
function paylines(board,stake){
 const wins=[];
 LINES.forEach((line,index)=>{const symbol=board[line[0]];if(!PAY[symbol])return;let count=1;while(count<5&&(board[line[count]]===symbol||board[line[count]]===IDS.wild))count++;
  if(count>=3)wins.push({line:index+1,positions:line.slice(0,count),symbol,count,amount:Math.round(stake*Number(PAY[symbol][count])/25)});
 });return {wins,total:sum(wins.map(w=>w.amount))};
}
function effective(cell,mul=1){return cell?cell.value*(cell.jackpot?1:Math.max(1,mul)):0;}
function bonusState(superMode,stake,features,initial){
 const rows=superMode?5:3,board=Array(rows*5).fill(null),muls=Array(rows*5).fill(0);
 for(const [i,v] of initial.entries()){const pos=superMode?Math.floor(v.pos/3)*5+v.pos%3+1:v.pos;board[pos]={id:v.id||IDS.coin,value:v.value??stake*(i%3+1),jackpot:v.jackpot||null};}
 return {rows,board,muls,features:[...features],left:3,stake,round:0};
}
function applyBonus(state,arrivals){
 const s=copy(state),events=[];s.round++;s.left--;const empty=()=>s.board.map((v,i)=>v===null?i:-1).filter(i=>i>=0);
 const placeMulti=(value,from,preferred)=>{let targets=empty();if(!targets.length)return;let target=preferred!=null&&targets.includes(preferred)?preferred:targets.find(i=>!s.muls[i])??targets[0];s.muls[target]+=value;events.push({type:'multi',from,to:target,value,total:s.muls[target]});};
 for(const raw of arrivals){if(!Number.isInteger(raw.pos)||raw.pos<0||raw.pos>=s.board.length||s.board[raw.pos])throw Error('Invalid or occupied bonus cell');const a=copy(raw);let feature=a.feature;
  s.board[a.pos]={id:a.id||IDS.coin,value:a.value??s.stake,jackpot:a.jackpot||null};
  events.push({type:'land',pos:a.pos,cell:copy(s.board[a.pos])});
  if(s.muls[a.pos])placeMulti(s.muls[a.pos],a.pos,a.copyTo);
  if(a.id===IDS.pinata){feature=a.transform||'multi';events.push({type:'pinata',pos:a.pos,feature});s.board[a.pos].id=IDS[feature];}
  if(feature&&!s.features.includes(feature)){s.features.push(feature);events.push({type:'activate',feature,pos:a.pos});}
  if(feature==='multi'){[2,3,5].forEach((v,i)=>placeMulti(v,a.pos,a.multiTargets?.[i]));s.board[a.pos].id=2003;}
  if(feature==='mystery'){s.board[a.pos]={id:2004,value:a.value??s.stake*25,jackpot:a.jackpot||null};events.push({type:'mystery',pos:a.pos,value:s.board[a.pos].value,jackpot:a.jackpot});}
  if(feature==='collect'){
   const sources=[];let collected=0;
   s.board.forEach((c,i)=>{if(!c||i===a.pos)return;const amount=effective(c,s.muls[i]);if(s.muls[i]>1&&!c.jackpot){c.value=amount;s.muls[i]=1;}collected+=amount;sources.push({pos:i,value:amount});});
   s.board[a.pos].value=effective(s.board[a.pos],s.muls[a.pos])+collected;s.board[a.pos].id=2005;s.muls[a.pos]=1;
   events.push({type:'collect',pos:a.pos,sources,value:s.board[a.pos].value});
  }
 }
 if(arrivals.length){s.left=3;events.push({type:'reset',left:3});}
 const centre=s.board.every((v,i)=>s.rows===5&&(i%5===0||i%5===4)||v!==null),full=s.board.every(Boolean);
 s.fullAward=full&&s.rows===5?'grand':centre?'major':null;
 s.done=s.left===0||full;
 return {state:s,events};
}
function finishBonus(s){const values=s.board.map((c,i)=>effective(c,s.muls[i]));const fullAward=s.fullAward;const jackpot=fullAward?s.stake*JACKPOT_MULT[fullAward]:0;return {values,fullAward,jackpot,total:sum(values)+jackpot};}
const VERSION='amigos-2.1.0',TAPE_VERSION='amigos-1.0.0',BETS=[.25,.5,1,2],BUY={normal:70,super:150};
const MODES=['low','std','high'];
const KINDS=['multi','mystery','collect','multi-mystery','multi-collect','mystery-collect','combined','pinata','super','mini','minor','major','super-major','grand'];
const cents=n=>Math.round(n),pick=(a,r)=>a[Math.floor(r()*a.length)],unit=(stake,v)=>Math.max(1,cents(stake*v));
function bonusTape(kind,seed,stake=100,rich=false){
 const rng=random(seed),superMode=['super','super-major','grand'].includes(kind);
 const features=kind==='combined'||superMode?TYPES:kind==='pinata'?['multi']:kind.includes('-')?kind.split('-'):[TYPES.includes(kind)?kind:'mystery'];
 const slots=[0,4,6,8,10,14],values=rich?[.5,1,2,3]:[.1,.2,.5,1];
 let state=bonusState(superMode,stake,features,slots.map(pos=>({pos,value:unit(stake,pick(values,rng))})));
 const initial=copy(state),steps=[],full=['major','super-major','grand'].includes(kind),max=stake*200;
 function add(arrivals){let step=applyBonus(state,arrivals);if(finishBonus(step.state).total>max){arrivals=[];step=applyBonus(state,arrivals);}steps.push({arrivals,...step});state=step.state;}
 for(let turn=0;!state.done&&turn<80;turn++){
  const empty=state.board.map((x,i)=>!x?i:-1).filter(i=>i>=0&&(kind!=='super-major'||i%5>0&&i%5<4));
  if(!empty.length){add([]);continue;}
  const n=full?Math.min(empty.length,1+Math.floor(rng()*3)):rng()<.42?1+(rng()<.22&&empty.length>1?1:0):0;
  const arrivals=[];
  for(let j=0;j<n;j++){
   const pos=empty.splice(Math.floor(rng()*empty.length),1)[0];
   const a={pos,value:unit(stake,pick(values,rng))};
   if(!full&&rng()<.38){a.feature=pick(features,rng);a.id=IDS[a.feature];if(rng()<.15){a.id=IDS.pinata;a.transform=pick(TYPES,rng);a.feature=a.transform;}
    if(a.feature==='mystery'){a.value=unit(stake,pick(rich?[2,5,10,15]:[1,2,3,5],rng));if(rng()<.13){a.jackpot=rng()<.8?'mini':'minor';a.value=stake*JACKPOT_MULT[a.jackpot];}}
   }
   if(turn===0&&j===0&&['mini','minor','pinata'].includes(kind)){a.id=kind==='pinata'?IDS.pinata:IDS.mystery;a.feature='mystery';a.transform='mystery';if(kind!=='pinata'){a.jackpot=kind;a.value=stake*JACKPOT_MULT[kind];}}
   arrivals.push(a);
  }
  add(arrivals);
 }
 if(!state.done)throw Error('Unterminated bonus');
 return {kind,super:superMode,initial,steps,final:finishBonus(state)};
}
const baseCache=new Map();
function basePool(target){if(baseCache.has(target))return baseCache.get(target);
 const rng=random(91473+target),pool=[];
 const choices={20:[5007,3],40:[5007,4],80:[5005,4],100:[5001,3],200:[5005,5],400:[5001,4],800:[5002,5]};
 for(let attempt=0;attempt<30000&&pool.length<24;attempt++){
  const board=Array.from({length:15},()=>rng()<.10?1001+Math.floor(rng()*4):5001+Math.floor(rng()*8));
  if(target){const [id,n]=choices[target],line=pick(LINES,rng);for(let i=0;i<n;i++)board[line[i]]=i>0&&rng()<.16?3001:id;}
  const e=paylines(board,100);if(e.total===target)pool.push({board,wins:e.wins});
 }
 if(!pool.length)throw Error('Missing base outcome '+target);baseCache.set(target,pool);return pool;
}
const cache=new Map();
function poolFor(stake=100,rich=false){const key=stake+':'+rich;if(cache.has(key))return cache.get(key);
 const entries=[];
 for(const kind of KINDS)for(let i=0;i<24;i++){
  if(rich==='normal'&&['super','super-major','grand'].includes(kind))continue;
  if(rich==='super'&&!['super','super-major','grand'].includes(kind))continue;
  const seed=1709+i*7919+KINDS.indexOf(kind)*34567,b=bonusTape(kind,seed,stake,!!rich);
  entries.push({kind,seed,total:b.final.total});
 }
 cache.set(key,entries);return entries;
}
const returns={low:[.01,.02,.03,.07,.11,.06,.02],std:[0,.01,.02,.03,.07,.08,.05],high:[0,0,.01,.02,.03,.06,.08]};
const bonusReturns={low:[.26,.20,.06,.02],std:[.28,.22,.06,.04],high:[.20,.26,.10,.10]};
const prizes=[20,40,80,100,200,400,800],distCache=new Map();

const varietyCache=new Map();
function distribution(vol='std',buy=null,stake=100){
 if(!MODES.includes(vol))throw Error('Invalid Amigos mode');
 if(buy)return legacyDistribution(vol,buy,stake);
 const ck=vol+':'+stake;if(varietyCache.has(ck))return varietyCache.get(ck);
 const d=legacyDistribution('std',null,stake),meta=new Map();
 for(const r of d.rows.filter(r=>r.bonus)){const b=bonusTape(r.kind,r.seed,stake);meta.set(r,{key:b.super?'super':b.initial.features.join('+'),nuance:[b.steps.some(s=>s.events.some(e=>e.type==='pinata')),!!b.final.fullAward,b.steps.some(s=>s.events.some(e=>e.jackpot))].join(':')});}
 const out=equalAccessDistribution(d.rows,vol,{stake,value:r=>r.total/stake,key:r=>meta.get(r).key,nuance:r=>meta.get(r).nuance});
 if(out.bonusP*5>1)throw Error('Amigos progression arrival mass exceeded');
 varietyCache.set(ck,out);return out;
}

function legacyDistribution(vol='std',buy=null,stake=100){
 if(!MODES.includes(vol)||buy!==null&&!BUY[buy]||!Number.isSafeInteger(stake)||stake<1)throw Error('Invalid Amigos configuration');
 const key=[vol,buy,stake].join(':');if(distCache.has(key))return distCache.get(key);
 const cost=stake*(BUY[buy]||1),rows=[];
 if(buy){
  const pool=poolFor(stake,buy),target=cost*.86,lo=pool.filter(x=>x.total<target),hi=pool.filter(x=>x.total>=target);
  const mean=a=>a.reduce((s,x)=>s+x.total,0)/a.length,L=mean(lo),H=mean(hi);
  if(!lo.length||!hi.length||H===L)throw Error('Purchase distribution cannot meet the target');
  const highP=(target-L)/(H-L);
  for(const [items,p]of [[lo,1-highP],[hi,highP]])for(const item of items)rows.push({...item,p:p/items.length,bonus:true});
 }else{
  let funded=0;
  prizes.forEach((target,i)=>{const ret=returns[vol][i];if(!ret)return;const pool=basePool(target);const total=paylines(pool[0].board,stake).total;const p=ret/(total/stake);rows.push({target,total,p,bonus:false});funded+=ret;});
  const pool=poolFor(stake),featureReturn=.86-funded;
  const buckets=[[],[],[],[]];for(const item of pool){const x=item.total/stake;buckets[x<10?0:x<25?1:x<50?2:3].push(item);}for(const [i,bucket] of buckets.entries()){if(!bucket.length)throw Error('Empty bonus tier');for(const item of bucket)rows.push({...item,p:bonusReturns[vol][i]/bucket.length/(item.total/stake),bonus:true});}
  const loss=1-rows.reduce((s,x)=>s+x.p,0);if(loss<0)throw Error('Invalid probability mass');rows.push({target:0,total:0,p:loss,bonus:false});
 }
 const sumP=rows.reduce((s,x)=>s+x.p,0),rtp=rows.reduce((s,x)=>s+x.p*x.total/cost,0);
 if(Math.abs(sumP-1)>1e-10||Math.abs(rtp-.86)>1e-10)throw Error('Math proof failed');
 const dist={rows,cost,stake,expected:rtp,max:Math.max(...rows.map(x=>x.total/stake)),bonusP:rows.filter(x=>x.bonus).reduce((s,x)=>s+x.p,0)};
 distCache.set(key,dist);return dist;
}
function legacyRound(vol='std',rnd,settings={}){
 if(typeof rnd!=='function')throw Error('Server RNG required');
 const buy=settings.buy||null,stake=cents((settings.baseBet??(settings.bet?settings.bet/(BUY[buy]||1):1))*100),d=distribution(vol,buy,stake);
 let x=rnd(),entry=d.rows[d.rows.length-1];for(const a of d.rows){x-=a.p;if(x<0){entry=a;break;}}
 let board,wins,baseWin,feature=null;
 if(entry.bonus){feature=bonusTape(entry.kind,entry.seed,stake,!!buy);board=[...basePool(0)[Math.floor(rnd()*basePool(0).length)].board];[0,4,6,8,10,14].forEach((p,i)=>board[p]=i===0?(feature.super?IDS.super:IDS[feature.initial.features[0]]):IDS.coin);wins=[];baseWin=0;}
 else{const a=pick(basePool(entry.target),rnd);board=[...a.board];const e=paylines(board,stake);wins=e.wins;baseWin=e.total;}
 const total=baseWin+(feature?.final.total||0);
 if(total!==entry.total)throw Error('Outcome disagrees with math catalog');
 return {version:VERSION,win:total/d.cost,bonus:!!feature,feature:feature?(feature.super?'chili_super':'chili_hold'):null,featureSpins:feature?.steps.length||0,detail:feature?{features:feature.initial.features,super:feature.super,award:feature.final.fullAward,buy}:null,
  round:{model:TAPE_VERSION,mathVersion:VERSION,stake,cost:d.cost,board,wins,baseWin,bonus:feature,total}};
}
function expected(vol='std',buy=null,stake=100){return distribution(vol,buy,stake).expected;}
const PROGRESSION_VERSION=2,CAPACITY=6,FEATURES=['super','multi','collect','mystery'];
const initialCounts=rnd=>Object.fromEntries(FEATURES.map(f=>[f,Math.floor(rnd()*3)]));
function progressionKey(settings){const buy=settings.buy||null,stake=cents((settings.baseBet??(settings.bet?settings.bet/(BUY[buy]||1):1))*100);return stake+':'+(settings.vol||'std');}
function validCounts(c){return !!c&&FEATURES.every(f=>Number.isInteger(c[f])&&c[f]>=0&&c[f]<CAPACITY);}
function initialState(rnd){return {version:PROGRESSION_VERSION,counts:initialCounts(rnd),cycles:0};}
const progressionCache=new Map();
function progressionDistribution(vol='std',stake=100){
 const key=stake+':'+vol;if(progressionCache.has(key))return progressionCache.get(key);
 const d=distribution(vol,null,stake),groups=Object.fromEntries(FEATURES.map(f=>[f,{rows:[],p:0,mean:0,arrivalP:0}]));
 for(const row of d.rows.filter(r=>r.bonus)){const b=bonusTape(row.kind,row.seed,stake),f=b.super?'super':b.initial.features[0];groups[f].rows.push(row);groups[f].p+=row.p;groups[f].mean+=row.p*row.total/stake;}
 for(const g of Object.values(groups)){g.mean/=g.p;g.arrivalP=5*g.p;}
 const arrivalP=Object.values(groups).reduce((s,g)=>s+g.arrivalP,0);
 if(arrivalP>1+1e-12)throw Error('Collection probability exceeds one');
 const base=d.rows.filter(r=>!r.bonus&&r.total>0),baseP=base.reduce((s,r)=>s+r.p,0),baseReturn=base.reduce((s,r)=>s+r.p*r.total/stake,0);
 const expected=baseReturn+Object.values(groups).reduce((s,g)=>s+g.arrivalP/5*g.mean,0);
 if(Math.abs(expected-.86)>1e-10)throw Error('Collection renewal proof failed');
 const result={groups,base,baseP,baseReturn,arrivalP,expected,capacity:CAPACITY,meanArrivals:5};progressionCache.set(key,result);return result;
}
function progressionRound(vol,rnd,settings={},saved=null){
 if(typeof rnd!=='function')throw Error('Server RNG required');
 if(saved&&(!validCounts(saved.counts)||saved.version!==PROGRESSION_VERSION))throw Error('Invalid saved basket state');
 const state=saved?copy(saved):initialState(rnd),before=copy(state.counts),key=progressionKey({...settings,vol}),stake=Number(key.split(':')[0]);
 const buy=settings.buy||null;
 if(buy){const o=legacyRound(vol,rnd,settings);o.version=VERSION;o.round.mathVersion=VERSION;o.round.baskets={version:2,capacity:6,key,before,collected:copy(before),after:copy(before),arrivals:[],triggers:[],purchase:true};o.progression=state;return o;}
 const d=progressionDistribution(vol,stake);let x=rnd(),target=0;
 for(const row of d.base){x-=row.p;if(x<0){target=row.target;break;}}
 const a=pick(basePool(target),rnd),board=a.board.map(id=>FEATURES.some(f=>IDS[f]===id)?IDS.coin:id),e=paylines(board,stake),collected=copy(before),arrivals=[],triggers=[];
 let feature=null,selected=null;x=rnd();
 for(const f of FEATURES){x-=d.groups[f].arrivalP;if(x<0){selected=f;break;}}
 if(selected){
  const used=new Set(e.wins.flatMap(w=>w.positions)),free=board.map((_,i)=>i).filter(i=>!used.has(i));if(!free.length)throw Error('No safe collection cell');
  const pos=pick(free,rnd);board[pos]=IDS[selected];collected[selected]++;arrivals.push({pos,feature:selected,before:before[selected],after:collected[selected]});
  state.counts[selected]=collected[selected];
  if(collected[selected]===CAPACITY){
   triggers.push(selected);const group=d.groups[selected];let y=rnd()*group.p,entry=group.rows.at(-1);for(const row of group.rows){y-=row.p;if(y<0){entry=row;break;}}
   feature=bonusTape(entry.kind,entry.seed,stake);state.counts[selected]=Math.floor(rnd()*3);state.cycles=(state.cycles||0)+1;
  }
 }
 if(paylines(board,stake).total!==e.total)throw Error('Collection changed a line award');
 const total=e.total+(feature?.final.total||0);
 return {version:VERSION,win:total/stake,bonus:!!feature,feature:feature?(feature.super?'chili_super':'chili_hold'):null,featureSpins:feature?.steps.length||0,detail:feature?{features:feature.initial.features,super:feature.super,award:feature.final.fullAward,buy:null,collector:triggers[0]}:null,progression:state,
  round:{model:TAPE_VERSION,mathVersion:VERSION,stake,cost:stake,board,wins:e.wins,baseWin:e.total,bonus:feature,total,baskets:{version:2,capacity:6,key,before,collected,after:copy(state.counts),arrivals,triggers,purchase:false}}};
}

return {PROGRESSION_VERSION,CAPACITY,FEATURES,initialState,validCounts,progressionKey,progressionDistribution,legacyRound,VERSION,TAPE_VERSION,BETS,BUY,VOLATILITY:true,BANK_FULL:2,round:progressionRound,expected,distribution,bonusTape,IDS,INIT,PAY,LINES,JACKPOT_MULT,random,paylines,applyBonus,finishBonus};
})();
export {AmigosMath};




