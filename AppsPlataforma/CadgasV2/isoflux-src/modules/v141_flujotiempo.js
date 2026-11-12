/* ===== V33.24 · Unidades de flujo por tiempo (m³/h, m³/día, m³/mes) =====
   - En «Potencia nominal» se puede ingresar el consumo como flujo de gas: m³/h, m³/día o
     m³/mes (se convierten a potencia con el poder calorífico PCI del gas activo).
   - En el caudal se agregan m³/día y m³/mes además de m³/h.
   El sistema de unidades (v62) entrega siempre el valor en la unidad base del modelo, así que
   escribir el consumo en m³/día o m³/mes alimenta el cálculo ya convertido. */
(function(){
 const PCI=()=>{try{const p=(typeof CF!='undefined'&&+CF.pci)||10.4;return p>0?p:10.4;}catch(e){return 10.4;}}; /* kWh/m³ */
 function init(V){
  const D=V.D;if(!D)return false;let listo=true;
  /* --- POTENCIA (dim. W, base W): flujo de gas → potencia con PCI --- */
  if(D.W&&D.W.u&&!D.W.__fluj){D.W.__fluj=1;
   const F={'m³/h (gas)':()=>PCI()*1000,'m³/día (gas)':()=>PCI()*1000/24,'m³/mes (gas)':()=>PCI()*1000/720}; /* W por 1 unidad */
   Object.keys(F).forEach(u=>{try{Object.defineProperty(D.W.u,u,{get:F[u],enumerable:true,configurable:true});}catch(e){}});
   try{Object.assign(V.AL,{'m³/h (gas)':'m³/h (gas)','m3/h (gas)':'m³/h (gas)','m³/día (gas)':'m³/día (gas)','m³/dia (gas)':'m³/día (gas)','m3/dia (gas)':'m³/día (gas)','m³/mes (gas)':'m³/mes (gas)','m3/mes (gas)':'m³/mes (gas)'});}catch(e){}
   if(D.W.sel.indexOf('m³/h (gas)')<0)D.W.sel=D.W.sel.concat(['m³/h (gas)','m³/día (gas)','m³/mes (gas)']);
  }
  /* --- CAUDAL (dim. Q, base m³/s): agregar por día y por mes --- */
  if(D.Q&&D.Q.u&&!D.Q.__tmp){D.Q.__tmp=1;
   try{if(!('m³/día' in D.Q.u))D.Q.u['m³/día']=1/86400;if(!('m³/mes' in D.Q.u))D.Q.u['m³/mes']=1/2592000;}catch(e){}
   try{Object.assign(V.AL,{'m³/día':'m³/día','m³/dia':'m³/día','m3/dia':'m³/día','m³/mes':'m³/mes','m3/mes':'m³/mes'});}catch(e){}
   /* D.Q.sel puede ser un getter (lo define v133); se envuelve para incluir día y mes */
   try{const cur=Object.getOwnPropertyDescriptor(D.Q,'sel');
    if(cur&&cur.get){const g0=cur.get;Object.defineProperty(D.Q,'sel',{get(){const s=(g0.call(D.Q)||[]).slice();return s.indexOf('m³/día')<0?s.concat(['m³/día','m³/mes']):s;},configurable:true});}
    else if(Array.isArray(D.Q.sel)&&D.Q.sel.indexOf('m³/día')<0){D.Q.sel=D.Q.sel.concat(['m³/día','m³/mes']);}
   }catch(e){}
  }
  try{V.barrer&&V.barrer();}catch(e){}
  return !!(D.W&&D.W.__fluj&&D.Q&&D.Q.__tmp);
 }
 let k=0;const t=setInterval(()=>{try{if((window.V62u&&init(window.V62u))||++k>60)clearInterval(t);}catch(e){clearInterval(t);}},200);
})();
