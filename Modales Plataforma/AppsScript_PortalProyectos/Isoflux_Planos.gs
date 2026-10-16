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
    case 'sgcPlanoTrabajoLeer':    return isoPlanLeer_(u, b.proyectoId);
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
function isoPlano_(u, planoId) {
  const x = sigLeer_('Planos').find(r => r.planoId === planoId);
  if (!x) throw new Error('Plano no encontrado.');
  const p = sigProyectoVisible_(u, x.proyectoId);
  return { x: x, p: p };
}
const isoFecha_ = f => f instanceof Date ? f.toISOString() : String(f || '');
function isoMeta_(x) {
  return { planoId: x.planoId, proyectoId: String(x.proyectoId), nombre: x.nombre, version: +x.version || 0, bytes: +x.bytes || 0,
    nodos: +x.nodos || 0, tuberias: +x.tuberias || 0, fondos: +x.fondos || 0, sha256: x.sha256, autor: x.autor, email: x.email,
    creado: isoFecha_(x.creado), actualizado: isoFecha_(x.actualizado), actualizadoPor: x.actualizadoPor, estado: x.estado || 'vigente',
    miniatura: String(x.miniatura || ''), nota: x.nota || '' };
}
function isoPuedeArchivar_(u, x, p) { return u.rol === 'admin' || p.owner === u.email || x.email === u.email; }

// ---------- CONSULTAS ----------
/** Proyectos que el usuario puede ver, con su número de planos (para el selector de Isoflux). */
function isoProyectos_(u) {
  const cnt = {};
  sigLeer_('Planos').forEach(x => { if (x.estado !== 'archivado') cnt[x.proyectoId] = (cnt[x.proyectoId] || 0) + 1; });
  const ps = rows('Proyectos').filter(p => isoVe_(u, p)).map(p => ({ id: String(p.id), titulo: p.titulo, cliente: p.cliente || '', tipo: p.tipo || '',
    estado: p.estado || '', ubicacion: p.ubicacion || '', owner: p.owner, planos: cnt[String(p.id)] || 0, actualizado: isoFecha_(p.actualizado || p.creado) }));
  return { proyectos: ps.reverse(), usuario: { email: u.email, nombre: u.nombre || u.email, rol: u.rol } };
}
function isoListar_(u, proyectoId, archivados) {
  const p = sigProyectoVisible_(u, proyectoId);
  const lista = sigLeer_('Planos').filter(x => String(x.proyectoId) === String(p.id) && (archivados || x.estado !== 'archivado'))
    .sort((a, b) => String(isoFecha_(b.actualizado)).localeCompare(String(isoFecha_(a.actualizado))))
    .map(x => Object.assign(isoMeta_(x), { puedeArchivar: isoPuedeArchivar_(u, x, p) }));
  return { proyecto: { id: String(p.id), titulo: p.titulo, cliente: p.cliente || '', ubicacion: p.ubicacion || '' }, planos: lista };
}
function isoVersiones_(u, planoId) {
  const o = isoPlano_(u, planoId);
  const vs = sigLeer_('PlanosVersiones').filter(v => v.planoId === planoId).sort((a, b) => (+b.version) - (+a.version))
    .map(v => ({ version: +v.version, bytes: +v.bytes || 0, sha256: v.sha256, autor: v.autor, email: v.email, fecha: isoFecha_(v.fecha), nota: v.nota || '' }));
  return { plano: isoMeta_(o.x), versiones: vs };
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
  const p = sigProyectoVisible_(u, b.proyectoId);
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
    const planoId = x ? x.planoId : 'PL-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    const version = x ? (+x.version + 1) : 1;
    const f = isoCarpeta_(p).createFile(Utilities.newBlob(bytes, 'application/json',
      (planoId + '_v' + version + ' - ' + nombre).replace(/[\\/:*?"<>|]/g, '_').slice(0, 150) + '.json'));
    f.setDescription('Isoflux · ' + nombre + ' · v' + version + ' · ' + autor + ' · SHA-256 ' + sha);
    const fila = { planoId: planoId, proyectoId: String(p.id), nombre: nombre, version: version, fileId: f.getId(), bytes: bytes.length,
      nodos: +b.nodos || 0, tuberias: +b.tuberias || 0, fondos: +b.fondos || 0, sha256: sha, actualizado: ahora, actualizadoPor: autor,
      estado: 'vigente', miniatura: mini.length <= ISO.MINI_MAX && /^data:image\//.test(mini) ? mini : (x ? x.miniatura : ''), nota: nota };
    if (x) sigActualizar_('Planos', x._fila, fila);
    else sigAgregar_('Planos', Object.assign(fila, { autor: autor, email: u.email, creado: ahora }));
    sigAgregar_('PlanosVersiones', { planoId: planoId, version: version, fileId: f.getId(), bytes: bytes.length, sha256: sha, autor: autor, email: u.email, fecha: ahora, nota: nota });
    sigBitacora_(u.email, p.miembroId || '', x ? 'plano_version' : 'plano_creado', { proyecto: String(p.id), plano: planoId, nombre: nombre, version: version, sha256: sha });
    CacheService.getScriptCache().put('v_' + p.id, String(Date.now()), 21600);
    const nuevo = sigLeer_('Planos').find(r => r.planoId === planoId);
    return { plano: isoMeta_(nuevo) };
  } finally { lock.releaseLock(); }
}
function isoRenombrar_(u, planoId, nombre) {
  const o = isoPlano_(u, planoId), n = String(nombre || '').trim().slice(0, 120);
  if (!n) throw new Error('Escribe un nombre.');
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
      out.push(DriveApp.getFileById(x.fileId).getBlob().setName('Planos Isoflux/' + String(x.nombre + ' v' + x.version).replace(/[\\/:*?"<>|]/g, '_') + '.json'));
      lista.push(x.planoId + ' | ' + x.nombre + ' | v' + x.version + ' | ' + x.actualizadoPor + ' | SHA-256 ' + x.sha256);
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
