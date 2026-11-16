/* v149 · Propiedades del archivo en el panel + sello de fechas (creado / última modificación).
   No depende de ningún otro módulo. Usa globales existentes: S, PJ, panel, hs, V19sgc. */
(function(){
 'use strict';
 if(typeof window==='undefined'||typeof document==='undefined')return;
 const g=id=>document.getElementById(id);
 const two=n=>(n<10?'0':'')+n;
 function fdate(ms){if(!ms)return '—';try{const d=new Date(ms);if(isNaN(d))return '—';return `${two(d.getDate())}/${two(d.getMonth()+1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;}catch(e){return '—';}}
 function kb(n){if(!(n>0))return '—';return n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(2)+' MB';}
 function E(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

 /* --- sello de fechas: cada edición marca S.meta.actualizado (y crea creado la 1a vez) --- */
 try{
  if(typeof hs==='function'){const _hs=hs;hs=function(){try{if(typeof S!=='undefined'&&S){S.meta=S.meta||{};if(!S.meta.creado)S.meta.creado=Date.now();S.meta.actualizado=Date.now();}}catch(e){}return _hs.apply(this,arguments);};}
 }catch(e){}

 function metaS(){try{return (typeof S!=='undefined'&&S&&S.meta)||{};}catch(e){return {};}}
 function proj(){try{return (typeof PJ!=='undefined'&&PJ)||{};}catch(e){return {};}}
 function linkInfo(){try{const V=window.V19sgc;const lk=V&&V.link&&V.link();return lk||null;}catch(e){return null;}}
 function approxBytes(){try{return JSON.stringify(S).length;}catch(e){return 0;}}
 function row(lbl,val){return `<div class="fp9r"><span>${E(lbl)}</span><b>${E(val)}</b></div>`;}

 function cardHTML(){
  const P=proj(),M=metaS(),lk=linkInfo();
  let c={n:0,p:0,a:0};try{c={n:(S.nodes||[]).length,p:(S.pipes||[]).length,a:(S.anns||[]).length};}catch(e){}
  const nombre=P.nombre||P.codigo||'(sin nombre)';
  let h=`<div class="fp9"><div class="fp9h">📄 Propiedades del archivo</div>`;
  h+=row('Proyecto',nombre);
  if(P.codigo)h+=row('Código',P.codigo+(P.rev?'  ·  Rev. '+P.rev:''));
  if(P.cliente)h+=row('Cliente',P.cliente);
  if(P.ubic)h+=row('Ubicación',P.ubic);
  if(P.tipo)h+=row('Tipo',P.tipo);
  h+=`<div class="fp9s"></div>`;
  h+=row('Creado',fdate(M.creado));
  h+=row('Última modificación',fdate(M.actualizado));
  if(P.fecha)h+=row('Fecha del proyecto',P.fecha);
  if(lk&&lk.version)h+=row('Versión del plano','v'+lk.version);
  h+=`<div class="fp9s"></div>`;
  h+=row('Contenido',`${c.n} componentes · ${c.p} tuberías · ${c.a} anotaciones`);
  h+=row('Tamaño aprox.',kb(approxBytes()));
  h+=`</div>`;
  return h;
 }

 (function(){const s=document.createElement('style');s.textContent=`
  #pp .fp9{margin:10px 0 4px;border:1px solid var(--bd,#2a3648);border-radius:12px;background:rgba(14,22,34,.6);padding:10px 12px}
  #pp .fp9h{font:700 11px Inter,system-ui,Arial;letter-spacing:.06em;text-transform:uppercase;color:#8fc9ff;margin-bottom:8px}
  #pp .fp9r{display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:3px 0;border-bottom:1px solid #ffffff10}
  #pp .fp9r:last-child{border-bottom:0}
  #pp .fp9r span{opacity:.72;flex:0 0 auto}
  #pp .fp9r b{text-align:right;color:#e4eefa;font-weight:600;word-break:break-word}
  #pp .fp9s{height:1px;margin:6px 0;background:#2f5f9a55}
 `;document.head.appendChild(s);})();

 function hayEdicion(){try{return !!((typeof sel!=='undefined'&&sel)||(typeof ms!=='undefined'&&Array.isArray(ms)&&ms.length));}catch(e){return false;}}
 function montar(){
  try{
   const pp=g('pp');if(!pp)return;
   const ex=g('fp9card');if(ex)ex.remove();
   if(hayEdicion())return;           /* hay selección: el panel muestra el elemento, no el archivo */
   const d=document.createElement('div');d.id='fp9card';d.innerHTML=cardHTML();
   pp.appendChild(d);
  }catch(e){}
 }
 try{if(typeof panel==='function'){const _pn=panel;panel=function(){const r=_pn.apply(this,arguments);try{montar();}catch(e){}return r;};}}catch(e){}
 try{setTimeout(montar,800);}catch(e){}
 window.PROPARCH={cardHTML,montar};
})();
