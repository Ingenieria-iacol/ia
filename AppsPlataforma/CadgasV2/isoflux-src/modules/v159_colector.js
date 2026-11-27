/* v159 · Colector equivalente (manifold multifuente)
   PROBLEMA que resuelve: cuando varios tanques/fuentes alimentan un COLECTOR COMÚN, el motor
   multifuente anterior (MF94) partía la red en una zona por fuente y DESCARTABA los tramos del
   colector entre zonas; así, solo un tanque alimentaba de verdad y los demás aparecían con 0.
   SOLUCIÓN (alta ingeniería, enfoque de fuente equivalente): si dos o más fuentes están
   hidráulicamente conectadas en un mismo colector, se tratan como UNA fuente equivalente de
   capacidad combinada inyectada en el colector. Así: (1) todos los tramos del colector entran al
   cálculo, (2) todos los equipos reciben flujo y (3) cada tanque aporta su parte, repartida por su
   capacidad de vaporización. El caso de una sola fuente queda intacto (no pasa por aquí).
   Nota de modelo: el reparto entre tanques es por capacidad de vaporización (gobernante en tanques
   de GLP, limitados por vaporización); el colector aguas abajo se resuelve con el motor base. */
(function(){
 'use strict';
 if(typeof solve!='function')return;
 const prev=solve;                           /* solve vigente (base para 1 fuente; MF94 para fuentes disjuntas) */
 const esCorte=n=>n&&(n.type=='valvula'||n.type=='val_sismica'||n.type=='multivalvula')&&n.est=='Cerrada';
 const openSrc=n=>!!n&&!!n.src&&!esCorte(n);

 /* presión de fuente en mbar man, replicando la lógica del motor base */
 function srcP(f){
  if(+f.ps0>0)return +f.ps0;
  try{if(typeof CF!='undefined'&&CF.gas=='GLP'&&window.VSIM29&&VSIM29.presionFuente){const pv=VSIM29.presionFuente(f);if(isFinite(pv)&&pv>0)return pv;}}catch(e){}
  try{return (+CF.psum||0)*68.9476;}catch(e){return 0;}
 }
 /* peso de reparto = capacidad de vaporización (m³/h) del tanque; si no hay, peso 1 */
 function peso(f){
  try{if(typeof CF!='undefined'&&CF.gas=='GLP'&&window.VSIM29&&VSIM29.fisica){const fis=VSIM29.fisica(f);
   if(fis&&fis.mmax>0){const g=(+CF.g)||.6,rho=1.225*g;return rho>0?fis.mmax/rho:fis.mmax;}}}catch(e){}
  return 1;
 }

 /* adyacencia sobre tuberías; no atraviesa un nodo-válvula cerrado */
 function adjac(){const A={};S.nodes.forEach(n=>A[n.id]=[]);S.pipes.forEach(p=>{if(A[p.a]&&A[p.b]){A[p.a].push([p,p.b]);A[p.b].push([p,p.a]);}});return A;}
 function alcanzables(A,desde){const seen=new Set([desde]),q=[desde];while(q.length){const u=q.shift();if(u!=desde&&esCorte(N(u)))continue;for(const[,v]of A[u]||[])if(!seen.has(v)){seen.add(v);q.push(v);}}return seen;}

 /* pierna de una fuente: tramos desde el tanque hasta el primer nodo de grado>=3 (unión del colector) */
 function pierna(A,f){
  const legs=[];let u=f.id,prevN=null,guard=0;
  while(guard++<40){const es=(A[u]||[]).filter(([,v])=>v!=prevN);
   if(u!=f.id){const grado=(A[u]||[]).length;if(grado>=3)break;}      /* llegó a la unión del colector */
   if(es.length!=1)break;                                             /* fin de rama o bifurcación */
   const[p,v]=es[0];legs.push(p);prevN=u;u=v;if(openSrc(N(u)))break;}  /* no cruzar a otra fuente */
  return legs;
 }

 function manifold(){
  const F=S.nodes.filter(openSrc);
  if(F.length<2)return null;                                          /* 1 fuente → motor base */
  const A=adjac();
  const alc=alcanzables(A,F[0].id);
  if(!F.every(f=>alc.has(f.id)))return null;                          /* fuentes en colectores separados → MF94 */

  const Ps=F.map(srcP),Peq=Math.min(...Ps.filter(x=>x>0).concat(Ps.some(x=>x>0)?[]:[0]));
  const spread=Ps.length?(Math.max(...Ps)-Math.min(...Ps)):0;
  const ws=F.map(peso),sw=ws.reduce((a,b)=>a+b,0)||F.length;

  /* super-fuente virtual conectada a cada tanque con tubería de resistencia ~0 */
  const cx=F.reduce((a,f)=>a+f.x,0)/F.length,cy=F.reduce((a,f)=>a+f.y,0)/F.length,cz=F.reduce((a,f)=>a+f.z,0)/F.length;
  const bigDia=F.map(f=>f.dia).sort((a,b)=>(+b||0)-(+a||0))[0]||'2';
  const V={id:'__MFV',tag:'Colector equivalente',x:cx,y:cy,z:cz,type:'brida',src:true,ps0:Peq};
  const vps=F.map((f,i)=>({id:'__MFVP'+i,a:V.id,b:f.id,dia:bigDia,mat:'Acero',L:0.001,obra:'Existente',__v:1}));
  const S0=S;let R=null;
  try{
   const nodes=S0.nodes.map(n=>openSrc(n)?Object.assign({},n,{src:false}):n);nodes.push(V);
   S=Object.assign({},S0,{nodes,pipes:S0.pipes.concat(vps)});
   R=prev.apply(this,arguments);
  }finally{S=S0;}
  if(!R)return null;

  /* caudal total = suma de lo que inyecta la super-fuente por las tuberías virtuales */
  let Qtot=0;vps.forEach(vp=>{const r=R.byP&&R.byP[vp.id];if(r&&isFinite(r.Q))Qtot+=r.Q;});
  if(!(Qtot>0)){try{Qtot=Object.values(R.pn||{}).reduce((a,o)=>a+((o&&o.Q)||0),0);}catch(e){}}

  /* quitar elementos virtuales del resultado */
  const esV=id=>typeof id=='string'&&id.indexOf('__MFV')===0;
  if(R.pipes)R.pipes=R.pipes.filter(r=>!esV(r.id));
  if(R.byP)for(const k in R.byP)if(esV(k))delete R.byP[k];
  if(R.nodes)R.nodes=R.nodes.filter(r=>r.tag!=V.tag);
  if(R.pn)for(const k in R.pn)if(esV(k))delete R.pn[k];
  if(R.warn)R.warn=R.warn.filter(w=>!/__MFV/.test(w));

  /* reparto por tanque y sobrescritura de sus piernas (para que TODOS aporten al colector) */
  const ST={ok:'Cumple',v:'Velocidad alta',d:'Caída excedida',x:'Presión agotada',nf:'Sin flujo'};
  const srcs=[];const usados=new Set();
  F.forEach((f,i)=>{
   const share=Qtot*ws[i]/sw;
   const legs=pierna(A,f);
   let P1=Peq+CF.patm;                                   /* presión en el tanque (abs) */
   legs.forEach(p=>{
    if(usados.has(p.id))return;usados.add(p.id);
    const D=idm(p),Leq=len(p)*(1+CF.eqp/100),r=p2(P1,share,D,Leq,DM?DM[p.dia]:undefined),
          A2=Math.PI/4*(D/1000)**2,
          v=r.P2>0?share*(1013.25/r.P2)*((273.15+CF.T)/288.15)/3600/A2:NaN,
          cum=(P1-r.P2)/Math.max(P1-CF.patm,1e-6)*100,
          st=share<=0?'nf':r.x?'x':v>CF.vmax?'v':cum>CF.dpmax?'d':'ok';
    const row={det:{...r,P1a:P1,Dmm:D},from:f.id,id:p.id,tramo:p.tag,dn:p.dia+'"',di:D,mat:p.mat,
     L:len(p),Leq,Q:share,v,P1:P1-CF.patm,P2:r.P2-CF.patm,dp:P1-r.P2,cum:share>0?cum:0,F:r.F,Re:r.Re,st,est:ST[st]};
    if(R.byP)R.byP[p.id]=row;
    if(R.pipes){const j=R.pipes.findIndex(x=>x.id==p.id);if(j>=0)R.pipes[j]=row;else R.pipes.push(row);}
    P1=r.P2;
   });
   srcs.push({id:f.id,tag:f.tag||f.id,P0:Peq,Q:share,cap:ws[i],n:0});
  });

  /* avisos: quitar los de malla por tanque, poner el de colector equivalente */
  if(R.warn)R.warn=R.warn.filter(w=>!/[Mm]alla|frontera|m[aá]s de una fuente/.test(w));
  R.warn=R.warn||[];
  R.warn.unshift(`Colector equivalente: ${F.length} fuentes en un mismo colector se resuelven como una sola fuente de capacidad combinada (${fx?fx(Qtot,1):Qtot.toFixed(1)} m³/h). Cada tanque aporta según su capacidad de vaporización.`);
  if(spread>Math.max(50,0.1*Math.max(...Ps)))R.warn.push(`Aviso: las presiones de fuente difieren (${fx?fx(Math.min(...Ps),0):''}–${fx?fx(Math.max(...Ps),0):''} mbar). Siendo un colector común deberían ser iguales (presión de vapor a la misma temperatura); revisa los datos. Se usó la menor (${fx?fx(Peq,0):Peq} mbar) como presión del colector.`);

  R.srcs=srcs;R.Qtot=Qtot;R.manifold=true;
  R.src=N(F[0].id);R.srcs.sort((a,b)=>b.Q-a.Q);
  return R;
 }

 solve=function(){let R=null;try{R=manifold();}catch(e){R=null;if(window.console)console.warn('v159 colector',e);}return R||prev.apply(this,arguments);};
 window.MF159={activo:()=>S.nodes.filter(openSrc).length>1,manifold};
})();
