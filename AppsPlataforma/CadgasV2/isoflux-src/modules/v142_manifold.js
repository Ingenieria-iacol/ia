/* ===== V33.25 · Varios tanques en un mismo manifold: capacidad combinada =====
   Cuando dos o más tanques de GLP están conectados a la misma red (un mismo manifold),
   se comportan como una sola fuente cuya capacidad de suministro es la SUMA de la
   vaporización de cada tanque. La vaporización de cada tanque la calcula la física de
   VaporGLP (VSIM29.fisica) con SU propia temperatura, nivel de llenado, geometría y
   presiones, de modo que las diferencias entre tanques quedan reflejadas: el más frío o
   más vacío aporta menos. Con el consumo sostenido los tanques tienden a igualarse.
   Aquí se agregan esas capacidades, se compara la demanda total contra la suma, y se
   reemplaza el aviso por-tanque por una evaluación combinada del manifold. */
(function(){
 const num=(v,d=1)=>{try{return (typeof nf=='function')?nf(v,d):(+v).toLocaleString('es-CO',{maximumFractionDigits:d});}catch(e){return (+v).toFixed(d);}};
 /* componentes conexos: agrupa los tanques-fuente que comparten red (mismo manifold) */
 function grupos(tanks){
  const adj={};S.nodes.forEach(n=>adj[n.id]=[]);
  (S.pipes||[]).forEach(p=>{if(adj[p.a]&&adj[p.b]){adj[p.a].push(p.b);adj[p.b].push(p.a);}});
  const comp={};let ci=0;
  S.nodes.forEach(n=>{if(comp[n.id]!=null)return;ci++;const q=[n.id];comp[n.id]=ci;while(q.length){const u=q.shift();(adj[u]||[]).forEach(v=>{if(comp[v]==null){comp[v]=ci;q.push(v);}});}});
  const g={};tanks.forEach(t=>{const c=comp[t.id];(g[c]=g[c]||[]).push(t);});
  return Object.keys(g).map(k=>g[k]);
 }
 try{if(typeof solve=='function'){const _s=solve;solve=function(){
   const R=_s.apply(this,arguments);
   try{
    if(!R||R.err||typeof CF=='undefined'||CF.gas!='GLP')return R;
    if(S.nodes.some(n=>n.type=='vaporizador'))return R;         /* con vaporizador forzado la vaporización natural deja de ser el límite */
    /* idempotente: quita evaluaciones de manifold anteriores */
    R.warn=(R.warn||[]).filter(w=>!/mismo manifold/.test(w));
    R.coh=(R.coh||[]).filter(w=>!/mismo manifold/.test(w));
    const tanks=S.nodes.filter(n=>n.type=='tanque'&&n.src);
    if(tanks.length<2)return R;
    grupos(tanks).forEach(g=>{
     if(g.length<2)return;
     const caps=g.map(t=>({t,c:(window.VAPORCAP?VAPORCAP(t):null)})).filter(x=>x.c&&x.c.qvap>0);
     if(caps.length<2)return;
     const totCap=caps.reduce((a,x)=>a+x.c.qvap,0),totMmax=caps.reduce((a,x)=>a+x.c.mmax,0);
     const totDem=caps.reduce((a,x)=>a+Math.max(0,(R.pn&&R.pn[x.t.id]&&R.pn[x.t.id].Q)||0),0);
     const tags=caps.map(x=>x.t.tag);
     /* quita los avisos por-tanque de vaporización (quedan reemplazados por el combinado) */
     const quita=w=>!(/vaporiza/.test(w)&&tags.some(t=>w.indexOf(t+':')===0));
     R.warn=(R.warn||[]).filter(quita);R.coh=(R.coh||[]).filter(quita);
     const rep=caps.map(x=>`${x.t.tag} ${num(x.c.qvap,1)} m³/h (${num(x.c.mmax,1)} kg/h${x.c.vinc?'':', estim.'})`).join(' + ');
     const cab=`${caps.length} tanques en el mismo manifold: vaporización combinada ≈ ${num(totCap,1)} m³/h (${num(totMmax,1)} kg/h) = ${rep}.`;
     let msg;
     if(totDem>totCap*1.001){
      msg=`${cab} La red pide ${num(totDem,1)} m³/h — aun sumando todos los tanques la vaporización NO alcanza (×${num(totCap/Math.max(totDem,.01),2)}). Requiere un vaporizador forzado, tanques mayores o más unidades en paralelo.`;
      R.warn=[msg].concat(R.warn||[]);
     }else{
      msg=`${cab} La red pide ${num(totDem,1)} m³/h — suficiente (margen ×${num(totCap/Math.max(totDem,.01),2)}). Cada tanque aporta en proporción a su capacidad; las diferencias de temperatura y de nivel de llenado hacen que el más frío o más vacío aporte menos, y con el consumo sostenido los tanques tienden a igualarse.`;
      R.coh=(R.coh||[]).concat([msg]);
     }
     R.vapManifold=(R.vapManifold||[]).concat([{tanks:tags,totCap,totMmax,totDem,ok:totDem<=totCap*1.001,
       reparto:caps.map(x=>({tag:x.t.tag,qvap:x.c.qvap,mmax:x.c.mmax,share:totCap>0?Math.min(x.c.qvap,totDem*x.c.qvap/totCap):0,vinc:!!x.c.vinc}))}]);
    });
   }catch(e){}
   return R;};}}catch(e){}
 window.VAPORMANIFOLD={grupos};
})();
