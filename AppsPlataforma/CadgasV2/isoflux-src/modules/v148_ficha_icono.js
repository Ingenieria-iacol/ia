/* ===== V33.33 · Encabezado de la ficha: foto del elemento o, si no hay, su ícono 3D =====
   Antes, el encabezado del panel solo aparecía cuando el elemento tenía foto de terreno (o una
   imagen enlazada). Ahora, cuando no hay foto, se muestra un pequeño dibujo isométrico del
   elemento según su tipo (tanque, válvula, regulador, medidor, manómetro, vaporizador, tubería,
   te, accesorios, equipo de consumo…). Expone window.ELEMICO; heroEl() en la base lo usa como
   respaldo. Solo presentación. */
(function(){
 const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const ST='#cfd8e3',SL='#99a6b5',SR='#7b8693',STK='#454f5b';
 function box(t,l,r,x,y){x=x||0;y=y||0;const P=(a,b)=>`${a+x} ${b+y}`;
  return `<path d="M${P(14,3)} L${P(25,8.5)} L${P(14,14)} L${P(3,8.5)} Z" fill="${t}"/>`
   +`<path d="M${P(3,8.5)} L${P(14,14)} L${P(14,25)} L${P(3,19.5)} Z" fill="${l}"/>`
   +`<path d="M${P(25,8.5)} L${P(14,14)} L${P(14,25)} L${P(25,19.5)} Z" fill="${r}"/>`
   +`<path d="M${P(14,3)} L${P(25,8.5)} L${P(14,14)} L${P(3,8.5)} Z M${P(3,8.5)} L${P(14,14)} L${P(14,25)} L${P(3,19.5)} Z M${P(25,8.5)} L${P(14,14)} L${P(14,25)} L${P(25,19.5)} Z" fill="none" stroke="${STK}" stroke-width=".7" stroke-linejoin="round"/>`;}
 /* cilindro horizontal (tanque, tubería) */
 function cylH(cx,cy,rx,ry,len,top,body){
  return `<path d="M${cx} ${cy-ry} l${len} 0 a${rx} ${ry} 0 0 1 0 ${2*ry} l${-len} 0 Z" fill="${body}"/>`
   +`<ellipse cx="${cx+len}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${top}" stroke="${STK}" stroke-width=".7"/>`
   +`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${body}" stroke="${STK}" stroke-width=".7"/>`
   +`<path d="M${cx} ${cy-ry} l${len} 0 M${cx} ${cy+ry} l${len} 0" stroke="${STK}" stroke-width=".7" fill="none"/>`;}
 const wheel=(x,y)=>`<ellipse cx="${x}" cy="${y}" rx="4" ry="1.5" fill="#8d9aa7" stroke="${STK}" stroke-width=".6"/><rect x="${x-.6}" y="${y-4}" width="1.2" height="4" fill="#6b7682"/>`;
 const flame=(x,y,s)=>`<path d="M${x} ${y} q${-2*s} ${2.2*s} 0 ${3.8*s} q${2*s} ${1*s} ${1.9*s} ${-1.2*s} q${.9*s} ${1*s} ${0*s} ${1.9*s} q${2.8*s} ${-1*s} ${.9*s} ${-3.9*s} q${-.9*s} ${.9*s} ${-.9*s} ${-.9*s} q${-.9*s} ${1*s} ${-2.9*s} ${-.9*s} Z" fill="#ff8a1e"/>`;

 /* dibujo por tipo; viewBox 0 0 28 28, mismo estilo que los iconos de la paleta (v143) */
 const T={
  tanque:   ()=>cylH(6,15,3.2,5.2,13,'#d7e7f2','#9fc3d8')+`<rect x="9" y="22" width="1.4" height="4" fill="#6b7682"/><rect x="18" y="22" width="1.4" height="4" fill="#6b7682"/>`,
  tuberia:  ()=>cylH(3,14,2,3,22,'#cdd7e2','#9aa7b6'),
  valvula:  ()=>`<path d="M14 14 L6 9 L6 19 Z" fill="#9fc3d8" stroke="${STK}" stroke-width=".7"/><path d="M14 14 L22 9 L22 19 Z" fill="#7fa9c0" stroke="${STK}" stroke-width=".7"/>`+wheel(14,8),
  multivalvula:()=>`<path d="M11 15 L5 11 L5 19 Z" fill="#9fc3d8" stroke="${STK}" stroke-width=".6"/><path d="M11 15 L17 11 L17 19 Z" fill="#7fa9c0" stroke="${STK}" stroke-width=".6"/>`+wheel(11,10)+`<circle cx="22" cy="15" r="3.4" fill="#8d9aa7" stroke="${STK}" stroke-width=".6"/><circle cx="22" cy="15" r="1.3" fill="#2b333c"/>`,
  regulador:()=>box(ST,SL,SR,0,2)+`<path d="M8 10 Q14 2 20 10 Z" fill="#b7c2cf" stroke="${STK}" stroke-width=".7"/><circle cx="14" cy="9.5" r="1.2" fill="#6b7682"/>`,
  medidor:  ()=>box(ST,SL,SR)+`<circle cx="18" cy="16" r="3.4" fill="#eef4fb" stroke="${STK}" stroke-width=".7"/><path d="M18 16 L18 13.4 M18 16 L20 17" stroke="#c0392b" stroke-width=".8"/>`,
  manometro:()=>`<circle cx="14" cy="12" r="8" fill="#eef4fb" stroke="#6b7682" stroke-width="1.3"/><circle cx="14" cy="12" r="6.2" fill="#f7fbff" stroke="${STK}" stroke-width=".5"/><path d="M14 12 L14 7 M14 12 L18 13" stroke="#c0392b" stroke-width="1" stroke-linecap="round"/><circle cx="14" cy="12" r="1" fill="#2b333c"/><rect x="13" y="20" width="2" height="5" fill="#8d9aa7"/>`,
  vaporizador:()=>box('#d9e2ec','#9aa7b6','#7b8693')+`<path d="M9 16 q2 -2 4 0 q2 2 4 0 q2 -2 4 0" fill="none" stroke="#c0392b" stroke-width="1.1" transform="translate(-1 1)"/>`+flame(10.5,19,.7)+flame(14.5,19.5,.7),
  te:       ()=>cylH(3,16,1.8,2.6,20,'#cdd7e2','#9aa7b6')+`<path d="M14 16 l0 -9 a1.8 2.6 0 0 1 3.6 0 l0 9" fill="#9aa7b6" stroke="${STK}" stroke-width=".6"/><ellipse cx="15.8" cy="7" rx="1.8" ry="1" fill="#cdd7e2" stroke="${STK}" stroke-width=".6"/>`,
  reduccion:()=>`<path d="M4 10 L13 12 L13 16 L4 18 Z" fill="#9aa7b6" stroke="${STK}" stroke-width=".7"/><path d="M13 12 L24 13 L24 15 L13 16 Z" fill="#8795a4" stroke="${STK}" stroke-width=".7"/>`,
  transicion:()=>`<path d="M4 11 L14 11 L14 17 L4 17 Z" fill="#e0a53a" stroke="${STK}" stroke-width=".7"/><path d="M14 11 L24 11 L24 17 L14 17 Z" fill="#9aa7b6" stroke="${STK}" stroke-width=".7"/><rect x="13" y="10" width="2" height="8" fill="#6b7682"/>`,
  union:    ()=>cylH(4,14,2,3,18,'#cdd7e2','#9aa7b6')+`<rect x="12" y="10.5" width="4" height="7" rx="1" fill="#8d9aa7" stroke="${STK}" stroke-width=".6"/>`,
  brida:    ()=>`<ellipse cx="11" cy="14" rx="2.4" ry="7" fill="#8d9aa7" stroke="${STK}" stroke-width=".7"/><ellipse cx="17" cy="14" rx="2.4" ry="7" fill="#9aa7b6" stroke="${STK}" stroke-width=".7"/><circle cx="11" cy="9" r=".8" fill="#2b333c"/><circle cx="11" cy="19" r=".8" fill="#2b333c"/>`,
  flexible: ()=>`<path d="M4 14 q3 -5 6 0 q3 5 6 0 q3 -5 6 0" fill="none" stroke="#9aa7b6" stroke-width="3.4" stroke-linecap="round"/><path d="M4 14 q3 -5 6 0 q3 5 6 0 q3 -5 6 0" fill="none" stroke="#6b7682" stroke-width="1" stroke-dasharray="1.5 1.8"/>`,
  electrocorrector:()=>box(ST,SL,SR)+`<path d="M15 9 L11 16 H14 L12.5 22 L19 14 H15.5 Z" fill="#ffd21e" stroke="#b8860b" stroke-width=".5"/>`,
  ptopres:  ()=>`<circle cx="14" cy="11" r="6" fill="#eef4fb" stroke="#6b7682" stroke-width="1.1"/><path d="M14 11 L14 7 M14 11 L17 12" stroke="#c0392b" stroke-width=".9" stroke-linecap="round"/><rect x="13" y="17" width="2" height="7" fill="#8d9aa7"/>`,
  fuente:   ()=>cylH(6,15,3,5,12,'#d7e7f2','#9fc3d8')+`<path d="M20 15 h5 M22.5 12.5 l2.5 2.5 l-2.5 2.5" stroke="#5aa6ff" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  generic:  ()=>box(ST,SL,SR)+`<rect x="11" y="15" width="6" height="4" rx=".6" fill="none" stroke="#49535f" stroke-width=".9" transform="skewY(26.6)"/>`
 };
 const ALIAS={valvula:'valvula',multivalvula:'multivalvula',tanque:'tanque',regulador:'regulador',medidor:'medidor',manometro:'manometro',vaporizador:'vaporizador',te:'te',reduccion:'reduccion',transicion:'transicion',union:'union',brida:'brida',flexible:'flexible',electrocorrector:'electrocorrector',ptopres:'ptopres',fuente:'fuente'};
 const NOM={consumo:'Equipo de consumo',tanque:'Tanque',valvula:'Válvula',multivalvula:'Multiválvula',regulador:'Regulador',medidor:'Medidor',manometro:'Manómetro',vaporizador:'Vaporizador',te:'Nodo / te',reduccion:'Reducción',transicion:'Transición',union:'Unión',brida:'Brida',flexible:'Flexible',electrocorrector:'Electrocorrector',ptopres:'Punto de presión',fuente:'Fuente de suministro'};

 function svgFor(o,k){
  try{
   let g;
   if(k=='p'){g=T.tuberia;}
   else if(o&&o.type=='consumo'){
    if(window.EQICO3D&&EQICO3D.svgFor&&o.eq&&o.eq.nombre&&o.eq.nombre!='Ninguno')return EQICO3D.svgFor(o.eq.nombre);
    g=T.generic;
   } else { g=T[ALIAS[o&&o.type]]||T.generic; }
   return `<svg viewBox="0 0 28 28" width="68" height="68" aria-hidden="true">${g()}</svg>`;
  }catch(e){return `<svg viewBox="0 0 28 28" width="68" height="68">${T.generic()}</svg>`;}
 }
 function nombre(o,k){ if(k=='p')return o&&o.obra=='Existente'?'Tubería existente':'Tubería'; if(o&&o.type=='consumo'&&o.eq&&o.eq.nombre&&o.eq.nombre!='Ninguno')return o.eq.nombre; return (o&&NOM[o.type])||'Elemento'; }

 const css=document.createElement('style');css.id='elemico-css';
 css.textContent=`.phero.pheroic{background:linear-gradient(160deg,#16202e,#0e1726);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:12px 8px;min-height:92px}
 .phero.pheroic .pheroicbox{filter:drop-shadow(0 3px 7px rgba(0,0,0,.4))}
 .phero.pheroic span{position:static;background:none;color:#9fb6d2;font-size:11.5px;font-weight:500}
 .phero.pheroic.clik{cursor:pointer}.phero.pheroic.clik:hover{background:linear-gradient(160deg,#1a2740,#111c2e)}`;
 (document.head||document.documentElement).appendChild(css);

 window.ELEMICO={svgFor,nombre};
})();
