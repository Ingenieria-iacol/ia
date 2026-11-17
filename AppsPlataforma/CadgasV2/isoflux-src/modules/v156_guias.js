/* v156 · Leyenda de guías: explica el significado de las líneas punteadas de varios colores.
   Se inserta como sección plegable dentro del panel «Representación» (pestaña Vista), junto a
   los interruptores Nodos / Plomos. Es puramente informativa; no cambia el dibujo. Sin tocar el núcleo. */
(function(){
 'use strict';
 if(typeof window==='undefined'||typeof document==='undefined')return;
 const g=id=>document.getElementById(id);

 /* Entradas de la leyenda: [muestra, título, descripción]. La "muestra" es un trazo de color. */
 const ITEMS=[
  {c:'rgba(60,120,200,.9)',d:[3,3],ori:'v',t:'Plomo de altura',s:'Línea vertical azul punteada: proyecta cada punto al piso de referencia para leer su altura. Se oculta con el botón «Plomos».'},
  {c:'#0b7bff',d:[6,4],t:'Guía de arrastre / dibujo',s:'Azul brillante a trazos: aparece al mover un punto o trazar un tramo; conserva el ángulo del isométrico.'},
  {c:'#2f86e8',d:[10,6],t:'Tramo existente',s:'Tubo a trazos en el color del material: obra «Existente». La línea continua es obra nueva.'},
  {c:'#ff2d2d',d:[5,5],t:'Sentido del flujo',s:'Rojo animado que recorre el tubo durante la simulación; su velocidad refleja el caudal.'},
  {c:'rgba(255,90,90,.9)',d:[3,3],t:'Alerta de traslape',s:'Rojo punteado fijo al lado de un tramo: los accesorios no caben en su longitud. Corrige el diseño.'},
  {c:'#6c7a8c',d:[4,5],t:'Sin flujo (cálculo)',s:'Gris a trazos sobre el tramo: resultado de cálculo «no fluye».'},
  {c:'#ffd24a',d:[],t:'Revisar (cálculo)',s:'Amarillo sobre el tramo: resultado fuera de rango; conviene revisarlo.'},
  {c:'#3df08a',d:[5,4],t:'Guías de fondo',s:'Verde a trazos: calibración de una imagen o plano de fondo.'},
  {c:'#5aa9ff',d:[],t:'Ejes X · Z · Y',s:'Terna roja/azul/verde en la esquina: orientación del isométrico (se activa en «Isométrico ajustable»).'}
 ];

 function swatch(it){
  const cv=document.createElement('canvas');cv.width=34;cv.height=14;
  const x=cv.getContext('2d');x.strokeStyle=it.c;x.lineWidth=2.4;x.lineCap='round';
  if(it.d&&it.d.length)x.setLineDash(it.d);
  x.beginPath();
  if(it.ori==='v'){x.moveTo(17,1);x.lineTo(17,13);}else{x.moveTo(2,7);x.lineTo(32,7);}
  x.stroke();
  return cv;
 }

 function build(box){
  if(g('v156leg'))return true;
  const d=document.createElement('details');d.id='v156leg';d.className='v156leg';
  const sm=document.createElement('summary');sm.textContent='Leyenda de guías';d.appendChild(sm);
  const wrap=document.createElement('div');wrap.className='v156body';
  ITEMS.forEach(it=>{
   const row=document.createElement('div');row.className='v156row';
   const sw=swatch(it);sw.className='v156sw';
   const tx=document.createElement('div');tx.className='v156tx';
   tx.innerHTML=`<b>${it.t}</b><span>${it.s}</span>`;
   row.appendChild(sw);row.appendChild(tx);wrap.appendChild(row);
  });
  d.appendChild(wrap);box.appendChild(d);
  return true;
 }

 function css(){
  if(g('v156css'))return;const s=document.createElement('style');s.id='v156css';s.textContent=`
  #rep39 .v156leg{width:100%;border-top:1px solid var(--bd,#2a3648);margin-top:4px;padding-top:6px}
  #rep39 .v156leg>summary{cursor:pointer;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#8fc9ff;list-style:none;user-select:none;padding:2px 0}
  #rep39 .v156leg>summary::-webkit-details-marker{display:none}
  #rep39 .v156leg>summary::before{content:'▸ ';opacity:.7}
  #rep39 .v156leg[open]>summary::before{content:'▾ '}
  #rep39 .v156body{display:flex;flex-direction:column;gap:7px;margin-top:6px}
  #rep39 .v156row{display:flex;gap:9px;align-items:flex-start}
  #rep39 .v156sw{flex:0 0 auto;margin-top:2px;width:34px;height:14px}
  #rep39 .v156tx b{display:block;font-size:12px;color:#e6eefa;line-height:1.2}
  #rep39 .v156tx span{display:block;font-size:11px;opacity:.72;line-height:1.3;margin-top:1px}
  `;document.head.appendChild(s);
 }

 let n=0;const iv=setInterval(()=>{
  n++;
  try{const box=g('rep39');if(box){css();if(build(box)){clearInterval(iv);return;}}}catch(e){}
  if(n>80)clearInterval(iv);
 },160);
})();
