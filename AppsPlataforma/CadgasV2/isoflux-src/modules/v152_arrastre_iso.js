/* v152 · Arrastre isométrico + líneas guía.
   Al arrastrar UN elemento conectado, se engancha al eje isométrico de su(s) vecino(s)
   (la tubería conserva el ángulo del isométrico) y se dibujan las líneas guía, como al dibujar.
   El imán a nodo/tubería existente conserva la prioridad. Envuelve movMove/movUp/draw sin tocar el núcleo. */
(function(){
 'use strict';
 if(typeof window==='undefined')return;
 const DIRS=[[1,0,0],[0,0,1]];     /* ejes isométricos del suelo (X y Z del mundo) */
 let GUIDE=null;                    /* {segs:[{x0,y0,x1,y1,hot}], lab:{x,y,txt}} */
 const r3v=v=>Math.round(v*1000)/1000;
 const stepv=()=>{try{return(typeof step==='function'&&step())||0.1;}catch(e){return 0.1;}};

 /* engancha el nodo arrastrado al eje iso de un vecino y prepara las guías */
 function isoSnap(){
  GUIDE=null;
  try{
   const d=(typeof mdrag!=='undefined')?mdrag:null;
   if(!d||!d.h||d.snapN)return;                 /* el imán tiene prioridad */
   if(!d.ids||d.ids.size!==1)return;            /* solo un elemento */
   const id=[...d.ids][0],n=N(id);if(!n)return;
   /* vecinos fijos (otro extremo de cada tubería conectada) */
   const nbs=[];S.pipes.forEach(p=>{let o=null;if(p.a===id)o=N(p.b);else if(p.b===id)o=N(p.a);if(o&&!d.ids.has(o.id))nbs.push(o);});
   if(!nbs.length)return;
   if(d.cx==null)return;
   const gc=ground(d.cx,d.cy,n.y,true);         /* cursor en el mundo, plano a la altura del nodo */
   let best=null;const st=stepv();
   nbs.forEach(nb=>{DIRS.forEach(dir=>{
    const t0=(gc[0]-nb.x)*dir[0]+(gc[2]-nb.z)*dir[2];
    const t=Math.round(t0/st)*st;if(Math.abs(t)<1e-6)return;
    const px=r3v(nb.x+dir[0]*t),pz=r3v(nb.z+dir[2]*t);
    const sp=P(px,n.y,pz);                       /* posición candidata en pantalla */
    const dist=Math.hypot(sp[0]-d.cx,sp[1]-d.cy);
    if(!best||dist<best.dist)best={dist,nb,dir,px,pz,t};
   });});
   if(!best||best.dist>26)return;                /* solo engancha si el cursor está cerca del eje */
   /* aplicar: el nodo queda sobre el eje iso del vecino → la tubería conserva el ángulo */
   n.x=best.px;n.z=best.pz;
   /* guías: los dos ejes iso que pasan por el vecino enganchado (el activo resaltado) */
   const segs=[];const EXT=1e5;
   DIRS.forEach(dir=>{const A=P(best.nb.x-dir[0]*EXT,best.nb.y,best.nb.z-dir[2]*EXT),B=P(best.nb.x+dir[0]*EXT,best.nb.y,best.nb.z+dir[2]*EXT);
    segs.push({x0:A[0],y0:A[1],x1:B[0],y1:B[1],hot:dir===best.dir});});
   const sp=P(best.px,n.y,best.pz);
   GUIDE={segs,lab:{x:sp[0],y:sp[1],txt:Math.abs(r3v(best.t))+' m'}};
  }catch(e){GUIDE=null;}
 }

 function render(){
  try{
   if(!GUIDE||typeof ctx==='undefined'||!ctx)return;
   ctx.save();
   GUIDE.segs.forEach(s=>{ctx.beginPath();ctx.moveTo(s.x0,s.y0);ctx.lineTo(s.x1,s.y1);
    if(s.hot){ctx.strokeStyle='rgba(11,123,255,.9)';ctx.lineWidth=1.6;ctx.setLineDash([6,4]);}
    else{ctx.strokeStyle='rgba(120,170,230,.35)';ctx.lineWidth=1;ctx.setLineDash([3,4]);}
    ctx.stroke();});
   ctx.setLineDash([]);
   if(GUIDE.lab){const t=GUIDE.lab.txt,x=GUIDE.lab.x+12,y=GUIDE.lab.y-12;ctx.font='600 11px Inter,system-ui,Arial';const w=ctx.measureText(t).width+10;
    ctx.fillStyle='rgba(8,18,34,.9)';ctx.strokeStyle='#2f86e8';ctx.lineWidth=1;if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x,y-13,w,17,6);ctx.fill();ctx.stroke();}else{ctx.fillRect(x,y-13,w,17);}
    ctx.fillStyle='#cfe4ff';ctx.fillText(t,x+5,y);}
   ctx.restore();
  }catch(e){}
 }

 let n=0;const iv=setInterval(()=>{
  n++;
  try{
   if(typeof movMove==='function'&&typeof draw==='function'&&typeof movUp==='function'&&!movMove.__v152){
    const _mm=movMove, _mu=movUp, _dr=draw;
    movMove=function(e){let q=null;try{q=pos(e);}catch(_){}_mm.call(this,e);try{const d=(typeof mdrag!=='undefined')?mdrag:null;if(d&&q){d.cx=q[0];d.cy=q[1];}}catch(_){}isoSnap();if(GUIDE){try{_dr();}catch(_){}}};
    movMove.__v152=1;
    movUp=function(){GUIDE=null;const r=_mu.apply(this,arguments);return r;};
    draw=function(){const r=_dr.apply(this,arguments);render();return r;};
    clearInterval(iv);
   }
  }catch(e){}
  if(n>60)clearInterval(iv);
 },120);
 window.ISOARR={isoSnap,get guide(){return GUIDE;}};
})();
