/* ===== V33.28 · «Niveles» integrado en la barra inferior de orientación =====
   El minipanel «Niveles» (ascensor flotante a la izquierda, #niv33) pasa a la barra inferior
   #v14hud, junto a Az/El/Fijar y los interruptores de vista (rosa, ejes, profundidad). Se vuelve
   un control compacto: selector de planta activa + «＋ Planta» + ver/ocultar los planos. Se usa la
   API pública NIV33 (misma lógica), y el ascensor flotante se oculta para no duplicar. */
(function(){
 const g=id=>document.getElementById(id);
 function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
 const nf=(v,d)=>{try{return (+v).toLocaleString('es-CO',{minimumFractionDigits:d,maximumFractionDigits:d});}catch(e){return (+v).toFixed(d);}};
 let box=null;
 function render(){
  const hud=g('v14hud');if(!hud||!window.NIV33||!NIV33.cfg)return false;
  const c=NIV33.cfg();if(!c||!c.list)return false;
  const ro=(typeof window.RO!=='undefined'&&window.RO);
  if(!box){box=document.createElement('span');box.id='nivHud';box.style.cssText='display:inline-flex;gap:4px;align-items:center;border-left:1px solid #2b3a52;margin-left:4px;padding-left:6px';hud.appendChild(box);}
  /* firma para no re-renderizar en cada frame */
  const sig=c.list.map(l=>l.n+':'+l.y).join('|')+'#'+c.act+(c.ver?'V':'o')+(ro?'R':'');
  if(box.dataset.sig===sig)return true;box.dataset.sig=sig;
  const opts=c.list.map((lv,i)=>`<option value="${i}" ${i==c.act?'selected':''}>${esc(lv.n)} · ${nf(lv.y,2)} m</option>`).join('');
  box.innerHTML=`<span title="Planta/nivel activo donde se dibuja" style="opacity:.8">⛰ Niveles</span>`
   +`<select id="nivHudSel" title="Planta activa: lo que dibujes se ubica en ella" style="max-width:120px">${opts}</select>`
   +(ro?'':`<button id="nivHudAdd" title="Agregar una planta encima" style="padding:2px 6px">＋</button>`)
   +`<button id="nivHudEye" title="Mostrar u ocultar los planos de nivel" style="padding:2px 6px"${c.ver?' class="on"':''}>${c.ver?'👁':'🚫'}</button>`;
  const sel=g('nivHudSel');if(sel)sel.onchange=()=>{NIV33.activar(+sel.value);setTimeout(render,0);};
  const ad=g('nivHudAdd');if(ad)ad.onclick=()=>{NIV33.agregar();setTimeout(render,30);};
  const ey=g('nivHudEye');if(ey)ey.onclick=()=>{NIV33.verToggle();setTimeout(render,0);};
  /* oculta el ascensor flotante original para no duplicar */
  const fl=g('niv33');if(fl)fl.style.display='none';
  return true;
 }
 /* mantiene oculto el flotante aunque se repinte, y refresca el selector si cambian las plantas */
 let k=0;const t=setInterval(()=>{try{render();const fl=g('niv33');if(fl&&fl.style.display!='none')fl.style.display='none';}catch(e){}if(++k>4000)clearInterval(t);},400);
 const css=document.createElement('style');css.textContent='#nivHud button.on{background:#1d5fbf;color:#fff;border-color:#8fc9ff}#nivHud select{padding:2px 4px}';document.head.appendChild(css);
 window.NIVHUD={render};
})();
