/* v154 · Registro de versiones más amigable, con miniatura por versión.
   Miniatura = imagen de la versión (x.img) si existe · si no, un pantallazo que capture el
   usuario (se guarda en el navegador) · si no, una miniatura generada con el tema Entalpía.
   Reescribe el contenido del modal #verov al abrirlo, sin tocar el núcleo. */
(function(){
 'use strict';
 if(typeof window==='undefined'||typeof document==='undefined')return;
 const $=id=>document.getElementById(id);
 const E=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const cache={};

 function wrap(g,t,x,y,max,lh,maxLines){const words=String(t).split(' ');let line='',yy=y,ln=0;for(const w of words){const test=line+w+' ';if(g.measureText(test).width>max&&line){g.fillText(line.trim(),x,yy);line=w+' ';yy+=lh;ln++;if(ln>=maxLines-1){let rest=line;if(g.measureText(rest).width>max){while(rest&&g.measureText(rest+'…').width>max)rest=rest.slice(0,-1);rest=rest.trim()+'…';}g.fillText(rest.trim(),x,yy);return;}}else line=test;}g.fillText(line.trim(),x,yy);}

 function placeholder(x){
  if(cache[x.v])return cache[x.v];
  try{
   const W=400,H=250,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
   let bg=g.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#13203a');bg.addColorStop(1,'#0a0d12');g.fillStyle=bg;g.fillRect(0,0,W,H);
   let rg=g.createRadialGradient(W-78,66,8,W-78,66,180);rg.addColorStop(0,'rgba(201,161,68,.55)');rg.addColorStop(.45,'rgba(224,120,60,.22)');rg.addColorStop(1,'rgba(90,60,160,0)');g.fillStyle=rg;g.fillRect(0,0,W,H);
   g.fillStyle='rgba(143,201,255,.9)';g.font='700 14px Inter,system-ui,Arial';g.fillText('ENTALPÍA LAB · ISOFLUX',24,38);
   g.fillStyle='#eaf3ff';g.font='800 58px Inter,system-ui,Arial';g.fillText('v'+x.v,24,120);
   g.fillStyle='rgba(228,238,250,.6)';g.font='500 14px Inter,system-ui,Arial';g.fillText(x.f||'',26,146);
   g.fillStyle='rgba(228,238,250,.9)';g.font='600 14px Inter,system-ui,Arial';
   wrap(g,x.t||'',24,182,W-44,19,3);
   const u=c.toDataURL('image/jpeg',.82);cache[x.v]=u;return u;
  }catch(e){return '';}
 }

 const shotKey=v=>'isoflux_vs_'+v;
 function savedShot(v){try{return localStorage.getItem(shotKey(v))||'';}catch(e){return '';}}
 function thumbOf(x){const im=(x.img&&x.img.length&&x.img[0])||savedShot(x.v);return im||placeholder(x);}
 function hasShot(x){return !!((x.img&&x.img.length&&x.img[0])||savedShot(x.v));}

 function mainCanvas(){let best=null;document.querySelectorAll('canvas').forEach(c=>{if(c.id==='cv')best=c;});if(best)return best;document.querySelectorAll('canvas').forEach(c=>{if(!best||c.width*c.height>best.width*best.height)best=c;});return best;}

 window.__verCap=function(v){
  try{
   const cv=mainCanvas();if(!cv||!cv.width){return;}
   const W=400,H=Math.max(140,Math.min(260,Math.round(W*cv.height/cv.width))),c=document.createElement('canvas');c.width=W;c.height=H;
   const g=c.getContext('2d');g.fillStyle='#0a0d12';g.fillRect(0,0,W,H);g.drawImage(cv,0,0,W,H);
   const u=c.toDataURL('image/jpeg',.72);
   try{localStorage.setItem(shotKey(v),u);}catch(e){}
   render();
  }catch(e){}
 };
 window.__verClr=function(v){try{localStorage.removeItem(shotKey(v));render();}catch(e){}};
 window.__verZoom=function(src){let z=$('verzoom');if(z){const im=z.querySelector('img');if(im)im.src=src;z.classList.add('on');}};

 function css(){
  if($('v154css'))return;const s=document.createElement('style');s.id='v154css';s.textContent=`
  #ver_b .v2i{display:grid;grid-template-columns:200px 1fr;gap:16px;border:1px solid var(--bd,#2a3648);border-radius:14px;padding:12px;background:linear-gradient(180deg,rgba(255,255,255,.02),transparent);transition:border-color .15s,transform .15s}
  #ver_b .v2i:hover{border-color:#39527a}
  #ver_b .v2i.cur{border-color:#c9a144;box-shadow:0 0 0 1px #c9a14455 inset}
  #ver_b .v2thumb{position:relative;border-radius:10px;overflow:hidden;border:1px solid var(--bd,#2a3648);background:#0b111a;aspect-ratio:400/250}
  #ver_b .v2thumb img{width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in}
  #ver_b .v2badge{position:absolute;left:8px;top:8px;font:800 14px Inter,system-ui,Arial;color:#eaf3ff;background:rgba(10,13,18,.72);border:1px solid #2f86e8;border-radius:9px;padding:1px 8px}
  #ver_b .v2cur{position:absolute;right:8px;top:8px;font:700 10px Inter,system-ui,Arial;color:#0a0d12;background:#ffd24a;border-radius:9px;padding:2px 8px;letter-spacing:.04em}
  #ver_b .v2tools{position:absolute;right:6px;bottom:6px;display:flex;gap:4px;opacity:0;transition:opacity .15s}
  #ver_b .v2i:hover .v2tools{opacity:1}
  #ver_b .v2tools button{font-size:12px;line-height:1;padding:3px 6px;border-radius:7px;border:1px solid #2f86e8;background:rgba(10,13,18,.82);color:#cfe4ff;cursor:pointer}
  #ver_b .v2tools button:hover{background:#123a66}
  #ver_b .v2body{min-width:0}
  #ver_b .v2head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px}
  #ver_b .v2head b{font:700 15px Inter,system-ui,Arial;color:#e4eefa}
  #ver_b .v2date{font-size:11.5px;opacity:.6}
  #ver_b .v2body ul{margin:2px 0 0;padding-left:18px}
  #ver_b .v2body li{font-size:12.5px;line-height:1.5;margin:2px 0;opacity:.92}
  @media(max-width:620px){#ver_b .v2i{grid-template-columns:1fr}}
  `;document.head.appendChild(s);
 }

 function render(){
  const b=$('ver_b');if(!b||typeof ISO_VER==='undefined')return;css();
  b.innerHTML=ISO_VER.map(x=>{const cur=x.v===APP_VER;const propia=hasShot(x);
   return `<div class="v2i${cur?' cur':''}">`+
    `<div class="v2thumb"><img src="${thumbOf(x)}" alt="Miniatura v${E(x.v)}" onclick="__verZoom(this.src)">`+
    `<span class="v2badge">v${E(x.v)}</span>${cur?'<span class="v2cur">INSTALADA</span>':''}`+
    `<div class="v2tools"><button title="Usar una captura del plano actual como miniatura" onclick="__verCap('${E(x.v)}')">📷 Captura</button>${propia?`<button title="Quitar la captura y volver a la miniatura automática" onclick="__verClr('${E(x.v)}')">✕</button>`:''}</div>`+
    `</div>`+
    `<div class="v2body"><div class="v2head"><b>${E(x.t)}</b><span class="v2date">${E(x.f)}</span></div>`+
    `<ul>${(x.c||[]).map(c=>`<li>${E(c)}</li>`).join('')}</ul></div>`+
   `</div>`;
  }).join('');
 }

 /* re-render cuando el modal se abre */
 function hook(){
  const vo=$('verov');if(!vo||vo.__v154)return false;vo.__v154=1;
  const mo=new MutationObserver(()=>{if(vo.classList.contains('on'))render();});
  mo.observe(vo,{attributes:true,attributeFilter:['class']});
  if(vo.classList.contains('on'))render();
  return true;
 }
 let n=0;const iv=setInterval(()=>{n++;try{if(hook()||n>60)clearInterval(iv);}catch(e){if(n>60)clearInterval(iv);}},150);
 window.VER154={render};
})();
