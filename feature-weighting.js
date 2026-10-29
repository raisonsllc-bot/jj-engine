const sum=a=>a.reduce((s,x)=>s+x,0);
export function momentWeights(values,weights,mode){
 if(!['low','std','high'].includes(mode)||!values.length||values.length!==weights.length)throw Error('Invalid feature weighting');
 const z=sum(weights);if(!(z>0)||values.some(x=>!Number.isFinite(x)||x<0)||weights.some(x=>!Number.isFinite(x)||x<0))throw Error('Invalid support');
 const reference=weights.map(x=>x/z),mean=sum(values.map((x,i)=>x*reference[i]));
 if(mode==='std')return reference;
 const lo=Math.min(...values),hi=Math.max(...values);
 if(hi===lo)return reference;
 let a=lo,b=hi;
 if(mode==='low'){a=Math.max(...values.filter(x=>x<=mean));b=Math.min(...values.filter(x=>x>=mean));}
 const pa=a===b?1:(b-mean)/(b-a),ca=values.filter(x=>x===a).length,cb=values.filter(x=>x===b).length;
 const extreme=values.map(x=>x===a?pa/ca:x===b?(1-pa)/cb:0),mix=mode==='low'?.85:.65;
 const out=reference.map((x,i)=>(1-mix)*x+mix*extreme[i]);
 if(Math.abs(sum(out)-1)>1e-10||Math.abs(sum(values.map((x,i)=>x*out[i]))-mean)>1e-9)throw Error('Feature moment mismatch');
 return out;
}

export function equalAccessDistribution(rows,mode,{value,key,nuance,baseNuance=()=>'',stake=1,target=.86,weights=null}){
 const base=rows.filter(r=>!r.bonus),bonus=rows.filter(r=>r.bonus),baseP=sum(base.map(r=>r.p)),oldBonusP=sum(bonus.map(r=>r.p));
 if(!(baseP>0&&oldBonusP>0))throw Error('Missing base or bonus support');
 const baseMean=sum(base.map(r=>r.p*value(r)))/baseP,groups=new Map();
 for(const r of bonus){const k=key(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
 const primary=[...groups.keys()].sort(),primaryMass=primary.map(k=>weights?.[k]??1),primaryTotal=sum(primaryMass),parts=[];
 for(let i=0;i<primary.length;i++){
  const k=primary[i],a=groups.get(k),mass=sum(a.map(r=>r.p)),strata=new Map();
  for(const r of a){const n=nuance(r);if(!strata.has(n))strata.set(n,[]);strata.get(n).push(r);}
  for(const [n,b] of strata){const p=sum(b.map(r=>r.p))/mass*primaryMass[i]/primaryTotal,mean=sum(b.map(r=>r.p*value(r)))/sum(b.map(r=>r.p));parts.push({k,n,p,mean,rows:b});}
 }
 const bonusMean=sum(parts.map(x=>x.p*x.mean)),bonusP=(target-baseMean)/(bonusMean-baseMean);
 if(!(bonusP>0&&bonusP<1))throw Error('Feature mix cannot meet target');
 const output=[],exposure={};
 const baseGroups=new Map();for(const r of base){const k=(value(r)===0?'loss:':'pay:')+baseNuance(r);if(!baseGroups.has(k))baseGroups.set(k,[]);baseGroups.get(k).push(r);}
 for(const [className,a] of baseGroups){
  const p=(1-bonusP)*sum(a.map(r=>r.p))/baseP,w=momentWeights(a.map(value),a.map(r=>r.p),mode);
  a.forEach((r,i)=>output.push({...r,p:p*w[i],featureClass:'base-'+className}));
 }
 for(const g of parts){const w=momentWeights(g.rows.map(value),g.rows.map(r=>r.p),mode);g.rows.forEach((r,i)=>output.push({...r,p:bonusP*g.p*w[i],featureClass:g.k,featureNuance:g.n}));const e=exposure[g.k]??={probability:0,return:0,nuances:{}};e.probability+=bonusP*g.p;e.return+=bonusP*g.p*g.mean;e.nuances[g.n]=bonusP*g.p;}
 const expected=sum(output.map(r=>r.p*value(r))),mass=sum(output.map(r=>r.p)),variance=sum(output.map(r=>r.p*value(r)**2))-expected**2;
 if(Math.abs(mass-1)>1e-10||Math.abs(expected-target)>1e-9||output.some(r=>r.p<0))throw Error('Equal-access proof failed');
 return {rows:output,stake,cost:stake,expected,bonusP,baseP:1-bonusP,baseMean,bonusMean,variance,exposure,max:Math.max(...output.map(value)),policy:'equal-feature-access-1'};
}
