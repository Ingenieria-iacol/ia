/* ===== V33.27 · Iconos 3D de equipos de consumo (reemplazan los emojis de la paleta) =====
   La paleta «Equipos de consumo» mostraba cada equipo con un emoji. Aquí se sustituye ese
   emoji por un pequeño dibujo isométrico 3D (SVG) propio de cada equipo, conservando el
   nombre y todo el comportamiento (los botones data-eq97 siguen igual). Es solo presentación:
   un barrido + observador cambia el contenido del <span class="i97"> por el SVG; si la paleta
   se vuelve a dibujar, se reaplica. No toca cálculo ni geometría del lienzo. */
(function(){
 const NS='http://www.w3.org/2000/svg';
 /* caja isométrica base (cuerpo del electrodoméstico) */
 function box(t,l,r,x){x=x||0;
  return `<path d="M${14+x} 3 L${25+x} 8.5 L${14+x} 14 L${3+x} 8.5 Z" fill="${t}"/>`
   +`<path d="M${3+x} 8.5 L${14+x} 14 L${14+x} 25 L${3+x} 19.5 Z" fill="${l}"/>`
   +`<path d="M${25+x} 8.5 L${14+x} 14 L${14+x} 25 L${25+x} 19.5 Z" fill="${r}"/>`
   +`<path d="M${14+x} 3 L${25+x} 8.5 L${14+x} 14 L${3+x} 8.5 Z M${3+x} 8.5 L${14+x} 14 L${14+x} 25 L${3+x} 19.5 Z M${25+x} 8.5 L${14+x} 14 L${14+x} 25 L${25+x} 19.5 Z" fill="none" stroke="#454f5b" stroke-width=".7" stroke-linejoin="round"/>`;
 }
 /* cilindro vertical (calderas, acumuladores) */
 function cyl(top,body){
  return `<path d="M7 7 V21 A7 3 0 0 0 21 21 V7 Z" fill="${body}"/>`
   +`<ellipse cx="14" cy="21" rx="7" ry="3" fill="none" stroke="#454f5b" stroke-width=".7"/>`
   +`<ellipse cx="14" cy="7" rx="7" ry="3" fill="${top}" stroke="#454f5b" stroke-width=".7"/>`;
 }
 const flame=(x,y,s)=>`<path d="M${x} ${y} q${-2.2*s} ${2.4*s} 0 ${4.2*s} q${2.2*s} ${1.1*s} ${2.1*s} ${-1.3*s} q${1*s} ${1.1*s} ${0.1*s} ${2.1*s} q${3.1*s} ${-1.1*s} ${1*s} ${-4.3*s} q${-1*s} ${1*s} ${-1*s} ${-1*s} q${-1*s} ${1.1*s} ${-3.3*s} ${-1*s} Z" fill="#ff8a1e"/>`;
 const drop=(x,y)=>`<path d="M${x} ${y} q2.4 2.6 0 4.2 q-2.4 1.6 -2.4 -1 q0 -1.7 2.4 -3.2 Z" fill="#49b6ff"/>`;
 const ST='#cfd8e3',SL='#99a6b5',SR='#7b8693';           /* acero: top, izq, der */

 /* dibujo por tipo de equipo */
 const DRAW={
  estufa:  ()=>box(ST,SL,SR)+flame(10.5,5.5,.8)+flame(14.5,6,.9)+flame(18.5,5.5,.8),
  horno:   ()=>box(ST,SL,SR)+`<rect x="15.5" y="12" width="7.5" height="9" rx="1" fill="#2b333c" transform="skewY(26.6)"/><circle cx="21.5" cy="23.4" r=".9" fill="#d2dbe6"/>`,
  caldera: ()=>cyl('#d7e7f2','#9fc3d8')+`<rect x="9" y="17" width="10" height="2" fill="#2b333c"/>`+flame(10.5,15,.85)+flame(14,15.5,.95)+flame(17.5,15,.85),
  acum:    ()=>cyl('#d2dbe6','#9aa7b6')+drop(12.5,11),
  calent:  ()=>box(ST,SL,SR)+drop(12.5,9)+`<rect x="10.5" y="20" width="7" height="1.4" fill="#49b6ff" transform="skewY(26.6)"/>`,
  freid:   ()=>box(ST,SL,SR)+`<path d="M9 9 L14 11.5 L19 9 L19 11 L14 13.5 L9 11 Z" fill="#e0a53a"/><rect x="12.5" y="5.5" width="3" height="4" rx=".6" fill="#6b7682"/>`,
  plancha: ()=>box('#d9e2ec','#9aa7b6','#7b8693')+`<path d="M9 8.5 L14 11 L19 8.5" fill="none" stroke="#c0392b" stroke-width="1"/>`+flame(12.5,19,.7)+flame(16,19.5,.7),
  marmita: ()=>`<path d="M7 11 A7 4.5 0 0 0 21 11 L20 20 A6 3 0 0 1 8 20 Z" fill="#9aa7b6"/><ellipse cx="14" cy="11" rx="7" ry="4.5" fill="#cfd8e3" stroke="#454f5b" stroke-width=".7"/><rect x="13" y="6.5" width="2" height="2" rx="1" fill="#6b7682"/>`+flame(11,21,.7)+flame(15,21,.7),
  matriz:  ()=>`<path d="M5 20 L14 14 L23 9" fill="none" stroke="#c9a144" stroke-width="2.2" stroke-linecap="round"/><path d="M14 14 L22 18 M14 14 L17 22" fill="none" stroke="#e0b85a" stroke-width="1.8" stroke-linecap="round"/><path d="M22 16 L24 18.5 L21 19 Z" fill="#ffb020"/><path d="M15.5 21 L18 22.5 L15 23.5 Z" fill="#ffb020"/><circle cx="14" cy="14" r="2" fill="#c9a144" stroke="#2b333c" stroke-width=".7"/>`,
  quemador:()=>`<ellipse cx="14" cy="17" rx="8" ry="4" fill="#9aa7b6" stroke="#454f5b" stroke-width=".7"/><ellipse cx="14" cy="16" rx="5" ry="2.4" fill="#2b333c"/>`+flame(12,10,.9)+flame(15.5,10.5,.8),
  secadora:()=>box(ST,SL,SR)+`<ellipse cx="18" cy="17" rx="3.4" ry="4" fill="#2b333c"/><ellipse cx="18" cy="17" rx="1.7" ry="2" fill="#4a5560"/>`,
  generador:()=>box(ST,SL,SR)+`<path d="M15 9 L11 16 H14 L12.5 22 L19 14 H15.5 Z" fill="#ffd21e" stroke="#b8860b" stroke-width=".5"/>`,
  chimenea:()=>box('#b98a5a','#8a6540','#6f4f31')+`<rect x="17" y="4" width="3" height="5" fill="#6f4f31" transform="skewY(26.6)"/>`+flame(12,18,.9)+flame(15.5,18.5,.8),
  otro:    ()=>box(ST,SL,SR)+`<rect x="11" y="15" width="6" height="4" rx=".6" fill="none" stroke="#49535f" stroke-width=".9" transform="skewY(26.6)"/>`
 };
 const KEYKIND={
  'Estufa residencial':'estufa','Estufa industrial':'estufa','Horno':'horno',
  'Calentador de paso':'calent','Calentador de acumulación':'acum','Caldera':'caldera',
  'Secadora':'secadora','Freidora':'freid','Plancha / asador':'plancha',
  'Chimenea / calefactor':'chimenea','Generador a gas':'generador','Marmita':'marmita',
  'Quemador':'quemador','Línea matriz (alimenta varias zonas)':'matriz','Otro equipo':'otro'
 };
 function svgFor(key){
  let k=KEYKIND[key];
  if(!k){try{const d=(window.EQD&&(window.EQD[key]||{}))||{};const kk=d[4];
    const M={estufa:'estufa',estres:'estufa',horno:'horno',calent:'calent',acum:'acum',caldera:'caldera',freid:'freid',plancha:'plancha',marm:'marmita',matriz:'matriz',otro:'otro'};k=M[kk];}catch(e){}}
  const g=DRAW[k]||DRAW.otro;
  return `<svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true" style="display:block">${g()}</svg>`;
 }

 /* reemplaza los emojis de la paleta por el SVG 3D */
 function sweep(){
  try{
   document.querySelectorAll('button[data-eq97] .i97').forEach(sp=>{
    const key=sp.closest('button[data-eq97]').dataset.eq97;
    if(sp.dataset.ic3==key)return;              /* ya puesto */
    sp.innerHTML=svgFor(key);sp.dataset.ic3=key;
    sp.style.display='inline-flex';sp.style.alignItems='center';sp.style.justifyContent='center';
   });
   /* icono del encabezado de la sección (resumen) */
   const sum=document.querySelector('details.acc [data-eq97]')?null:null;
   const head=[...document.querySelectorAll('details.acc > summary')].find(s=>/Equipos de consumo/.test(s.textContent||''));
   if(head){const sp=head.querySelector('span');if(sp&&sp.dataset.ic3!='hdr'){sp.innerHTML=svgFor('Estufa industrial');sp.dataset.ic3='hdr';sp.style.display='inline-flex';sp.style.verticalAlign='middle';}}
  }catch(e){}
 }
 let k=0;const t=setInterval(()=>{sweep();if(++k>30)clearInterval(t);},300);
 let pend=0;const deb=()=>{if(pend)return;pend=1;setTimeout(()=>{pend=0;sweep();},150);};
 try{const mo=new MutationObserver(deb);mo.observe(document.body,{childList:true,subtree:true});}catch(e){}
 window.EQICO3D={svgFor,sweep,DRAW};
})();
