/* v153 · Plan de Aseguramiento Metrológico (P.A.M.)
   Esquema metrológico del Subsistema Nacional de la Calidad (Colombia) aplicado a la red:
   clasifica los elementos susceptibles de control/calibración, los integra al panel de
   propiedades y a un tablero que respeta el filtro de proyecto activo, y permite programar
   calibraciones (se registran como fichas de trabajo tipo "Calibración").
   Marco: Decreto 1595/2015 (SNC) · Decreto 4175/2011 (INM) · metrología legal (SIC) ·
   acreditación ONAC/ISO-IEC 17025 · reconocimiento ILAC · Resolución SIC 77507/2016. */
(function(){
 'use strict';
 if(typeof window==='undefined')return;
 const $=id=>document.getElementById(id);
 const E=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const hoy=()=>new Date().toISOString().slice(0,10);
 const addMonths=(d,m)=>{try{const x=new Date(d+'T00:00:00');x.setMonth(x.getMonth()+ (+m||0));return x.toISOString().slice(0,10);}catch(e){return '';}};

 /* --- clasificación metrológica por tipo de elemento --- */
 const PAMT={
  medidor:{clase:'Legal',mag:'Volumen / caudal de gas',patron:'Trazable al INM mediante laboratorio acreditado por ONAC (ISO/IEC 17025)',emp:'Según RTM de medidores de gas (SIC)',int:60,norma:'Metrología legal · control metrológico de la SIC · RTM de medidores de gas (Circular Única SIC, Título VI, en adopción)'},
  electrocorrector:{clase:'Legal',mag:'Corrección de volumen (presión, temperatura, Z)',patron:'Laboratorio acreditado por ONAC',emp:'Según reglamento aplicable',int:12,norma:'Metrología legal · control metrológico de la SIC'},
  manometro:{clase:'Industrial',mag:'Presión',patron:'Laboratorio de calibración acreditado por ONAC (ISO/IEC 17025), trazable al INM',emp:'Según la clase de exactitud del instrumento',int:12,norma:'Metrología industrial · trazabilidad al INM · ISO/IEC 17025'},
  ptopres:{clase:'Industrial',mag:'Presión',patron:'Laboratorio acreditado por ONAC',emp:'Según la clase del manómetro instalado',int:12,norma:'Metrología industrial'},
  sen_pre:{clase:'Industrial',mag:'Presión (transmisor)',patron:'Laboratorio acreditado por ONAC, trazable al INM',emp:'Según especificación del transmisor',int:12,norma:'Metrología industrial · ISO/IEC 17025'},
  sen_temp:{clase:'Industrial / Científica',mag:'Temperatura',patron:'Laboratorio acreditado por ONAC, trazable al INM',emp:'Según especificación del sensor',int:12,norma:'Metrología industrial/científica · ISO/IEC 17025'},
  sen_cau:{clase:'Industrial',mag:'Caudal / flujo',patron:'Laboratorio acreditado por ONAC, trazable al INM',emp:'Según especificación',int:12,norma:'Metrología industrial'},
  sen_vel:{clase:'Industrial',mag:'Velocidad',patron:'Laboratorio acreditado por ONAC',emp:'Según especificación',int:12,norma:'Metrología industrial'},
  sen_otro:{clase:'Industrial',mag:'Variable de proceso',patron:'Laboratorio acreditado por ONAC',emp:'Según especificación',int:12,norma:'Metrología industrial'},
  regulador:{clase:'Verificación',mag:'Presión de ajuste (set-point)',patron:'Verificación con patrón de presión trazable',emp:'Banda de regulación del fabricante',int:12,norma:'Verificación funcional (no es instrumento de medición sujeto a control legal)'}
 };
 const CLASE_COL={Legal:'#e0a030',Industrial:'#2f86e8','Industrial / Científica':'#a970ff',Verificación:'#2fbf62'};

 function clasif(o){if(!o)return null;const t=o.type;if(PAMT[t])return PAMT[t];
  /* un punto de control de presión con manómetro también aplica */
  if(t==='ptopres')return PAMT.ptopres;return null;}
 function susceptibles(){try{return S.nodes.filter(n=>clasif(n)&&!(window.CAPOFF&&CAPOFF(n)));}catch(e){return [];}}

 /* --- estado de calibración --- */
 function estado(o){const p=o.pam||{};if(!p.ult)return{k:'sin',txt:'Sin registro',col:'#8a97a8'};
  const prox=addMonths(p.ult,p.int||clasif(o).int);const h=hoy();
  if(prox<h)return{k:'venc',txt:'Vencida',col:'#e5484d',prox};
  const d=new Date(prox+'T00:00:00')-new Date(h+'T00:00:00');
  if(d<=45*864e5)return{k:'prox',txt:'Próxima',col:'#e0a030',prox};
  return{k:'ok',txt:'Al día',col:'#2e9e4f',prox};}

 /* --- API de edición (desde el panel) --- */
 window.PAM={
  set(id,field,val){try{const o=N(id);if(!o)return;o.pam=o.pam||{};if(field==='int')val=Math.max(0,+val||0);o.pam[field]=val;if(typeof hs==='function')hs();if(typeof draw==='function')draw();if($('pam96')&&$('pam96').classList.contains('on'))pinta();}catch(e){}},
  programar(k,id){try{if(typeof fichaOpen!=='function')return;fichaOpen(k,id,null);const t=$('fch_tipo');if(t){t.value='Calibración';t.dispatchEvent(new Event('change'));}const o=N(id),c=clasif(o);if(c&&$('fch_tit')&&!$('fch_tit').value)$('fch_tit').value='Calibración de '+(TY[o.type]||'instrumento')+' '+(o.tag||'');}catch(e){}},
  clasif,estado,susceptibles,abrir
 };

 /* --- sección en el panel de propiedades --- */
 function panelSec(o){
  const c=clasif(o);if(!c)return '';const p=o.pam||{},k=o[0];const id=o.id;const st=estado(o);const kk=(typeof sel!=='undefined'&&sel)?sel.k:'n';
  return `<hr style="border-color:var(--bd)"><div style="display:flex;align-items:center;gap:8px"><b>🔬 Aseguramiento metrológico (P.A.M.)</b><span style="margin-left:auto;font-size:11px;font-weight:700;color:${st.col}">${st.txt}</span></div>`+
   `<div style="font-size:11px;margin:4px 0;display:flex;flex-wrap:wrap;gap:6px"><span style="padding:1px 7px;border-radius:9px;background:${CLASE_COL[c.clase]||'#555'}33;border:1px solid ${CLASE_COL[c.clase]||'#555'};color:#e4eefa">Metrología ${E(c.clase)}</span><span style="opacity:.8">${E(c.mag)}</span></div>`+
   `<div style="font-size:11px;opacity:.75;margin:2px 0 6px">Trazabilidad: ${E(c.patron)}<br>EMP: ${E(c.emp)}</div>`+
   `<div class="g2" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">`+
   `<div><label>Intervalo (meses)</label><input type="number" min="0" value="${E(p.int!=null?p.int:c.int)}" oninput="PAM.set('${id}','int',this.value)"></div>`+
   `<div><label>Última calibración</label><input type="date" value="${E(p.ult||'')}" onchange="PAM.set('${id}','ult',this.value)"></div>`+
   `<div><label>N° certificado</label><input type="text" value="${E(p.cert||'')}" onchange="PAM.set('${id}','cert',this.value)"></div>`+
   `<div><label>Laboratorio (acreditado ONAC)</label><input type="text" value="${E(p.lab||'')}" onchange="PAM.set('${id}','lab',this.value)"></div>`+
   `<div><label>Incertidumbre</label><input type="text" value="${E(p.incert||'')}" placeholder="± ..." onchange="PAM.set('${id}','incert',this.value)"></div>`+
   `<div><label>Clase / EMP real</label><input type="text" value="${E(p.empr||'')}" onchange="PAM.set('${id}','empr',this.value)"></div>`+
   `</div>`+
   (st.prox?`<div style="font-size:11px;opacity:.8;margin-top:4px">Próxima calibración: <b>${E(st.prox)}</b></div>`:'')+
   `<button style="width:100%;margin-top:6px" onclick="PAM.programar('${kk}','${id}')">📅 Programar calibración</button>`+
   `<div style="font-size:10.5px;opacity:.6;margin-top:4px">${E(c.norma)}</div>`;
 }

 /* envolver panel() para añadir la sección al final cuando aplica */
 let n0=0;const iv=setInterval(()=>{n0++;
  try{
   if(typeof panel==='function'&&!panel.__v153pam){
    const _pn=panel;panel=function(){const r=_pn.apply(this,arguments);try{
     const pp=$('pp');if(pp){const o=(typeof so==='function')?so():null;const multi=(typeof ms!=='undefined'&&ms&&ms.length>1);
      if(o&&!multi&&(typeof sel!=='undefined'&&sel&&sel.k=='n')&&clasif(o))pp.insertAdjacentHTML('beforeend',panelSec(o));}
    }catch(e){}return r;};
    panel.__v153pam=1;
    injectBtn();buildModal();
    clearInterval(iv);
   }
  }catch(e){}
  if(n0>60)clearInterval(iv);
 },140);

 /* --- botón para abrir el tablero P.A.M. (junto al Cronograma) --- */
 function injectBtn(){try{const bc=$('bcrn');if(!bc||$('bpam'))return;const b=document.createElement(bc.tagName);b.id='bpam';b.textContent='🔬 P.A.M.';b.title='Plan de Aseguramiento Metrológico';if(bc.className)b.className=bc.className;b.onclick=abrir;bc.after(b);}catch(e){}}

 /* --- tablero / modal P.A.M. --- */
 let ov=null;
 function buildModal(){
  if(ov)return;ov=document.createElement('div');ov.className='ov';ov.id='pam96';
  ov.innerHTML=`<div class="pbx" style="width:min(1150px,97vw);max-height:92vh"><header style="cursor:grab;flex-wrap:wrap"><b style="flex:1">🔬 Plan de Aseguramiento Metrológico (P.A.M.)</b><button id="pam_norma">📖 Marco normativo</button><button id="pam_x">Cerrar</button></header><div id="pam_b" style="overflow:auto;padding:12px 16px"></div></div>`;
  document.body.appendChild(ov);
  $('pam_x').onclick=()=>ov.classList.remove('on');
  ov.addEventListener('pointerdown',e=>{if(e.target===ov)ov.classList.remove('on');});
  $('pam_norma').onclick=()=>{const b=$('pam_b');b.innerHTML=normaHTML()+`<button style="margin-top:10px" onclick="PAM.abrir()">← Volver al tablero</button>`;};
  /* arrastre del encabezado */
  try{const bx=ov.querySelector('.pbx'),h=bx.querySelector('header');let s=null,dx=0,dy=0;h.addEventListener('pointerdown',e=>{if(e.target.closest('button,select,input'))return;s=[e.clientX-dx,e.clientY-dy];h.setPointerCapture(e.pointerId);});h.addEventListener('pointermove',e=>{if(!s)return;dx=e.clientX-s[0];dy=e.clientY-s[1];bx.style.transform=`translate(${dx}px,${dy}px)`;});h.addEventListener('pointerup',()=>s=null);}catch(e){}
 }
 function pinta(){
  const b=$('pam_b');if(!b)return;const L=susceptibles();
  const pinf=window.PROYINFO?PROYINFO():{act:null};
  const banner=pinf.act?`<div style="margin:0 0 8px;padding:6px 10px;border:1px solid #2f86e8;border-radius:8px;background:rgba(18,58,102,.3);font-size:12px">🎯 Filtrado por proyecto activo: <b>${E(pinf.nom)}</b></div>`:'';
  if(!L.length){b.innerHTML=banner+'<p>No hay elementos susceptibles de control metrológico en '+(pinf.act?'este proyecto':'el plano')+'. Los medidores, correctores de volumen, manómetros, puntos de control de presión, sensores/transmisores y reguladores aparecen aquí.</p>';return;}
  const cont={Legal:0,Industrial:0,'Industrial / Científica':0,'Verificación':0},est={ok:0,prox:0,venc:0,sin:0};
  L.forEach(o=>{const c=clasif(o);cont[c.clase]=(cont[c.clase]||0)+1;est[estado(o).k]++;});
  const chip=(t,n,col)=>`<span style="display:inline-block;margin:0 10px 6px 0;font-size:12px"><b style="color:${col}">${n}</b> ${E(t)}</span>`;
  let h=banner+`<div style="margin-bottom:8px">${chip('Legal',cont.Legal,CLASE_COL.Legal)}${chip('Industrial',cont.Industrial,CLASE_COL.Industrial)}${chip('Ind./Científica',cont['Industrial / Científica'],CLASE_COL['Industrial / Científica'])}${chip('Verificación',cont['Verificación'],CLASE_COL['Verificación'])} &nbsp;|&nbsp; ${chip('al día',est.ok,'#2e9e4f')}${chip('próximas',est.prox,'#e0a030')}${chip('vencidas',est.venc,'#e5484d')}${chip('sin registro',est.sin,'#8a97a8')}</div>`;
  h+=`<table class="ct"><tr><th>Elemento</th><th>Clase metrológica</th><th>Magnitud</th><th>Intervalo</th><th>Última</th><th>Próxima</th><th>Estado</th><th>Certificado</th></tr>`+
   L.map(o=>{const c=clasif(o),p=o.pam||{},st=estado(o);return `<tr style="cursor:pointer" onclick="PAM._ir('${o.id}')"><td>${E(o.tag||o.id)} <span style="opacity:.6">(${E(TY[o.type]||o.type)})</span></td><td style="color:${CLASE_COL[c.clase]};font-weight:600">${E(c.clase)}</td><td>${E(c.mag)}</td><td>${E(p.int!=null?p.int:c.int)} m</td><td>${E(p.ult||'—')}</td><td>${E(st.prox||'—')}</td><td style="color:${st.col};font-weight:700">${E(st.txt)}</td><td>${E(p.cert||'')}</td></tr>`;}).join('')+`</table>`;
  h+=`<div style="font-size:11px;opacity:.6;margin-top:8px">Haz clic en una fila para ir al elemento. El tablero respeta el proyecto activo. Pulsa «📖 Marco normativo» para ver el esquema del Subsistema Nacional de la Calidad.</div>`;
  b.innerHTML=h;
 }
 window.PAM._ir=function(id){try{ov.classList.remove('on');sel={k:'n',id};ms=[];if(typeof panel==='function')panel();if(window.V26buscar&&V26buscar.ir)try{V26buscar.ir({k:'n',id,tag:'',tipo:''});}catch(e){}if(typeof draw==='function')draw();}catch(e){}};
 function abrir(){buildModal();ov.classList.add('on');pinta();}

 function normaHTML(){
  return `<div style="font-size:12.5px;line-height:1.5;max-width:860px">
  <h3 style="color:#8fc9ff;margin:4px 0">Esquema metrológico del Subsistema Nacional de la Calidad (Colombia)</h3>
  <p>El <b>Subsistema Nacional de la Calidad (SNC)</b> articula normalización, reglamentos técnicos, acreditación, evaluación de la conformidad, metrología y vigilancia. Marco general: <b>Decreto 1595 de 2015</b> (modifica el Decreto Único 1074 de 2015).</p>
  <h4 style="color:#8fc9ff;margin:8px 0 2px">Actores</h4>
  <ul style="margin:2px 0 6px 16px;padding:0">
   <li><b>INM — Instituto Nacional de Metrología</b> (Decreto 4175 de 2011): metrología científica e industrial; custodia de los patrones nacionales y trazabilidad.</li>
   <li><b>SIC — Superintendencia de Industria y Comercio</b>: autoridad de <b>metrología legal</b>; control metrológico de instrumentos de medición en uso (reglamentos técnicos metrológicos, RTM).</li>
   <li><b>ONAC — Organismo Nacional de Acreditación de Colombia</b>: acredita laboratorios de calibración y ensayo bajo <b>ISO/IEC 17025</b>; firmante de los acuerdos de reconocimiento de <b>ILAC</b> e <b>IAAC</b>.</li>
  </ul>
  <h4 style="color:#8fc9ff;margin:8px 0 2px">Tipos de metrología</h4>
  <ul style="margin:2px 0 6px 16px;padding:0">
   <li><b>Legal</b>: instrumentos cuyo resultado tiene efectos comerciales, fiscales o de seguridad (p. ej. <b>medidores de gas</b> y correctores de volumen). Controlados por la SIC.</li>
   <li><b>Industrial</b>: aseguramiento de las mediciones en procesos (manómetros, transmisores de presión/temperatura/caudal). Calibración trazable al INM.</li>
   <li><b>Científica</b>: realización y mantenimiento de patrones de más alta exactitud (INM).</li>
  </ul>
  <h4 style="color:#8fc9ff;margin:8px 0 2px">Trazabilidad y calibración</h4>
  <p>La calibración se realiza en laboratorios <b>acreditados por ONAC (ISO/IEC 17025)</b>, con patrones trazables al <b>INM</b> y, por la cadena ILAC, al SI. La incertidumbre se estima según la <b>GUM</b> y la terminología según el <b>VIM</b>. El resultado se documenta en un <b>certificado de calibración</b>.</p>
  <h4 style="color:#8fc9ff;margin:8px 0 2px">Referencias normativas</h4>
  <ul style="margin:2px 0 6px 16px;padding:0">
   <li>Decreto 1595 de 2015 — Subsistema Nacional de la Calidad.</li>
   <li>Decreto 4175 de 2011 — creación del INM.</li>
   <li>Resolución SIC 77507 de 2016 — control metrológico de instrumentos de medición.</li>
   <li>RTM de medidores de gas — en adopción vía la Circular Única de la SIC (Título VI).</li>
   <li>ISO/IEC 17025 — competencia de laboratorios de ensayo y calibración.</li>
  </ul>
  <p style="opacity:.65;font-size:11px">Esta guía es una ayuda de planeación. Verifica los números de resolución y los intervalos vigentes con la SIC, el INM y ONAC, pues la reglamentación metrológica se actualiza periódicamente.</p>
  </div>`;
 }

 window.PAM.abrir=abrir;
})();
