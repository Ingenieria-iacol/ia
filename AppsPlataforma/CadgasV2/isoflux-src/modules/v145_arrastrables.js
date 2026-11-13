/* ===== V33.29 · Paneles arrastrables: Psinapsis (tarjeta abajo-derecha) y barra de vista =====
   - El asistente Psinapsis (#ps79) se ubica abajo a la derecha y se puede arrastrar tomándolo por
     su encabezado o por la barra; sigue plegándose con ▾ (minimizar) y ocultándose con ✕.
   - La barra de vista de pantalla completa (#fs50bar) también se arrastra tomándola por un espacio
     libre (no por los botones).
   El anclaje es por borde izquierdo + inferior, para que la ventana de conversación siga creciendo
   hacia arriba y la barra no salte al abrir/cerrar. La posición se recuerda en localStorage. */
(function(){
 const g=id=>document.getElementById(id);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 /* hace arrastrable a `el`; canStart(target) decide si el punto donde se presiona inicia el arrastre */
 function draggable(el,canStart,key){
  if(!el||el.dataset.drag145)return;el.dataset.drag145='1';
  el.style.cursor='';                       /* el cursor de arrastre se pone solo sobre zonas válidas */
  let sx=0,sy=0,bL=0,bB=0,drag=false,cand=false,moved=false;
  const restore=()=>{try{const s=JSON.parse(localStorage.getItem(key)||'null');if(s&&isFinite(s.l)&&isFinite(s.b)){el.style.left=clamp(s.l,0,innerWidth-80)+'px';el.style.bottom=clamp(s.b,0,innerHeight-36)+'px';el.style.right='auto';el.style.top='auto';el.style.transform='none';}}catch(e){}};
  restore();
  el.addEventListener('pointerdown',e=>{
   if(e.button!=0)return;if(!canStart(e.target))return;
   const r=el.getBoundingClientRect();bL=r.left;bB=innerHeight-r.bottom;sx=e.clientX;sy=e.clientY;cand=true;moved=false;
  });
  window.addEventListener('pointermove',e=>{
   if(!cand)return;const dx=e.clientX-sx,dy=e.clientY-sy;
   if(!drag){if(Math.abs(dx)<4&&Math.abs(dy)<4)return;drag=true;document.body.style.userSelect='none';}
   moved=true;
   const L=clamp(bL+dx,2,innerWidth-60),B=clamp(bB-dy,2,innerHeight-36);
   el.style.left=L+'px';el.style.bottom=B+'px';el.style.right='auto';el.style.top='auto';el.style.transform='none';
  });
  window.addEventListener('pointerup',()=>{
   if(drag){try{const r=el.getBoundingClientRect();localStorage.setItem(key,JSON.stringify({l:r.left,b:innerHeight-r.bottom}));}catch(e){}}
   if(cand)document.body.style.userSelect='';
   cand=false;setTimeout(()=>{drag=false;},0);
  });
  /* si se arrastró, anula el clic que seguiría (p.ej. no togglear al soltar sobre el icono) */
  el.addEventListener('click',e=>{if(moved){e.stopPropagation();e.preventDefault();moved=false;}},true);
  /* reubica dentro de la pantalla si cambia el tamaño de la ventana */
  addEventListener('resize',()=>{if(el.style.left){const r=el.getBoundingClientRect();el.style.left=clamp(r.left,2,innerWidth-60)+'px';el.style.bottom=clamp(innerHeight-r.bottom,2,innerHeight-36)+'px';}});
 }

 /* zona de agarre de Psinapsis: encabezado o barra, nunca campos/botones (salvo el icono del cerebro) */
 function psStart(t){const z=t.closest&&t.closest('.hd,.bar');if(!z)return false;if(t.closest('input,textarea,select'))return false;if(t.closest('button')&&!t.closest('.brain'))return false;return true;}
 /* zona de agarre de la barra de vista: cualquier parte menos los botones */
 function barStart(t){return !(t.closest&&t.closest('button,input,select'));}

 function cssOnce(){if(g('drag145css'))return;const s=document.createElement('style');s.id='drag145css';
  s.textContent=`#ps79{left:auto;right:14px;transform:none}
  #ps79 .hd{cursor:move}#ps79 .hd button{cursor:pointer}
  #ps79 .bar{cursor:default}
  #fs50bar{cursor:move}#fs50bar button{cursor:pointer}
  #ps79 .grip145,#fs50bar .grip145{cursor:move;opacity:.5;padding:0 4px;font-weight:bold;letter-spacing:-1px}`;
  document.head.appendChild(s);}

 let k=0;const t=setInterval(()=>{
  cssOnce();
  const ps=g('ps79');if(ps)draggable(ps,psStart,'isoflux_ps79pos');
  const fb=g('fs50bar');if(fb)draggable(fb,barStart,'isoflux_fs50pos');
  if((ps&&fb)||++k>40)clearInterval(t);
 },300);
 window.DRAG145={draggable};
})();
