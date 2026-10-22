/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PUBLICAR CAMBIOS (léelo antes de tocar «Implementar»)                    ║
 * ║  La ÚNICA implementación que usan Isoflux y el Portal es la de producción: ║
 * ║    ID …Ary8eET5N08  (AKfycbzPsHZ7…)                                       ║
 * ║  1) Guardar (💾).  2) Implementar ▸ Gestionar implementaciones.           ║
 * ║  3) Seleccionar la de ID …Ary8eET5N08 ▸ ✏️ Editar ▸ Versión: Nueva versión ║
 * ║     ▸ Implementar.                                                        ║
 * ║  NUNCA «Nueva implementación»: crea otra URL y Isoflux no la conoce.      ║
 * ║  Isoflux avisa si el servidor publicado quedó desactualizado              ║
 * ║  (compara ISO_BACKEND con la versión que espera).                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
const ISO_BACKEND = '21.0';
/**
 * ============================================================================
 *  Isoflux_Planos.gs — Planos de Isoflux guardados dentro de los proyectos del
 *  Portal de Proyectos (SGC). Industrias I.A. Col · ENTALPIA LABS · V01 (2026-10-11)
 * ============================================================================
 *
 *  QUÉ HACE
 *  - Cada dibujo de Isoflux se guarda en la nube asignado a un proyecto del portal.
 *    Se ve en la ficha del proyecto y se abre desde allí, sin cargar archivos .json.
 *  - Cada "Guardar" crea una VERSIÓN nueva (v1, v2, v3…) con su huella SHA-256; las
 *    anteriores se conservan (control de cambios del SGC). Nada se borra: un plano
 *    que ya no se usa se ARCHIVA y el administrador puede restaurarlo.
 *  - Si dos personas editan el mismo plano, el segundo en guardar recibe un aviso
 *    de conflicto en lugar de sobrescribir sin saberlo.
 *  - Los archivos quedan en Drive, en la carpeta del portal › "Isoflux · Planos" ›
 *    una subcarpeta por proyecto. No se comparten: solo se entregan por el portal
 *    a quien puede ver el proyecto.
 *  - La versión vigente de cada plano entra al paquete "Paquetizar y entregar".
 *
 *  CÓMO SE INSTALA
 *  1) Crear en el mismo proyecto de Apps Script un archivo de script llamado
 *     Isoflux_Planos y pegar todo esto.
 *  2) Reemplazar SIG_Miembros por la versión del repositorio (ya trae las hojas
 *     Planos y PlanosVersiones y el enlace a este módulo en su router).
 *  3) Implementar › Gestionar implementaciones › editar › Versión nueva › Implementar.
 *  Las hojas Planos y PlanosVersiones se crean solas.
 * ============================================================================
 */

const ISO = {
  CARPETA: 'Isoflux · Planos',
  MAX_BYTES: 45 * 1024 * 1024,     // tamaño máximo del dibujo (con fondos)
  MINI_MAX: 48000,                 // miniatura (data URL) que cabe en una celda
};

/** Router de las acciones sgcPlano* (lo llama sigApi). */
function isoApi_(u, b) {
  switch (b.a) {
    case 'sgcPlanoProyectos':  return isoProyectos_(u);
    case 'sgcPlanosListar':    return isoListar_(u, b.proyectoId, b.archivados);
    case 'sgcPlanoLeer':       return isoLeer_(u, b.planoId, b.version);
    case 'sgcPlanoGuardar':    return isoGuardar_(u, b);
    case 'sgcPlanoVersiones':  return isoVersiones_(u, b.planoId);
    case 'sgcPlanoRenombrar':  return isoRenombrar_(u, b.planoId, b.nombre);
    case 'sgcPlanoArchivar':   return isoArchivar_(u, b.planoId, b.archivar !== false);
    case 'sgcPlanoTrabajoGuardar': return isoPlanGuardar_(u, b);
    case 'sgcPlanoVigente':    return isoVigente_(u, b.planoId, b.version);
    case 'sgcPlanoLive':       return isoLive_(u, b);
    case 'sgcPlanoBorrador':   return isoBorrador_(u, b);
    case 'sgcPlanoBorradorLeer': return isoBorradorLeer_(u, b.planoId);
    case 'sgcPlanoTrabajoLeer':    return isoPlanLeer_(u, b.proyectoId);
    case 'sgcPlanoPrecios':    return isoPrecios_(u, b);
    case 'sgcPlanoNormasListar':  return isoNormasListar_(u);
    case 'sgcPlanoNormasLeer':    return isoNormasLeer_(u, b.id);
    case 'sgcPlanoNormasGuardar': return isoNormasGuardar_(u, b);
    case 'sgcPlanoNormasEliminar':return isoNormasEliminar_(u, b.id);
    case 'sgcPlanoMover':      return isoMover_(u, b.planoId, b.proyectoId);
    case 'sgcPlanoCowork':     return isoCowork_(u, b);
    case 'sgcPlanoCampo':      return isoCampo_(u, b);
    case 'sgcPlanoServidor':   return { version: ISO_BACKEND, implementacion: ScriptApp.getService().getUrl() };
  }
  return { error: 'Acción no permitida.' };
}

