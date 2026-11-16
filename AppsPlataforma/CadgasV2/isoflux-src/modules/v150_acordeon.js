/* v150 · Encabezados acordeón para los modales flotantes.
   Añade a cada ventana (.pbx con <header> y título) un control ▾ que la colapsa a su barra de título.
   Al colapsar, la ventana flota sobre el dibujo (el fondo deja de bloquear), para seguir trabajando.
   No depende de otros módulos. */
(function(){
 'use strict';
 if(typeof document==='undefined')return;
 const CSS=`
  .pbx.flacc{max-height:none!important;height:auto!important;min-height:0!important;resize:none!important}
  .pbx.flacc>*:not(header){display:none!important}
  .pbx.flacc>header{border-bottom:0!important;border-radius:12px!important;flex-wrap:nowrap!important}
  .ov.flaccov{background:transparent!important;pointer-events:none!important;align-items:flex-start!important;justify-content:flex-start!important;backdrop-filter:none!important}
  .ov.flaccov .pbx{pointer-events:auto!important;box-shadow:0 10px 34px #000b!important}
  .flaccbtn{flex:0 0 auto;cursor:pointer;background:transparent;border:0;color:inherit;font-size:13px;opacity:.72;padding:2px 7px;margin-right:2px;border-radius:6px;line-height:1;order:-1}
  .flaccbtn:hover{opacity:1;background:#ffffff1f}
 `;
 try{const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);}catch(e){}

 function headerOf(pbx){try{for(const ch of pbx.children){if(ch.tagName==='HEADER')return ch;}}catch(e){}return null;}

 function collapse(pbx,on){
  const ov=pbx.closest('.ov');
  if(on){
   try{const r=pbx.getBoundingClientRect();pbx.__flt=pbx.style.transform||'';pbx.style.transform='none';pbx.style.position='fixed';pbx.style.left=Math.max(4,Math.min(r.left,innerWidth-80))+'px';pbx.style.top=Math.max(4,Math.min(r.top,innerHeight-40))+'px';pbx.style.margin='0';}catch(e){}
   pbx.classList.add('flacc');if(ov)ov.classList.add('flaccov');
  }else{
   pbx.classList.remove('flacc');if(ov)ov.classList.remove('flaccov');
   try{pbx.style.position='';pbx.style.left='';pbx.style.top='';pbx.style.margin='';pbx.style.transform=pbx.__flt||'';}catch(e){}
  }
  const h=headerOf(pbx),b=h&&h.querySelector('.flaccbtn');if(b){b.textContent=on?'▸':'▾';b.title=on?'Expandir esta ventana':'Colapsar esta ventana (acordeón)';}
 }
 function toggle(pbx){collapse(pbx,!pbx.classList.contains('flacc'));}

 function enhance(pbx){
  try{
   if(!pbx||pbx.__flacc)return;
   const h=headerOf(pbx);if(!h)return;
   if(!h.querySelector('b'))return;            /* solo ventanas con título */
   pbx.__flacc=true;
   const btn=document.createElement('button');btn.className='flaccbtn';btn.textContent='▾';btn.title='Colapsar esta ventana (acordeón)';btn.setAttribute('aria-label','Colapsar o expandir la ventana');
   btn.addEventListener('pointerdown',e=>{e.stopPropagation();});
   btn.addEventListener('click',e=>{e.stopPropagation();e.preventDefault();toggle(pbx);});
   h.insertBefore(btn,h.firstChild);
   /* doble clic en una zona libre del encabezado también colapsa */
   h.addEventListener('dblclick',e=>{if(e.target.closest('button,select,input,textarea,a,label'))return;toggle(pbx);});
  }catch(e){}
 }
 function sweep(){try{document.querySelectorAll('.pbx').forEach(enhance);}catch(e){}}

 let t=null;const soon=()=>{if(t)return;t=setTimeout(()=>{t=null;sweep();},300);};
 try{const mo=new MutationObserver(ms=>{for(const m of ms){if(m.addedNodes&&m.addedNodes.length){soon();return;}}});mo.observe(document.body,{childList:true,subtree:true});}catch(e){}
 try{[500,1400,3200].forEach(d=>setTimeout(sweep,d));}catch(e){}
 window.FLACC={enhance,sweep,toggle,collapse};
})();
