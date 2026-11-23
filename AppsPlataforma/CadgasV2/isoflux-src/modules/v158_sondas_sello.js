/* v158 · Sello de seguridad para el diagnóstico con sondas (modo Real)
   Desde V33.50 el cálculo de diseño es SIEMPRE teórico; la calibración con sondas quedó como
   diagnóstico dentro del panel «Modelo real vs modelo teórico». Este módulo añade un sello
   inconfundible en ese panel para que nadie confunda un valor calibrado con un valor de diseño.
   Puramente informativo; no toca el cálculo. */
(function(){
 'use strict';
 if(typeof window==='undefined'||typeof document==='undefined')return;
 const g=id=>document.getElementById(id);

 function sello(){
  const body=g('rl_b');if(!body||g('v158sello'))return !!g('v158sello');
  const d=document.createElement('div');d.id='v158sello';d.className='v158sello';
  d.innerHTML=`<span class="v158ic">🛡️</span><div><b>Esto es diagnóstico operativo, no diseño.</b>
   El cálculo de <b>diseño</b> —tabla de flujo, despiece, simulación e informes— usa <b>siempre</b> el modelo <b>teórico</b>.
   Aquí solo comparas lo <b>medido por las sondas</b> contra ese diseño; cambiar a 📡 Real <u>no</u> altera los resultados de diseño.</div>`;
  body.parentNode.insertBefore(d,body);
  return true;
 }

 function css(){
  if(g('v158css'))return;const s=document.createElement('style');s.id='v158css';s.textContent=`
  #real47 #v158sello{display:flex;gap:10px;align-items:flex-start;margin:10px 0 2px;padding:9px 12px;
   border:1px solid #caa23f;border-left:4px solid #e0a030;border-radius:9px;background:#2a230e;color:#f1e6c8;font-size:12px;line-height:1.4}
  #real47 #v158sello .v158ic{font-size:17px;line-height:1}
  #real47 #v158sello b{color:#ffe7a6}
  #real47 #v158sello u{text-decoration-color:#e0a030}
  `;document.head.appendChild(s);
 }

 let n=0;const iv=setInterval(()=>{
  n++;
  try{if(g('rl_b')){css();if(sello()){/* re-observa por si el panel se recrea */}}}catch(e){}
  if(n>400)clearInterval(iv);
 },300);
})();