// ---------- ACCESO ----------
function isoVe_(u, p) {
  if (u.rol === 'admin' || p.owner === u.email) return true;
  if (String(p.miembros || '').toLowerCase().split(',').map(z => z.trim()).indexOf(String(u.email).toLowerCase()) >= 0) return true;
  const v = sigVinculo_(u.email);
  return !!(v && p.miembroId && p.miembroId === v.miembroId);
}
/** «Mis dibujos»: espacio personal de cada usuario (proyecto virtual MD-<correo>). Solo lo ve su dueño y el administrador. */
const isoMisId_ = email => 'MD-' + String(email || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
function isoProy_(u, proyectoId) {
  const id = String(proyectoId || '');
  if (id === 'MIS' || id.indexOf('MD-') === 0) {
    const mio = isoMisId_(u.email), pid = id === 'MIS' ? mio : id;
    if (pid !== mio && u.rol !== 'admin') throw new Error('No tienes acceso a esos dibujos.');
    return { id: pid, titulo: pid === mio ? 'Mis dibujos' : 'Mis dibujos · ' + pid.slice(3), cliente: '', ubicacion: '', owner: pid === mio ? u.email : '', miembroId: '', personal: true };
  }
  return sigProyectoVisible_(u, id);
}
function isoPlano_(u, planoId) {
  const x = sigLeer_('Planos').find(r => r.planoId === planoId);
  if (!x) throw new Error('Plano no encontrado.');
  const p = isoProy_(u, x.proyectoId);
  return { x: x, p: p };
}
const isoFecha_ = f => f instanceof Date ? f.toISOString() : String(f || '');
function isoMeta_(x) {
  return { planoId: x.planoId, proyectoId: String(x.proyectoId), nombre: x.nombre, version: +x.version || 0, bytes: +x.bytes || 0,
    nodos: +x.nodos || 0, tuberias: +x.tuberias || 0, fondos: +x.fondos || 0, sha256: x.sha256, autor: x.autor, email: x.email,
    creado: isoFecha_(x.creado), actualizado: isoFecha_(x.actualizado), actualizadoPor: x.actualizadoPor, estado: x.estado || 'vigente',
    miniatura: String(x.miniatura || ''), nota: x.nota || '', vigente: +x.vigente || +x.version || 0, vigentePor: x.vigentePor || '', vigenteFecha: isoFecha_(x.vigenteFecha),
    enLinea: isoPresentes_(x.planoId).length };
}
const isoNom_ = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
/** La vigencia la decide el desarrollador del plano (quien lo creó) o el administrador. */
function isoPuedeVigencia_(u, x) { return u.rol === 'admin' || String(x.email).toLowerCase() === String(u.email).toLowerCase(); }
function isoPuedeArchivar_(u, x, p) { return u.rol === 'admin' || p.owner === u.email || x.email === u.email; }

// ---------- CONSULTAS ----------
/** Proyectos que el usuario puede ver, con su número de planos (para el selector de Isoflux). */
function isoProyectos_(u) {
  const cnt = {};
  sigLeer_('Planos').forEach(x => { if (x.estado !== 'archivado') cnt[x.proyectoId] = (cnt[x.proyectoId] || 0) + 1; });
  const ps = rows('Proyectos').filter(p => isoVe_(u, p)).map(p => ({ id: String(p.id), titulo: p.titulo, cliente: p.cliente || '', tipo: p.tipo || '',
    estado: p.estado || '', ubicacion: p.ubicacion || '', owner: p.owner, planos: cnt[String(p.id)] || 0, actualizado: isoFecha_(p.actualizado || p.creado) }));
  const mis = isoMisId_(u.email);
  return { proyectos: ps.reverse(), mis: { id: mis, titulo: 'Mis dibujos', planos: cnt[mis] || 0 }, usuario: { email: u.email, nombre: u.nombre || u.email, rol: u.rol } };
}
function isoListar_(u, proyectoId, archivados) {
  const p = isoProy_(u, proyectoId);
  const lista = sigLeer_('Planos').filter(x => String(x.proyectoId) === String(p.id) && (archivados || x.estado !== 'archivado'))
    .sort((a, b) => String(isoFecha_(b.actualizado)).localeCompare(String(isoFecha_(a.actualizado))))
    .map(x => Object.assign(isoMeta_(x), { puedeArchivar: isoPuedeArchivar_(u, x, p), puedeVigencia: isoPuedeVigencia_(u, x) }));
  return { proyecto: { id: String(p.id), titulo: p.titulo, cliente: p.cliente || '', ubicacion: p.ubicacion || '', personal: !!p.personal }, planos: lista };
}
function isoVersiones_(u, planoId) {
  const o = isoPlano_(u, planoId);
  const vs = sigLeer_('PlanosVersiones').filter(v => v.planoId === planoId).sort((a, b) => (+b.version) - (+a.version))
    .map(v => ({ version: +v.version, bytes: +v.bytes || 0, sha256: v.sha256, autor: v.autor, email: v.email, fecha: isoFecha_(v.fecha), nota: v.nota || '' }));
  return { plano: isoMeta_(o.x), versiones: vs, vigente: +o.x.vigente || +o.x.version, puedeVigencia: isoPuedeVigencia_(u, o.x) };
}
/** Devuelve el contenido del dibujo comprimido (gzip en base64). */
function isoLeer_(u, planoId, version) {
  const o = isoPlano_(u, planoId);
  let fid = o.x.fileId, ver = +o.x.version;
  if (version && +version !== ver) {
    const v = sigLeer_('PlanosVersiones').find(r => r.planoId === planoId && +r.version === +version);
    if (!v) throw new Error('Versión no encontrada.');
    fid = v.fileId; ver = +v.version;
  }
  const blob = DriveApp.getFileById(fid).getBlob();
  const z = Utilities.gzip(blob);
  sigBitacora_(u.email, o.p.miembroId || '', 'plano_abierto', { proyecto: String(o.p.id), plano: planoId, version: ver });
  return { plano: isoMeta_(o.x), versionLeida: ver, z: 1, b64: Utilities.base64Encode(z.getBytes()) };
}

// ---------- GUARDAR ----------
function isoCarpeta_(p) {
  const raiz = DriveApp.getFolderById(SIG.CARPETA_RAIZ_ID);
  const it = raiz.getFoldersByName(ISO.CARPETA), base = it.hasNext() ? it.next() : raiz.createFolder(ISO.CARPETA);
  const nom = 'P-' + p.id;
  const sub = base.getFolders();
  while (sub.hasNext()) { const f = sub.next(); if (f.getName().indexOf(nom + ' ') === 0 || f.getName() === nom) return f; }
  return base.createFolder((nom + ' ' + String(p.titulo || '')).replace(/[\\/:*?"<>|]/g, '_').slice(0, 120));
}
function isoGuardar_(u, b) {
  const p = isoProy_(u, b.proyectoId);
  let bytes;
  if (b.z) bytes = Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(String(b.b64 || '')), 'application/x-gzip')).getBytes();
  else bytes = Utilities.newBlob(String(b.json || '')).getBytes();
  if (!bytes.length) throw new Error('No llegó el dibujo.');
  if (bytes.length > ISO.MAX_BYTES) throw new Error('El dibujo supera 45 MB. Guárdalo sin fondos o con menos imágenes.');
  try { const d = JSON.parse(Utilities.newBlob(bytes).getDataAsString()); if (!d || !Array.isArray(d.nodes)) throw 0; }
  catch (e) { throw new Error('El contenido no es un dibujo de Isoflux válido.'); }
  const nombre = String(b.nombre || '').trim().slice(0, 120) || 'Plano sin nombre';
  const nota = String(b.nota || '').trim().slice(0, 300);
  const mini = String(b.miniatura || '');
  const sha = sigShaBytes_(bytes), ahora = sigAhora_(), autor = String(u.nombre || u.email).slice(0, 80);
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    let x = b.planoId ? sigLeer_('Planos').find(r => r.planoId === b.planoId) : null;
    if (b.planoId && !x) throw new Error('Plano no encontrado.');
    if (x && String(x.proyectoId) !== String(p.id)) throw new Error('El plano pertenece a otro proyecto.');
    if (x && x.estado === 'archivado') throw new Error('El plano está archivado. Restáuralo desde el portal o guárdalo como plano nuevo.');
    if (x && !b.forzar && +b.baseVersion !== +x.version)
      return { conflicto: true, version: +x.version, por: x.actualizadoPor, fecha: isoFecha_(x.actualizado) };
    if (x && x.sha256 === sha && x.nombre === nombre) return { plano: isoMeta_(x), sinCambios: true };
    /* no puede haber dos planos con el mismo nombre en el proyecto (nombre + versión es único) */
    const dup = sigLeer_('Planos').find(r => String(r.proyectoId) === String(p.id) && r.estado !== 'archivado' && isoNom_(r.nombre) === isoNom_(nombre) && (!x || r.planoId !== x.planoId));
    if (dup) throw new Error('Ya existe un plano llamado «' + dup.nombre + '» en este proyecto (v' + dup.version + '). Ábrelo y guarda una versión nueva, o usa otro nombre.');
    const planoId = x ? x.planoId : 'PL-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    const version = x ? (+x.version + 1) : 1;
    const f = isoCarpeta_(p).createFile(Utilities.newBlob(bytes, 'application/json',
      (planoId + '_v' + version + ' - ' + nombre).replace(/[\\/:*?"<>|]/g, '_').slice(0, 150) + '.json'));
    f.setDescription('Isoflux · ' + nombre + ' · v' + version + ' · ' + autor + ' · SHA-256 ' + sha);
    const fila = { planoId: planoId, proyectoId: String(p.id), nombre: nombre, version: version, fileId: f.getId(), bytes: bytes.length,
      nodos: +b.nodos || 0, tuberias: +b.tuberias || 0, fondos: +b.fondos || 0, sha256: sha, actualizado: ahora, actualizadoPor: autor,
      estado: x ? (x.estado || 'vigente') : 'vigente', miniatura: mini.length <= ISO.MINI_MAX && /^data:image\//.test(mini) ? mini : (x ? x.miniatura : ''), nota: nota };
    const fija = x && String(x.vigenteFijada || '') === '1';
    if (!x || (isoPuedeVigencia_(u, x) && b.vigente !== false && !fija)) Object.assign(fila, { vigente: version, vigentePor: autor, vigenteFecha: ahora, vigenteFijada: '' });
    if (x && +(sigLeer_('PlanosVersiones').find(v => v.planoId === planoId && +v.version === version) || {}).version === version) throw new Error('La versión v' + version + ' ya existe. Vuelve a abrir el plano.');
    if (x) sigActualizar_('Planos', x._fila, fila);
    else sigAgregar_('Planos', Object.assign(fila, { autor: autor, email: u.email, creado: ahora }));
    sigAgregar_('PlanosVersiones', { planoId: planoId, version: version, fileId: f.getId(), bytes: bytes.length, sha256: sha, autor: autor, email: u.email, fecha: ahora, nota: nota });
    sigBitacora_(u.email, p.miembroId || '', x ? 'plano_version' : 'plano_creado', { proyecto: String(p.id), plano: planoId, nombre: nombre, version: version, sha256: sha });
    CacheService.getScriptCache().put('v_' + p.id, String(Date.now()), 21600);
    const nuevo = sigLeer_('Planos').find(r => r.planoId === planoId);
    return { plano: isoMeta_(nuevo) };
  } finally { lock.releaseLock(); }
}
/** Pasa un plano (normalmente de «Mis dibujos») a un proyecto del SGC conservando todas sus versiones y su trazabilidad. */
function isoMover_(u, planoId, proyectoId) {
  const o = isoPlano_(u, planoId), dest = isoProy_(u, proyectoId);
  if (String(dest.id) === String(o.x.proyectoId)) return { plano: isoMeta_(o.x) };
  if (u.rol !== 'admin' && String(o.x.email).toLowerCase() !== String(u.email).toLowerCase()) throw new Error('Solo quien creó el plano o el administrador pueden moverlo a otro proyecto.');
  if (sigLeer_('Planos').some(r => String(r.proyectoId) === String(dest.id) && r.estado !== 'archivado' && isoNom_(r.nombre) === isoNom_(o.x.nombre))) throw new Error('El proyecto destino ya tiene un plano llamado «' + o.x.nombre + '». Renómbralo antes de moverlo.');
  const carp = isoCarpeta_(dest);
  sigLeer_('PlanosVersiones').filter(v => v.planoId === planoId).forEach(v => { try { DriveApp.getFileById(v.fileId).moveTo(carp); } catch (e) {} });
  sigActualizar_('Planos', o.x._fila, { proyectoId: String(dest.id) });
  sigBitacora_(u.email, dest.miembroId || '', 'plano_movido', { plano: planoId, de: String(o.x.proyectoId), a: String(dest.id), nombre: o.x.nombre });
  CacheService.getScriptCache().put('v_' + dest.id, String(Date.now()), 21600);
  return { plano: isoMeta_(sigLeer_('Planos').find(r => r.planoId === planoId)), proyecto: { id: String(dest.id), titulo: dest.titulo } };
}
function isoRenombrar_(u, planoId, nombre) {
  const o = isoPlano_(u, planoId), n = String(nombre || '').trim().slice(0, 120);
  if (!n) throw new Error('Escribe un nombre.');
  if (sigLeer_('Planos').some(r => String(r.proyectoId) === String(o.p.id) && r.planoId !== planoId && r.estado !== 'archivado' && isoNom_(r.nombre) === isoNom_(n))) throw new Error('Ya existe otro plano con ese nombre en el proyecto.');
  sigActualizar_('Planos', o.x._fila, { nombre: n });
  sigBitacora_(u.email, o.p.miembroId || '', 'plano_renombrado', { plano: planoId, de: o.x.nombre, a: n });
  return { ok: true };
}
function isoArchivar_(u, planoId, archivar) {
  const o = isoPlano_(u, planoId);
  if (archivar && !isoPuedeArchivar_(u, o.x, o.p)) throw new Error('Solo el autor, el dueño del proyecto o el administrador pueden archivar este plano.');
  if (!archivar && u.rol !== 'admin') throw new Error('Solo el administrador puede restaurar planos archivados.');
  sigActualizar_('Planos', o.x._fila, { estado: archivar ? 'archivado' : 'vigente' });
  sigBitacora_(u.email, o.p.miembroId || '', archivar ? 'plano_archivado' : 'plano_restaurado', { plano: planoId });
  CacheService.getScriptCache().put('v_' + o.p.id, String(Date.now()), 21600);
  return { ok: true };
}

/** Para el paquete de entrega: versión vigente de cada plano del proyecto. */
function isoBlobsProyecto_(proyectoId) {
  const out = [], lista = [];
  sigLeer_('Planos').filter(x => String(x.proyectoId) === String(proyectoId) && x.estado !== 'archivado').forEach(x => {
    try {
      const vg = +x.vigente || +x.version, vv = vg !== +x.version ? sigLeer_('PlanosVersiones').find(r => r.planoId === x.planoId && +r.version === vg) : null;
      const fid = vv ? vv.fileId : x.fileId, sha = vv ? vv.sha256 : x.sha256;
      out.push(DriveApp.getFileById(fid).getBlob().setName('Planos Isoflux/' + String(x.nombre + ' v' + vg).replace(/[\\/:*?"<>|]/g, '_') + '.json'));
      lista.push(x.planoId + ' | ' + x.nombre + ' | v' + vg + ' (vigente) | ' + (x.vigentePor || x.actualizadoPor) + ' | SHA-256 ' + sha);
    } catch (e) {}
  });
  return { blobs: out, lista: lista };
}

// ---------- PLAN DE TRABAJO (Gantt del proyecto) ----------
/* Isoflux publica el plan de trabajo de la obra (actividades, fases, fechas, responsables y avance).
   Se guarda en la hoja PlanTrabajo (una fila por actividad); cada envío reemplaza el plan anterior
   del proyecto y queda en la bitácora del SGC. El portal lo muestra en «Cronograma (Gantt)». */
function isoPlanHoja_() {
  if (!HOJAS.PlanTrabajo) HOJAS.PlanTrabajo = ['proyectoId', 'planoId', 'version', 'orden', 'id', 'fase', 'actividad', 'dias', 'predecesora', 'inicio', 'fin', 'responsable', 'avance', 'autor', 'fecha'];
  return sigHoja_('PlanTrabajo');
}
function isoPlanGuardar_(u, b) {
  const p = sigProyectoVisible_(u, b.proyectoId);
  if (p.ciclo === 'papelera') throw new Error('El proyecto está en la papelera.');
  const A = Array.isArray(b.actividades) ? b.actividades.slice(0, 300) : [];
  if (!A.length) throw new Error('El plan no tiene actividades.');
  const fd = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : '';
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const sh = isoPlanHoja_(), H = HOJAS.PlanTrabajo, ahora = sigAhora_(), autor = String(u.nombre || u.email).slice(0, 80);
    const prev = sigLeer_('PlanTrabajo').filter(r => String(r.proyectoId) === String(p.id));
    const version = prev.reduce((m, r) => Math.max(m, +r.version || 0), 0) + 1;
    prev.map(r => r._fila).sort((a, c) => c - a).forEach(f => sh.deleteRow(f));
    delete SIG_RD_.PlanTrabajo;
    const rows = A.map((a, i) => H.map(k => ({ proyectoId: String(p.id), planoId: String(b.planoId || ''), version: version, orden: +a.orden || i + 1, id: String(a.id || i + 1).slice(0, 20),
      fase: String(a.fase || '').slice(0, 40), actividad: String(a.actividad || '').slice(0, 200), dias: +a.dias || 1, predecesora: String(a.predecesora || '').slice(0, 20),
      inicio: fd(a.inicio), fin: fd(a.fin), responsable: String(a.responsable || '').slice(0, 80), avance: Math.max(0, Math.min(100, +a.avance || 0)), autor: autor, fecha: ahora })[k]));
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, H.length).setValues(rows);
    delete SIG_RD_.PlanTrabajo;
    const ini = rows.map(r => r[H.indexOf('inicio')]).filter(String).sort()[0] || '', fin = rows.map(r => r[H.indexOf('fin')]).filter(String).sort().pop() || '';
    const cambios = {};
    if (b.actualizarProyecto !== false) {
      if (ini) cambios.inicio = ini; if (fin) cambios.fin = fin;
      if (b.avance != null && isFinite(+b.avance)) cambios.avance = Math.round(Math.max(0, Math.min(100, +b.avance)));
      try { Object.keys(cambios).forEach(k => setCell('Proyectos', p.id, k, cambios[k])); } catch (e) { cambios.error = String(e.message || e); }
    }
    sigBitacora_(u.email, p.miembroId || '', 'plan_trabajo_publicado', { proyecto: String(p.id), plano: String(b.planoId || ''), version: version, actividades: rows.length, inicio: ini, fin: fin, avance: cambios.avance });
    CacheService.getScriptCache().put('v_' + p.id, String(Date.now()), 21600);
    return { ok: 1, version: version, actividades: rows.length, inicio: ini, fin: fin, proyecto: cambios };
  } finally { lock.releaseLock(); }
}
function isoPlanLeer_(u, proyectoId) {
  const p = sigProyectoVisible_(u, proyectoId);
  isoPlanHoja_();
  const L = sigLeer_('PlanTrabajo').filter(r => String(r.proyectoId) === String(p.id)).sort((a, c) => (+a.orden) - (+c.orden))
    .map(r => ({ orden: +r.orden, id: r.id, fase: r.fase, actividad: r.actividad, dias: +r.dias, predecesora: r.predecesora,
      inicio: isoFecha_(r.inicio).slice(0, 10), fin: isoFecha_(r.fin).slice(0, 10), responsable: r.responsable, avance: +r.avance || 0, version: +r.version, autor: r.autor, fecha: isoFecha_(r.fecha) }));
  return { proyectoId: String(p.id), actividades: L };
}

// ---------- VIGENCIA (la decide el desarrollador del plano) ----------
function isoVigente_(u, planoId, version) {
  const o = isoPlano_(u, planoId), v = +version;
  if (!isoPuedeVigencia_(u, o.x)) throw new Error('Solo el desarrollador del plano (' + o.x.autor + ') o el administrador pueden definir la versión vigente.');
  if (!sigLeer_('PlanosVersiones').some(r => r.planoId === planoId && +r.version === v)) throw new Error('Versión no encontrada.');
  const autor = String(u.nombre || u.email).slice(0, 80), ahora = sigAhora_();
  sigActualizar_('Planos', o.x._fila, { vigente: v, vigentePor: autor, vigenteFecha: ahora, vigenteFijada: v === +o.x.version ? '' : '1' });
  sigBitacora_(u.email, o.p.miembroId || '', 'plano_vigencia', { proyecto: String(o.p.id), plano: planoId, nombre: o.x.nombre, de: +o.x.vigente || +o.x.version, a: v });
  CacheService.getScriptCache().put('v_' + o.p.id, String(Date.now()), 21600);
  return { ok: 1, vigente: v };
}

// ---------- EDICIÓN EN LÍNEA (varias personas sobre el mismo plano) ----------
/* Cada cliente envía cada pocos segundos los cambios por elemento (nodos, tuberías, anotaciones y datos
   del proyecto) y recibe los de los demás. Los cambios se numeran (rev) y se guardan en la caché del
   script; un borrador completo se guarda en Drive para quien entra después. Las versiones del SGC
   siguen siendo explícitas (☁️ Guardar en el proyecto). */
const ISO_LV = { TTL: 21600, MAX: 95000, VIVO: 25000 };
function isoPresentes_(planoId) {
  try { const c = CacheService.getScriptCache().get('lp_' + planoId); if (!c) return []; const o = JSON.parse(c), t = Date.now();
    return Object.keys(o).filter(k => t - o[k].t < ISO_LV.VIVO).map(k => Object.assign({ email: k }, o[k])); } catch (e) { return []; }
}
function isoLive_(u, b) {
  const o = isoPlano_(u, b.planoId), id = o.x.planoId, cache = CacheService.getScriptCache(), props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const mk = 'lv_' + id;let meta = {}; try { meta = JSON.parse(props.getProperty(mk) || '{}'); } catch (e) {}
    meta.rev = +meta.rev || 0; meta.min = +meta.min || 0;
    // presencia
    const pk = 'lp_' + id; let pr = {}; try { pr = JSON.parse(cache.get(pk) || '{}'); } catch (e) {}
    const yo = String(u.email).toLowerCase(), nuevo = !pr[yo] || Date.now() - pr[yo].t > 3600000;
    pr[yo] = { n: String(u.nombre || u.email).slice(0, 60), t: Date.now(), sel: b.sel ? String(b.sel).slice(0, 40) : '', c: String(b.color || '').slice(0, 9) };
    Object.keys(pr).forEach(k => { if (Date.now() - pr[k].t > 120000) delete pr[k]; });
    cache.put(pk, JSON.stringify(pr), ISO_LV.TTL);
    // cambios propios
    let mine = 0;
    if (Array.isArray(b.ops) && b.ops.length) {
      const txt = JSON.stringify({ by: yo, n: pr[yo].n, ops: b.ops });
      if (txt.length > ISO_LV.MAX) throw new Error('Los cambios son demasiado grandes para la edición en línea: guarda una versión del plano.');
      meta.rev++; mine = meta.rev; cache.put(mk + '_' + meta.rev, txt, ISO_LV.TTL);
      if (!meta.min) meta.min = meta.rev; meta.t = sigAhora_(); props.setProperty(mk, JSON.stringify(meta));
      if (nuevo) sigBitacora_(u.email, o.p.miembroId || '', 'plano_edicion_en_linea', { proyecto: String(o.p.id), plano: id, nombre: o.x.nombre });
    }
    // cambios de los demás desde b.rev
    const from = +b.rev;let ops = [], resync = false;
    if (from >= 0 && from < meta.rev) {
      if (meta.rev - from > 400) resync = true;
      else { const keys = []; for (let r = from + 1; r <= meta.rev; r++) keys.push(mk + '_' + r); const got = cache.getAll(keys);
        for (let r = from + 1; r <= meta.rev; r++) { const t = got[mk + '_' + r]; if (!t) { if (r !== mine) { resync = true; break; } continue; } if (r === mine) continue;
          const j = JSON.parse(t); if (j.by !== yo) ops.push({ rev: r, by: j.n, ops: j.ops }); } }
    }
    const bd = o.x.borradorId ? { rev: +o.x.borradorRev || 0, fecha: isoFecha_(o.x.borradorFecha), por: o.x.borradorPor || '' } : null;
    return { rev: meta.rev, mine: mine, ops: resync ? [] : ops, resync: resync, usuarios: isoPresentes_(id).filter(x => x.email !== yo),
      plano: { version: +o.x.version, vigente: +o.x.vigente || +o.x.version, actualizado: isoFecha_(o.x.actualizado), actualizadoPor: o.x.actualizadoPor }, borrador: bd };
  } finally { lock.releaseLock(); }
}
// ---------- MODO COWORKING (V20) ----------
/**
 * Presentación en vivo de un plano a las personas del proyecto: quien presenta comparte su vista (cámara),
 * su puntero y lo que selecciona; los demás lo siguen y hacen preguntas por el chat del plano.
 * Todo vive en la caché (no se guarda en hojas); la bitácora registra el inicio de cada presentación.
 */
function isoCowork_(u, b) {
  const o = isoPlano_(u, b.planoId), id = o.x.planoId, cache = CacheService.getScriptCache(), k = 'cw_' + id, yo = String(u.email).toLowerCase(), nom = String(u.nombre || u.email).slice(0, 60);
  const leer = () => { try { return JSON.parse(cache.get(k) || '{}'); } catch (e) { return {}; } };
  let st = leer(), escribir = false;
  const vivo = p => p && Date.now() - p.t < 15000;
  if (b.presentar || b.parar || b.chat || b.resp) {
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      st = leer(); st.chat = Array.isArray(st.chat) ? st.chat : []; st.seq = +st.seq || 0;
      if (b.presentar) {
        const nuevo = !vivo(st.pres) || st.pres.email !== yo;
        if (vivo(st.pres) && st.pres.email !== yo && !b.tomar) return { ocupado: true, pres: st.pres, chat: [], usuarios: isoPresentes_(id) };
        const x = b.presentar;
        st.pres = { email: yo, n: nom, t: Date.now(), cam: x.cam || null, ptr: x.ptr || null, sel: String(x.sel || '').slice(0, 40), nota: String(x.nota || '').slice(0, 140), hoja: String(x.hoja || '').slice(0, 80) };
        if (nuevo) { sigBitacora_(u.email, o.p.miembroId || '', 'cowork_presentacion', { proyecto: String(o.p.id), plano: id, nombre: o.x.nombre }); st.chat.push({ id: ++st.seq, t: Date.now(), n: nom, email: yo, txt: '🎥 ' + nom + ' empezó a presentar.', sis: 1 }); }
      }
      if (b.parar && st.pres && st.pres.email === yo) { st.pres = null; st.chat.push({ id: ++st.seq, t: Date.now(), n: nom, email: yo, txt: '⏹ ' + nom + ' terminó la presentación.', sis: 1 }); }
      if (b.chat) { const txt = String(b.chat).trim().slice(0, 600); if (txt) st.chat.push({ id: ++st.seq, t: Date.now(), n: nom, email: yo, txt: txt, q: !!b.q }); }
      if (b.resp) { const m = st.chat.find(x => x.id === +b.resp); if (m) m.ok = nom; }
      st.chat = st.chat.slice(-80); cache.put(k, JSON.stringify(st), 7200); escribir = true;
    } finally { lock.releaseLock(); }
  }
  const desde = +b.desde || 0, ch = (st.chat || []).filter(x => x.id > desde || (b.resp && x.ok));
  return { pres: vivo(st.pres) ? st.pres : null, chat: ch, seq: +st.seq || 0, usuarios: isoPresentes_(id) };
}
function isoBorrador_(u, b) {
  const o = isoPlano_(u, b.planoId);
  let bytes; if (b.z) bytes = Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(String(b.b64 || '')), 'application/x-gzip')).getBytes(); else bytes = Utilities.newBlob(String(b.json || '')).getBytes();
  if (!bytes.length || bytes.length > ISO.MAX_BYTES) throw new Error('Borrador no válido.');
  const rev = +b.rev || 0;
  if (o.x.borradorId && +o.x.borradorRev > rev) return { ok: 1, omitido: true };
  const autor = String(u.nombre || u.email).slice(0, 80), blob = Utilities.newBlob(bytes, 'application/json', o.x.planoId + '_borrador_en_linea.json');
  let fid = o.x.borradorId;
  try { if (fid) { const f = DriveApp.getFileById(fid); f.setContent(Utilities.newBlob(bytes).getDataAsString()); } else throw 0; }
  catch (e) { const f = isoCarpeta_(o.p).createFile(blob); f.setDescription('Isoflux · borrador de edición en línea · ' + o.x.nombre); fid = f.getId(); }
  sigActualizar_('Planos', o.x._fila, { borradorId: fid, borradorRev: rev, borradorFecha: sigAhora_(), borradorPor: autor });
  return { ok: 1 };
}
function isoBorradorLeer_(u, planoId) {
  const o = isoPlano_(u, planoId);
  if (!o.x.borradorId) return { vacio: true };
  const blob = DriveApp.getFileById(o.x.borradorId).getBlob();
  return { rev: +o.x.borradorRev || 0, fecha: isoFecha_(o.x.borradorFecha), por: o.x.borradorPor || '', z: 1, b64: Utilities.base64Encode(Utilities.gzip(blob).getBytes()) };
}


// ---------- PRECIOS WEB (V19) ----------
/**
 * Busca en la Web el precio comercial aproximado (COP, sin IVA) de los ítems del despiece de Isoflux.
 * La clave de Anthropic vive SOLO en el servidor: Configuración del proyecto ▸ Propiedades del script ▸
 *   ANTHROPIC_API_KEY = sk-ant-…      (obligatoria)
 *   ANTHROPIC_MODEL   = claude-sonnet-5-5 (opcional)
 * Solo se envían descripción, especificación y unidad de cada ítem; nunca datos del proyecto ni del cliente.
 * Límite: 60 consultas por usuario y hora.
 */
function isoPrecios_(u, b) {
  const P = PropertiesService.getScriptProperties();
  const key = P.getProperty('ANTHROPIC_API_KEY');
  if (!key) return { error: 'La búsqueda de precios en la Web aún no está activada en el portal: el administrador debe registrar ANTHROPIC_API_KEY en Propiedades del script.', sinClave: true };
  const items = (b.items || []).slice(0, 12).map(function (x, i) {
    return { i: +x.i || i, item: String(x.item || '').slice(0, 160), especificacion: String(x.especificacion || '').slice(0, 160), unidad: String(x.unidad || '').slice(0, 16) };
  });
  if (!items.length) return { ok: true, precios: [] };
  const C = CacheService.getScriptCache(), ck = 'px_' + Utilities.base64EncodeWebSafe(String(u.email)).slice(0, 60), n = +(C.get(ck) || 0);
  if (n >= 60) return { error: 'Se alcanzó el límite de consultas de precios de esta hora. Intenta más tarde.' };
  C.put(ck, String(n + 1), 3600);
  const model = P.getProperty('ANTHROPIC_MODEL') || 'claude-sonnet-5-5';
  const msgs = [{ role: 'user', content: 'Para cada ítem da el precio unitario comercial aproximado en pesos colombianos (COP), sin IVA, en el mercado colombiano actual (ferreterías, distribuidores de gas, listas de precios, APU publicados). Responde SOLO con un arreglo JSON: [{"i":<número>,"cop":<número>,"nota":"fuente o criterio breve"}]. Ítems: ' + JSON.stringify(items) }];
  const body = { model: model, max_tokens: 4000, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
    system: 'Eres un estimador de costos de obras de gas en Colombia. Usa la búsqueda web y responde SOLO con un arreglo JSON, sin texto ni markdown.', messages: msgs };
  let d = null;
  for (let k = 0; k < 3; k++) {
    const r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, payload: JSON.stringify(body) });
    const code = r.getResponseCode(), tx = r.getContentText();
    if (code !== 200) { let m = tx; try { m = JSON.parse(tx).error.message; } catch (e) {} return { error: 'El servicio de precios respondió ' + code + ': ' + String(m).slice(0, 200) }; }
    d = JSON.parse(tx);
    if (d.stop_reason !== 'pause_turn') break;
    msgs.push({ role: 'assistant', content: d.content });           // búsqueda larga: se continúa el turno
  }
  const t = (d && d.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('\n');
  const m = t.match(/\[[\s\S]*\]/);
  let arr = [];
  try { arr = m ? JSON.parse(m[0]) : []; } catch (e) { arr = []; }
  arr = arr.filter(function (x) { return x && isFinite(+x.cop) && +x.cop > 0; }).map(function (x) { return { i: +x.i, cop: Math.round(+x.cop), nota: String(x.nota || '').slice(0, 200) }; });
  try { sigBitacora_(u.email, '', 'precios_web', { items: items.length, respuestas: arr.length, plano: String(b.planoId || ''), modelo: model }); } catch (e) {}
  return { ok: true, precios: arr, modelo: model, fecha: new Date().toISOString() };
}


// ---------- LIBRERÍA DE NORMAS DEL AUDITOR (V19.5) ----------
/**
 * Plantillas de requisitos normativos compartidas por toda la red (hoja NormasLib).
 * Cada plantilla guarda sus criterios en JSON (o en un archivo de Drive si es muy grande).
 * Cualquier usuario con sesión puede usarlas; edita o elimina quien la creó o el administrador.
 */
const ISO_NL_H = ['id', 'nombre', 'codigo', 'entidad', 'version', 'descripcion', 'n', 'criterios', 'autor', 'email', 'fecha', 'actualizado', 'eliminado', 'fluido', 'escenarios'];
function isoNormasHoja_() { if (!HOJAS.NormasLib) HOJAS.NormasLib = ISO_NL_H; return sigHoja_('NormasLib'); }
function isoNormasMeta_(r) {
  return { id: String(r.id), nombre: r.nombre, codigo: r.codigo, entidad: r.entidad, version: r.version, descripcion: r.descripcion, fluido: r.fluido || 'General', escenarios: r.escenarios || '', n: +r.n || 0,
    autor: r.autor, email: r.email, fecha: isoFecha_(r.fecha), actualizado: isoFecha_(r.actualizado) };
}
function isoNormasListar_(u) {
  isoNormasHoja_();
  return { normas: sigLeer_('NormasLib').filter(r => r.id && !r.eliminado).map(isoNormasMeta_), puedeTodo: u.rol === 'admin' };
}
function isoNormasLeer_(u, id) {
  isoNormasHoja_();
  const r = sigLeer_('NormasLib').find(x => String(x.id) === String(id) && !x.eliminado);
  if (!r) throw new Error('La plantilla no existe o fue eliminada.');
  let c = String(r.criterios || '[]');
  if (c.indexOf('drive:') === 0) c = DriveApp.getFileById(c.slice(6)).getBlob().getDataAsString();
  return Object.assign(isoNormasMeta_(r), { criterios: JSON.parse(c) });
}
function isoNormasGuardar_(u, b) {
  const m = b.meta || {}, C = Array.isArray(b.criterios) ? b.criterios.slice(0, 2000) : [];
  if (!String(m.nombre || '').trim()) throw new Error('La plantilla necesita un nombre.');
  if (!C.length) throw new Error('La plantilla no tiene requisitos.');
  isoNormasHoja_();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const L = sigLeer_('NormasLib'), ahora = sigAhora_();
    const dup = L.find(x => !x.eliminado && String(x.id) !== String(b.id || '') && String(x.nombre).trim().toLowerCase() === String(m.nombre).trim().toLowerCase() && String(x.version || '') === String(m.version || ''));
    if (dup) throw new Error('Ya existe una plantilla con ese nombre y versión.');
    let json = JSON.stringify(C);
    if (json.length > 45000) {
      const raiz = DriveApp.getFolderById(SIG.CARPETA_RAIZ_ID), it = raiz.getFoldersByName(ISO.CARPETA), base = it.hasNext() ? it.next() : raiz.createFolder(ISO.CARPETA);
      const it2 = base.getFoldersByName('Librería de normas'), carp = it2.hasNext() ? it2.next() : base.createFolder('Librería de normas');
      json = 'drive:' + carp.createFile(Utilities.newBlob(json, 'application/json', String(m.nombre).slice(0, 80) + '.json')).getId();
    }
    const fila = { nombre: String(m.nombre).slice(0, 160), codigo: String(m.codigo || '').slice(0, 60), entidad: String(m.entidad || '').slice(0, 120), version: String(m.version || '').slice(0, 30),
      descripcion: String(m.descripcion || '').slice(0, 1000), fluido: String(m.fluido || 'General').slice(0, 40), escenarios: String(m.escenarios || '').slice(0, 2000), n: C.length, criterios: json, actualizado: ahora };
    if (b.id) {
      const r = L.find(x => String(x.id) === String(b.id) && !x.eliminado);
      if (!r) throw new Error('La plantilla no existe.');
      if (u.rol !== 'admin' && String(r.email).toLowerCase() !== String(u.email).toLowerCase()) throw new Error('Solo quien creó la plantilla o el administrador pueden editarla.');
      sigActualizar_('NormasLib', r._fila, fila);
      sigBitacora_(u.email, '', 'norma_editada', { id: String(b.id), nombre: fila.nombre, requisitos: C.length });
      return { ok: 1, id: String(b.id) };
    }
    const id = 'NL' + Date.now().toString(36);
    sigAgregar_('NormasLib', Object.assign(fila, { id: id, autor: String(u.nombre || u.email).slice(0, 80), email: u.email, fecha: ahora, eliminado: '' }));
    sigBitacora_(u.email, '', 'norma_creada', { id: id, nombre: fila.nombre, requisitos: C.length });
    return { ok: 1, id: id };
  } finally { lock.releaseLock(); }
}
function isoNormasEliminar_(u, id) {
  isoNormasHoja_();
  const r = sigLeer_('NormasLib').find(x => String(x.id) === String(id) && !x.eliminado);
  if (!r) throw new Error('La plantilla no existe.');
  if (u.rol !== 'admin' && String(r.email).toLowerCase() !== String(u.email).toLowerCase()) throw new Error('Solo quien creó la plantilla o el administrador pueden eliminarla.');
  sigActualizar_('NormasLib', r._fila, { eliminado: sigAhora_() });
  sigBitacora_(u.email, '', 'norma_eliminada', { id: String(id), nombre: r.nombre });
  return { ok: 1 };
}

// ---------- LEVANTAMIENTO DE CAMPO GEORREFERENCIADO (V21) ----------
/**
 * Isoflux trae de la bitácora de campo del proyecto los levantamientos que publicó el personal de campo
 * (colector móvil o plantilla Excel): sin fid lista los registros con archivos de levantamiento; con fid
 * entrega ese archivo (solo si pertenece a la bitácora de un proyecto que el usuario puede ver).
 */
const ISO_CAMPO_EXT = /\.(json|xlsx|xls|csv|kml|gpx|geojson)$/i;
function isoCampo_(u, b) {
  const p = sigProyectoVisible_(u, b.proyectoId), es = sigCampoLista_(p.id);
  if (!b.fid) return { entradas: es.filter(e => (e.archivos || []).some(a => ISO_CAMPO_EXT.test(String(a.n || '')))) };
  const ok = es.some(e => (e.archivos || []).some(a => a.fid === b.fid && ISO_CAMPO_EXT.test(String(a.n || ''))));
  if (!ok) throw new Error('Ese archivo no pertenece a la bitácora de campo del proyecto.');
  const f = DriveApp.getFileById(b.fid), bytes = f.getBlob().getBytes();
  if (bytes.length > 25 * 1024 * 1024) throw new Error('El archivo supera 25 MB.');
  return { n: f.getName().replace(/^\d{4}-\d{2}-\d{2} \d{4} · /, ''), m: f.getMimeType(), b64: Utilities.base64Encode(bytes) };
}
