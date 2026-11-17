/* v155 · Modal de simulación: botón "Saturar" + acordeones en todas las secciones.
   - Saturar (en el encabezado): activo = muestra etiquetas y tarjetas según la pestaña Vista;
     inactivo = oculta TODAS las etiquetas/tarjetas (se ve solo el flujo). Gatilla layLabels().
   - Convierte en acordeón las secciones que aún no lo eran (Capacidad, Funcionamiento, etc.).
   Sin tocar el núcleo. */
(function(){
 'use strict';
 if(typeof window==='undefined'||typeof document==='undefined')return;
 const $=id=>document.getElementById(id);

 /* ---------- Saturar: estado + gatillo de layLabels ---------- */
 try{window.SAT=(localStorage.getItem('isoflux_sat')!=='0');}catch(e){window.SAT=true;}
 function gateLay(){
  if(typeof layLabels!=='function'||layLabels.__v155)return false;
  const _ll=layLabels;
  layLabels=function(){if(window.SAT===false){try{const s=$('lstat');if(s)s.style.display='none';}catch(e){}return;}return _ll.apply(this,arguments);};
  layLabels.__v155=1;return true;
 }
 window.SATset=function(on){window.SAT=!!on;try{localStorage.setItem('isoflux_sat',on?'1':'0');}catch(e){}try{if(typeof draw==='function')draw();}catch(e){}paintBtn();};
 function paintBtn(){const b=$('sp_sat');if(!b)return;const on=window.SAT!==false;b.textContent=(on?'🏷️ Saturar: ON':'🏷️ Saturar: OFF');b.classList.toggle('on',on);b.title=on?'Mostrando etiquetas y tarjetas según la pestaña Vista. Clic para ocultarlas y ver solo el flujo.':'Etiquetas y tarjetas ocultas (solo el flujo). Clic para volver a mostrarlas según la pestaña Vista.';}

 /* ---------- inyectar botón Saturar en el encabezado del modal ---------- */
 function injectBtn(box){
  try{
   const h=box.querySelector('header');if(!h||h.querySelector('#sp_sat'))return;
   const pdf=h.querySelector('#sp_pdf');
   const b=document.createElement('button');b.id='sp_sat';b.onclick=()=>window.SATset(window.SAT===false);
   const rb=document.createElement('button');rb.id='sp_reset';rb.textContent='⟲ Reiniciar lecturas';rb.title='Poner en cero las lecturas acumuladas de los medidores (no son contadores infinitos)';
   rb.onclick=()=>{try{if(window.SIM92&&SIM92.reset){SIM92.reset();if(typeof draw==='function')draw();}}catch(e){}};
   if(pdf){h.insertBefore(b,pdf);h.insertBefore(rb,pdf);}else{h.appendChild(b);h.appendChild(rb);}
   paintBtn();
  }catch(e){}
 }

 /* ---------- acordeones en las secciones del cuerpo ---------- */
 const COL=new Set();  /* títulos colapsados */
 function titleOf(sec){try{const k=sec.children[0];if(!k)return '';const b=(k.tagName==='B')?k:(k.querySelector&&k.querySelector('b'));return b?b.textContent.trim():'';}catch(e){return '';}}
 function accSection(sec){
  try{
   if(!sec||sec.__v155acc)return;
   const tag=sec.tagName;
   if(tag==='DETAILS'||tag==='LABEL'||tag==='P'||tag==='H4')return;
   if(sec.classList.contains('kp'))return;          /* las tarjetas-resumen quedan siempre visibles */
   const hdr=sec.children[0];if(!hdr)return;
   const hasTitle=(hdr.tagName==='B')||(hdr.querySelector&&hdr.querySelector('b'));
   if(!hasTitle||sec.children.length<2)return;       /* necesita título y algo que plegar */
   sec.__v155acc=1;sec.classList.add('v155acc');hdr.classList.add('v155hdr');
   const ch=document.createElement('span');ch.className='v155ch';hdr.insertBefore(ch,hdr.firstChild);
   const ttl=titleOf(sec);const col=COL.has(ttl);sec.classList.toggle('v155col',col);ch.textContent=col?'▸':'▾';
   hdr.style.cursor='pointer';
   hdr.addEventListener('click',e=>{if(e.target.closest('button,a,select,input'))return;const c=sec.classList.toggle('v155col');ch.textContent=c?'▸':'▾';const k=titleOf(sec);if(c)COL.add(k);else COL.delete(k);});
  }catch(e){}
 }
 function apply(box){
  injectBtn(box);
  const sb=box.querySelector('.sb');if(!sb)return;
  [...sb.children].forEach(accSection);
 }

 function css(){
  if($('v155css'))return;const s=document.createElement('style');s.id='v155css';s.textContent=`
  #simp .v155col > :not(.v155hdr){display:none!important}
  #simp .v155ch{display:inline-block;width:13px;opacity:.7;font-size:11px;vertical-align:baseline}
  #simp .v155hdr{user-select:none}
  #simp header #sp_sat{font-size:11px;padding:2px 8px;border-radius:8px;border:1px solid #556;background:#223;color:#9fb0c6;cursor:pointer}
  #simp header #sp_sat.on{border-color:#2f86e8;background:#123a66;color:#dcebff}
  `;document.head.appendChild(s);
 }

 /* ---------- observar el modal y reaplicar en cada render ---------- */
 let box=null,mo=null,busy=false;
 function watch(){
  box=$('simp');if(!box||box.__v155)return false;box.__v155=1;css();
  const run=()=>{if(busy)return;busy=true;try{apply(box);}catch(e){}busy=false;};
  mo=new MutationObserver(()=>run());
  mo.observe(box,{childList:true,subtree:true});
  run();
  return true;
 }
 let n=0;const iv=setInterval(()=>{n++;try{gateLay();const ok=watch();if((layLabels.__v155&&ok)||n>80)clearInterval(iv);}catch(e){if(n>80)clearInterval(iv);}},140);
 window.SIM155={apply:()=>box&&apply(box),paintBtn};
})();
