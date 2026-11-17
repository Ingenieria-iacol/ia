/* Plan de Aseguramiento Metrológico (P.A.M.) · Entalpía Lab / Isoflux
   ARCHIVO SEPARADO: Isoflux lo carga en tiempo de ejecución (<script src="pam/pam.js" defer>),
   para no robustecer el HTML principal de Cadgas. Mantén este archivo aparte en el repo.
   Esquema del Subsistema Nacional de la Calidad (Colombia): clasifica los elementos susceptibles
   de control/calibración, integra su HOJA DE VIDA METROLÓGICA al panel de propiedades y a un tablero
   que respeta el filtro de proyecto activo, programa calibraciones (fichas tipo "Calibración") y
   exporta el plan en PDF. Marco: Decreto 1595/2015 (SNC) · Decreto 4175/2011 (INM) · metrología legal
   (SIC) · acreditación ONAC/ISO-IEC 17025 · ILAC · Resolución SIC 77507/2016 · confirmación ISO 10012
   · regla de decisión ILAC-G8. */
(function(){
 'use strict';
 if(typeof window==='undefined')return;
 const $=id=>document.getElementById(id);
 const E=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const hoy=()=>new Date().toISOString().slice(0,10);
 const addMonths=(d,m)=>{try{const x=new Date(d+'T00:00:00');x.setMonth(x.getMonth()+ (+m||0));return x.toISOString().slice(0,10);}catch(e){return '';}};

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
 const TYd=t=>{try{return (typeof TY!=='undefined'&&TY[t])||t;}catch(e){return t;}};

 function clasif(o){if(!o)return null;const t=o.type;if(PAMT[t])return PAMT[t];if(t==='ptopres')return PAMT.ptopres;return null;}
 function susceptibles(){try{return S.nodes.filter(n=>clasif(n)&&!(window.CAPOFF&&CAPOFF(n)));}catch(e){return [];}}
 function estado(o){const p=o.pam||{};if(!p.ult)return{k:'sin',txt:'Sin registro',col:'#8a97a8'};
  const prox=addMonths(p.ult,p.int||clasif(o).int);const h=hoy();
  if(prox<h)return{k:'venc',txt:'Vencida',col:'#e5484d',prox};
  const d=new Date(prox+'T00:00:00')-new Date(h+'T00:00:00');
  if(d<=45*864e5)return{k:'prox',txt:'Próxima',col:'#e0a030',prox};
  return{k:'ok',txt:'Al día',col:'#2e9e4f',prox};}

 window.PAM={
  set(id,field,val){try{const o=N(id);if(!o)return;o.pam=o.pam||{};if(field==='int')val=Math.max(0,+val||0);o.pam[field]=val;if(typeof hs==='function')hs();if(typeof draw==='function')draw();if($('pam96')&&$('pam96').classList.contains('on'))pinta();}catch(e){}},
  programar(k,id){try{if(typeof fichaOpen!=='function')return;fichaOpen(k,id,null);const t=$('fch_tipo');if(t){t.value='Calibración';t.dispatchEvent(new Event('change'));}const o=N(id),c=clasif(o);if(c&&$('fch_tit')&&!$('fch_tit').value)$('fch_tit').value='Calibración de '+TYd(o.type)+' '+(o.tag||'');}catch(e){}},
  clasif,estado,susceptibles
 };

 /* ---- helpers de campos ---- */
 const tf=(id,f,lab,v,type,ph)=>`<div><label>${E(lab)}</label><input type="${type||'text'}" value="${E(v==null?'':v)}" ${ph?`placeholder="${E(ph)}"`:''} onchange="PAM.set('${id}','${f}',this.value)"></div>`;
 const tfw=(id,f,lab,v,type,ph)=>tf(id,f,lab,v,type,ph).replace('<div>','<div style="grid-column:1/3">');
 const sf=(id,f,lab,v,opts,full)=>`<div${full?' style="grid-column:1/3"':''}><label>${E(lab)}</label><select onchange="PAM.set('${id}','${f}',this.value)">${opts.map(o=>`<option${o===(v==null?'':v)?' selected':''}>${E(o)}</option>`).join('')}</select></div>`;
 const grp=(t,inner)=>`<div style="margin-top:8px"><div style="font-size:10px;font-weight:700;letter-spacing:.05em;color:#8fc9ff;text-transform:uppercase;margin-bottom:5px">${E(t)}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${inner}</div></div>`;

 function panelSec(o){
  const c=clasif(o);if(!c)return '';const p=o.pam||{},id=o.id,st=estado(o);const kk=(typeof sel!=='undefined'&&sel)?sel.k:'n';
  let h=`<hr style="border-color:var(--bd)"><div style="display:flex;align-items:center;gap:8px"><b>🔬 Aseguramiento metrológico (P.A.M.)</b><span style="margin-left:auto;font-size:11px;font-weight:700;color:${st.col}">${st.txt}</span></div>`;
  h+=`<div style="font-size:11px;margin:4px 0;display:flex;flex-wrap:wrap;gap:6px"><span style="padding:1px 7px;border-radius:9px;background:${CLASE_COL[c.clase]||'#555'}33;border:1px solid ${CLASE_COL[c.clase]||'#555'};color:#e4eefa">Metrología ${E(c.clase)}</span><span style="opacity:.8">${E(c.mag)}</span></div>`;
  h+=`<div style="font-size:11px;opacity:.75;margin:2px 0 2px">Trazabilidad: ${E(c.patron)}<br>EMP de referencia: ${E(c.emp)}</div>`;
  h+=grp('Identificación del instrumento',
    tf(id,'marca','Marca',p.marca)+tf(id,'modelo','Modelo',p.modelo)+tf(id,'serie','N° de serie',p.serie)+tf(id,'codigo','Código interno',p.codigo)+tf(id,'rango','Rango / alcance',p.rango)+tf(id,'resol','Resolución',p.resol));
  h+=grp('Calibración',
    `<div><label>Intervalo (meses)</label><input type="number" min="0" value="${E(p.int!=null?p.int:c.int)}" oninput="PAM.set('${id}','int',this.value)"></div>`+
    tf(id,'ult','Última calibración',p.ult,'date')+
    tf(id,'cert','N° certificado',p.cert)+tf(id,'lab','Laboratorio (ONAC)',p.lab)+
    tf(id,'incert','Incertidumbre (U)',p.incert,'text','± ...')+tf(id,'empr','Clase / EMP real',p.empr)+
    tfw(id,'certurl','Enlace al certificado (URL)',p.certurl,'text','https://...'));
  if(p.certurl&&/^https?:\/\//i.test(p.certurl))h+=`<div style="margin-top:4px"><a href="${E(p.certurl)}" target="_blank" rel="noopener" style="color:#8fc9ff;font-size:11px">📄 Abrir certificado ↗</a></div>`;
  if(st.prox)h+=`<div style="font-size:11px;opacity:.8;margin-top:4px">Próxima calibración: <b>${E(st.prox)}</b></div>`;
  h+=grp('Confirmación metrológica (ISO 10012 · ILAC-G8)',
    sf(id,'reglaDec','Regla de decisión',p.reglaDec,['—','Aceptación simple (w=0)','Con banda de guarda'])+
    sf(id,'veredicto','Veredicto',p.veredicto,['—','Conforme','No conforme','Condicional'])+
    tfw(id,'asfound','Como se encontró (as-found)',p.asfound)+
    tfw(id,'asleft','Como se entregó (as-left)',p.asleft)+
    sf(id,'ajuste','¿Se realizó ajuste?',p.ajuste,['No','Sí','N.A.']));
  h+=grp('Gestión',
    sf(id,'crit','Criticidad',p.crit,['—','Alta','Media','Baja'])+
    tf(id,'resp','Responsable',p.resp));
  h+=`<button style="width:100%;margin-top:8px" onclick="PAM.programar('${kk}','${id}')">📅 Programar calibración</button>`;
  h+=`<div style="font-size:10.5px;opacity:.6;margin-top:4px">${E(c.norma)}</div>`;
  return h;
 }

 /* envolver panel() */
 let n0=0;const iv=setInterval(()=>{n0++;
  try{
   if(typeof panel==='function'&&!panel.__pam){
    const _pn=panel;panel=function(){const r=_pn.apply(this,arguments);try{
     const pp=$('pp');if(pp){const o=(typeof so==='function')?so():null;const multi=(typeof ms!=='undefined'&&ms&&ms.length>1);
      if(o&&!multi&&(typeof sel!=='undefined'&&sel&&sel.k=='n')&&clasif(o))pp.insertAdjacentHTML('beforeend',panelSec(o));}
    }catch(e){}return r;};
    panel.__pam=1;injectBtn();buildModal();clearInterval(iv);
   }
  }catch(e){}
  if(n0>80)clearInterval(iv);
 },150);

 function injectBtn(){try{const bc=$('bcrn');if(!bc||$('bpam'))return;const b=document.createElement(bc.tagName);b.id='bpam';b.textContent='🔬 P.A.M.';b.title='Plan de Aseguramiento Metrológico';if(bc.className)b.className=bc.className;b.onclick=abrir;bc.after(b);}catch(e){}}

 let ov=null;
 function buildModal(){
  if(ov)return;ov=document.createElement('div');ov.className='ov';ov.id='pam96';
  ov.innerHTML=`<div class="pbx" style="width:min(1150px,97vw);max-height:92vh"><header style="cursor:grab;flex-wrap:wrap"><b style="flex:1">🔬 Plan de Aseguramiento Metrológico (P.A.M.)</b><button id="pam_pdf" title="Descargar el plan de calibración en PDF">⬇ PDF</button><button id="pam_norma">📖 Marco normativo</button><button id="pam_x">Cerrar</button></header><div id="pam_b" style="overflow:auto;padding:12px 16px"></div></div>`;
  document.body.appendChild(ov);
  $('pam_x').onclick=()=>ov.classList.remove('on');
  $('pam_pdf').onclick=pamPDF;
  ov.addEventListener('pointerdown',e=>{if(e.target===ov)ov.classList.remove('on');});
  $('pam_norma').onclick=()=>{const b=$('pam_b');b.innerHTML=normaHTML()+`<button style="margin-top:10px" onclick="PAM.abrir()">← Volver al tablero</button>`;};
  try{const bx=ov.querySelector('.pbx'),hh=bx.querySelector('header');let s=null,dx=0,dy=0;hh.addEventListener('pointerdown',e=>{if(e.target.closest('button,select,input'))return;s=[e.clientX-dx,e.clientY-dy];hh.setPointerCapture(e.pointerId);});hh.addEventListener('pointermove',e=>{if(!s)return;dx=e.clientX-s[0];dy=e.clientY-s[1];bx.style.transform=`translate(${dx}px,${dy}px)`;});hh.addEventListener('pointerup',()=>s=null);}catch(e){}
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
  h+=`<table class="ct"><tr><th>Elemento</th><th>Clase</th><th>Magnitud</th><th>Serie</th><th>Int.</th><th>Última</th><th>Próxima</th><th>Estado</th><th>Veredicto</th><th>Certificado</th></tr>`+
   L.map(o=>{const c=clasif(o),p=o.pam||{},st=estado(o);return `<tr style="cursor:pointer" onclick="PAM._ir('${o.id}')"><td>${E(o.tag||o.id)} <span style="opacity:.6">(${E(TYd(o.type))})</span></td><td style="color:${CLASE_COL[c.clase]};font-weight:600">${E(c.clase)}</td><td>${E(c.mag)}</td><td>${E(p.serie||'')}</td><td>${E(p.int!=null?p.int:c.int)} m</td><td>${E(p.ult||'—')}</td><td>${E(st.prox||'—')}</td><td style="color:${st.col};font-weight:700">${E(st.txt)}</td><td>${E(p.veredicto&&p.veredicto!=='—'?p.veredicto:'')}</td><td>${p.certurl&&/^https?:/i.test(p.certurl)?`<a href="${E(p.certurl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:#8fc9ff">${E(p.cert||'ver')}</a>`:E(p.cert||'')}</td></tr>`;}).join('')+`</table>`;
  h+=`<div style="font-size:11px;opacity:.6;margin-top:8px">Clic en una fila para ir al elemento. El tablero respeta el proyecto activo. Pulsa «📖 Marco normativo» para ver el esquema del Subsistema Nacional de la Calidad.</div>`;
  b.innerHTML=h;
 }
 window.PAM._ir=function(id){try{ov.classList.remove('on');sel={k:'n',id};ms=[];if(typeof panel==='function')panel();if(window.V26buscar&&V26buscar.ir)try{V26buscar.ir({k:'n',id,tag:'',tipo:''});}catch(e){}if(typeof draw==='function')draw();}catch(e){}};
 function abrir(){buildModal();ov.classList.add('on');pinta();}
 window.PAM.abrir=abrir;

 function pamPDF(){
  const X=window.PDFX;if(!X||!X.engine){alert('El generador de PDF no está disponible.');return;}
  const L=susceptibles();if(!L.length){alert('No hay instrumentos susceptibles de control metrológico para incluir en el PDF.');return;}
  const pinf=window.PROYINFO?PROYINFO():{act:null};
  const proj=(typeof PJ!=='undefined'&&PJ)||{};
  const t='Plan de Aseguramiento Metrológico';
  const sub=(proj.nombre||proj.codigo||'Red de gas')+(pinf.act?' · Proyecto: '+pinf.nom:'');
  let D;try{D=X.engine(t);}catch(e){alert(e.message);return;}
  try{D.id=(typeof docId==='function')?docId():'ISO';}catch(e){}
  try{X.cover(D,t,sub);}catch(e){}
  const cont={},est={ok:0,prox:0,venc:0,sin:0};L.forEach(o=>{const c=clasif(o);cont[c.clase]=(cont[c.clase]||0)+1;est[estado(o).k]++;});
  const V=v=>(v&&v!=='—')?v:'';
  try{
   D.part('Instrumentos sujetos a control metrológico');
   D.h2('Resumen');
   D.kv([['Instrumentos',String(L.length)],
    ['Metrología legal',String(cont.Legal||0)],
    ['Metrología industrial / científica',String((cont.Industrial||0)+(cont['Industrial / Científica']||0))],
    ['Verificación',String(cont['Verificación']||0)],
    ['Al día / Próximas / Vencidas / Sin registro',`${est.ok} / ${est.prox} / ${est.venc} / ${est.sin}`],
    ['Alcance',pinf.act?('Proyecto activo: '+pinf.nom):'Plano completo']]);
   D.h2('Plan de calibración');
   D.table(['Elemento','Clase','Magnitud','Int. (m)','Última cal.','Próxima cal.','Estado','Veredicto','Certificado'],
    L.map(o=>{const c=clasif(o),p=o.pam||{},s=estado(o);return [String(o.tag||o.id)+' ('+TYd(o.type)+')',c.clase,c.mag,String(p.int!=null?p.int:c.int),p.ult||'',s.prox||'',s.txt,V(p.veredicto),p.cert||''];}),
    {styles:{fontSize:7,cellPadding:2.2}});
   D.h2('Identificación de los instrumentos');
   D.table(['Elemento','Marca','Modelo','N° serie','Rango / alcance','Resolución','Código'],
    L.map(o=>{const p=o.pam||{};return [String(o.tag||o.id),p.marca||'',p.modelo||'',p.serie||'',p.rango||'',p.resol||'',p.codigo||''];}),
    {styles:{fontSize:7,cellPadding:2.2}});
   D.h2('Confirmación metrológica (ISO 10012 · ILAC-G8)');
   D.table(['Elemento','Incertidumbre (U)','Clase / EMP real','Regla de decisión','Veredicto','As-found / As-left','Criticidad','Responsable'],
    L.map(o=>{const p=o.pam||{};return [String(o.tag||o.id),p.incert||'',p.empr||'',V(p.reglaDec),V(p.veredicto),((p.asfound||'')+(p.asleft?' / '+p.asleft:'')).trim()||'',V(p.crit),p.resp||''];}),
    {styles:{fontSize:7,cellPadding:2.2}});
   D.part('Marco normativo — Subsistema Nacional de la Calidad');
   D.kv([
    ['Subsistema Nacional de la Calidad','Decreto 1595 de 2015 (modifica el Decreto 1074 de 2015)'],
    ['INM — Instituto Nacional de Metrología','Decreto 4175 de 2011 · metrología científica e industrial; patrones nacionales y trazabilidad'],
    ['SIC — Superintendencia de Industria y Comercio','Autoridad de metrología legal; control metrológico de instrumentos (RTM)'],
    ['ONAC','Acreditación de laboratorios bajo ISO/IEC 17025; firmante de ILAC e IAAC'],
    ['Control metrológico','Resolución SIC 77507 de 2016'],
    ['Medidores de gas','RTM en adopción vía la Circular Única de la SIC (Título VI)'],
    ['Confirmación metrológica','ISO 10012 · regla de decisión ILAC-G8 · incertidumbre según la GUM · términos según el VIM']]);
   D.h2('Nota');
   D.kv([['Vigencia','Esta guía es una ayuda de planeación. Verifica los números de resolución y los intervalos vigentes con la SIC, el INM y ONAC, pues la reglamentación metrológica se actualiza periódicamente.']]);
   X.finish(D,t,'PAM_');
  }catch(e){console.error('pamPDF',e);alert('No se pudo generar el PDF: '+e.message);}
 }

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
  <h4 style="color:#8fc9ff;margin:8px 0 2px">Hoja de vida y confirmación metrológica</h4>
  <p>Cada instrumento mantiene su <b>hoja de vida</b>: identificación (marca, modelo, serie, rango, resolución), calibración (intervalo, certificado, laboratorio, incertidumbre) y <b>confirmación metrológica (ISO 10012)</b>: se compara el error y la <b>incertidumbre (U)</b> contra el <b>EMP</b> aplicando la <b>regla de decisión (ILAC-G8)</b> para emitir el veredicto (conforme / no conforme). Se registran los resultados <b>«como se encontró / como se entregó»</b> y los ajustes.</p>
  <h4 style="color:#8fc9ff;margin:8px 0 2px">Trazabilidad y calibración</h4>
  <p>La calibración se realiza en laboratorios <b>acreditados por ONAC (ISO/IEC 17025)</b>, con patrones trazables al <b>INM</b> y, por la cadena ILAC, al SI. La incertidumbre se estima según la <b>GUM</b> y la terminología según el <b>VIM</b>.</p>
  <h4 style="color:#8fc9ff;margin:8px 0 2px">Referencias normativas</h4>
  <ul style="margin:2px 0 6px 16px;padding:0">
   <li>Decreto 1595 de 2015 — Subsistema Nacional de la Calidad.</li>
   <li>Decreto 4175 de 2011 — creación del INM.</li>
   <li>Resolución SIC 77507 de 2016 — control metrológico de instrumentos de medición.</li>
   <li>RTM de medidores de gas — en adopción vía la Circular Única de la SIC (Título VI).</li>
   <li>ISO/IEC 17025 — competencia de laboratorios de ensayo y calibración · ISO 10012 — confirmación metrológica · ILAC-G8 — regla de decisión.</li>
  </ul>
  <p style="opacity:.65;font-size:11px">Esta guía es una ayuda de planeación. Verifica los números de resolución y los intervalos vigentes con la SIC, el INM y ONAC, pues la reglamentación metrológica se actualiza periódicamente.</p>
  </div>`;
 }
})();
