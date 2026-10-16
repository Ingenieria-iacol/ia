/* ==== ENTALPÍA LAB · Kit estándar de aplicativos (Tecnologías Básicas) ====
   Fuente única: AppsPlataforma/_kit/entalpia-kit.js — se inserta en línea con _kit/aplicar_kit.py.
   Configuración por aplicativo en window.EK_CFG (se define antes de este script):
     app     nombre del aplicativo            sub     subtítulo de la cabecera
     ver     versión mostrada en el pie       norma   referencia normativa (texto)
     ayuda   HTML de la guía de uso           raiz    ruta relativa a la raíz del sitio ("../")
     alerta  false para conservar window.alert nativo
     pdf     false para no enmarcar los PDF de jsPDF
     marcoImpresion false si la app ya imprime su propio encabezado
     oscuro  true para aplicar el tema oscuro estándar a apps Tailwind claras
     informe título por defecto de los informes
   API pública: EK.modal, EK.alerta, EK.confirmar, EK.toast, EK.ayuda, EK.descargar,
                EK.marcoPDF(doc,{titulo}), EK.fecha(), EK.esc() */
(function () {
  'use strict';
  if (window.EK && window.EK.__v) return;
  var C = window.EK_CFG || {};
  var LOGO_ENT = window.EK_LOGO_ENT, LOGO_PIO = window.EK_LOGO_PIO;
  var PIE = "Hub de Ingeniería Pioneer's · un desarrollo de Industrias I.A. Col";
  var d = document;
  var EK = { __v: '1.0', cfg: C, LOGO_ENT: LOGO_ENT, LOGO_PIO: LOGO_PIO, PIE: PIE };
  window.EK = EK;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fecha() { var f = new Date(); return f.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' + f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }); }
  EK.esc = esc; EK.fecha = fecha;

  /* ---------- cabecera y pie ---------- */
  function montar() {
    if (d.querySelector('.ek-hdr')) return;
    d.documentElement.classList.add('ek');
    if (C.pie === false) d.documentElement.classList.add('ek-sinpie');
    var h = d.createElement('header');
    h.className = 'ek-hdr';
    h.setAttribute('data-ek', '');
    h.innerHTML =
      '<img class="ek-logo" alt="Entalpía" src="' + LOGO_ENT + '">' +
      '<div class="ek-tit"><b>' + esc(C.app || d.title) + '</b><span>' + esc(C.sub || 'ENTALPÍA LAB · Tecnologías Básicas') + '</span></div>' +
      '<div class="ek-sp"></div>' +
      (C.ayuda ? '<button type="button" class="ek-hbtn" data-ek-ayuda title="Guía de uso, método de cálculo y referencias"><span>?</span><span class="ek-lbl">Ayuda</span></button>' : '') +
      '<button type="button" class="ek-hbtn" data-ek-volver title="Volver a la plataforma"><span>⌂</span><span class="ek-lbl">Plataforma</span></button>';
    d.body.insertBefore(h, d.body.firstChild);
    if (C.pie !== false) {
      var f = d.createElement('footer');
      f.className = 'ek-ftr';
      f.setAttribute('data-ek', '');
      f.innerHTML = '<img alt="Hub de Ingeniería Pioneer\'s" src="' + LOGO_PIO + '"><span>' + PIE + '</span><div class="ek-sp"></div><span class="ek-hide-m">ENTALPÍA LAB · ' + esc(C.app || '') + (C.ver ? ' · v' + esc(C.ver) : '') + '</span>';
      d.body.appendChild(f);
    }
    // bloques de impresión (navegador → PDF) para las vistas que la app imprime por su cuenta
    if (C.marcoImpresion !== false) {
    var pc = d.createElement('div');
    pc.className = 'ek-print ek-print-cab';
    pc.innerHTML = '<img alt="Entalpía" src="' + LOGO_ENT + '"><div><h1>' + esc(C.informe || C.app || d.title) + '</h1><div>ENTALPÍA LAB · ' + esc(C.app || '') + (C.norma ? ' · ' + esc(C.norma) : '') + ' · <span data-ek-fecha></span></div></div>';
    d.body.insertBefore(pc, h.nextSibling);
    var pp = d.createElement('div');
    pp.className = 'ek-print ek-print-pie';
    pp.setAttribute('data-ek', '');
    pp.innerHTML = '<img alt="Pioneer\'s" src="' + LOGO_PIO + '"><span>' + PIE + ' · ' + esc(C.app || '') + (C.ver ? ' v' + esc(C.ver) : '') + '. Resultado de apoyo técnico: debe ser revisado por un profesional competente antes de usarse en obra.</span>';
    // el pie de impresión va al final del documento: si aún se está leyendo el HTML, se espera
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { d.body.appendChild(pp); });
    else d.body.appendChild(pp);
    }
    window.addEventListener('beforeprint', function () {
      var s = d.querySelectorAll('[data-ek-fecha]');
      for (var i = 0; i < s.length; i++) s[i].textContent = fecha();
    });
    h.addEventListener('click', function (e) {
      if (e.target.closest('[data-ek-ayuda]')) EK.ayuda();
      if (e.target.closest('[data-ek-volver]')) volver();
    });
  }
  function volver() {
    var dest = (C.raiz || '../') + 'index.html';
    try { if (d.referrer && new URL(d.referrer).origin === location.origin && history.length > 1) { history.back(); return; } } catch (e) {}
    location.href = dest;
  }
  EK.volver = volver;

  /* ---------- modales ---------- */
  var abiertos = [];
  function arrastrable(box, asa) {
    var x0, y0, dx = 0, dy = 0, mov = false;
    asa.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button,a,input,select,textarea')) return;
      mov = true; x0 = e.clientX - dx; y0 = e.clientY - dy;
      try { asa.setPointerCapture(e.pointerId); } catch (er) {}
    });
    asa.addEventListener('pointermove', function (e) {
      if (!mov) return;
      dx = e.clientX - x0; dy = e.clientY - y0;
      box.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    });
    function fin() { mov = false; }
    asa.addEventListener('pointerup', fin); asa.addEventListener('pointercancel', fin);
  }
  /* EK.modal({titulo, html|nodo, ancho, botones:[{t, cls, fn(cerrar)->false para no cerrar}], alCerrar, cerrarFondo})
     Devuelve {el, cuerpo, cerrar}. */
  EK.modal = function (o) {
    o = o || {};
    var m = d.createElement('div');
    m.className = 'ek-modal on';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="ek-mbox"' + (o.ancho ? ' style="max-width:' + o.ancho + 'px"' : '') + '>' +
      '<div class="ek-mhd"><b>' + esc(o.titulo || '') + '</b><div class="ek-sp"></div><span class="ek-mhd-extra"></span><button type="button" class="ek-x" title="Cerrar" aria-label="Cerrar">×</button></div>' +
      '<div class="ek-mbd"></div>' + ((o.botones && o.botones.length) ? '<div class="ek-mft"></div>' : '') + '</div>';
    var box = m.firstChild, cuerpo = m.querySelector('.ek-mbd');
    if (o.nodo) cuerpo.appendChild(o.nodo); else cuerpo.innerHTML = o.html || '';
    var cerrado = false;
    function cerrar(v) {
      if (cerrado) return; cerrado = true;
      m.remove();
      abiertos = abiertos.filter(function (x) { return x !== api; });
      if (o.alCerrar) o.alCerrar(v);
    }
    var api = { el: m, cuerpo: cuerpo, cerrar: cerrar, cabecera: m.querySelector('.ek-mhd-extra') };
    (o.botones || []).forEach(function (b) {
      var bt = d.createElement('button');
      bt.type = 'button';
      bt.className = 'ek-btn ' + (b.cls || '');
      bt.textContent = b.t;
      bt.onclick = function () { var r = b.fn ? b.fn(cerrar) : undefined; if (r !== false) cerrar(b.v); };
      m.querySelector('.ek-mft').appendChild(bt);
    });
    m.querySelector('.ek-x').onclick = function () { cerrar(o.vCerrar); };
    if (o.cerrarFondo !== false) m.addEventListener('mousedown', function (e) { if (e.target === m) cerrar(o.vCerrar); });
    arrastrable(box, m.querySelector('.ek-mhd'));
    (d.body || d.documentElement).appendChild(m);
    abiertos.push(api);
    var f = m.querySelector('.ek-mft .pri') || m.querySelector('.ek-mft .ek-btn');
    if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 30);
    return api;
  };
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && abiertos.length) { abiertos[abiertos.length - 1].cerrar(); e.stopPropagation(); }
  }, true);

  EK.alerta = function (msg, titulo) {
    var txt = String(msg == null ? '' : msg);
    var tipo = /error|no se pudo|inválid|invalid|falt|debe|⚠|❌/i.test(txt) ? 'wa' : '';
    return new Promise(function (res) {
      EK.modal({
        titulo: titulo || C.app || 'Aviso', ancho: 460,
        html: '<div class="ek-note ' + tipo + '" style="white-space:pre-wrap;margin:0">' + esc(txt) + '</div>',
        botones: [{ t: 'Aceptar', cls: 'pri' }], alCerrar: function () { res(); }
      });
    });
  };
  EK.confirmar = function (titulo, texto, si, no) {
    return new Promise(function (res) {
      EK.modal({
        titulo: titulo || 'Confirmar', ancho: 460, vCerrar: false,
        html: '<p style="white-space:pre-wrap;margin:0">' + esc(texto || '') + '</p>',
        botones: [{ t: no || 'Cancelar', v: false }, { t: si || 'Aceptar', cls: 'pri', v: true }],
        alCerrar: function (v) { res(!!v); }
      });
    });
  };
  EK.toast = function (msg, ms) {
    var t = d.getElementById('ek-toast');
    if (!t) { t = d.createElement('div'); t.id = 'ek-toast'; d.body.appendChild(t); }
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._t); t._t = setTimeout(function () { t.style.display = 'none'; }, ms || 3500);
  };
  EK.descargar = function (nombre, contenido, tipo) {
    var b = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo || 'text/plain;charset=utf-8' });
    var a = d.createElement('a');
    a.href = URL.createObjectURL(b); a.download = nombre;
    d.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };

  /* ---------- guía de uso ---------- */
  function guiaHTML() {
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guía de uso · ' + esc(C.app) + '</title>' +
      '<style>body{font:15px/1.55 "Segoe UI",Arial,sans-serif;max-width:840px;margin:24px auto;padding:0 16px;color:#1b2533}h1{color:#173a6b;font-size:22px;margin:0}h3{color:#1d4f8f;margin-top:22px}' +
      'header{display:flex;align-items:center;gap:14px;border-bottom:2px solid #1d4f8f;padding-bottom:10px;margin-bottom:14px}header img{height:56px}footer{display:flex;align-items:center;gap:10px;border-top:1px solid #c8d3e2;margin-top:28px;padding-top:8px;font-size:12.5px;color:#555}footer img{height:30px}' +
      'code,.ek-f{font-family:Consolas,monospace;background:#eef3fa;border:1px solid #c8d3e2;border-radius:5px;padding:1px 5px;font-size:13px}.ek-f{display:block;padding:6px 9px;margin:6px 0;white-space:pre-wrap}' +
      'table{border-collapse:collapse;width:100%;font-size:13.5px}th,td{border:1px solid #c8d3e2;padding:4px 6px;text-align:left}th{background:#eaf1fa}.ek-note{border-left:3px solid #2f86e8;background:#f2f7fd;padding:6px 9px;margin:8px 0}.ek-note.wa{border-color:#e8b23a;background:#fdf8ea}</style></head><body>' +
      '<header><img src="' + LOGO_ENT + '" alt="Entalpía"><div><h1>Guía de uso · ' + esc(C.app) + '</h1><div>ENTALPÍA LAB · Tecnologías Básicas' + (C.ver ? ' · v' + esc(C.ver) : '') + '</div></div></header>' +
      (C.ayuda || '') +
      '<footer><img src="' + LOGO_PIO + '" alt="Pioneer\'s"><span>' + PIE + ' · ' + esc(C.app) + '. Guía generada el ' + fecha() + '.</span></footer></body></html>';
  }
  EK.ayuda = function () {
    var md = EK.modal({ titulo: 'Guía de uso · ' + (C.app || ''), html: C.ayuda || '<p>Sin guía.</p>', ancho: 780 });
    var b = d.createElement('button');
    b.type = 'button'; b.className = 'ek-btn sm'; b.textContent = 'Descargar guía';
    b.onclick = function () { EK.descargar('Guia_de_uso_' + String(C.app || 'aplicativo').replace(/[^\wáéíóúñÁÉÍÓÚÑ]+/g, '_') + '_Entalpia_Lab.html', guiaHTML(), 'text/html;charset=utf-8'); };
    md.cabecera.appendChild(b);
    return md;
  };

  /* ---------- informe estándar (Imprimir / Guardar como PDF) ----------
     EK.informe({
       titulo, subtitulo,
       datos:[[etiqueta, valor], ...],                       // identificación del proyecto
       secciones:[{titulo, cabeza:[...], filas:[[...],...], numeros:[índices de columnas numéricas],
                   formula:'texto', texto:'texto', html:'html propio'}],
       veredicto:{tipo:'ok'|'no'|'wa', txt:'...'},
       notas:['...'], firmas:true|['Elaboró','Revisó'] })
     Abre el diálogo de impresión del navegador; el usuario elige "Guardar como PDF". */
  EK.informe = function (o) {
    o = o || {};
    var h = [];
    h.push('<div class="rh"><img src="' + LOGO_ENT + '" alt="Entalpía"><div><h1>' + esc(o.titulo || C.informe || C.app) + '</h1><div>' +
      esc(o.subtitulo || ('ENTALPÍA LAB · ' + (C.app || '') + (C.norma ? ' · ' + C.norma : ''))) + ' · Generado: ' + fecha() + '</div></div></div>');
    if (o.datos && o.datos.length) {
      h.push('<table><tbody>');
      for (var i = 0; i < o.datos.length; i += 2) {
        var a = o.datos[i], b = o.datos[i + 1];
        h.push('<tr><th style="width:18%">' + esc(a[0]) + '</th><td style="width:32%">' + esc(a[1] == null || a[1] === '' ? '—' : a[1]) + '</td>' +
          (b ? '<th style="width:18%">' + esc(b[0]) + '</th><td style="width:32%">' + esc(b[1] == null || b[1] === '' ? '—' : b[1]) + '</td>' : '<td colspan="2"></td>') + '</tr>');
      }
      h.push('</tbody></table>');
    }
    (o.secciones || []).forEach(function (s) {
      if (!s) return;
      if (s.titulo) h.push('<h2>' + esc(s.titulo) + '</h2>');
      if (s.texto) h.push('<div class="txt">' + esc(s.texto) + '</div>');
      if (s.formula) h.push('<div class="fm">' + esc(s.formula) + '</div>');
      if (s.filas && s.filas.length) {
        var nums = s.numeros || [];
        h.push('<table>');
        if (s.cabeza) h.push('<thead><tr>' + s.cabeza.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead>');
        h.push('<tbody>' + s.filas.map(function (f) {
          return '<tr>' + f.map(function (c, j) {
            var cls = nums.indexOf(j) >= 0 ? ' class="n"' : '';
            if (c && typeof c === 'object' && 'v' in c) return '<td class="' + (c.cls || '') + (nums.indexOf(j) >= 0 ? ' n' : '') + '">' + esc(c.v) + '</td>';
            return '<td' + cls + '>' + esc(c == null ? '' : c) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table>');
      }
      if (s.html) h.push(s.html);
    });
    if (o.veredicto) h.push('<div class="ver ' + (o.veredicto.tipo || '') + '">' + esc(o.veredicto.txt) + '</div>');
    if (o.notas && o.notas.length) h.push('<h2>Observaciones</h2><ul>' + o.notas.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>');
    if (o.firmas) {
      var f = o.firmas === true ? ['Elaboró', 'Revisó / Aprobó'] : o.firmas;
      h.push('<table class="firmas" style="margin-top:16px"><tr>' + f.map(function (x) { return '<td>__________________________<br>' + esc(x) + '<br>Nombre, matrícula y firma</td>'; }).join('') + '</tr></table>');
    }
    h.push('<div class="pie"><img src="' + LOGO_PIO + '" alt="Pioneer\'s"><span>' + PIE + ' · ' + esc(C.app || '') + (C.ver ? ' v' + esc(C.ver) : '') +
      '. Resultado de apoyo técnico generado por software: debe ser verificado por un profesional competente' + (C.norma ? ' frente a ' + esc(C.norma) + ' vigente' : '') + '.</span></div>');
    var r = d.getElementById('ek-reporte');
    if (!r) { r = d.createElement('div'); r.id = 'ek-reporte'; d.body.appendChild(r); }
    r.innerHTML = h.join('');
    d.documentElement.classList.add('ek-informe');
    var t0 = d.title;
    if (o.archivo) d.title = o.archivo;
    function fin() { d.documentElement.classList.remove('ek-informe'); d.title = t0; window.removeEventListener('afterprint', fin); }
    window.addEventListener('afterprint', fin);
    setTimeout(function () { window.print(); setTimeout(fin, 500); }, 120);
  };

  /* ---------- marco estándar para PDF de jsPDF ----------
     Reduce el contenido de cada página para dejar espacio a la franja de cabecera (logo Entalpía, título)
     y al pie (texto del Hub, paginación, logo Pioneer's), igual que los informes de Isoflux. */
  EK.marcoPDF = function (doc, o) {
    if (!doc || doc.__ekMarco) return doc;
    doc.__ekMarco = true;
    o = o || {};
    try {
      var n = doc.getNumberOfPages(), k = doc.internal.scaleFactor;
      var tit = o.titulo || C.informe || C.app || 'Informe';
      var sub = 'ENTALPÍA LAB · ' + (C.app || '') + (C.norma ? ' · ' + C.norma : '') + ' · ' + fecha();
      var TOP = 50, BOT = 30; // pt
      for (var i = 1; i <= n; i++) {
        doc.setPage(i);
        var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
        var Wp = W * k, Hp = H * k;
        var s = (Hp - TOP - BOT) / Hp;
        var tx = (Wp - s * Wp) / 2, ty = BOT + ((Hp - TOP - BOT) - s * Hp) / 2;
        var pg = doc.internal.pages[i];
        if (pg && pg.unshift) { pg.unshift('q ' + s.toFixed(5) + ' 0 0 ' + s.toFixed(5) + ' ' + tx.toFixed(3) + ' ' + ty.toFixed(3) + ' cm'); pg.push('Q'); }
        var u = function (pt) { return pt / k; };
        doc.setFillColor(12, 17, 26); doc.rect(0, 0, W, u(TOP - 6), 'F');
        doc.setFillColor(30, 95, 191); doc.rect(0, u(TOP - 6), W, u(1.6), 'F');
        try { doc.addImage(LOGO_ENT, 'JPEG', u(14), u(4), u(40), u(35)); } catch (e) {}
        doc.setFont('helvetica', 'bold'); doc.setTextColor(190, 225, 255); doc.setFontSize(13);
        doc.text(String(tit).slice(0, 90), u(64), u(20));
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(150, 175, 205);
        doc.text(sub.slice(0, 150), u(64), u(33));
        doc.setDrawColor(30, 95, 191); doc.setLineWidth(u(0.8));
        doc.line(u(22), H - u(BOT - 4), W - u(22), H - u(BOT - 4));
        doc.setTextColor(80, 80, 80); doc.setFontSize(7.5);
        doc.text(PIE + ' · ' + (C.app || ''), u(22), H - u(12));
        doc.text('Pág. ' + i + '/' + n, W - u(52), H - u(12), { align: 'right' });
        try { doc.addImage(LOGO_PIO, 'JPEG', W - u(46), H - u(BOT - 6), u(26), u(21)); } catch (e) {}
      }
      doc.setTextColor(0, 0, 0); doc.setDrawColor(0, 0, 0); doc.setFillColor(255, 255, 255);
      doc.setPage(n);
    } catch (e) { if (window.console) console.warn('EK.marcoPDF', e); }
    return doc;
  };
  function enganchaJsPDF() {
    if (C.pdf === false) return true;
    var ns = window.jspdf, Orig = ns && ns.jsPDF;
    if (!Orig || Orig.__ek) return !!(Orig && Orig.__ek);
    function envolver(doc) {
      ['save', 'output'].forEach(function (m) {
        var f = doc[m];
        if (typeof f !== 'function') return;
        doc[m] = function () { EK.marcoPDF(doc); return f.apply(doc, arguments); };
      });
      return doc;
    }
    function J(a, b, c, e) { var doc = new Orig(a, b, c, e); return envolver(doc); }
    J.prototype = Orig.prototype;
    Object.keys(Orig).forEach(function (kk) { try { J[kk] = Orig[kk]; } catch (er) {} });
    J.API = Orig.API; J.version = Orig.version; J.__ek = true; J.__orig = Orig;
    ns.jsPDF = J;
    if (window.jsPDF === Orig) window.jsPDF = J;
    return true;
  }
  EK.enganchaJsPDF = enganchaJsPDF;

  /* ---------- arranque ---------- */
  d.documentElement.classList.add('ek');
  if (C.oscuro) d.documentElement.classList.add('ek-oscuro');
  if (C.alerta !== false) {
    var alertaNativa = window.alert;
    EK.alertaNativa = alertaNativa;
    window.alert = function (m) { if (!d.body) return alertaNativa.call(window, m); EK.alerta(m); };
  }
  if (!enganchaJsPDF()) {
    var tries = 0, iv = setInterval(function () { if (enganchaJsPDF() || ++tries > 40) clearInterval(iv); }, 250);
    window.addEventListener('load', enganchaJsPDF);
  }
  function bordesOscuros() {
    // Tailwind (preflight) pinta todos los bordes "sin color" en gris claro; en el tema oscuro se
    // reemplaza con especificidad cero y al final del documento, para no pisar los bordes de color.
    if (!C.oscuro || d.getElementById('ek-oscuro-base')) return;
    var s = d.createElement('style');
    s.id = 'ek-oscuro-base';
    s.textContent = '@media screen{:where(html.ek-oscuro) *,:where(html.ek-oscuro) ::before,:where(html.ek-oscuro) ::after{border-color:#2a3648}}';
    d.body.appendChild(s);
  }
  if (d.body) montar(); else d.addEventListener('DOMContentLoaded', montar);
  if (d.readyState === 'complete') bordesOscuros(); else window.addEventListener('load', bordesOscuros);
})();
