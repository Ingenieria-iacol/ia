/* v157 · Panel de control de la simulación (redes grandes · simulación planificada)
   El modal de simulación (#simp, módulo V37) ya opera válvulas y equipos uno a uno. Este módulo lo
   potencia para redes grandes y maniobras planificadas, SIN tocar su lógica:
     · 🔎 Buscador/filtro de válvulas y equipos por nombre o tipo (filtra las filas en vivo).
     · 🎬 Escenarios: guarda el estado completo (válvulas abiertas/cerradas + nivel de cada equipo) con
       un nombre, y aplícalo cuando quieras. Permite preparar y comparar operaciones planificadas.
   Se reinyecta tras cada repintado de V37 (que reescribe el modal). Nada de esto altera el cálculo. */
(function(){
 'use strict';
 if(typeof window==='undefined'||typeof document==='undefined')return;
 const g=id=>document.getElementById(id);
 const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const SS=()=>(typeof S!=='undefined'&&S)?S:null;
 const isVal=n=>n&&(n.type=='valvula'||n.type=='val_sismica'||n.type=='multivalvula');
 const isEq=n=>n&&n.type=='consumo'&&n.eq&&n.eq.nombre&&n.eq.nombre!='Ninguno'&&((+n.eq.kw||0)>0||(+n.eq.qlm||0)>0);

 let filtro='';

 /* ---------- escenarios (persisten en el dibujo: S.simscn) ---------- */
 const SCN=()=>{const S=SS();if(!S)return[];S.simscn=S.simscn||[];return S.simscn;};
 function snapEstado(){const S=SS(),o={v:{},q:{}};if(!S)return o;S.nodes.forEach(n=>{if(isVal(n))o.v[n.id]=n.est||'Abierta';else if(isEq(n))o.q[n.id]=n.op||'Alta';});return o;}
 function aplicarEstado(st){const S=SS();if(!st||!S)return;S.nodes.forEach(n=>{if(isVal(n)&&st.v&&st.v[n.id]!=null)n.est=st.v[n.id];else if(isEq(n)&&st.q&&st.q[n.id]!=null)n.op=st.q[n.id];});}
 function resumen(st){let c=0,a=0;for(const k in (st.v||{}))if(st.v[k]=='Cerrada')c++;for(const k in (st.q||{}))if(st.q[k]=='Apagado')a++;const tv=Object.keys(st.v||{}).length,tq=Object.keys(st.q||{}).length;return `${tv-c}/${tv} válvulas abiertas · ${tq-a}/${tq} equipos encendidos`;}

 function recomputar(){
  /* fuerza recálculo y repintado reusando el motor de V37 */
  try{if(typeof calcR!=='undefined'&&typeof solve==='function')calcR=solve();}catch(e){}
  try{if(typeof draw==='function')draw();}catch(e){}
  try{if(window.V37&&V37.pinta)V37.pinta();}catch(e){}
 }

 /* ---------- filtro en vivo ---------- */
 function aplicarFiltro(box){
  const f=filtro.trim().toLowerCase();
  box.querySelectorAll('.rw').forEach(r=>{
   const item=r.querySelector('[data-v],[data-q],[data-ver]');
   if(!item){return;}
   const t=((r.querySelector('.n')||r).textContent||'').toLowerCase();
   r.style.display=(!f||t.indexOf(f)>=0)?'':'none';
  });
  box.querySelectorAll('details.vg37').forEach(d=>{
   const rows=[...d.querySelectorAll('.rw')].filter(r=>r.querySelector('[data-v],[data-q],[data-ver]'));
   if(!rows.length)return;
   const vis=rows.some(r=>r.style.display!=='none');
   d.style.display=(f&&!vis)?'none':'';
   if(f&&vis)d.open=true;
  });
 }

 /* ---------- UI: buscador ---------- */
 function barraBuscar(box){
  if(g('c157f'))return;
  const anchor=box.querySelector('details.vg37.top');
  if(!anchor)return; /* no hay válvulas ni equipos todavía */
  const d=document.createElement('div');d.id='c157f';d.className='c157f';
  d.innerHTML=`<span class="c157ic">🔎</span><input id="c157q" type="search" placeholder="Buscar válvula o equipo…" value="${esc(filtro)}"><button id="c157x" title="Limpiar" ${filtro?'':'style="visibility:hidden"'}>✕</button>`;
  anchor.parentNode.insertBefore(d,anchor);
  const inp=g('c157q');
  inp.addEventListener('input',()=>{filtro=inp.value;const x=g('c157x');if(x)x.style.visibility=filtro?'':'hidden';aplicarFiltro(box);});
  inp.addEventListener('keydown',e=>e.stopPropagation());
  g('c157x').addEventListener('click',()=>{filtro='';inp.value='';g('c157x').style.visibility='hidden';aplicarFiltro(box);inp.focus();});
 }

 /* ---------- UI: escenarios ---------- */
 function seccionEscenarios(box){
  if(g('c157s'))return;
  /* ancla: antes de la bitácora; si no, al final del modal */
  let anchor=[...box.querySelectorAll('h4')].find(h=>/Bit[aá]cora/i.test(h.textContent));
  const d=document.createElement('details');d.id='c157s';d.className='c157s';d.open=!!seccionEscenarios.abierto;
  d.addEventListener('toggle',()=>{seccionEscenarios.abierto=d.open;});
  d.innerHTML=`<summary>🎬 Escenarios de operación <small class="c157n"></small></summary><div class="c157b"></div>`;
  if(anchor)anchor.parentNode.insertBefore(d,anchor);else box.appendChild(d);
  renderEscenarios();
 }
 function renderEscenarios(){
  const d=g('c157s');if(!d)return;const b=d.querySelector('.c157b'),L=SCN();
  d.querySelector('.c157n').textContent=L.length?`(${L.length})`:'';
  b.innerHTML=`<p class="c157m">Guarda el estado actual de todas las válvulas y equipos como un escenario, y aplícalo cuando quieras para ensayar una operación planificada.</p>
   <div class="c157g"><input id="c157name" type="text" placeholder="Nombre del escenario (p. ej. «Mantenimiento zona A»)"><button id="c157save" class="c157pr">💾 Guardar estado actual</button></div>
   ${L.length?`<div class="c157list">${L.map(s=>`<div class="c157row" data-id="${s.id}"><div class="c157t"><b>${esc(s.nombre)}</b><span>${esc(resumen(s.st||{}))}</span></div><button data-ap="${s.id}" class="c157ap" title="Aplicar este escenario al dibujo">▶ Aplicar</button><button data-dl="${s.id}" class="c157del" title="Eliminar">🗑</button></div>`).join('')}</div>`:`<p class="c157e">Aún no has guardado escenarios.</p>`}`;
  const nm=g('c157name');if(nm)nm.addEventListener('keydown',e=>e.stopPropagation());
  g('c157save').onclick=()=>{
   const L2=SCN(),nombre=(g('c157name').value||'').trim()||`Escenario ${L2.length+1}`;
   L2.push({id:'SC'+Date.now().toString(36),nombre,fecha:new Date().toISOString(),st:snapEstado()});
   if(L2.length>40)L2.shift();
   g('c157name').value='';renderEscenarios();
   try{if(typeof bgToast==='function')bgToast('🎬 Escenario «'+nombre+'» guardado.');}catch(e){}
  };
  b.querySelectorAll('[data-ap]').forEach(btn=>btn.onclick=()=>{const s=SCN().find(x=>x.id==btn.dataset.ap);if(!s)return;try{if(typeof hs==='function')hs();}catch(e){}aplicarEstado(s.st);recomputar();try{if(typeof bgToast==='function')bgToast('▶ Escenario «'+s.nombre+'» aplicado.');}catch(e){}});
  b.querySelectorAll('[data-dl]').forEach(btn=>btn.onclick=()=>{const L3=SCN(),i=L3.findIndex(x=>x.id==btn.dataset.dl);if(i<0)return;L3.splice(i,1);renderEscenarios();});
 }

 /* ---------- estilos ---------- */
 function css(){
  if(g('c157css'))return;const s=document.createElement('style');s.id='c157css';s.textContent=`
  #simp .c157f{display:flex;align-items:center;gap:6px;margin:8px 0 6px;padding:4px 8px;background:#0e1830;border:1px solid #2a3b57;border-radius:9px}
  #simp .c157f .c157ic{opacity:.7;font-size:13px}
  #simp .c157f input{flex:1;background:transparent;border:0;color:#e6eefa;font-size:12.5px;outline:none;padding:3px 0}
  #simp .c157f button{background:transparent;border:0;color:#9fb3cc;cursor:pointer;font-size:12px;padding:2px 4px}
  #simp .c157s{margin:8px 0;border:1px solid #2a3b57;border-radius:10px;background:#0c1526;overflow:hidden}
  #simp .c157s>summary{cursor:pointer;padding:7px 10px;font-weight:700;font-size:12.5px;color:#cfe0f5;list-style:none;user-select:none}
  #simp .c157s>summary::-webkit-details-marker{display:none}
  #simp .c157s>summary::before{content:'▸ ';opacity:.7}
  #simp .c157s[open]>summary::before{content:'▾ '}
  #simp .c157s .c157n{opacity:.6;font-weight:500;margin-left:4px}
  #simp .c157b{padding:4px 10px 10px}
  #simp .c157m{font-size:11px;opacity:.72;margin:2px 0 8px;line-height:1.35}
  #simp .c157g{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
  #simp .c157g input{flex:1;min-width:150px;background:#0e1830;border:1px solid #2a3b57;border-radius:8px;color:#e6eefa;font-size:12px;padding:5px 8px}
  #simp .c157pr{background:#1f5fb0;border:1px solid #2f86e8;color:#fff;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;white-space:nowrap}
  #simp .c157list{display:flex;flex-direction:column;gap:6px}
  #simp .c157row{display:flex;align-items:center;gap:8px;background:#0e1830;border:1px solid #243451;border-radius:8px;padding:6px 8px}
  #simp .c157t{flex:1;min-width:0}
  #simp .c157t b{display:block;font-size:12.5px;color:#eef5ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #simp .c157t span{display:block;font-size:10.5px;opacity:.65}
  #simp .c157ap{background:#14532d;border:1px solid #2fbf62;color:#c8f7d8;border-radius:7px;padding:4px 9px;font-size:11.5px;cursor:pointer;white-space:nowrap}
  #simp .c157del{background:transparent;border:1px solid #3a2530;color:#e59aa6;border-radius:7px;padding:4px 7px;font-size:11.5px;cursor:pointer}
  #simp .c157e{font-size:11px;opacity:.6;margin:2px 0}
  `;document.head.appendChild(s);
 }

 /* ---------- observar el modal y reinyectar en cada repintado ---------- */
 let busy=false;
 function aplicar(box){
  if(busy)return;busy=true;
  try{barraBuscar(box);seccionEscenarios(box);aplicarFiltro(box);}catch(e){}
  busy=false;
 }
 let mo=null,n=0;
 const iv=setInterval(()=>{
  n++;const box=g('simp');
  if(box&&!box.__c157){box.__c157=1;css();
   mo=new MutationObserver(()=>{if(!busy)aplicar(box);});
   mo.observe(box,{childList:true,subtree:true});
   aplicar(box);clearInterval(iv);return;}
  if(n>80)clearInterval(iv);
 },160);

 window.C157={escenarios:SCN,aplicar:aplicarEstado,snap:snapEstado};
})();
