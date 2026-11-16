/* v151 · Cronograma mejorado:
   (1) secciones plegables agrupando por Elemento / Tipo / Estado / Responsable / Fase;
   (2) Gantt con progreso, hitos y dependencias (ruta);
   (3) filtro por proyecto activo (respeta CAPOFF, igual que el despiece);
   (4) campos nuevos en la ficha: Fase, % de avance, Depende de, Es un hito (resp/estado/costo ya existían).
   Reemplaza las funciones globales crnRows/renderCrn/fichaOpen y envuelve el guardado, sin editar el núcleo. */
(function(){
 'use strict';
 if(typeof window==='undefined')return;
 const $=id=>document.getElementById(id);
 const ea=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const F=n=>{try{return window.fmt?fmt(n):String(n);}catch(e){return String(n);}};
 const COLG=new Set();            /* grupos colapsados (clave "g|valor") */

 function tryInit(){
  if(typeof allFichas!=='function'||typeof window.renderCrn!=='function'&&typeof renderCrn!=='function'){return false;}
  return true;
 }

 /* ---------- 1 · campos nuevos en el editor de ficha ---------- */
 function injectFields(){
  try{
   if(!$('fch_desc')||$('fch_fase'))return;
   const descWrap=$('fch_desc').closest('div');if(!descWrap||!descWrap.parentNode)return;
   descWrap.insertAdjacentHTML('beforebegin',
    `<div><label>Fase / grupo</label><input id="fch_fase" type="text" placeholder="(opcional)"></div>`+
    `<div><label>% de avance</label><input id="fch_avance" type="number" min="0" max="100" step="5" value="0"></div>`+
    `<div style="grid-column:1/3"><label>Depende de (actividad previa)</label><select id="fch_dep"><option value="">— ninguna —</option></select></div>`+
    `<div style="grid-column:1/3"><label style="display:flex;align-items:center;gap:6px;margin:0"><input type="checkbox" id="fch_hito" style="width:auto"> Es un hito (milestone)</label></div>`);
  }catch(e){}
 }

 /* ---------- envolver fichaOpen para poblar los campos nuevos ---------- */
 function wrapOpen(){
  if(typeof fichaOpen!=='function'||fichaOpen.__v151)return;
  const _fo=fichaOpen;
  window.fichaOpen=function(k,id,fid){
   _fo(k,id,fid);
   try{
    injectFields();
    const o=k=='n'?N(id):Pi(id);if(!o)return;
    const f=fid?(o.fichas||[]).find(x=>x.id==fid):null;
    if($('fch_fase'))$('fch_fase').value=(f&&f.fase)||'';
    if($('fch_avance'))$('fch_avance').value=(f&&+f.avance)||0;
    if($('fch_hito'))$('fch_hito').checked=!!(f&&f.hito);
    const dep=$('fch_dep');
    if(dep){const sib=(o.fichas||[]).filter(x=>x.id!==(f&&f.id));
     dep.innerHTML=`<option value="">— ninguna —</option>`+sib.map(x=>`<option value="${ea(x.id)}">${ea((x.fecha||'')+' · '+(x.titulo||x.tipo||x.id))}</option>`).join('');
     dep.value=(f&&f.dep)||'';}
   }catch(e){}
  };
  fichaOpen.__v151=1;
 }

 /* ---------- envolver el guardado para persistir los campos nuevos ---------- */
 function wrapSave(){
  const btn=$('fch_ok');if(!btn||btn.__v151)return;
  const prev=btn.onclick;
  btn.onclick=function(ev){
   const fk=(typeof FK!=='undefined'&&FK)?FK:null;
   const fidBefore=fk?fk.fid:null;
   const o0=fk?(fk.k=='n'?N(fk.id):Pi(fk.id)):null;
   const ids0=o0?new Set((o0.fichas||[]).map(x=>x.id)):null;
   if(prev)prev.call(this,ev);
   /* tras guardar, localizar la ficha (nueva o editada) y añadir los campos nuevos */
   try{
    if(!o0)return;
    let f=fidBefore?(o0.fichas||[]).find(x=>x.id==fidBefore):(o0.fichas||[]).find(x=>!ids0.has(x.id));
    if(!f&&o0.fichas&&o0.fichas.length)f=o0.fichas[o0.fichas.length-1];
    if(!f)return;
    f.fase=($('fch_fase')&&$('fch_fase').value||'').trim();
    f.avance=Math.max(0,Math.min(100,+($('fch_avance')&&$('fch_avance').value)||0));
    f.hito=!!($('fch_hito')&&$('fch_hito').checked);
    f.dep=($('fch_dep')&&$('fch_dep').value)||'';
    if(typeof draw==='function')draw();
    if($('crn')&&$('crn').classList.contains('on'))window.renderCrn();
   }catch(e){}
  };
  btn.__v151=1;
 }

 /* ---------- 2 · selector "Agrupar por" en el encabezado del cronograma ---------- */
 function injectGroupSel(){
  try{
   if($('crn_g')||!$('crn_v'))return;
   const sel=document.createElement('select');sel.id='crn_g';sel.title='Agrupar las actividades';
   sel.innerHTML=`<option value="e">Agrupar: Elemento</option><option value="t">Agrupar: Tipo</option><option value="s">Agrupar: Estado</option><option value="r">Agrupar: Responsable</option><option value="f">Agrupar: Fase</option>`;
   $('crn_v').after(sel);
   sel.onchange=()=>window.renderCrn();
  }catch(e){}
 }

 const GKEY=(x,g)=>g=='t'?(x.f.tipo||'(sin tipo)'):g=='s'?(x.st||'(sin estado)'):g=='r'?(x.f.resp||'(sin responsable)'):g=='f'?(x.f.fase||'(sin fase)'):x.tag;

 /* ---------- 3 · crnRows con filtro de proyecto ---------- */
 function installRows(){
  window.crnRows=function(){const e=$('crn_e').value,t=$('crn_t').value,q=$('crn_q').value.toLowerCase();
   return allFichas().map(x=>Object.assign(x,{st:fSt(x.f)})).concat(projections().map(x=>Object.assign(x,{st:'Proyectada'})))
    .filter(x=>!(window.CAPOFF&&CAPOFF(x.o)))
    .filter(x=>(!e||x.st==e)&&(!t||x.f.tipo==t)&&(!q||x.tag.toLowerCase().includes(q)))
    .sort((a,b)=>(a.f.fecha||'').localeCompare(b.f.fecha||'')||a.tag.localeCompare(b.tag));};
 }

 /* ---------- 2+1 · renderCrn con grupos plegables y Gantt mejorado ---------- */
 function installRender(){
  window.renderCrn=function(){
   const rows=window.crnRows(),b=$('crn_b');if(!b)return;
   injectGroupSel();
   if(!rows.length){b.innerHTML='<p>Aún no hay actividades. Selecciona una tubería o componente y crea su primera <b>ficha de trabajo</b> en el panel de propiedades.'+(window.PROYINFO&&PROYINFO().act?' <br><span style="color:#9ed0ff">Hay un proyecto activo: el cronograma muestra solo sus actividades.</span>':'')+'</p>';return;}
   const g=($('crn_g')&&$('crn_g').value)||'e';
   const open=x=>`fichaOpen('${x.k}','${x.id}',${x.f.proj?'null':`'${x.f.id}'`})`;
   /* agrupar conservando orden por fecha */
   const groups=[],gi={};rows.forEach(x=>{const k=GKEY(x,g);if(!(k in gi)){gi[k]=groups.length;groups.push({k,items:[]});}groups[gi[k]].items.push(x);});
   const pinf=window.PROYINFO?PROYINFO():{act:null};
   const banner=pinf.act?`<div style="margin:0 0 8px;padding:6px 10px;border:1px solid #2f86e8;border-radius:8px;background:rgba(18,58,102,.3);font-size:12px">🎯 Filtrado por proyecto activo: <b>${ea(pinf.nom)}</b> (${pinf.view=='solo'?'solo el proyecto':'Base + modificaciones'})</div>`:'';
   const ghead=(gk,n,extra)=>{const col=COLG.has(g+'|'+gk);return `<div class="crg" data-gk="${ea(gk)}" style="cursor:pointer;display:flex;align-items:center;gap:8px;margin:8px 0 2px;padding:5px 8px;background:#15223a;border:1px solid #27354d;border-radius:8px;font-weight:700;font-size:12px"><span style="width:12px">${col?'▸':'▾'}</span><span style="flex:1">${ea(gk)}</span><span style="opacity:.7;font-weight:500">${n} actividad(es)${extra||''}</span></div>`;};

   const view=($('crn_v')&&$('crn_v').value)||'g';

   if(view=='l'){
    let h=banner;
    groups.forEach(gr=>{const col=COLG.has(g+'|'+gr.k);const costo=gr.items.reduce((s,x)=>s+(+x.f.costo||0),0);
     h+=ghead(gr.k,gr.items.length,costo?` · COP ${F(costo)}`:'');
     if(!col){h+=`<table class="ct"><tr><th>Fecha</th><th>Dur</th><th>Elemento</th><th>Tipo</th><th>Título</th><th>Estado</th><th>Avance</th><th>Responsable</th><th>Fase</th><th>Costo COP</th></tr>`+
      gr.items.map(x=>`<tr style="cursor:pointer" onclick="${open(x)}"><td>${x.f.fecha||''}</td><td>${x.f.hito?'◆':(x.f.dur||1)}</td><td>${ea(x.tag)}</td><td>${ea(x.f.tipo)}</td><td>${ea(x.f.titulo||'')}</td><td style="color:${SC[x.st]};font-weight:700">${x.st}</td><td>${(+x.f.avance||0)}%</td><td>${ea(x.f.resp||'')}</td><td>${ea(x.f.fase||'')}</td><td>${x.f.costo?F(x.f.costo):''}</td></tr>`).join('')+`</table>`;}
    });
    b.innerHTML=h;bindGroupToggles(b,g);return;
   }

   /* ---- Gantt: una fila por actividad, agrupadas y plegables ---- */
   const h0=hoy();let a=rows[0].f.fecha||h0,z=h0;rows.forEach(x=>{if(!x.f.fecha)return;const e=addDays(x.f.fecha,x.f.dur||1);if(e>z)z=e;if(x.f.fecha<a)a=x.f.fecha;});if(h0<a)a=h0;a=addDays(a,-10);z=addDays(z,20);
   const D=Math.max(1,daysBt(a,z)),pd=Math.min(40,Math.max(3,1100/D)),LW=190,W=LW+D*pd,RH=26,AX=24;
   const X=f=>LW+daysBt(a,f)*pd;
   const pos={};let y=AX,flow='';
   groups.forEach(gr=>{const col=COLG.has(g+'|'+gr.k);
    flow+=`<div class="crg" data-gk="${ea(gr.k)}" style="position:relative;height:${RH}px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:0 8px;background:#15223a;border-bottom:1px solid #27354d;font-weight:700;font-size:12px;z-index:2"><span style="width:12px">${col?'▸':'▾'}</span><span>${ea(gr.k)}</span><span style="opacity:.6;font-weight:500">· ${gr.items.length}</span></div>`;
    y+=RH;if(col)return;
    gr.items.forEach(x=>{const x0=X(x.f.fecha),w=Math.max(9,(x.f.dur||1)*pd),av=Math.max(0,Math.min(100,+x.f.avance||0)),proj=x.st=='Proyectada';
     pos[x.k+x.id+(x.f.id||'')]={x0,x1:x.f.hito?x0:x0+w,y:y+RH/2};
     let bar;
     if(x.f.hito){bar=`<div onclick="${open(x)}" title="${ea('◆ Hito · '+(x.f.fecha||'')+' · '+(x.f.titulo||x.f.tipo)+' · '+x.st)}" style="position:absolute;top:${RH/2-7}px;left:${x0-7}px;width:14px;height:14px;background:${SC[x.st]};transform:rotate(45deg);border:1.5px solid #0b111a;cursor:pointer;z-index:3"></div>`;}
     else{bar=`<div onclick="${open(x)}" title="${ea((x.f.fecha||'')+' · '+x.f.tipo+' · '+(x.f.titulo||'')+' · '+x.st+' · '+av+'%'+(x.f.resp?' · '+x.f.resp:''))}" style="position:absolute;top:${RH/2-8}px;left:${x0}px;width:${w}px;height:16px;background:${proj?'transparent':SC[x.st]+'55'};border:2px ${proj?'dashed':'solid'} ${SC[x.st]};border-radius:4px;cursor:pointer;overflow:hidden;z-index:1">${!proj&&av>0?`<div style="position:absolute;left:0;top:0;bottom:0;width:${av}%;background:${SC[x.st]}"></div>`:''}</div>`+(av>0&&!proj?`<div style="position:absolute;left:${x0+w+4}px;top:${RH/2-7}px;font-size:10px;opacity:.75;z-index:1">${av}%</div>`:'');}
     flow+=`<div style="position:relative;height:${RH}px;border-bottom:1px solid #141c2b"><b style="position:sticky;left:0;display:inline-block;width:${LW-10}px;background:var(--pn);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:${RH}px;font-weight:500;font-size:11px;z-index:2">${ea(x.tag+' · '+x.f.tipo)}</b>${bar}</div>`;
     y+=RH;});
   });
   const bodyH=y;
   /* capa de fondo: rejilla de meses + etiquetas */
   let gridL='';for(let d=dObj(a.slice(0,8)+'01');d<=dObj(z);d.setMonth(d.getMonth()+1)){const l=X(ymd(d));gridL+=`<span style="position:absolute;left:${Math.max(LW,l)}px;top:4px;font-size:10px;opacity:.8">${d.toLocaleDateString('es-CO',{month:'short',year:'2-digit'})}</span><i style="position:absolute;left:${l}px;top:${AX}px;height:${bodyH-AX}px;border-left:1px dotted #26344c"></i>`;}
   /* capa superior: línea de hoy + dependencias */
   const hx=X(h0);let topL=`<i style="position:absolute;left:${hx}px;top:0;height:${bodyH}px;border-left:2px solid #ff3b3b" title="Hoy"></i>`;
   const segs=[];rows.forEach(x=>{if(!x.f.dep)return;const me=pos[x.k+x.id+(x.f.id||'')],pr=pos[x.k+x.id+x.f.dep];if(!me||!pr)return;segs.push(`<path d="M${pr.x1} ${pr.y} C ${pr.x1+16} ${pr.y}, ${me.x0-16} ${me.y}, ${me.x0} ${me.y}" fill="none" stroke="#9fb6d4" stroke-width="1.4" marker-end="url(#crnarr)"/>`);});
   if(segs.length)topL+=`<svg style="position:absolute;left:0;top:0;width:${W}px;height:${bodyH}px;overflow:visible"><defs><marker id="crnarr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z" fill="#9fb6d4"/></marker></defs>${segs.join('')}</svg>`;
   const legend=`<div style="margin-top:10px;font-size:11px">${Object.keys(SC).map(k=>`<span style="margin-right:12px"><i style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${SC[k]};vertical-align:middle"></i> ${k}</span>`).join('')}<span style="margin-right:12px">◆ hito</span><span style="opacity:.75">relleno = % avance · flecha = dependencia · línea roja = hoy</span></div>`;
   b.innerHTML=banner+`<div style="position:relative;width:${W}px;font-size:11px"><div style="position:absolute;inset:0;height:${bodyH}px;pointer-events:none;z-index:0">${gridL}</div>${flow}<div style="position:absolute;inset:0;height:${bodyH}px;pointer-events:none;z-index:4">${topL}</div></div>`+legend;
   bindGroupToggles(b,g);
  };
 }

 function bindGroupToggles(b,g){
  try{b.querySelectorAll('.crg').forEach(el=>{el.addEventListener('click',e=>{if(e.target.closest('a,button,input,select'))return;const gk=el.getAttribute('data-gk');const key=g+'|'+gk;if(COLG.has(key))COLG.delete(key);else COLG.add(key);window.renderCrn();});});}catch(e){}
 }

 /* ---------- arranque ---------- */
 function boot(){
  if(typeof allFichas!=='function'||typeof renderCrn!=='function'){return false;}
  installRows();installRender();wrapOpen();
  injectFields();injectGroupSel();
  /* re-enganchar el guardado (el botón existe en el DOM desde el inicio) */
  wrapSave();
  /* si el cronograma ya tiene su onclick de apertura, lo dejamos; solo aseguramos render nuevo */
  return true;
 }
 let n=0;const iv=setInterval(()=>{n++;try{if(boot()||n>40)clearInterval(iv);}catch(e){if(n>40)clearInterval(iv);}},150);
 window.CRON151={installRows,installRender,boot};
})();
