/**
 * ============================================================================
 *  SIG_Miembros.gs — Módulo de miembros del SIG (perfil, logo, estado, leyenda,
 *  bitácora encadenada) para el Portal de Proyectos ENTALPIA LABS.
 *  Industrias I.A. Col · Hub de Ingeniería Pioneer's · Versión 01 (2026-10-10)
 * ============================================================================
 *
 *  QUÉ HACE
 *  - Cada cuenta del portal pertenece a un MIEMBRO (persona natural o empresa)
 *    con identificador único e inmodificable (MBR-0001, MBR-0002…).
 *  - El miembro carga sus datos y su logo. El logo nunca se sobrescribe: cada
 *    cambio crea una versión nueva con su huella SHA-256.
 *  - El estado frente al SIG (Aspirante → Implementación → Evaluación →
 *    Adscrito → Suspendido / Retirado) SOLO lo cambia el administrador
 *    (función central). La leyenda "Miembro del SIG" solo se genera en
 *    estado Adscrito y lleva un código verificable.
 *  - Toda acción queda en una bitácora encadenada (cada fila guarda la huella
 *    de la anterior): si alguien edita o borra una fila en la hoja, la
 *    verificación de la cadena lo detecta.
 *  - Cada proyecto nuevo queda sellado con el miembro dueño y con la marca
 *    bajoSIG (solo si el miembro está Adscrito y el proyecto nace después de
 *    su fecha de ingreso: sin retroactividad).
 *
 *  CÓMO SE INSTALA (3 pasos, en el mismo proyecto de Apps Script del portal)
 *  1) Crear un archivo nuevo de script llamado SIG_Miembros y pegar todo esto.
 *  2) En doPost, justo DESPUÉS de validar el token y obtener el usuario
 *     (el objeto con email, nombre y rol) y ANTES del switch de acciones,
 *     agregar:
 *
 *        const sig = sigApi(b, usuario);      // b = cuerpo JSON recibido
 *        if (sig) return salida(sig);         // usa tu misma función de respuesta JSON
 *
 *     Y para la acción pública de verificación de leyendas (sin sesión),
 *     ANTES de exigir token:
 *
 *        if (b.a === 'sgcVerificar') return salida(sigVerificarPublico(b.codigo));
 *
 *  3) En tus acciones existentes:
 *     - "registro": después de crear el usuario llama  sigAlRegistrar(email, nombre);
 *     - "nuevo proyecto": antes de guardar la fila llama
 *          const sello = sigSelloProyecto(usuario.email);
 *       y guarda sello.miembroId, sello.bajoSIG, sello.fechaIngresoSIG en
 *       columnas nuevas del proyecto (miembroId, bajoSIG, selloSIG).
 *     - "lista": si el usuario no es admin, filtra con
 *          sigPuedeVerProyecto(usuario, proyecto)
 *       para que cada miembro vea solo lo suyo.
 *
 *  Las hojas Miembros, MiembroUsuarios, Logos y BitacoraSIG se crean solas.
 * ============================================================================
 */

// ---------- CONFIGURACIÓN ----------
const SIG = {
  SHEET_ID: '1E8OtwJeBCxq_qxV9geS6o9Yf3CVhPN6clkeNnDkn85Y',   // hoja del portal
  CARPETA_RAIZ_ID: '1niH8pLRIsVjCaJ7BTHqARX_N-3adlbkS',        // carpeta del portal en Drive
  CARPETA_MIEMBROS: 'SIG · Miembros',
  TITULAR: 'Industrias I.A. Col',
  RED: "Red del Hub de Ingeniería Pioneer's · ENTALPIA LABS",
  LOGO_MAX_BYTES: 500 * 1024,
  ESTADOS: ['Aspirante', 'Implementación', 'Evaluación', 'Adscrito', 'Suspendido', 'Retirado'],
  SERVICIOS: ['Diseño de instalaciones de gas', 'Construcción y montaje', 'Mantenimiento y reparación', 'Interventoría', 'I+D+i'],
  // Campos que el miembro puede editar libremente
  CAMPOS_LIBRES: ['nombreComercial', 'representante', 'ciudad', 'direccion', 'telefono', 'correoContacto', 'sitioWeb', 'serviciosSolicitados'],
  // Campos de identidad legal: se bloquean desde Evaluación (solo admin los cambia)
  CAMPOS_LEGALES: ['tipoPersona', 'razonSocial', 'nit'],
  // Carpeta maestra de documentos del SIG (solo lectura para los miembros)
  CARPETA_DOCS_ID: '1jqlo0TPKzeF5NsXIoCXMNzsmEcv9xYZW',
  // Tipos documentales que cada miembro diligencia en su propia copia
  PLANTILLAS: ['FO', 'MZ', 'PL', 'PG'],
  REGISTRO_MAX_BYTES: 20 * 1024 * 1024,
  VIDEO_MAX_BYTES: 30 * 1024 * 1024,
  // Definiciones de los formularios en línea (documento controlado, versionado en GitHub)
  FORMS_URL: 'https://raw.githubusercontent.com/Ingenieria-iacol/ia/main/Modales%20Plataforma/AppsScript_PortalProyectos/formularios.json',
};

const HOJAS = {
  Miembros: ['miembroId', 'tipoPersona', 'razonSocial', 'nit', 'nombreComercial', 'representante', 'ciudad', 'direccion', 'telefono', 'correoContacto', 'sitioWeb', 'serviciosSolicitados', 'alcanceAprobado', 'estadoSIG', 'motivoEstado', 'fechaEstado', 'fechaIngresoSIG', 'logoVersion', 'logoFileId', 'logoSha256', 'carpetaId', 'creadoPor', 'creado', 'actualizado', 'introVideo'],
  MiembroUsuarios: ['miembroId', 'email', 'rolMiembro', 'estado', 'fecha'],
  Logos: ['miembroId', 'version', 'fileId', 'sha256', 'mime', 'bytes', 'cargadoPor', 'fecha', 'vigente'],
  BitacoraSIG: ['n', 'fecha', 'email', 'miembroId', 'accion', 'detalle', 'hashAnterior', 'hash'],
  Registros: ['registroId', 'miembroId', 'codigo', 'titulo', 'origen', 'fileId', 'creadoPor', 'fecha', 'estado', 'pdfId', 'sha256', 'cerradoPor', 'fechaCierre', 'proyectoId'],
  Auditorias: ['token', 'email', 'miembroId', 'expira', 'creadoPor', 'fecha', 'estado', 'motivo'],
  Solicitudes: ['token', 'miembroId', 'codigo', 'email', 'proyecto', 'mensaje', 'expira', 'creadoPor', 'fecha', 'estado', 'registroId', 'fechaRespuesta', 'proyectoId'],
  DocsMarca: ['miembroId', 'docId', 'clave', 'pdfId', 'fecha'],
  Campo: ['id', 'proyectoId', 'fecha', 'tipo', 'texto', 'autor', 'email', 'origen', 'gps', 'archivos'],
  EnlacesCampo: ['token', 'proyectoId', 'email', 'expira', 'creadoPor', 'fecha', 'estado', 'mensaje'],
};

// ---------- ROUTER ----------
/** Devuelve un objeto de respuesta si la acción es del módulo SIG; si no, null. */
function sigApi(b, u) {
  if (!b || !b.a || String(b.a).indexOf('sgc') !== 0) return null;
  if (!u || !u.email) return { error: 'Sesión no válida.' };
  const esAdmin = u.rol === 'admin';
  SIG_LOGO_SHA_ = String(b.logoSha || '');
  try {
    switch (b.a) {
      case 'sgcPerfil':          return sigPerfil(u);
      case 'sgcCrearMiembro':    return sigCrearMiembro(u, b);
      case 'sgcGuardarPerfil':   return sigGuardarPerfil(u, b);
      case 'sgcLogo':            return sigCargarLogo(u, b);
      case 'sgcSolicitarUnion':  return sigSolicitarUnion(u, b.miembroId);
      case 'sgcAprobarUnion':    return sigAprobarUnion(u, b.email, b.aprobar);
      case 'sgcSolicitarAdmision': return sigSolicitarAdmision(u);
      case 'sgcLeyenda':         return sigLeyenda(u);
      case 'sgcBitacora':        return sigBitacoraDe(u, b.miembroId);
      // ---- solo administrador (función central) ----
      case 'sgcMiembros':        if (!esAdmin) break; return sigListaMiembros();
      case 'sgcEstado':          if (!esAdmin) break; return sigCambiarEstado(u, b.miembroId, b.estado, b.motivo, b.alcance);
      case 'sgcEditarLegal':     if (!esAdmin) break; return sigEditarLegal(u, b.miembroId, b.campos);
      case 'sgcVerificarCadena': if (!esAdmin) break; return sigVerificarCadena();
      case 'sgcVideo':           if (!esAdmin) break; return sigVideo(u, b.miembroId, b.url);
      case 'sgcVideoSubir':      if (!esAdmin) break; return sigVideoSubir(u, b.miembroId, b.b64, b.nombre);
      case 'sgcRefrescarDocs':   if (!esAdmin) break; CacheService.getScriptCache().remove('sig_docs_v1'); return sigDocs(u);
      // ---- documentos, registros y auditorías ----
      case 'sgcDocs':            return sigDocs(u);
      case 'sgcDocVer':          return sigDocVer(u, b.id);
      case 'sgcDiligenciar':     return sigDiligenciar(u, b.id, b.proyectoId);
      case 'sgcRegistrosProyecto': return sigRegistrosProyecto(u, b.proyectoId);
      // ---- bitácora de campo del proyecto ----
      case 'sgcCampoListar':     return sigCampoListar(u, b.proyectoId);
      case 'sgcCampoEntrada':    { const p = sigProyectoVisible_(u, b.proyectoId); return sigCampoEntrada_(p, u.nombre || u.email, u.email, 'portal', b); }
      case 'sgcCampoArchivo':    { const e = sigCampoEntradaDe_(b.entradaId); sigProyectoVisible_(u, e.proyectoId); return sigCampoArchivo_(e, b, u.nombre || u.email); }
      case 'sgcCampoEnlace':     return sigCampoEnlace(u, b);
      case 'sgcCampoRevocar':    return sigCampoRevocar(u, b.token);
      case 'sgcRegistros':       return sigRegistros(u, b.miembroId);
      case 'sgcRegistroVer':     return sigRegistroVer(u, b.id);
      case 'sgcSubirRegistro':   return sigSubirRegistro(u, b);
      case 'sgcCerrarRegistro':  return sigCerrarRegistro(u, b.id);
      case 'sgcAuditoriaCrear':  return sigAuditoriaCrear(u, b);
      case 'sgcAuditorias':      return sigAuditorias(u);
      case 'sgcAuditoriaRevocar': return sigAuditoriaRevocar(u, b.token);
      // ---- formularios en línea ----
      case 'sgcFormEnviar':      return sigFormEnviar(u, b);
      case 'sgcFormSolicitudes': return sigFormSolicitudes(u);
      case 'sgcFormRevocar':     return sigFormRevocar(u, b.token);
    }
    return { error: 'Acción no permitida.' };
  } catch (e) {
    return { error: e.message };
  }
}

// ---------- HOJAS ----------
// Rendimiento: el libro se abre UNA vez por petición y cada hoja se lee una sola vez
// (las escrituras invalidan la lectura memorizada de esa hoja).
let SIG_SS_ = null, SIG_SH_ = {}, SIG_RD_ = {}, SIG_LOGO_SHA_ = '';
function sigHoja_(nombre) {
  if (SIG_SH_[nombre]) return SIG_SH_[nombre];
  const ss = SIG_SS_ || (SIG_SS_ = SpreadsheetApp.openById(SIG.SHEET_ID));
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, HOJAS[nombre].length).setValues([HOJAS[nombre]]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (nombre === 'BitacoraSIG') sh.protect().setDescription('Bitácora SIG: no editar manualmente').setWarningOnly(true);
  } else if (sh.getLastColumn() < HOJAS[nombre].length) {
    // Columnas nuevas del módulo: se agregan al final sin mover las existentes
    sh.getRange(1, 1, 1, HOJAS[nombre].length).setValues([HOJAS[nombre]]).setFontWeight('bold');
  }
  SIG_SH_[nombre] = sh;
  return sh;
}
function sigLeer_(nombre) {
  if (SIG_RD_[nombre]) return SIG_RD_[nombre].map(o => Object.assign({}, o));
  const sh = sigHoja_(nombre), v = sh.getDataRange().getValues(), h = v.shift();
  SIG_RD_[nombre] = v.map((r, i) => { const o = { _fila: i + 2 }; h.forEach((k, j) => o[k] = r[j]); return o; });
  return SIG_RD_[nombre].map(o => Object.assign({}, o));
}
function sigAgregar_(nombre, obj) {
  delete SIG_RD_[nombre];
  const sh = sigHoja_(nombre);
  sh.appendRow(HOJAS[nombre].map(k => obj[k] === undefined ? '' : obj[k]));
}
function sigActualizar_(nombre, fila, cambios) {
  delete SIG_RD_[nombre];
  const sh = sigHoja_(nombre), h = HOJAS[nombre];
  Object.keys(cambios).forEach(k => {
    const c = h.indexOf(k);
    if (c >= 0) sh.getRange(fila, c + 1).setValue(cambios[k]);
  });
}
const sigAhora_ = () => new Date().toISOString();
function sigSha_(texto) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function sigShaBytes_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function sigSecreto_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('SIG_SECRETO');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SIG_SECRETO', s); }
  return s;
}

// ---------- BITÁCORA ENCADENADA ----------
function sigBitacora_(email, miembroId, accion, detalle) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = sigHoja_('BitacoraSIG'), last = sh.getLastRow();
    const prev = last > 1 ? String(sh.getRange(last, 8).getValue()) : 'GENESIS';
    const n = last;  // número consecutivo
    const fecha = sigAhora_();
    const det = typeof detalle === 'string' ? detalle : JSON.stringify(detalle);
    const hash = sigSha_([n, fecha, email, miembroId, accion, det, prev].join('|'));
    sh.appendRow([n, fecha, email, miembroId, accion, det, prev, hash]);
    delete SIG_RD_['BitacoraSIG'];
  } finally { lock.releaseLock(); }
}
function sigVerificarCadena() {
  const filas = sigHoja_('BitacoraSIG').getDataRange().getValues().slice(1);
  let prev = 'GENESIS';
  for (let i = 0; i < filas.length; i++) {
    const [n, fecha, email, mid, acc, det, ant, hash] = filas[i];
    const f = fecha instanceof Date ? fecha.toISOString() : String(fecha);
    const calc = sigSha_([n, f, email, mid, acc, det, prev].join('|'));
    if (String(ant) !== prev || calc !== String(hash)) return { ok: false, fila: i + 2, mensaje: 'La bitácora fue alterada a partir de la fila ' + (i + 2) + '.' };
    prev = String(hash);
  }
  return { ok: true, registros: filas.length, mensaje: 'Cadena íntegra: ' + filas.length + ' registros verificados.' };
}

// ---------- MIEMBRO DEL USUARIO ----------
function sigVinculo_(email) {
  return sigLeer_('MiembroUsuarios').find(v => String(v.email).toLowerCase() === String(email).toLowerCase() && v.estado === 'activo');
}
function sigMiembro_(miembroId) {
  return sigLeer_('Miembros').find(m => m.miembroId === miembroId);
}
/** Para usar desde el código existente del portal. */
function sigMiembroDe(email) { const v = sigVinculo_(email); return v ? sigMiembro_(v.miembroId) : null; }

function sigNuevoId_() {
  const ids = sigLeer_('Miembros').map(m => +String(m.miembroId).replace('MBR-', '') || 0);
  return 'MBR-' + ('000' + (Math.max(0, ...ids) + 1)).slice(-4);
}

/** Se llama al crear una cuenta: deja registro; el miembro se crea desde "Mi empresa". */
function sigAlRegistrar(email, nombre) {
  sigBitacora_(email, '', 'cuenta_creada', { nombre: nombre });
}

function sigCrearMiembro(u, b) {
  if (sigVinculo_(u.email)) throw new Error('Tu cuenta ya pertenece a un miembro de la red.');
  if (!b.razonSocial || !b.nit || !b.tipoPersona) throw new Error('Razón social (o nombre), NIT/cédula y tipo de persona son obligatorios.');
  const nit = String(b.nit).replace(/[^0-9\-]/g, '');
  if (sigLeer_('Miembros').some(m => String(m.nit).replace(/[^0-9\-]/g, '') === nit)) throw new Error('Ya existe un miembro con ese NIT/cédula. Solicita unirte a él con su código MBR.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let id;
  try {
    id = sigNuevoId_();
    const raiz = DriveApp.getFolderById(SIG.CARPETA_RAIZ_ID);
    const it = raiz.getFoldersByName(SIG.CARPETA_MIEMBROS);
    const cm = it.hasNext() ? it.next() : raiz.createFolder(SIG.CARPETA_MIEMBROS);
    const carpeta = cm.createFolder(id + ' · ' + String(b.razonSocial).slice(0, 60));
    const ahora = sigAhora_();
    const m = { miembroId: id, estadoSIG: 'Aspirante', fechaEstado: ahora, carpetaId: carpeta.getId(), creadoPor: u.email, creado: ahora, actualizado: ahora, logoVersion: 0 };
    SIG.CAMPOS_LEGALES.concat(SIG.CAMPOS_LIBRES).forEach(k => { if (b[k] !== undefined) m[k] = sigLimpio_(k, b[k]); });
    m.nit = nit;
    sigAgregar_('Miembros', m);
    sigAgregar_('MiembroUsuarios', { miembroId: id, email: u.email, rolMiembro: 'responsable', estado: 'activo', fecha: ahora });
  } finally { lock.releaseLock(); }
  sigBitacora_(u.email, id, 'miembro_creado', { razonSocial: b.razonSocial, nit: nit });
  return sigPerfil(u);
}

function sigLimpio_(k, v) {
  if (k === 'serviciosSolicitados') {
    const lista = (Array.isArray(v) ? v : String(v).split('|')).filter(s => SIG.SERVICIOS.indexOf(s) >= 0);
    return lista.join('|');
  }
  if (k === 'tipoPersona') return v === 'Jurídica' ? 'Jurídica' : 'Natural';
  return String(v).slice(0, 200);
}

function sigGuardarPerfil(u, b) {
  const v = sigVinculo_(u.email);
  if (!v) throw new Error('Primero registra tu empresa o únete a una existente.');
  if (v.rolMiembro !== 'responsable') throw new Error('Solo el responsable del miembro puede editar el perfil.');
  const m = sigMiembro_(v.miembroId);
  const bloqueados = ['Evaluación', 'Adscrito', 'Suspendido', 'Retirado'].indexOf(m.estadoSIG) >= 0;
  const cambios = {}, antes = {};
  SIG.CAMPOS_LIBRES.forEach(k => { if (b[k] !== undefined) { const nv = sigLimpio_(k, b[k]); if (String(nv) !== String(m[k])) { cambios[k] = nv; antes[k] = m[k]; } } });
  SIG.CAMPOS_LEGALES.forEach(k => {
    if (b[k] === undefined) return;
    const nv = k === 'nit' ? String(b[k]).replace(/[^0-9\-]/g, '') : sigLimpio_(k, b[k]);
    if (String(nv) === String(m[k])) return;
    if (bloqueados) throw new Error('La razón social, el NIT y el tipo de persona quedan bloqueados desde la Evaluación. Pide el cambio a la función central.');
    cambios[k] = nv; antes[k] = m[k];
  });
  if (!Object.keys(cambios).length) return sigPerfil(u);
  cambios.actualizado = sigAhora_();
  sigActualizar_('Miembros', m._fila, cambios);
  sigBitacora_(u.email, m.miembroId, 'perfil_actualizado', { antes: antes, despues: cambios });
  return sigPerfil(u);
}

// ---------- LOGO (versionado, nunca se sobrescribe) ----------
function sigCargarLogo(u, b) {
  const v = sigVinculo_(u.email);
  if (!v || v.rolMiembro !== 'responsable') throw new Error('Solo el responsable del miembro puede cambiar el logo.');
  const m = sigMiembro_(v.miembroId);
  if (m.estadoSIG === 'Retirado') throw new Error('El miembro está retirado.');
  const bytes = Utilities.base64Decode(String(b.base64 || '').replace(/^data:[^,]+,/, ''));
  if (!bytes.length) throw new Error('No llegó la imagen.');
  if (bytes.length > SIG.LOGO_MAX_BYTES) throw new Error('El logo supera 500 KB.');
  const B = i => bytes[i] & 0xff;
  let mime = null;
  if (B(0) === 0x89 && B(1) === 0x50 && B(2) === 0x4e && B(3) === 0x47) mime = 'image/png';
  else if (B(0) === 0xff && B(1) === 0xd8 && B(2) === 0xff) mime = 'image/jpeg';
  else if (B(0) === 0x52 && B(1) === 0x49 && B(2) === 0x46 && B(3) === 0x46 && B(8) === 0x57 && B(9) === 0x45 && B(10) === 0x42 && B(11) === 0x50) mime = 'image/webp';
  if (!mime) throw new Error('Formato no permitido. Usa PNG, JPG o WEBP.');
  const sha = sigShaBytes_(bytes);
  if (sha === String(m.logoSha256)) return sigPerfil(u);
  const version = (+m.logoVersion || 0) + 1;
  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  const nombre = m.miembroId + '_logo_v' + ('0' + version).slice(-2) + '.' + ext;
  const archivo = DriveApp.getFolderById(m.carpetaId).createFile(Utilities.newBlob(bytes, mime, nombre));
  archivo.setDescription('Logo ' + m.miembroId + ' v' + version + ' · SHA-256 ' + sha + ' · cargado por ' + u.email);
  const logos = sigLeer_('Logos').filter(l => l.miembroId === m.miembroId && l.vigente === 'sí');
  logos.forEach(l => sigActualizar_('Logos', l._fila, { vigente: 'no' }));
  sigAgregar_('Logos', { miembroId: m.miembroId, version: version, fileId: archivo.getId(), sha256: sha, mime: mime, bytes: bytes.length, cargadoPor: u.email, fecha: sigAhora_(), vigente: 'sí' });
  sigActualizar_('Miembros', m._fila, { logoVersion: version, logoFileId: archivo.getId(), logoSha256: sha, actualizado: sigAhora_() });
  sigBitacora_(u.email, m.miembroId, 'logo_cargado', { version: version, sha256: sha, bytes: bytes.length });
  return sigPerfil(u);
}
function sigLogoDataUrl_(m) {
  if (!m || !m.logoFileId) return '';
  try { const bl = DriveApp.getFileById(m.logoFileId).getBlob(); return 'data:' + bl.getContentType() + ';base64,' + Utilities.base64Encode(bl.getBytes()); }
  catch (e) { return ''; }
}

// ---------- VÍNCULOS DE USUARIOS A UN MIEMBRO ----------
function sigSolicitarUnion(u, miembroId) {
  if (sigVinculo_(u.email)) throw new Error('Tu cuenta ya pertenece a un miembro.');
  const m = sigMiembro_(String(miembroId || '').trim().toUpperCase());
  if (!m) throw new Error('No existe ese código de miembro.');
  if (sigLeer_('MiembroUsuarios').some(x => x.email === u.email && x.estado === 'pendiente')) throw new Error('Ya tienes una solicitud pendiente.');
  sigAgregar_('MiembroUsuarios', { miembroId: m.miembroId, email: u.email, rolMiembro: 'usuario', estado: 'pendiente', fecha: sigAhora_() });
  sigBitacora_(u.email, m.miembroId, 'union_solicitada', '');
  return { ok: true, mensaje: 'Solicitud enviada. El responsable de ' + m.razonSocial + ' debe aprobarla.' };
}
function sigAprobarUnion(u, email, aprobar) {
  const v = sigVinculo_(u.email);
  const esAdmin = u.rol === 'admin';
  const sol = sigLeer_('MiembroUsuarios').find(x => x.email === email && x.estado === 'pendiente');
  if (!sol) throw new Error('No hay solicitud pendiente de ese correo.');
  if (!esAdmin && (!v || v.rolMiembro !== 'responsable' || v.miembroId !== sol.miembroId)) throw new Error('No puedes aprobar esta solicitud.');
  sigActualizar_('MiembroUsuarios', sol._fila, { estado: aprobar ? 'activo' : 'rechazado', fecha: sigAhora_() });
  sigBitacora_(u.email, sol.miembroId, aprobar ? 'union_aprobada' : 'union_rechazada', { email: email });
  return sigPerfil(u);
}

// ---------- ESTADO FRENTE AL SIG ----------
function sigSolicitarAdmision(u) {
  const v = sigVinculo_(u.email);
  if (!v || v.rolMiembro !== 'responsable') throw new Error('Solo el responsable puede solicitar la admisión.');
  const m = sigMiembro_(v.miembroId);
  if (m.estadoSIG !== 'Implementación') throw new Error('La admisión se solicita en estado Implementación (después de firmar el convenio de adhesión).');
  const faltan = ['razonSocial', 'nit', 'representante', 'serviciosSolicitados', 'logoFileId'].filter(k => !m[k]);
  if (faltan.length) throw new Error('Completa antes: ' + faltan.join(', ') + '.');
  sigActualizar_('Miembros', m._fila, { estadoSIG: 'Evaluación', motivoEstado: 'Solicitud de admisión (GI-PR-09)', fechaEstado: sigAhora_() });
  sigBitacora_(u.email, m.miembroId, 'admision_solicitada', '');
  return sigPerfil(u);
}
function sigCambiarEstado(u, miembroId, estado, motivo, alcance) {
  if (SIG.ESTADOS.indexOf(estado) < 0) throw new Error('Estado no válido.');
  if (!motivo || String(motivo).trim().length < 5) throw new Error('Escribe el motivo del cambio (queda en la bitácora).');
  const m = sigMiembro_(miembroId); if (!m) throw new Error('Miembro no encontrado.');
  const c = { estadoSIG: estado, motivoEstado: String(motivo).slice(0, 300), fechaEstado: sigAhora_() };
  if (estado === 'Adscrito') {
    if (!m.logoFileId) throw new Error('El miembro no tiene logo cargado.');
    if (!m.fechaIngresoSIG) c.fechaIngresoSIG = sigAhora_();     // sin retroactividad
    c.alcanceAprobado = sigLimpio_('serviciosSolicitados', alcance || m.serviciosSolicitados);
  }
  sigActualizar_('Miembros', m._fila, c);
  sigBitacora_(u.email, miembroId, 'estado_cambiado', { de: m.estadoSIG, a: estado, motivo: motivo, alcance: c.alcanceAprobado || '' });
  return sigListaMiembros();
}
function sigEditarLegal(u, miembroId, campos) {
  const m = sigMiembro_(miembroId); if (!m) throw new Error('Miembro no encontrado.');
  const c = {}, antes = {};
  SIG.CAMPOS_LEGALES.forEach(k => { if (campos && campos[k] !== undefined) { c[k] = k === 'nit' ? String(campos[k]).replace(/[^0-9\-]/g, '') : sigLimpio_(k, campos[k]); antes[k] = m[k]; } });
  c.actualizado = sigAhora_();
  sigActualizar_('Miembros', m._fila, c);
  sigBitacora_(u.email, miembroId, 'datos_legales_corregidos', { antes: antes, despues: c });
  return sigListaMiembros();
}

// ---------- LEYENDA Y VERIFICACIÓN ----------
function sigCodigo_(m) {
  const firma = Utilities.computeHmacSha256Signature([m.miembroId, m.nit, m.fechaIngresoSIG, m.alcanceAprobado].join('|'), sigSecreto_())
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  return m.miembroId + '-' + firma.slice(0, 10).toUpperCase();
}
function sigLeyenda(u) {
  const m = sigMiembroDe(u.email);
  if (!m) throw new Error('No perteneces a un miembro.');
  if (m.estadoSIG !== 'Adscrito') return { disponible: false, motivo: 'La leyenda solo se habilita en estado Adscrito. Estado actual: ' + m.estadoSIG + '.' };
  const codigo = sigCodigo_(m);
  sigBitacora_(u.email, m.miembroId, 'leyenda_generada', { codigo: codigo });
  return {
    disponible: true, codigo: codigo,
    texto: (m.nombreComercial || m.razonSocial) + ' es miembro adscrito (' + m.miembroId + ') del Sistema Integrado de Gestión de la ' + SIG.RED +
      ', administrado por ' + SIG.TITULAR + '. Alcance: ' + String(m.alcanceAprobado).split('|').join(', ') +
      '. Verifique con el código ' + codigo + '.',
  };
}
/** Pública: un cliente o auditor verifica un código de leyenda sin iniciar sesión. */
function sigVerificarPublico(codigo) {
  const id = String(codigo || '').split('-').slice(0, 2).join('-').toUpperCase();
  const m = sigMiembro_(id);
  if (!m || sigCodigo_(m) !== String(codigo).toUpperCase()) return { valido: false, mensaje: 'Código no válido.' };
  return { valido: m.estadoSIG === 'Adscrito', estado: m.estadoSIG, miembro: m.nombreComercial || m.razonSocial, miembroId: m.miembroId,
    alcance: String(m.alcanceAprobado).split('|'), desde: m.fechaIngresoSIG, titular: SIG.TITULAR,
    mensaje: m.estadoSIG === 'Adscrito' ? 'Miembro adscrito vigente.' : 'El miembro NO está vigente en el SIG (' + m.estadoSIG + ').' };
}

// ---------- PERFIL (lo que ve el usuario) ----------
function sigPerfil(u) {
  const v = sigVinculo_(u.email);
  const pend = sigLeer_('MiembroUsuarios').find(x => x.email === u.email && x.estado === 'pendiente');
  if (!v) return { miembro: null, solicitudPendiente: pend ? pend.miembroId : '', servicios: SIG.SERVICIOS, titular: SIG.TITULAR, red: SIG.RED };
  const m = sigMiembro_(v.miembroId);
  const equipo = sigLeer_('MiembroUsuarios').filter(x => x.miembroId === m.miembroId && x.estado !== 'rechazado').map(x => ({ email: x.email, rol: x.rolMiembro, estado: x.estado }));
  const pub = {};
  HOJAS.Miembros.forEach(k => { if (['carpetaId', 'logoFileId'].indexOf(k) < 0) pub[k] = m[k] instanceof Date ? m[k].toISOString() : m[k]; });
  return {
    miembro: pub, rolMiembro: v.rolMiembro, equipo: v.rolMiembro === 'responsable' ? equipo : [],
    logo: m.logoSha256 && SIG_LOGO_SHA_ === String(m.logoSha256) ? '=' : sigLogoDataUrl_(m), servicios: SIG.SERVICIOS, titular: SIG.TITULAR, red: SIG.RED,
    legalesBloqueados: ['Evaluación', 'Adscrito', 'Suspendido', 'Retirado'].indexOf(m.estadoSIG) >= 0,
  };
}
function sigBitacoraDe(u, miembroId) {
  const v = sigVinculo_(u.email);
  const id = u.rol === 'admin' ? miembroId : (v && v.miembroId);
  if (!id) throw new Error('Sin miembro.');
  const filas = sigLeer_('BitacoraSIG').filter(r => r.miembroId === id).slice(-100).reverse()
    .map(r => ({ fecha: r.fecha instanceof Date ? r.fecha.toISOString() : r.fecha, email: r.email, accion: r.accion, detalle: r.detalle, hash: String(r.hash).slice(0, 12) }));
  return { registros: filas };
}
function sigListaMiembros() {
  const vin = sigLeer_('MiembroUsuarios');
  return {
    miembros: sigLeer_('Miembros').map(m => ({
      miembroId: m.miembroId, razonSocial: m.razonSocial, nit: m.nit, tipoPersona: m.tipoPersona, estadoSIG: m.estadoSIG,
      motivoEstado: m.motivoEstado, fechaIngresoSIG: m.fechaIngresoSIG instanceof Date ? m.fechaIngresoSIG.toISOString() : m.fechaIngresoSIG,
      serviciosSolicitados: m.serviciosSolicitados, alcanceAprobado: m.alcanceAprobado, logoVersion: m.logoVersion, creadoPor: m.creadoPor, introVideo: m.introVideo || '',
      usuarios: vin.filter(x => x.miembroId === m.miembroId).map(x => ({ email: x.email, rol: x.rolMiembro, estado: x.estado })),
    })),
    estados: SIG.ESTADOS, servicios: SIG.SERVICIOS,
  };
}

// ---------- GANCHOS PARA LAS ACCIONES EXISTENTES DEL PORTAL ----------
/** Llamar al crear un proyecto. Devuelve el sello que debe guardarse con el proyecto. */
function sigSelloProyecto(email) {
  const m = sigMiembroDe(email);
  if (!m) return { miembroId: '', bajoSIG: 'no', selloSIG: '' };
  const bajo = m.estadoSIG === 'Adscrito' && m.fechaIngresoSIG && new Date() >= new Date(m.fechaIngresoSIG);
  const sello = bajo ? sigSha_([m.miembroId, email, sigAhora_(), m.logoSha256].join('|')).slice(0, 16) : '';
  sigBitacora_(email, m.miembroId, 'proyecto_sellado', { bajoSIG: bajo ? 'sí' : 'no', sello: sello });
  return { miembroId: m.miembroId, bajoSIG: bajo ? 'sí' : 'no', selloSIG: sello };
}
/** Aislamiento: un usuario solo ve proyectos de su propio miembro (o los propios si no tiene miembro). */
function sigPuedeVerProyecto(u, p) {
  if (u.rol === 'admin') return true;
  if (p.owner === u.email) return true;
  const v = sigVinculo_(u.email);
  return !!(v && p.miembroId && p.miembroId === v.miembroId);
}


// =====================================================================================
//  DOCUMENTOS DEL SIG, REGISTROS DE CADA MIEMBRO, AUDITORÍAS Y VIDEO DE BIENVENIDA
// =====================================================================================
//  · Los documentos maestros viven en SIG.CARPETA_DOCS_ID y NUNCA se comparten: el portal
//    los entrega como PDF de solo lectura y deja constancia de cada consulta en la bitácora.
//  · Cada miembro diligencia sus formatos en una COPIA dentro de su propia carpeta
//    ("Registros SIG"); ningún miembro ve los registros de otro.
//  · Al cerrar un registro se congela un PDF con su huella SHA-256 y se retiran los editores.
//  · Un auditor (ente de control, certificador) entra con un enlace temporal + su correo y ve,
//    en solo lectura, los documentos del SIG y el expediente del miembro auditado.
const SIG_TIPOS = { CA: 'Caracterización', PO: 'Política', PL: 'Plan', PR: 'Procedimiento', IN: 'Instructivo', FO: 'Formato', MZ: 'Matriz', PG: 'Programa', LE: 'Listado maestro' };
const SIG_EST_DOCS = ['Implementación', 'Evaluación', 'Adscrito', 'Suspendido'];   // ven todo el SIG
const SIG_EST_REG = ['Implementación', 'Evaluación', 'Adscrito'];                  // diligencian registros

function sigDocsMaestros_() {
  const C = CacheService.getScriptCache(), k = 'sig_docs_v1', c = C.get(k);
  if (c) return JSON.parse(c);
  let raiz;
  try { raiz = DriveApp.getFolderById(SIG.CARPETA_DOCS_ID); raiz.getName(); }
  catch (e) { throw new Error('La carpeta maestra del SIG no es accesible para la cuenta que ejecuta el portal.'); }
  const out = [];
  const recorrer = (f, carpeta) => {
    const fs = f.getFiles();
    while (fs.hasNext()) {
      const x = fs.next(); if (x.isTrashed()) continue;
      const n = x.getName(), m = n.match(/^([A-Z]{2,3})-([A-Z]{2})-(\d{2})/);
      out.push({ id: x.getId(), nombre: n, codigo: m ? m[0] : '', tipo: m ? m[2] : '', carpeta: carpeta, plantilla: !!m && SIG.PLANTILLAS.indexOf(m[2]) >= 0 });
    }
    const ds = f.getFolders();
    while (ds.hasNext()) { const d = ds.next(); recorrer(d, d.getName()); }
  };
  recorrer(raiz, '00 Sistema');
  out.sort((a, b) => (a.carpeta + ' ' + a.nombre).localeCompare(b.carpeta + ' ' + b.nombre));
  C.put(k, JSON.stringify(out), 21600);
  return out;
}
function sigNivel_(u) {
  const v = sigVinculo_(u.email), m = v ? sigMiembro_(v.miembroId) : null;
  if (u.rol === 'admin') return { nivel: 'admin', v: v, m: m };
  if (!m) return { nivel: 'ninguno' };
  return { nivel: SIG_EST_DOCS.indexOf(m.estadoSIG) >= 0 ? 'total' : (m.estadoSIG === 'Aspirante' ? 'basico' : 'ninguno'), v: v, m: m };
}
function sigDocsVisibles_(n) {
  const d = sigDocsMaestros_();
  if (n.nivel === 'admin' || n.nivel === 'total') return d;
  if (n.nivel === 'basico') return d.filter(x => ['PO', 'LE'].indexOf(x.tipo) >= 0 || x.codigo === 'GI-PR-09');
  return [];
}
function sigDocs(u) {
  const n = sigNivel_(u);
  return {
    docs: sigDocsVisibles_(n), tipos: SIG_TIPOS, nivel: n.nivel, estado: n.m ? n.m.estadoSIG : '',
    puedeDiligenciar: !!(n.m && SIG_EST_REG.indexOf(n.m.estadoSIG) >= 0),
    rolMiembro: n.v ? n.v.rolMiembro : '', miembroId: n.m ? n.m.miembroId : '',
    formularios: (() => { try { return Object.keys(sigForms_()); } catch (e) { return []; } })(),
  };
}
function sigPdf_(fileId) {
  const f = DriveApp.getFileById(fileId), mt = f.getMimeType();
  if (/^application\/vnd\.google-apps\.(document|spreadsheet|presentation)$/.test(mt)) {
    return { b64: Utilities.base64Encode(f.getAs('application/pdf').getBytes()), mime: 'application/pdf', nombre: f.getName() + '.pdf' };
  }
  return { b64: Utilities.base64Encode(f.getBlob().getBytes()), mime: mt, nombre: f.getName() };
}
function sigDocVer(u, id) {
  const n = sigNivel_(u), d = sigDocsVisibles_(n).find(x => x.id === id);
  if (!d) throw new Error('Documento no disponible para tu estado en el SIG.');
  sigBitacora_(u.email, n.m ? n.m.miembroId : '', 'documento_consultado', { codigo: d.codigo || d.nombre });
  return n.m ? sigPdfMarca_(d, n.m) : sigPdf_(d.id);
}
function sigCarpetaRegistros_(m) {
  const f = DriveApp.getFolderById(m.carpetaId), it = f.getFoldersByName('Registros SIG');
  return it.hasNext() ? it.next() : f.createFolder('Registros SIG');
}
function sigEditoresEquipo_(file, miembroId) {
  const no = [];
  sigLeer_('MiembroUsuarios').filter(x => x.miembroId === miembroId && x.estado === 'activo')
    .forEach(x => { try { file.addEditor(String(x.email)); } catch (e) { no.push(x.email); } });
  return no;
}
function sigDiligenciar(u, id, proyectoId) {
  const n = sigNivel_(u), pj = proyectoId ? sigProyectoVisible_(u, proyectoId) : null;
  if (!n.m) throw new Error('Debes pertenecer a una empresa de la red.');
  if (SIG_EST_REG.indexOf(n.m.estadoSIG) < 0) throw new Error('Los formatos se diligencian desde el estado Implementación. Estado actual: ' + n.m.estadoSIG + '.');
  const d = sigDocsMaestros_().find(x => x.id === id && x.plantilla);
  if (!d) throw new Error('Esa plantilla no existe.');
  const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const copia = DriveApp.getFileById(d.id).makeCopy(n.m.miembroId + ' · ' + d.nombre + ' · ' + hoy, sigCarpetaRegistros_(n.m));
  copia.setDescription('Registro ' + d.codigo + ' de ' + n.m.miembroId + ', creado desde la plantilla maestra del SIG por ' + u.email);
  sigMarcarCopia_(copia.getId(), n.m);
  const sinAcceso = sigEditoresEquipo_(copia, n.m.miembroId);
  const rid = 'REG-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  sigAgregar_('Registros', { registroId: rid, miembroId: n.m.miembroId, codigo: d.codigo, titulo: d.nombre + (pj ? ' · ' + pj.titulo : ''), origen: 'plantilla', fileId: copia.getId(), creadoPor: u.email, fecha: sigAhora_(), estado: 'abierto', proyectoId: pj ? String(pj.id) : '' });
  sigBitacora_(u.email, n.m.miembroId, 'registro_creado', { registroId: rid, codigo: d.codigo });
  return { registroId: rid, url: copia.getUrl(), sinAcceso: sinAcceso };
}
function sigRegistrosDe_(miembroId) {
  return sigLeer_('Registros').filter(r => miembroId === '*' || r.miembroId === miembroId).reverse().map(r => ({
    registroId: r.registroId, miembroId: r.miembroId, codigo: r.codigo, titulo: r.titulo, origen: r.origen, creadoPor: r.creadoPor,
    fecha: r.fecha instanceof Date ? r.fecha.toISOString() : r.fecha, estado: r.estado, sha256: r.sha256, cerradoPor: r.cerradoPor,
    fechaCierre: r.fechaCierre instanceof Date ? r.fechaCierre.toISOString() : r.fechaCierre, fileId: r.fileId, proyectoId: r.proyectoId || '',
  }));
}
function sigRegistros(u, miembroId) {
  if (u.rol === 'admin') return { registros: sigRegistrosDe_(miembroId || '*') };
  const v = sigVinculo_(u.email);
  if (!v) return { registros: [] };
  return { registros: sigRegistrosDe_(v.miembroId).map(r => Object.assign(r, { url: r.estado === 'abierto' ? 'https://drive.google.com/open?id=' + r.fileId : '' })) };
}
function sigRegistroPropio_(u, rid) {
  const r = sigLeer_('Registros').find(x => x.registroId === rid);
  if (!r) throw new Error('Registro no encontrado.');
  if (u.rol !== 'admin') { const v = sigVinculo_(u.email); if (!v || v.miembroId !== r.miembroId) throw new Error('Ese registro no pertenece a tu empresa.'); }
  return r;
}
function sigRegistroVer(u, rid) {
  const r = sigRegistroPropio_(u, rid);
  sigBitacora_(u.email, r.miembroId, 'registro_consultado', { registroId: rid });
  return sigPdf_(r.pdfId || r.fileId);
}
function sigSubirRegistro(u, b) {
  const n = sigNivel_(u);
  if (!n.m) throw new Error('Debes pertenecer a una empresa de la red.');
  if (SIG_EST_REG.indexOf(n.m.estadoSIG) < 0) throw new Error('Los registros se cargan desde el estado Implementación.');
  const bytes = Utilities.base64Decode(String(b.b64 || ''));
  if (!bytes.length) throw new Error('No llegó el archivo.');
  if (bytes.length > SIG.REGISTRO_MAX_BYTES) throw new Error('El archivo supera 20 MB.');
  const codigo = String(b.codigo || '').toUpperCase().slice(0, 12), nombre = String(b.nombre || 'registro').slice(0, 120), pj = b.proyectoId ? sigProyectoVisible_(u, b.proyectoId) : null;
  const sha = sigShaBytes_(bytes), rid = 'REG-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  const f = sigCarpetaRegistros_(n.m).createFile(Utilities.newBlob(bytes, String(b.mime || 'application/octet-stream'), n.m.miembroId + ' · ' + (codigo ? codigo + ' · ' : '') + nombre));
  f.setDescription('Evidencia ' + rid + ' · SHA-256 ' + sha + ' · cargada por ' + u.email);
  sigAgregar_('Registros', { registroId: rid, miembroId: n.m.miembroId, codigo: codigo, titulo: nombre, origen: 'cargado', fileId: f.getId(), creadoPor: u.email, fecha: sigAhora_(), estado: 'cerrado', pdfId: f.getId(), sha256: sha, cerradoPor: u.email, fechaCierre: sigAhora_(), proyectoId: pj ? String(pj.id) : '' });
  sigBitacora_(u.email, n.m.miembroId, 'evidencia_cargada', { registroId: rid, codigo: codigo, sha256: sha });
  return { registroId: rid, sha256: sha };
}
function sigCerrarRegistro(u, rid) {
  const r = sigRegistroPropio_(u, rid);
  if (u.rol !== 'admin') { const v = sigVinculo_(u.email); if (v.rolMiembro !== 'responsable') throw new Error('Solo el responsable de la empresa puede cerrar registros.'); }
  if (r.estado !== 'abierto') throw new Error('El registro ya está cerrado.');
  const m = sigMiembro_(r.miembroId), orig = DriveApp.getFileById(r.fileId);
  const pdf = sigCarpetaRegistros_(m).createFile(orig.getAs('application/pdf').setName(orig.getName() + ' (cerrado).pdf'));
  const sha = sigShaBytes_(pdf.getBlob().getBytes());
  pdf.setDescription('Registro cerrado ' + rid + ' · SHA-256 ' + sha + ' · ' + u.email);
  orig.getEditors().forEach(e => { try { orig.removeEditor(e); } catch (x) {} });
  sigActualizar_('Registros', r._fila, { estado: 'cerrado', pdfId: pdf.getId(), sha256: sha, cerradoPor: u.email, fechaCierre: sigAhora_() });
  sigBitacora_(u.email, r.miembroId, 'registro_cerrado', { registroId: rid, sha256: sha });
  return { ok: true, sha256: sha };
}

// ---------- AUDITORÍAS (acceso temporal de solo lectura para entes de control) ----------
function sigAuditoriaCrear(u, b) {
  const em = String(b.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(em)) throw new Error('Correo del auditor inválido.');
  if (!/^https?:\/\//.test(b.base || '')) throw new Error('Enlace base inválido.');
  let mid;
  if (u.rol === 'admin') mid = b.miembroId || '*';
  else {
    const v = sigVinculo_(u.email);
    if (!v || v.rolMiembro !== 'responsable') throw new Error('Solo el responsable de la empresa o la función central pueden abrir una auditoría.');
    mid = v.miembroId;
  }
  if (mid !== '*' && !sigMiembro_(mid)) throw new Error('Miembro no encontrado.');
  const d = Math.max(1, Math.min(30, +b.dias || 7)), tk = 'A' + Utilities.getUuid().replace(/-/g, '');
  const ex = new Date(Date.now() + d * 864e5).toISOString(), motivo = String(b.motivo || '').slice(0, 200);
  sigAgregar_('Auditorias', { token: tk, email: em, miembroId: mid, expira: ex, creadoPor: u.email, fecha: sigAhora_(), estado: 'activa', motivo: motivo });
  sigBitacora_(u.email, mid === '*' ? '' : mid, 'auditoria_abierta', { auditor: em, expira: ex, motivo: motivo });
  const link = b.base + '?aud=' + tk;
  try {
    MailApp.sendEmail({ to: em, subject: 'Acceso de auditoría · SIG ' + SIG.RED, noReply: true,
      body: 'Se le concedió acceso de solo lectura al Sistema Integrado de Gestión administrado por ' + SIG.TITULAR +
        (mid === '*' ? ' (alcance: toda la red).' : ' (miembro ' + mid + ').') + '\n\nEnlace: ' + link + '\nVálido hasta: ' + new Date(ex).toLocaleString() +
        '\n\nAl abrirlo, escriba este mismo correo (' + em + ') para validar su acceso. Cada consulta queda registrada en la bitácora del SIG.' });
  } catch (e) {}
  return { link: link, expira: ex };
}
function sigAuditorias(u) {
  let mid = '*';
  if (u.rol !== 'admin') { const v = sigVinculo_(u.email); if (!v || v.rolMiembro !== 'responsable') return { auditorias: [] }; mid = v.miembroId; }
  return { auditorias: sigLeer_('Auditorias').filter(a => mid === '*' || a.miembroId === mid).reverse().map(a => ({
    token: a.token, email: a.email, miembroId: a.miembroId, expira: a.expira instanceof Date ? a.expira.toISOString() : a.expira,
    estado: a.estado, motivo: a.motivo, creadoPor: a.creadoPor })) };
}
function sigAuditoriaRevocar(u, token) {
  const a = sigLeer_('Auditorias').find(x => x.token === token);
  if (!a) throw new Error('Auditoría no encontrada.');
  if (u.rol !== 'admin') { const v = sigVinculo_(u.email); if (!v || v.rolMiembro !== 'responsable' || v.miembroId !== a.miembroId) throw new Error('No puedes revocar esta auditoría.'); }
  sigActualizar_('Auditorias', a._fila, { estado: 'revocada' });
  sigBitacora_(u.email, a.miembroId === '*' ? '' : a.miembroId, 'auditoria_revocada', { auditor: a.email });
  return sigAuditorias(u);
}
/** Pública (sin sesión): el auditor entra con token + correo. Llamar ANTES de validar la sesión. */
function sigAuditoriaPublica(q) {
  try {
    const C = CacheService.getScriptCache(), em = String(q.email || '').trim().toLowerCase(), k = 'au_' + q.token, f = +C.get(k) || 0;
    if (f >= 5) return { error: 'Demasiados intentos. Intenta en 10 minutos.' };
    const a = sigLeer_('Auditorias').find(x => x.token === q.token && String(x.email).toLowerCase() === em && x.estado === 'activa');
    if (!a) { C.put(k, String(f + 1), 600); return { error: 'Acceso de auditoría no válido. Verifica el correo.' }; }
    if (new Date(a.expira) < new Date()) return { error: 'Este acceso de auditoría venció.' };
    const mid = a.miembroId, quien = 'auditor:' + em, bm = mid === '*' ? '' : mid;
    if (q.paso === 'doc') {
      const d = sigDocsMaestros_().find(x => x.id === q.id); if (!d) return { error: 'Documento no encontrado.' };
      sigBitacora_(quien, bm, 'auditoria_consulta', { codigo: d.codigo || d.nombre }); return mid === '*' ? sigPdf_(d.id) : sigPdfMarca_(d, sigMiembro_(mid));
    }
    if (q.paso === 'registro') {
      const r = sigLeer_('Registros').find(x => x.registroId === q.id && (mid === '*' || x.miembroId === mid)); if (!r) return { error: 'Registro no encontrado.' };
      sigBitacora_(quien, r.miembroId, 'auditoria_consulta', { registroId: r.registroId }); return sigPdf_(r.pdfId || r.fileId);
    }
    sigBitacora_(quien, bm, 'auditoria_ingreso', { motivo: a.motivo });
    let miembro = null, logo = '';
    if (mid !== '*') {
      const m = sigMiembro_(mid);
      miembro = { miembroId: m.miembroId, razonSocial: m.razonSocial, nombreComercial: m.nombreComercial, nit: m.nit, tipoPersona: m.tipoPersona, estadoSIG: m.estadoSIG,
        fechaIngresoSIG: m.fechaIngresoSIG instanceof Date ? m.fechaIngresoSIG.toISOString() : m.fechaIngresoSIG, alcanceAprobado: m.alcanceAprobado, representante: m.representante, ciudad: m.ciudad };
      logo = sigLogoDataUrl_(m);
    }
    const bit = sigLeer_('BitacoraSIG').filter(r => mid === '*' || r.miembroId === mid).slice(-300).reverse()
      .map(r => ({ fecha: r.fecha instanceof Date ? r.fecha.toISOString() : r.fecha, email: r.email, miembroId: r.miembroId, accion: r.accion, detalle: r.detalle, hash: String(r.hash).slice(0, 12) }));
    return {
      auditor: em, expira: a.expira instanceof Date ? a.expira.toISOString() : a.expira, motivo: a.motivo, alcance: mid, titular: SIG.TITULAR, red: SIG.RED,
      miembro: miembro, logo: logo, miembros: mid === '*' ? sigListaMiembros().miembros.map(m => ({ miembroId: m.miembroId, razonSocial: m.razonSocial, estadoSIG: m.estadoSIG })) : [],
      docs: sigDocsMaestros_(), tipos: SIG_TIPOS, registros: sigRegistrosDe_(mid), bitacora: bit, cadena: sigVerificarCadena(),
    };
  } catch (e) { return { error: e.message }; }
}

// ---------- VIDEO DE BIENVENIDA (archivo .mp4 que carga la función central para cada miembro) ----------
//  Se guarda en la carpeta del miembro como versión nueva (nunca se sobrescribe), se comparte
//  "cualquier persona con el enlace" solo en lectura y se referencia como drive:ID.
function sigVideoSubir(u, miembroId, b64, nombre) {
  const m = sigMiembro_(miembroId); if (!m) throw new Error('Miembro no encontrado.');
  const bytes = Utilities.base64Decode(String(b64 || ''));
  if (!bytes.length) throw new Error('No llegó el video.');
  if (bytes.length > SIG.VIDEO_MAX_BYTES) throw new Error('El video supera 30 MB. Comprímelo (por ejemplo a 720p) e inténtalo de nuevo.');
  const tipo = String.fromCharCode(bytes[4] & 0xff, bytes[5] & 0xff, bytes[6] & 0xff, bytes[7] & 0xff);
  if (tipo !== 'ftyp') throw new Error('El archivo no es un video .mp4 válido.');
  const sha = sigShaBytes_(bytes);
  const previos = sigLeer_('BitacoraSIG').filter(r => r.miembroId === m.miembroId && r.accion === 'video_intro').length;
  const f = DriveApp.getFolderById(m.carpetaId).createFile(Utilities.newBlob(bytes, 'video/mp4', m.miembroId + '_video_bienvenida_v' + ('0' + (previos + 1)).slice(-2) + '.mp4'));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  f.setDescription('Video de bienvenida ' + m.miembroId + ' · SHA-256 ' + sha + ' · cargado por ' + u.email + ' · original: ' + String(nombre || '').slice(0, 80));
  sigActualizar_('Miembros', m._fila, { introVideo: 'drive:' + f.getId(), actualizado: sigAhora_() });
  sigBitacora_(u.email, miembroId, 'video_intro', { archivo: f.getName(), sha256: sha, bytes: bytes.length });
  return sigListaMiembros();
}
/** Solo para QUITAR el video (url vacía). Los videos se cargan como .mp4 con sigVideoSubir. */
function sigVideo(u, miembroId, url) {
  const m = sigMiembro_(miembroId); if (!m) throw new Error('Miembro no encontrado.');
  if (String(url || '').trim()) throw new Error('El video de bienvenida se carga como archivo .mp4.');
  sigActualizar_('Miembros', m._fila, { introVideo: '', actualizado: sigAhora_() });
  sigBitacora_(u.email, miembroId, 'video_intro', { accion: 'retirado' });
  return sigListaMiembros();
}

// =====================================================================================
//  MARCA DEL MIEMBRO EN LOS DOCUMENTOS (reemplaza el texto [LOGO DEL MIEMBRO] por su logo)
// =====================================================================================
function sigMarcarCopia_(fileId, m) {
  try {
    if (DriveApp.getFileById(fileId).getMimeType() !== 'application/vnd.google-apps.document') return;
    const doc = DocumentApp.openById(fileId), body = doc.getBody(), r = body.findText('\\[LOGO DEL MIEMBRO\\]');
    if (!r) return;
    const t = r.getElement().asText(), par = t.getParent();
    t.deleteText(r.getStartOffset(), r.getEndOffsetInclusive());
    let puesto = false;
    if (m.logoFileId) {
      try {
        const img = par.asParagraph().insertInlineImage(0, DriveApp.getFileById(m.logoFileId).getBlob());
        const h = 46, w = Math.round(img.getWidth() * h / Math.max(1, img.getHeight()));
        if (w > 130) img.setWidth(130).setHeight(Math.round(img.getHeight() * 130 / Math.max(1, img.getWidth()))); else img.setHeight(h).setWidth(w);
        puesto = true;
      } catch (e) {}
    }
    if (!puesto) par.asParagraph().appendText(m.nombreComercial || m.razonSocial || m.miembroId);
    par.asParagraph().appendText('\n' + m.miembroId).setFontSize(7);
    doc.saveAndClose();
  } catch (e) {}
}
function sigCarpetaMarca_(m) {
  const f = DriveApp.getFolderById(m.carpetaId), it = f.getFoldersByName('Documentos SIG con marca');
  return it.hasNext() ? it.next() : f.createFolder('Documentos SIG con marca');
}
/** PDF del documento maestro con el logo del miembro. Se genera una vez y se reutiliza hasta que cambie el logo o el documento. */
function sigPdfMarca_(d, m) {
  const f = DriveApp.getFileById(d.id);
  if (!m || !m.logoFileId || f.getMimeType() !== 'application/vnd.google-apps.document') return sigPdf_(d.id);
  const clave = String(m.logoSha256) + '|' + f.getLastUpdated().getTime(), nombre = m.miembroId + ' · ' + d.nombre + '.pdf';
  const c = sigLeer_('DocsMarca').find(x => x.miembroId === m.miembroId && x.docId === d.id && String(x.clave) === clave);
  if (c) { try { return { b64: Utilities.base64Encode(DriveApp.getFileById(c.pdfId).getBlob().getBytes()), mime: 'application/pdf', nombre: nombre }; } catch (e) {} }
  const carpeta = sigCarpetaMarca_(m), tmp = f.makeCopy('temporal ' + nombre, carpeta);
  sigMarcarCopia_(tmp.getId(), m);
  const pdf = tmp.getAs('application/pdf').setName(nombre);
  tmp.setTrashed(true);
  const p = carpeta.createFile(pdf);
  sigAgregar_('DocsMarca', { miembroId: m.miembroId, docId: d.id, clave: clave, pdfId: p.getId(), fecha: sigAhora_() });
  return { b64: Utilities.base64Encode(pdf.getBytes()), mime: 'application/pdf', nombre: nombre };
}

// =====================================================================================
//  FORMULARIOS EN LÍNEA: el miembro envía un formato por correo al personal de campo,
//  que lo diligencia desde el celular sin cuenta. Al enviarlo se genera un PDF con el logo
//  del miembro, su huella SHA-256 y un registro cerrado en "Registros SIG".
// =====================================================================================
function sigForms_() {
  // Las definiciones viven en este mismo archivo (SIG_FORMS_LOCAL, al final); GitHub queda solo como respaldo.
  if (typeof SIG_FORMS_LOCAL !== 'undefined') return SIG_FORMS_LOCAL;
  const C = CacheService.getScriptCache(), c = C.get('sig_forms_v1');
  if (c) return JSON.parse(c);
  const r = UrlFetchApp.fetch(SIG.FORMS_URL, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('No se pudieron cargar las definiciones de los formularios.');
  const t = r.getContentText();
  C.put('sig_forms_v1', t, 21600);
  return JSON.parse(t);
}
const sigEsc_ = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sigImg_ = v => /^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(String(v || ''));
// Logo para el PDF: solo PNG/JPEG (el conversor de PDF no lee WEBP); si no, se usa el nombre de la empresa.
const sigLogoPdf_ = m => { const l = sigLogoDataUrl_(m); return /^data:image\/(png|jpeg);base64,/.test(l) ? l : ''; };
function sigFormEnviar(u, b) {
  const n = sigNivel_(u);
  if (!n.m) throw new Error('Debes pertenecer a una empresa de la red.');
  if (SIG_EST_REG.indexOf(n.m.estadoSIG) < 0) throw new Error('Los formularios se usan desde el estado Implementación.');
  const F = sigForms_()[b.codigo]; if (!F) throw new Error('Ese formato no tiene formulario en línea.');
  if (!/^https?:\/\//.test(b.base || '')) throw new Error('Enlace base inválido.');
  const correos = String(b.emails || '').split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
  if (!correos.length) throw new Error('Escribe al menos un correo.');
  if (correos.length > 20) throw new Error('Máximo 20 correos por envío.');
  const malo = correos.find(x => !/^\S+@\S+\.\S+$/.test(x)); if (malo) throw new Error('Correo inválido: ' + malo);
  const d = Math.max(1, Math.min(30, +b.dias || 7)), ex = new Date(Date.now() + d * 864e5).toISOString();
  const m = n.m, nom = m.nombreComercial || m.razonSocial, msg = String(b.mensaje || '').slice(0, 500);
  // Vínculo con un proyecto del portal: solo proyectos que este usuario puede ver (propios, compartidos o de su empresa)
  let proyectoId = '', proyecto = String(b.proyecto || '').slice(0, 120);
  if (b.proyectoId) { const p = sigProyectoVisible_(u, b.proyectoId); proyectoId = String(p.id); proyecto = (p.titulo + (proyecto ? ' · ' + proyecto : '')).slice(0, 160); }
  let logo = null; if (m.logoFileId && b.enviar !== false) { try { logo = DriveApp.getFileById(m.logoFileId).getBlob().setName('logo'); } catch (e) {} }
  const out = [];
  correos.forEach(em => {
    const tk = 'F' + Utilities.getUuid().replace(/-/g, '');
    sigAgregar_('Solicitudes', { token: tk, miembroId: m.miembroId, codigo: F.c, email: em, proyecto: proyecto, mensaje: msg, expira: ex, creadoPor: u.email, fecha: sigAhora_(), estado: 'pendiente', proyectoId: proyectoId });
    const link = b.base + '?f=' + tk; out.push({ email: em, link: link });
    if (b.enviar === false) return;
    const html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #dde3ee;border-radius:10px;overflow:hidden">' +
      '<div style="background:#0a1a3d;color:#fff;padding:18px;text-align:center">' + (logo ? '<img src="cid:logo" style="max-height:60px;max-width:200px;background:#fff;border-radius:6px;padding:4px"><br>' : '') +
      '<b style="font-size:18px">' + sigEsc_(nom) + '</b><br><span style="font-size:12px;color:#9fb3d9">' + sigEsc_(m.miembroId) + ' · Sistema Integrado de Gestión</span></div>' +
      '<div style="padding:20px;color:#1f2937"><p>Hola,</p><p><b>' + sigEsc_(nom) + '</b> te solicita diligenciar en línea el formato:</p>' +
      '<p style="font-size:17px;background:#eef4ff;border-radius:8px;padding:12px"><b>' + sigEsc_(F.c) + '</b> · ' + sigEsc_(F.t) + (proyecto ? '<br><span style="font-size:13px">Proyecto: ' + sigEsc_(proyecto) + '</span>' : '') + '</p>' +
      (F.d ? '<p style="font-size:13px;color:#4b5563">' + sigEsc_(F.d) + '</p>' : '') +
      (msg ? '<p style="border-left:3px solid #3d8bff;padding-left:10px;color:#374151">' + sigEsc_(msg) + '</p>' : '') +
      '<p style="text-align:center;margin:26px 0"><a href="' + link + '" style="background:#1d5fd8;color:#fff;text-decoration:none;padding:14px 26px;border-radius:8px;font-weight:bold;font-size:16px">Diligenciar en línea</a></p>' +
      '<p style="font-size:12px;color:#6b7280">Se abre en el navegador de tu celular o computador; no necesitas cuenta. El enlace es personal, sirve una sola vez y vence el ' + Utilities.formatDate(new Date(ex), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') + '.</p></div>' +
      '<div style="background:#f3f5f9;color:#6b7280;font-size:11px;padding:10px;text-align:center">SIG administrado por ' + sigEsc_(SIG.TITULAR) + ' · ' + sigEsc_(SIG.RED) + '</div></div>';
    try { MailApp.sendEmail({ to: em, subject: F.c + ' · ' + F.t + ' — ' + nom, htmlBody: html, name: nom, noReply: true, inlineImages: logo ? { logo: logo } : {} }); } catch (e) { out[out.length - 1].error = 'No se pudo enviar el correo'; }
  });
  sigBitacora_(u.email, m.miembroId, 'formulario_enviado', { codigo: F.c, destinatarios: correos, proyecto: proyecto, proyectoId: proyectoId });
  return { enviados: out };
}
function sigFormSolicitudes(u) {
  let mid = '*';
  if (u.rol !== 'admin') { const v = sigVinculo_(u.email); if (!v) return { solicitudes: [] }; mid = v.miembroId; }
  return { solicitudes: sigLeer_('Solicitudes').filter(x => mid === '*' || x.miembroId === mid).slice(-200).reverse().map(x => ({
    token: x.token, miembroId: x.miembroId, codigo: x.codigo, email: x.email, proyecto: x.proyecto, creadoPor: x.creadoPor, registroId: x.registroId,
    fecha: x.fecha instanceof Date ? x.fecha.toISOString() : x.fecha, expira: x.expira instanceof Date ? x.expira.toISOString() : x.expira,
    estado: x.estado, fechaRespuesta: x.fechaRespuesta instanceof Date ? x.fechaRespuesta.toISOString() : x.fechaRespuesta })) };
}
function sigFormRevocar(u, token) {
  const x = sigLeer_('Solicitudes').find(r => r.token === token); if (!x) throw new Error('Solicitud no encontrada.');
  if (u.rol !== 'admin') { const v = sigVinculo_(u.email); if (!v || v.miembroId !== x.miembroId || (x.creadoPor !== u.email && v.rolMiembro !== 'responsable')) throw new Error('No puedes revocar esta solicitud.'); }
  if (x.estado !== 'pendiente') throw new Error('La solicitud ya no está pendiente.');
  sigActualizar_('Solicitudes', x._fila, { estado: 'revocada' });
  sigBitacora_(u.email, x.miembroId, 'formulario_revocado', { codigo: x.codigo, email: x.email });
  return sigFormSolicitudes(u);
}
/** Pública (sin sesión): ver y enviar un formulario con su enlace personal. Llamar ANTES de validar la sesión. */
function sigFormPublico(q) {
  try {
    const busca = () => sigLeer_('Solicitudes').find(x => x.token === String(q.token || ''));
    let s = busca();
    if (!s) return { error: 'Enlace no válido.' };
    if (s.estado === 'revocada') return { error: 'Este enlace fue anulado por quien lo envió.' };
    if (s.estado === 'diligenciada') return { error: 'Este formulario ya fue diligenciado (registro ' + s.registroId + '). Gracias.' };
    if (new Date(s.expira) < new Date()) return { error: 'Este enlace venció. Pide uno nuevo a quien te lo envió.' };
    const F = sigForms_()[s.codigo], m = sigMiembro_(s.miembroId);
    if (!F || !m) return { error: 'El formulario ya no está disponible.' };
    if (q.paso !== 'enviar') return {
      form: F, email: s.email, proyecto: s.proyecto, mensaje: s.mensaje, expira: s.expira instanceof Date ? s.expira.toISOString() : s.expira,
      miembro: { miembroId: m.miembroId, nombre: m.nombreComercial || m.razonSocial, estadoSIG: m.estadoSIG }, logo: sigLogoDataUrl_(m), titular: SIG.TITULAR, red: SIG.RED };
    const datos = q.datos || {}, txt = JSON.stringify(datos);
    if (txt.length > 6 * 1024 * 1024) return { error: 'El formulario es demasiado pesado. Reduce las fotos.' };
    if (!String(datos._nombre || '').trim() || !String(datos._doc || '').trim()) return { error: 'Escribe tu nombre y documento.' };
    if (!sigImg_(datos._firma)) return { error: 'Falta tu firma.' };
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      delete SIG_RD_['Solicitudes']; s = busca();
      if (s.estado !== 'pendiente') return { error: 'Este formulario ya fue diligenciado.' };
      const rid = 'REG-' + Utilities.getUuid().slice(0, 8).toUpperCase(), ahora = sigAhora_(), shaDatos = sigSha_(txt);
      const html = sigFormHtml_(F, m, sigLogoPdf_(m), datos, { rid: rid, fecha: ahora, email: s.email, proyecto: s.proyecto, sha: shaDatos });
      const nom = m.miembroId + ' · ' + F.c + ' · ' + rid;
      const pdf = Utilities.newBlob(html, 'text/html', nom + '.html').getAs('application/pdf').setName(nom + '.pdf');
      const carpeta = sigCarpetaRegistros_(m), pf = carpeta.createFile(pdf), sha = sigShaBytes_(pdf.getBytes());
      const jf = carpeta.createFile(Utilities.newBlob(txt, 'application/json', nom + '.json'));
      pf.setDescription('Formulario en línea ' + rid + ' · SHA-256 PDF ' + sha + ' · datos ' + shaDatos + ' · ' + s.email);
      sigAgregar_('Registros', { registroId: rid, miembroId: m.miembroId, codigo: F.c, titulo: F.c + ' ' + F.t + (s.proyecto ? ' · ' + s.proyecto : ''), origen: 'formulario', fileId: jf.getId(), creadoPor: s.email, fecha: ahora, estado: 'cerrado', pdfId: pf.getId(), sha256: sha, cerradoPor: s.email, fechaCierre: ahora, proyectoId: s.proyectoId || '' });
      sigActualizar_('Solicitudes', s._fila, { estado: 'diligenciada', registroId: rid, fechaRespuesta: ahora });
      sigBitacora_('formulario:' + s.email, m.miembroId, 'formulario_recibido', { registroId: rid, codigo: F.c, nombre: String(datos._nombre).slice(0, 80), sha256: sha });
      try { MailApp.sendEmail({ to: s.creadoPor, subject: 'Formulario diligenciado: ' + F.c + ' · ' + rid, noReply: true, attachments: [pdf],
        body: String(datos._nombre) + ' (' + s.email + ') diligenció ' + F.c + ' ' + F.t + (s.proyecto ? ' para ' + s.proyecto : '') + '.\n\nRegistro: ' + rid + '\nSHA-256: ' + sha + '\n\nEl PDF quedó en Registros SIG de ' + (m.nombreComercial || m.razonSocial) + ' y se adjunta a este correo.' }); } catch (e) {}
      return { ok: true, registroId: rid, sha256: sha };
    } finally { lock.releaseLock(); }
  } catch (e) { return { error: e.message }; }
}
function sigFormHtml_(F, m, logo, d, meta) {
  const e = sigEsc_, val = v => sigImg_(v) ? '<img src="' + v + '" style="max-height:48px">' : e(v).replace(/\n/g, '<br>');
  const td = 'border:1px solid #c9d2e3;padding:5px;font-size:9.5pt;vertical-align:top', th = td + ';background:#e8eef9;font-weight:bold';
  let o = '<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#111">' +
    '<table style="width:100%;border-collapse:collapse"><tr><td rowspan="2" style="' + td + ';width:22%;text-align:center">' + (logo ? '<img src="' + logo + '" style="max-height:52px;max-width:150px"><br>' : '') + '<span style="font-size:8pt">' + e(m.nombreComercial || m.razonSocial) + '<br>' + e(m.miembroId) + '</span></td>' +
    '<td style="' + td + ';text-align:center"><b style="color:#12408f">SISTEMA INTEGRADO DE GESTIÓN</b><br>' + e(SIG.RED) + '</td><td style="' + td + ';width:26%"><b>Código: ' + e(F.c) + '</b><br>Versión ' + e(F.v) + '</td></tr>' +
    '<tr><td style="' + td + ';text-align:center"><b>' + e(String(F.t).toUpperCase()) + '</b></td><td style="' + td + '">Registro <b>' + e(meta.rid) + '</b><br>' + e(meta.fecha.slice(0, 16).replace('T', ' ')) + ' UTC</td></tr></table>' +
    (meta.proyecto ? '<p style="font-size:9.5pt"><b>Proyecto:</b> ' + e(meta.proyecto) + '</p>' : '');
  F.s.forEach((b, i) => {
    o += '<h4 style="color:#12408f;margin:12px 0 4px">' + e(b.t) + '</h4>';
    if (b.n) o += '<p style="font-size:8.5pt;font-style:italic;margin:2px 0">' + e(b.n) + '</p>';
    if (b.x) o += '<p style="font-size:8.5pt;color:#555;margin:2px 0">' + e(b.x) + '</p><div style="' + td + '">' + val(d['s' + i + '.x']) + '&nbsp;</div>';
    if (b.p) { o += '<table style="width:100%;border-collapse:collapse">'; for (let j = 0; j < b.p.length; j += 2) o += '<tr><td style="' + th + ';width:22%">' + e(b.p[j]) + '</td><td style="' + td + ';width:28%">' + val(d['s' + i + '.p' + j]) + '</td><td style="' + th + ';width:22%">' + e(b.p[j + 1] || '') + '</td><td style="' + td + ';width:28%">' + (b.p[j + 1] ? val(d['s' + i + '.p' + (j + 1)]) : '') + '</td></tr>'; o += '</table>'; }
    if (b.k) { o += '<table style="width:100%;border-collapse:collapse"><tr><td style="' + th + '">Verificación</td><td style="' + th + ';width:9%;text-align:center">Cumple</td><td style="' + th + ';width:9%;text-align:center">No cumple</td><td style="' + th + ';width:7%;text-align:center">N/A</td></tr>';
      b.k.forEach((c, j) => { const r = d['s' + i + '.k' + j]; o += '<tr><td style="' + td + '">' + e(c) + '</td>' + ['C', 'NC', 'NA'].map(z => '<td style="' + td + ';text-align:center;font-weight:bold">' + (r === z ? 'X' : '') + '</td>').join('') + '</tr>'; }); o += '</table>'; }
    if (b.g) { const filas = Array.isArray(d['s' + i + '.g']) ? d['s' + i + '.g'] : [], fs = b.g.h.length > 14 ? ';font-size:5.5pt;padding:2px' : b.g.h.length > 8 ? ';font-size:7pt;padding:3px' : '';
      o += '<table style="width:100%;border-collapse:collapse"><tr>' + b.g.h.map(h => '<td style="' + th + fs + '">' + e(h) + '</td>').join('') + '</tr>';
      (filas.length ? filas : [[]]).forEach(f => { o += '<tr>' + b.g.h.map((h, c) => '<td style="' + td + fs + '">' + val((f || [])[c]) + '&nbsp;</td>').join('') + '</tr>'; }); o += '</table>'; }
  });
  o += '<h4 style="color:#12408f;margin:14px 0 4px">Diligenciado por</h4><table style="width:100%;border-collapse:collapse"><tr><td style="' + th + ';width:22%">Nombre</td><td style="' + td + '">' + e(d._nombre) + '</td><td style="' + th + ';width:18%">Documento</td><td style="' + td + '">' + e(d._doc) + '</td></tr>' +
    '<tr><td style="' + th + '">Correo</td><td style="' + td + '">' + e(meta.email) + '</td><td style="' + th + '">Ubicación GPS</td><td style="' + td + '">' + e(d._gps || 'No registrada') + '</td></tr>' +
    '<tr><td style="' + th + '">Firma</td><td style="' + td + '" colspan="3">' + val(d._firma) + '</td></tr></table>';
  const fotos = (Array.isArray(d._fotos) ? d._fotos : []).filter(sigImg_).slice(0, 4);
  if (fotos.length) o += '<h4 style="color:#12408f;margin:14px 0 4px">Registro fotográfico</h4>' + fotos.map(f => '<img src="' + f + '" style="width:48%;margin:0 1% 8px 0">').join('');
  o += '<p style="font-size:7.5pt;color:#555;border-top:1px solid #c9d2e3;margin-top:14px;padding-top:6px">Registro generado en línea en la plataforma ENTALPIA LABS · SIG administrado por ' + e(SIG.TITULAR) + '. Huella SHA-256 de los datos: ' + e(meta.sha) + '. Documento cerrado: no admite modificaciones.</p></body></html>';
  return o;
}

// =====================================================================================
//  DOCUMENTOS DEL SIG EN LA FICHA DEL PROYECTO Y EN EL PAQUETE DE ENTREGA
// =====================================================================================
/** Proyecto que el usuario puede ver: propio, compartido, de su misma empresa o cualquiera si es administrador. */
function sigProyectoVisible_(u, proyectoId) {
  const p = rows('Proyectos').find(x => String(x.id) === String(proyectoId));
  if (!p) throw new Error('Proyecto no encontrado.');
  if (u.rol === 'admin' || p.owner === u.email) return p;
  if (String(p.miembros || '').toLowerCase().split(',').map(z => z.trim()).indexOf(u.email) >= 0) return p;
  const v = sigVinculo_(u.email);
  if (v && p.miembroId && p.miembroId === v.miembroId) return p;
  throw new Error('No tienes acceso a ese proyecto.');
}
/** Registros del SIG vinculados a un proyecto y formularios enviados que siguen pendientes. */
function sigRegistrosProyecto(u, proyectoId) {
  const p = sigProyectoVisible_(u, proyectoId), id = String(p.id);
  const pend = sigLeer_('Solicitudes').filter(x => String(x.proyectoId) === id && x.estado === 'pendiente' && new Date(x.expira) > new Date())
    .map(x => ({ codigo: x.codigo, email: x.email, fecha: x.fecha instanceof Date ? x.fecha.toISOString() : x.fecha, token: x.token }));
  return { registros: sigRegistrosDe_('*').filter(r => String(r.proyectoId) === id), pendientes: pend };
}
/** Para el paquete de entrega (acción 'paquete' de Código.gs): archivos de todos los registros del proyecto. */
function sigBlobsProyecto_(proyectoId) {
  const out = [], lista = [];
  sigLeer_('Registros').filter(r => String(r.proyectoId) === String(proyectoId)).forEach(r => {
    try {
      const f = DriveApp.getFileById(r.pdfId || r.fileId), bl = f.getBlob();
      let n = bl.getName() || f.getName();
      if (f.getMimeType().indexOf('application/vnd.google-apps') === 0 && !/\.pdf$/i.test(n)) n += '.pdf';
      out.push(bl.setName('Documentos SIG/' + r.registroId + ' - ' + String(n).replace(/[\\/:*?"<>|]/g, '_')));
      lista.push(r.registroId + ' | ' + r.codigo + ' | ' + r.titulo + ' | ' + r.estado + ' | SHA-256 ' + (r.sha256 || '—'));
    } catch (e) {}
  });
  // Bitácora de campo del proyecto (los archivos ya están en la carpeta del proyecto y entran al paquete)
  const camp = sigLeer_('Campo').filter(e => String(e.proyectoId) === String(proyectoId));
  if (camp.length) out.push(Utilities.newBlob(camp.map(e => sigFechaTxt_(e.fecha) + ' | ' + e.tipo + ' | ' + e.autor + ' <' + e.email + '>' + (e.gps ? ' | GPS ' + e.gps : '') + '\n' + e.texto +
    (String(e.archivos || '') ? '\nArchivos: ' + JSON.parse(e.archivos || '[]').map(a => a.n).join(', ') : '')).join('\n\n----------------\n\n'), 'text/plain', 'Bitacora de campo.txt'));
  return { blobs: out, lista: lista };
}
const sigFechaTxt_ = f => Utilities.formatDate(f instanceof Date ? f : new Date(f), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');

// =====================================================================================
//  BITÁCORA DE CAMPO: el personal registra la prestación del servicio (avances, novedades,
//  fotos, videos y documentos) desde el portal o con un enlace de campo sin cuenta.
//  Los archivos quedan en la carpeta del proyecto (Archivos y fotos) y entran al paquete.
// =====================================================================================
const SIG_CAMPO_TIPOS = ['Avance del día', 'Novedad', 'Incidente o casi accidente', 'Visita / reunión', 'Material o equipo', 'Prueba o medición', 'Entrega parcial', 'Otro'];
const SIG_CAMPO_MAX = 30 * 1024 * 1024;
function sigCampoEntradaDe_(id) { const e = sigLeer_('Campo').find(x => x.id === id); if (!e) throw new Error('Entrada no encontrada.'); return e; }
function sigCampoJson_(e) {
  return { id: e.id, fecha: e.fecha instanceof Date ? e.fecha.toISOString() : e.fecha, tipo: e.tipo, texto: e.texto, autor: e.autor, email: e.email, origen: e.origen, gps: e.gps,
    archivos: (() => { try { return JSON.parse(e.archivos || '[]'); } catch (x) { return []; } })() };
}
function sigCampoLista_(proyectoId) { return sigLeer_('Campo').filter(e => String(e.proyectoId) === String(proyectoId)).reverse().slice(0, 200).map(sigCampoJson_); }
function sigCampoEntrada_(p, autor, email, origen, b) {
  const texto = String(b.texto || '').trim().slice(0, 4000);
  if (!texto && !b.conArchivos) throw new Error('Escribe una descripción o agrega archivos.');
  const tipo = SIG_CAMPO_TIPOS.indexOf(b.tipo) >= 0 ? b.tipo : 'Otro', id = 'C' + Utilities.getUuid().slice(0, 8);
  sigAgregar_('Campo', { id: id, proyectoId: String(p.id), fecha: sigAhora_(), tipo: tipo, texto: texto, autor: String(autor).slice(0, 80), email: email, origen: origen, gps: String(b.gps || '').slice(0, 80), archivos: '[]' });
  sigBitacora_(email, p.miembroId || '', 'campo_entrada', { proyecto: String(p.id), tipo: tipo });
  CacheService.getScriptCache().put('v_' + p.id, String(Date.now()), 21600);
  return { id: id };
}
function sigCampoArchivo_(e, b, autor) {
  const p = rows('Proyectos').find(x => String(x.id) === String(e.proyectoId));
  if (!p || !p.carpeta) throw new Error('El proyecto no tiene carpeta de archivos.');
  const bytes = Utilities.base64Decode(String(b.b64 || ''));
  if (!bytes.length) throw new Error('No llegó el archivo.');
  if (bytes.length > SIG_CAMPO_MAX) throw new Error('El archivo supera 30 MB.');
  const fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
  const nombre = (fecha + ' · ' + String(b.nombre || 'archivo')).replace(/[\\/:*?"<>|]/g, '_').slice(0, 140);
  const f = DriveApp.getFolderById(p.carpeta).createFile(Utilities.newBlob(bytes, String(b.mime || 'application/octet-stream'), nombre));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  f.setDescription('Bitácora de campo ' + e.id + ' · ' + e.tipo + ' · ' + autor + ' · SHA-256 ' + sigShaBytes_(bytes));
  add('Archivos', { id: uid(), proyecto: p.id, nombre: nombre, fid: f.getId(), autor: String(autor).slice(0, 80) + ' (campo)', fecha: now() });
  const lista = (() => { try { return JSON.parse(e.archivos || '[]'); } catch (x) { return []; } })();
  lista.push({ fid: f.getId(), n: nombre, m: String(b.mime || '') });
  sigActualizar_('Campo', e._fila, { archivos: JSON.stringify(lista) });
  CacheService.getScriptCache().put('v_' + p.id, String(Date.now()), 21600);
  return { fid: f.getId(), nombre: nombre };
}
function sigCampoListar(u, proyectoId) {
  const p = sigProyectoVisible_(u, proyectoId);
  const en = sigLeer_('EnlacesCampo').filter(x => String(x.proyectoId) === String(p.id)).reverse().map(x => ({ token: x.token, email: x.email,
    expira: x.expira instanceof Date ? x.expira.toISOString() : x.expira, estado: x.estado, creadoPor: x.creadoPor }));
  return { entradas: sigCampoLista_(p.id), enlaces: en, tipos: SIG_CAMPO_TIPOS };
}
function sigCampoEnlace(u, b) {
  const p = sigProyectoVisible_(u, b.proyectoId);
  if (!/^https?:\/\//.test(b.base || '')) throw new Error('Enlace base inválido.');
  const correos = String(b.emails || '').split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
  if (!correos.length) throw new Error('Escribe al menos un correo.');
  if (correos.length > 20) throw new Error('Máximo 20 correos por envío.');
  const malo = correos.find(x => !/^\S+@\S+\.\S+$/.test(x)); if (malo) throw new Error('Correo inválido: ' + malo);
  const d = Math.max(1, Math.min(90, +b.dias || 30)), ex = new Date(Date.now() + d * 864e5).toISOString(), msg = String(b.mensaje || '').slice(0, 500);
  const m = p.miembroId ? sigMiembro_(p.miembroId) : null, nom = m ? (m.nombreComercial || m.razonSocial) : SIG.TITULAR;
  let logo = null; if (m && m.logoFileId) { try { logo = DriveApp.getFileById(m.logoFileId).getBlob().setName('logo'); } catch (e) {} }
  const out = [];
  correos.forEach(em => {
    const tk = 'K' + Utilities.getUuid().replace(/-/g, ''), link = b.base + '?campo=' + tk;
    sigAgregar_('EnlacesCampo', { token: tk, proyectoId: String(p.id), email: em, expira: ex, creadoPor: u.email, fecha: sigAhora_(), estado: 'activo', mensaje: msg });
    out.push({ email: em, link: link });
    if (b.enviar === false) return;
    const html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #dde3ee;border-radius:10px;overflow:hidden"><div style="background:#0a1a3d;color:#fff;padding:18px;text-align:center">' +
      (logo ? '<img src="cid:logo" style="max-height:60px;max-width:200px;background:#fff;border-radius:6px;padding:4px"><br>' : '') + '<b style="font-size:18px">' + sigEsc_(nom) + '</b></div>' +
      '<div style="padding:20px;color:#1f2937"><p>Hola,</p><p>Te damos acceso a la <b>bitácora de campo</b> del proyecto:</p><p style="font-size:17px;background:#eef4ff;border-radius:8px;padding:12px"><b>' + sigEsc_(p.titulo) + '</b>' + (p.cliente ? '<br><span style="font-size:13px">' + sigEsc_(p.cliente) + '</span>' : '') + '</p>' +
      (msg ? '<p style="border-left:3px solid #3d8bff;padding-left:10px">' + sigEsc_(msg) + '</p>' : '') +
      '<p>Desde el celular podrás registrar avances, novedades, fotos, videos y documentos de la prestación del servicio, y diligenciar los formatos del SIG de la fase actual.</p>' +
      '<p style="text-align:center;margin:26px 0"><a href="' + link + '" style="background:#1d5fd8;color:#fff;text-decoration:none;padding:14px 26px;border-radius:8px;font-weight:bold;font-size:16px">Abrir bitácora de campo</a></p>' +
      '<p style="font-size:12px;color:#6b7280">Guarda este correo: el enlace es personal, puedes usarlo varias veces y vence el ' + Utilities.formatDate(new Date(ex), Session.getScriptTimeZone(), 'dd/MM/yyyy') + '. No necesitas cuenta.</p></div>' +
      '<div style="background:#f3f5f9;color:#6b7280;font-size:11px;padding:10px;text-align:center">SIG administrado por ' + sigEsc_(SIG.TITULAR) + '</div></div>';
    try { MailApp.sendEmail({ to: em, subject: 'Bitácora de campo · ' + p.titulo, htmlBody: html, name: nom, noReply: true, inlineImages: logo ? { logo: logo } : {} }); } catch (e) { out[out.length - 1].error = 'No se pudo enviar el correo'; }
  });
  sigBitacora_(u.email, p.miembroId || '', 'campo_enlace', { proyecto: String(p.id), destinatarios: correos });
  return { enviados: out };
}
function sigCampoRevocar(u, token) {
  const x = sigLeer_('EnlacesCampo').find(r => r.token === token); if (!x) throw new Error('Enlace no encontrado.');
  sigProyectoVisible_(u, x.proyectoId);
  sigActualizar_('EnlacesCampo', x._fila, { estado: 'revocado' });
  return sigCampoListar(u, x.proyectoId);
}
/** Pública (sin sesión): página de campo con enlace personal. Llamar ANTES de validar la sesión. */
function sigCampoPublico(q) {
  try {
    const C = CacheService.getScriptCache(), k = 'ca_' + q.token, f = +C.get(k) || 0;
    if (f >= 10) return { error: 'Demasiados intentos. Intenta en 10 minutos.' };
    const x = sigLeer_('EnlacesCampo').find(r => r.token === String(q.token || ''));
    if (!x) { C.put(k, String(f + 1), 600); return { error: 'Enlace no válido.' }; }
    if (x.estado !== 'activo') return { error: 'Este enlace fue anulado. Pide uno nuevo al responsable del proyecto.' };
    if (new Date(x.expira) < new Date()) return { error: 'Este enlace venció. Pide uno nuevo al responsable del proyecto.' };
    const p = rows('Proyectos').find(r => String(r.id) === String(x.proyectoId)); if (!p) return { error: 'El proyecto ya no existe.' };
    const m = p.miembroId ? sigMiembro_(p.miembroId) : null;
    if (q.paso === 'entrada') return sigCampoEntrada_(p, String(q.autor || x.email).slice(0, 80), x.email, 'enlace', q);
    if (q.paso === 'archivo') { const e = sigCampoEntradaDe_(q.entradaId); if (String(e.proyectoId) !== String(p.id) || e.email !== x.email) return { error: 'Entrada no válida.' }; return sigCampoArchivo_(e, q, e.autor); }
    if (q.paso === 'form') {
      if (!m) return { error: 'Este proyecto no pertenece a una empresa de la red.' };
      const F = sigForms_()[q.codigo]; if (!F) return { error: 'Ese formato no tiene formulario en línea.' };
      const tk = 'F' + Utilities.getUuid().replace(/-/g, '');
      sigAgregar_('Solicitudes', { token: tk, miembroId: m.miembroId, codigo: F.c, email: x.email, proyecto: p.titulo, mensaje: 'Diligenciado desde la bitácora de campo', expira: new Date(Date.now() + 3 * 864e5).toISOString(), creadoPor: x.creadoPor, fecha: sigAhora_(), estado: 'pendiente', proyectoId: String(p.id) });
      return { link: String(q.base || '') + '?f=' + tk };
    }
    const nf = String(q.n || '').length;
    return { proyecto: { id: p.id, titulo: p.titulo, cliente: p.cliente, ubicacion: p.ubicacion, tipo: p.tipo, estado: p.estado, avance: p.avance },
      email: x.email, expira: x.expira instanceof Date ? x.expira.toISOString() : x.expira, mensaje: x.mensaje, tipos: SIG_CAMPO_TIPOS,
      miembro: m ? { miembroId: m.miembroId, nombre: m.nombreComercial || m.razonSocial } : null, logo: m ? sigLogoDataUrl_(m) : '', titular: SIG.TITULAR,
      formularios: m ? Object.keys(sigForms_()) : [], entradas: sigCampoLista_(p.id).slice(0, 40) };
  } catch (e) { return { error: e.message }; }
}

// ---------- DEFINICIONES DE LOS FORMULARIOS EN LÍNEA (31 formatos del SIG; generado desde formularios.json) ----------
const SIG_FORMS_LOCAL = {"CN-FO-04":{"c":"CN-FO-04","t":"Acta de prueba de hermeticidad","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Identificación","p":["Miembro (razón social)","NIT","Proyecto (código)","Cliente","Dirección / ubicación","Distribuidor","Uso (residencial / comercial / red PE)","Tipo de gas (GN / GLP)","Fecha","Tramo o sección probada"]},{"t":"2. Condiciones de la prueba","n":"Valores según CN-IN-01, tabla A. Medio de prueba: aire o gas inerte. Prohibidos oxígeno, agua y gas combustible.","p":["Presión de operación","Presión de ensayo exigida","Medio de prueba","Tiempo mínimo exigido","Sellante anaeróbico usado (sí/no)","Tiempo de curado cumplido (sí/no)","Medidores, reguladores y artefactos desconectados (sí/no)","Temperatura ambiente"]},{"t":"3. Instrumento de medición","p":["Código del manómetro","Rango","Clase / grado de precisión","Calibración vigente hasta","Presión de ensayo como % del rango (25 % a 75 %)","Laboratorio de calibración"]},{"t":"4. Lecturas","g":{"h":["Intento","Hora inicial","Lectura inicial","Hora final","Lectura final","Variación","Resultado"],"r":3,"pre":["1","2","3"]}},{"t":"5. Fugas encontradas y correcciones","g":{"h":["Ubicación de la fuga","Método de detección","Corrección realizada","Repetición de prueba (intento N.º)"],"r":3}},{"t":"6. Verificaciones","k":["Todas las salidas taponadas con tapón metálico y sellante especificado","Válvulas maniobradas durante la prueba y herméticas","Sin fuentes de ignición en el área durante la prueba","Cero variación de lectura en el último intento","Instalación despresurizada y taponada al terminar"]},{"t":"7. Resultado y firmas","x":"Resultado final:   ☐ CONFORME   ☐ NO CONFORME (no se libera)","g":{"h":["Rol","Nombre","Certificado de competencia / matrícula","Inscripción SIC","Firma"],"r":3,"pre":["Ejecutor","Testigo","Libera (director técnico)"]}}],"d":"Evidencia que la red de gas construida o modificada es hermética antes de ponerla en servicio. Es el soporte técnico de la liberación de la instalación ante el cliente, el distribuidor y el organismo de inspección; sin este registro conforme la instalación no se libera.","i":["Identifica el proyecto, la dirección, el tramo o la instalación probada y la fecha.","Registra las condiciones de la prueba: fluido usado (aire o gas inerte, nunca gas combustible), presión de prueba, tiempo de estabilización y duración exigida por la norma aplicable.","Anota el manómetro o registrador usado con su número de serie y el certificado de calibración vigente.","En Lecturas, registra hora, presión y temperatura al inicio, durante y al final de la prueba.","Si hubo fugas, describe dónde estaban y cómo se corrigieron; repite la prueba después de corregir.","Completa las verificaciones y marca el resultado final (conforme o no conforme). Firman el ejecutor, el testigo y quien libera (director técnico)."]},"GI-FO-01":{"c":"GI-FO-01","t":"Solicitud de creación, modificación o anulación de documentos","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos de la solicitud","p":["Fecha","N.º de solicitud","Solicitante","Cargo / miembro","Proceso","Tipo de solicitud (crear / modificar / anular)"]},{"t":"2. Documento","p":["Código (si existe)","Título","Versión actual","Tipo de documento"]},{"t":"3. Descripción y justificación del cambio","x":"Describa el cambio propuesto (adjunte borrador con control de cambios) y la razón: cambio normativo, hallazgo de auditoría, mejora, cambio de proceso, solicitud de cliente."},{"t":"4. Análisis de impacto","k":["¿Afecta otros documentos del SIG?","¿Requiere formación del personal?","¿Afecta requisitos legales o del cliente?","¿Afecta peligros, riesgos o aspectos ambientales?","¿Afecta la configuración de la plataforma?"]},{"t":"5. Decisión","p":["Revisó (líder de proceso)","Fecha","Aprobó (gerente)","Fecha","Decisión (aprobada / rechazada)","Nueva versión"]}],"d":"Solicitud formal para crear, modificar o anular un documento del SIG. Garantiza que ningún documento cambie sin justificación, análisis de impacto y aprobación de la función central (control de la información documentada, ISO 9001 num. 7.5).","i":["Registra quién solicita, su empresa y la fecha.","Indica el código y el título del documento, o “nuevo” si se va a crear.","Describe el cambio propuesto y su razón: cambio normativo, hallazgo de auditoría, mejora o error detectado. Adjunta el borrador si lo tienes.","En Análisis de impacto, marca si el cambio afecta otros documentos, la formación del personal, los registros en uso o requisitos legales.","La sección Decisión la diligencia el Coordinador del SIG: aprobado, rechazado o con ajustes, nueva versión y fecha de vigencia."]},"GI-FO-05":{"c":"GI-FO-05","t":"Solicitud y evaluación de cambios","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Identificación del cambio","p":["Fecha","N.º de cambio","Solicitante","Proceso / miembro","Tipo (organizacional, legal, tecnológico, de proceso, de personal, de proveedor, de diseño)","Fecha prevista de implementación"]},{"t":"2. Descripción, propósito y consecuencias potenciales","x":"Qué cambia, por qué y qué podría salir mal (ISO 9001:2026 num. 6.3)."},{"t":"3. Evaluación de riesgos del cambio","g":{"h":["Peligro / riesgo / aspecto","Calidad","SST","Ambiente","Control propuesto","Responsable"],"r":5}},{"t":"4. Recursos, responsabilidades y comunicación","k":["Recursos disponibles","Responsables asignados","Documentos a actualizar identificados","Formación necesaria identificada","Partes interesadas informadas","Consulta con trabajadores realizada (ISO 45001 num. 5.4)"]},{"t":"5. Aprobación y verificación posterior","p":["Aprobó","Fecha","Verificación de eficacia (fecha)","Resultado"]}],"d":"Planifica y controla los cambios en procesos, equipos, personal, proveedores o requisitos antes de implementarlos, para que se hagan de forma controlada y sin riesgos nuevos (gestión del cambio, ISO 9001 num. 6.3 e ISO 45001 num. 8.1.3).","i":["Identifica el cambio: qué cambia, en qué proceso o proyecto, quién lo propone y la fecha prevista.","Describe el propósito del cambio y qué podría salir mal si se implementa mal.","En Evaluación de riesgos, lista cada peligro o riesgo nuevo, su valoración y el control que se aplicará.","Verifica recursos, responsables, formación necesaria y a quién se debe comunicar el cambio.","Registra la aprobación y, después de implementado, la verificación de eficacia con fecha y resultado."]},"GI-FO-09":{"c":"GI-FO-09","t":"Lista de verificación de admisión de miembros","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos del solicitante","p":["Razón social o nombre","NIT / documento","Representante legal","Cuenta oficial en el portal","Servicios solicitados en el alcance","Sedes / sitios","N.º de trabajadores","Fecha de solicitud"]},{"t":"2. Requisitos legales y contractuales","k":["Existencia y representación legal vigente (≤ 30 días) o RUT para persona natural","Convenio de adhesión firmado (CE-CO-01)","Afiliación a seguridad social y ARL de todos los trabajadores","Autoevaluación de estándares mínimos SG-SST (Res. 0312) con plan de mejora","Póliza de responsabilidad civil extracontractual vigente (si aplica)","Adopción por escrito de la política DE-PO-01 y del código DE-PO-02","Autorización de tratamiento de datos personales"]},{"t":"3. Competencia técnica","k":["Técnicos de gas con certificado de competencia laboral vigente (Res. 90902 num. 6.1)","Ingenieros con matrícula profesional COPNIA vigente","Certificados de trabajo en alturas vigentes (si aplica)","Responsable del SG-SST con licencia y curso de 50 horas","Responsable SIG del miembro designado y formado en el SIG"]},{"t":"4. Infraestructura y equipos","k":["Inventario de equipos de medición cargado en la plataforma","Certificados de calibración vigentes de manómetros y detectores","Herramientas y EPP adecuados al alcance"]},{"t":"5. Implementación del SIG","k":["Uso de documentos vigentes demostrado","Al menos un servicio piloto ejecutado con registros completos POSTERIOR a la fecha de solicitud (sin retroactividad)","Auditoría interna de admisión sin no conformidades mayores abiertas"]},{"t":"6. Decisión","p":["Resultado (aprobado: pasa a Adscrito / no aprobado: vuelve a Implementación con plan de acción)","Fecha de ingreso al SIG","Alcance aprobado","Firma Coordinador del SIG","Firma Gerente","Observaciones"]}],"d":"Lista de verificación con la que la función central decide la admisión de una empresa a la red como miembro Adscrito del SIG. Es el soporte de la decisión de admisión y del alcance aprobado.","i":["Diligencia los datos del solicitante tal como aparecen en su documento legal (cámara de comercio o RUT).","Revisa cada requisito con el soporte a la vista y marca Cumple, No cumple o N/A. No marques Cumple sin evidencia.","En Implementación del SIG, verifica que el servicio piloto sea POSTERIOR a la fecha de solicitud: el SIG no se aplica de forma retroactiva.","En Decisión, registra si es aprobado o no, la fecha de ingreso al SIG y el alcance aprobado (solo los servicios evaluados).","Si no es aprobado, anota en Observaciones el plan de acción y la empresa vuelve a estado Implementación."]},"GI-FO-12":{"c":"GI-FO-12","t":"Inspección planeada y recorrido gerencial HSEQ","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Miembro","Proyecto / sede","Inspector(es)","Participación COPASST/vigía (sí/no)","Tipo (recorrido gerencial / inspección planeada)"]},{"t":"2. Verificaciones","k":["Documentos vigentes disponibles en sitio (plano aprobado, plan de calidad)","Personal con certificados de competencia y alturas vigentes","Permisos de trabajo diligenciados antes de iniciar","Equipos de medición con etiqueta de calibración vigente","EPP completo y en buen estado","Detector de gas con prueba funcional del día","Extintor y botiquín disponibles","Señalización y aislamiento del área","Orden y aseo; separación de residuos","Zanjas con entibado/talud y señalización nocturna","Registros diligenciados en tiempo real","Trabajadores conocen la política y cómo detener un trabajo inseguro"]},{"t":"3. Hallazgos y acciones","g":{"h":["Hallazgo","Tipo (acto / condición / documental)","Acción inmediata","Responsable","Fecha de cierre"],"r":5}}],"d":"Registro de las inspecciones planeadas y los recorridos gerenciales en obra o en sede, para verificar en sitio las condiciones de seguridad, calidad y ambiente y corregir a tiempo actos y condiciones inseguras.","i":["Registra fecha, proyecto o sede, inspectores y si participó el COPASST o vigía.","Recorre el sitio y marca cada verificación: Cumple, No cumple o N/A.","Por cada No cumple, registra un hallazgo en la tabla: qué se encontró, si es acto, condición o documental, la acción inmediata, el responsable y la fecha de cierre.","Adjunta fotos de los hallazgos principales como evidencia.","Socializa los hallazgos con el responsable del frente de trabajo antes de retirarte."]},"GI-FO-20":{"c":"GI-FO-20","t":"Permiso de trabajo en alturas","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos del trabajo","n":"Obligatorio para trabajos a 2,0 m o más sobre un nivel inferior (Res. 4272 de 2021). Vigencia máxima: la jornada. Se revalida si cambian las condiciones.","p":["Fecha","Hora de inicio / fin","Proyecto / dirección","Altura aproximada (m)","Descripción de la tarea","Emisor del permiso (coordinador de alturas)"]},{"t":"2. Trabajadores autorizados","g":{"h":["Nombre","Documento","Certificado de alturas (nivel y vigencia)","Aptitud médica vigente","Firma"],"r":4}},{"t":"3. Verificación previa","k":["Análisis de riesgos de la tarea realizado y socializado","Medidas de prevención: barandas, delimitación, señalización","Sistema de protección: arnés cuerpo entero, eslinga con absorbedor, conectores, anclajes certificados (≥ 5000 lb por persona)","Inspección preuso de equipos realizada y sin defectos","Andamios/escaleras inspeccionados y certificados","Plan de rescate específico disponible y rescatista designado","Condiciones climáticas adecuadas (sin lluvia ni viento fuerte)","Líneas eléctricas a distancia de seguridad (RETIE)","Ayudante de seguridad designado"]},{"t":"4. Autorización y cierre","p":["Firma del emisor","Firma del responsable de la tarea","Hora de cierre","Observaciones de cierre"]}],"d":"Autoriza y controla cada trabajo a 2,0 m o más sobre un nivel inferior (Res. 4272 de 2021). Es obligatorio antes de iniciar; vale solo para la jornada y se revalida si cambian las condiciones.","i":["Diligéncialo ANTES de iniciar el trabajo, en el sitio.","Registra fecha, horario, dirección, altura aproximada, la tarea y el emisor (coordinador de trabajo en alturas).","Anota cada trabajador autorizado con su documento, certificado de alturas (nivel y vigencia) y aptitud médica; cada uno firma.","Revisa todas las verificaciones previas con el equipo; si alguna queda en No cumple, NO se inicia el trabajo.","Al terminar, registra la hora de cierre, las observaciones y las firmas de cierre."]},"GI-FO-21":{"c":"GI-FO-21","t":"Permiso de ingreso a espacios confinados","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","n":"Res. 0491 de 2020. Ningún trabajador ingresa sin monitoreo atmosférico previo y continuo, vigía en el exterior y plan de rescate.","p":["Fecha","Hora de inicio / fin","Espacio (cámara, sótano, tanque)","Clasificación (con o sin permiso)","Tarea","Supervisor de entrada"]},{"t":"2. Monitoreo atmosférico","g":{"h":["Hora","O2 (19,5–23,5 %)","LEL (< 10 %)","CO (< 25 ppm)","H2S (< 10 ppm)","Equipo (serie y calibración)","Firma"],"r":5}},{"t":"3. Verificación previa","k":["Aislamiento de energías y fluidos (bloqueo y etiquetado)","Ventilación forzada instalada","Vigía designado y comunicado con el entrante","Equipo de rescate (trípode, malacate, arnés) en sitio","Plan de rescate y número de emergencia","Entrantes con formación en espacios confinados","Iluminación y herramientas antichispa","EPP respiratorio adecuado"]},{"t":"4. Personal y autorización","g":{"h":["Nombre","Rol (entrante / vigía / supervisor / rescatista)","Hora entrada","Hora salida","Firma"],"r":4}}],"d":"Autoriza y controla el ingreso a espacios confinados como cámaras, sótanos o tanques (Res. 0491 de 2020). Ningún trabajador entra sin monitoreo atmosférico previo y continuo, vigía en el exterior y plan de rescate.","i":["Diligéncialo ANTES del ingreso, en el sitio.","Identifica el espacio, su clasificación, la tarea y el supervisor de entrada.","Mide la atmósfera antes de entrar y luego periódicamente: O2 entre 19,5 % y 23,5 %, LEL menor a 10 %, CO menor a 25 ppm y H2S menor a 10 ppm. Registra el equipo usado con su calibración.","Si alguna medición sale fuera de rango, nadie entra o todos salen de inmediato.","Verifica aislamiento, ventilación, vigía, equipo de rescate y formación; registra entrantes, vigía y supervisor con horas de entrada y salida y sus firmas."]},"GI-FO-22":{"c":"GI-FO-22","t":"Permiso de trabajo en caliente","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Hora de inicio / fin","Ubicación","Tarea (soldadura, corte, esmerilado, termofusión)","Emisor","Ejecutor"]},{"t":"2. Verificación","k":["Línea de gas aislada, despresurizada y purgada o confirmada fuera de servicio","Medición de explosividad en radio de 11 m: LEL 0 % (registrar valor)","Material combustible retirado o protegido en radio de 11 m","Extintor ABC de 20 lb a menos de 5 m","Vigía contra incendio durante el trabajo y 30 minutos después","Equipos de soldadura inspeccionados (cilindros asegurados, válvulas antirretroceso)","EPP: careta, guantes, peto, ropa ignífuga"]},{"t":"3. Mediciones","g":{"h":["Hora","% LEL","Equipo","Firma"],"r":3}},{"t":"4. Cierre","p":["Hora de finalización","Hora de fin de vigilancia post-trabajo","Firma del emisor","Firma del vigía"]}],"d":"Autoriza y controla trabajos que generan chispa, llama o calor (soldadura, corte, termofusión) cerca de gas o materiales combustibles, para prevenir incendios y explosiones.","i":["Diligéncialo ANTES de iniciar el trabajo en caliente.","Registra la tarea, el lugar, el horario y los responsables.","Verifica aislamiento de la línea, retiro de combustibles, extintor a la mano, vigía de fuego y EPP.","Mide la atmósfera (LEL) antes y durante el trabajo y registra cada medición con la hora.","Al cierre, inspecciona el área al menos 30 minutos después de terminar para descartar puntos calientes, y firma el cierre."]},"GI-FO-23":{"c":"GI-FO-23","t":"Registro de purga y puesta en servicio","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos de la instalación","n":"Solo se purga una instalación que superó la prueba de hermeticidad (CN-FO-04) y, cuando aplica, la inspección reglamentaria. La purga se realiza hacia el exterior, en sitio ventilado, lejos de fuentes de ignición, con la mínima emisión posible de gas.","p":["Fecha","Proyecto / dirección","Tipo de instalación (residencial / comercial / industrial)","Gas (natural / GLP)","Acta de hermeticidad N.º","Presión de suministro (kPa)","Técnico (certificado de competencia N.º)","Supervisor"]},{"t":"2. Verificación antes de la purga","k":["Válvulas de los artefactos cerradas","Área ventilada y sin fuentes de ignición","Detector de gas operativo","Extintor disponible","Usuario informado y ausente del área"]},{"t":"3. Purga","g":{"h":["Punto de purga","Método (venteo exterior / quemador)","Tiempo (s)","Verificación de gas en el punto (detector)","Firma"],"r":4}},{"t":"4. Puesta en servicio de artefactos","g":{"h":["Artefacto","Marca / tipo","Encendido correcto","Prueba de fugas con solución jabonosa / detector","CO ambiente (ppm)","Evacuación de humos conforme"],"r":5}},{"t":"5. Resultado","p":["Instalación en servicio (sí/no)","Defectos encontrados","Firma del técnico","Firma del usuario"]}],"d":"Registro de la purga de la instalación y de la puesta en servicio de los gasodomésticos o equipos. Evidencia que la instalación quedó funcionando de forma segura, con combustión correcta y sin monóxido de carbono.","i":["Registra los datos de la instalación, el usuario y el número del acta de hermeticidad (CN-FO-04).","Antes de purgar, verifica hermeticidad aprobada, ventilación del recinto, ausencia de fuentes de ignición y válvulas en posición correcta.","En Purga, anota el punto de venteo, la hora, el método y la verificación de gas en el punto.","Por cada artefacto puesto en servicio, registra tipo, marca, la verificación de llama y la medición de CO en el ambiente.","Si el CO ambiental es de 50 ppm o más, suspende el servicio de ese artefacto y regístralo. Marca el resultado y firma."]},"GI-FO-24":{"c":"GI-FO-24","t":"Permiso de excavación","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Ubicación","Longitud × ancho × profundidad (m)","Tipo de suelo","Emisor","Responsable de la excavación"]},{"t":"2. Verificación previa","k":["Planos de redes existentes (gas, energía, acueducto, telecomunicaciones) consultados con los operadores","Apiques o sondeo manual en cruces con redes existentes","Permiso de rotura de vía o espacio público (si aplica)","Señalización diurna y nocturna, cerramiento y pasos peatonales","Entibado o talud para profundidad ≥ 1,5 m","Material excavado a ≥ 0,6 m del borde","Escalera de acceso cada 7,5 m de zanja con profundidad ≥ 1,2 m","Pronóstico de lluvias revisado; drenaje previsto","Profundidad mínima de la red según NTC 3728 verificada en diseño"]},{"t":"3. Cierre","p":["Cinta de advertencia instalada sobre la tubería","Relleno y compactación conforme","Firma emisor","Fecha de cierre"]}],"d":"Autoriza y controla las excavaciones para acometidas y redes enterradas, para prevenir derrumbes, daños a redes existentes y accidentes de terceros.","i":["Diligéncialo ANTES de excavar.","Registra ubicación, dimensiones de la zanja, profundidad y responsables.","Consulta y marca las redes existentes (gas, agua, energía, telecomunicaciones) antes de iniciar.","Verifica entibado o talud según la profundidad, señalización diurna y nocturna, accesos y protección a peatones.","Al cierre, registra el relleno, la compactación, la reposición de la superficie y las firmas."]},"GI-FO-25":{"c":"GI-FO-25","t":"Permiso de trabajo eléctrico","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Ubicación / equipo","Tensión (V)","Tarea","Emisor","Ejecutor (matrícula / certificado)"]},{"t":"2. Cinco reglas de oro (RETIE)","k":["1. Corte visible de todas las fuentes de tensión","2. Bloqueo y etiquetado (LOTO) de los elementos de corte","3. Verificación de ausencia de tensión con detector probado","4. Puesta a tierra y en cortocircuito","5. Señalización y delimitación de la zona de trabajo"]},{"t":"3. Verificación adicional","k":["Herramientas aisladas en buen estado","EPP dieléctrico (guantes, casco clase E, calzado dieléctrico)","Trabajo con tensión solo con procedimiento específico y personal calificado","En atmósferas con posible presencia de gas: equipo apto para área clasificada"]},{"t":"4. Cierre","p":["Retiro de puestas a tierra","Reenergización autorizada por","Hora","Firma"]}],"d":"Autoriza y controla trabajos con riesgo eléctrico (prototipos, tableros, equipos de automatización) aplicando las cinco reglas de oro del RETIE.","i":["Diligéncialo ANTES de intervenir el circuito.","Registra el equipo o circuito, la tarea y los responsables.","Aplica en orden las cinco reglas de oro: corte visible, enclavamiento o bloqueo, verificación de ausencia de tensión, puesta a tierra y señalización del área. Marca cada una.","Completa las verificaciones adicionales: EPP dieléctrico, herramientas aisladas y personal calificado.","Al terminar, retira bloqueos y tierras en orden inverso, verifica que nadie esté expuesto y firma el cierre."]},"GI-FO-26":{"c":"GI-FO-26","t":"Inspección preoperacional de vehículos","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Placa","Tipo (automóvil / camioneta / motocicleta)","Conductor","Licencia de conducción (categoría y vigencia)","Kilometraje"]},{"t":"2. Documentos","k":["SOAT vigente","Revisión técnico-mecánica vigente","Póliza de responsabilidad civil (si aplica)","Tarjeta de propiedad"]},{"t":"3. Estado del vehículo","k":["Frenos","Luces y direccionales","Llantas (labrado ≥ 1,6 mm) y repuesto","Niveles de aceite, refrigerante y líquido de frenos","Espejos y pito","Cinturones de seguridad","Kit de carretera y extintor","Carga asegurada; cilindros de gas en posición vertical y ventilados","Para moto: casco certificado y chaleco reflectivo"]},{"t":"4. Resultado","p":["Apto para operar (sí/no)","Observaciones","Firma del conductor","Firma del supervisor"]}],"d":"Inspección diaria del vehículo o moto antes de desplazarse a una obra o servicio, para prevenir accidentes de tránsito (Ley 2050 de 2020, plan estratégico de seguridad vial).","i":["Diligéncialo cada día, antes del primer desplazamiento.","Registra fecha, placa, conductor y kilometraje.","Verifica documentos vigentes: licencia, SOAT y revisión técnico-mecánica.","Revisa el estado del vehículo: frenos, luces, llantas, niveles, espejos, cinturones o casco, y kit de carretera.","Si algo crítico no cumple, el vehículo NO sale; regístralo en Resultado y avisa al responsable."]},"CO-FO-02":{"c":"CO-FO-02","t":"Revisión de requisitos del servicio, conflicto de interés y satisfacción","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Cliente y servicio","p":["Fecha","N.º de proyecto","Cliente","NIT / CC","Dirección del servicio","Contacto","Servicio (diseño / construcción / mantenimiento / reparación / interventoría / I+D+i)","Tipo de usuario (residencial / comercial / industrial)","Gas (natural / GLP / otro)","Distribuidor"]},{"t":"2. Requisitos identificados","k":["Requisitos del cliente documentados (alcance, plazo, entregables)","Requisitos legales y reglamentarios identificados (Res. 90902, NTC aplicables, RETIE si aplica)","Requisitos del distribuidor (planos, solicitudes, inspección)","Requisitos implícitos (seguridad, garantía)","Requisitos de entrega y posentrega definidos","Licencias y permisos (rotura de vía, propiedad horizontal)"]},{"t":"3. Capacidad para cumplir","k":["Servicio dentro del alcance aprobado del miembro en el SIG","Personal competente y con certificados vigentes disponible","Equipos calibrados disponibles","Plazo factible","Riesgos HSEQ identificados y controlables","Diferencias entre solicitud y oferta resueltas"]},{"t":"4. Declaración de conflicto de interés (obligatoria en interventoría e I+D+i con terceros)","x":"Declaro que no tengo vínculo societario, contractual, laboral ni familiar (hasta cuarto grado de consanguinidad, segundo de afinidad o primero civil) con el ejecutor o diseñador objeto del servicio, y que el ejecutor no es otro miembro de la red. Sí ☐  No ☐ existe conflicto. Descripción: ____________. Firma: ____________"},{"t":"5. Encuesta de satisfacción (al cierre)","g":{"h":["Aspecto","1","2","3","4","5","Comentario"],"r":6,"pre":["Cumplimiento del plazo","Calidad del trabajo","Seguridad y orden en la obra","Atención y comunicación","Claridad de la documentación entregada","¿Nos recomendaría?"]}},{"t":"6. Aprobación","p":["Revisó (director técnico)","Fecha","Aprobó (representante legal)","Fecha"]}],"d":"Asegura que antes de aceptar un servicio se entendieron los requisitos del cliente y se tiene la capacidad para cumplirlos (ISO 9001 num. 8.2); registra la declaración de conflicto de interés y, al cierre, la satisfacción del cliente.","i":["Registra el cliente, el servicio solicitado y el alcance.","Marca los requisitos identificados: técnicos, legales, plazos, entregables y requisitos del distribuidor o de la autoridad.","Verifica la capacidad para cumplir: personal competente, equipos calibrados, plazo y recursos. Si algo no se cumple, no se acepta el servicio sin ajustarlo con el cliente.","En interventoría e I+D+i con terceros, diligencia la declaración de conflicto de interés de forma obligatoria.","Al cerrar el servicio, aplica la encuesta de satisfacción (calificación de 1 a 5) y registra la aprobación."]},"DI-FO-01":{"c":"DI-FO-01","t":"Planificación y datos de entrada del diseño","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Planificación","p":["Proyecto","Cliente","Diseñador (matrícula)","Verificador (matrícula)","Fecha de revisión prevista","Fecha de verificación prevista","Entregables","Interfaces (cliente, distribuidor, interventor)"]},{"t":"2. Datos generales","p":["Tipo de usuario","Gas y poder calorífico","Presión de suministro (kPa)","Distribuidor","N.º de unidades / pisos","Norma de diseño aplicable"]},{"t":"3. Artefactos","g":{"h":["Recinto","Artefacto","Tipo (A/B/C)","Potencia (kW)","Caudal (m³/h)","Volumen del recinto (m³)","Observaciones"],"r":6}},{"t":"4. Requisitos adicionales del cliente y consecuencias potenciales de falla","x":"Escribe aquí."}],"d":"Planifica el diseño de la instalación de gas y registra los datos de entrada (ISO 9001 num. 8.3.2 y 8.3.3): sobre esta base se diseña, se verifica y se valida.","i":["Diligencia la planificación: etapas, responsables, fechas, revisiones y verificaciones previstas.","Registra los datos generales: tipo de gas, presión de suministro, tipo de edificación y normas aplicables.","En Artefactos, lista cada gasodoméstico o equipo con su potencia y su ubicación.","Describe los requisitos adicionales del cliente y las consecuencias potenciales de una falla del diseño.","Revisa que los datos estén completos antes de empezar a diseñar; los vacíos se aclaran con el cliente."]},"DI-FO-02":{"c":"DI-FO-02","t":"Acta de revisión del diseño","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Proyecto","Etapa revisada","Fecha","Participantes"]},{"t":"2. Evaluación","k":["El diseño responde a todos los datos de entrada","Se cumplen los requisitos del distribuidor","Las rutas son constructibles y seguras","Se identificaron interferencias con otras redes","Los riesgos HSEQ de la construcción fueron considerados"]},{"t":"3. Problemas identificados y acciones","g":{"h":["Problema","Acción","Responsable","Fecha","Cerrado"],"r":4}}],"d":"Acta de la revisión del diseño en sus etapas, para evaluar si cumple los requisitos e identificar problemas a tiempo (ISO 9001 num. 8.3.4).","i":["Registra el proyecto, la etapa revisada, la fecha y los participantes.","Evalúa cada aspecto y marca Cumple, No cumple o N/A.","Por cada problema, registra la acción, el responsable y la fecha.","No avances a la siguiente etapa con problemas críticos abiertos."]},"DI-FO-03":{"c":"DI-FO-03","t":"Lista de verificación del diseño","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Proyecto","Versión de planos","Verificador","Fecha"]},{"t":"2. Verificación técnica","k":["Caudales calculados con potencias nominales y factor de simultaneidad justificado","Diámetros recalculados; caída de presión dentro del límite de la norma","Presión de prueba especificada según NTC 2505 tabla 2 / NTC 3728","Materiales y accesorios certificados y compatibles con el gas","Ventilación de recintos conforme (aberturas y volúmenes)","Evacuación de productos de combustión conforme a NTC 3833","Ubicación de medidor, regulador y válvulas de corte accesible y ventilada","Profundidades y separaciones de tubería enterrada conforme a NTC 3728","Tuberías no pasan por ductos prohibidos","Planos con firmas, matrícula, escala, convenciones e isométrico"]},{"t":"3. Resultado","p":["Conforme (sí/no)","Observaciones","Firma verificador","Fecha"]}],"d":"Lista de verificación técnica del diseño antes de entregarlo: confirma que los resultados del diseño cumplen los datos de entrada y las normas (ISO 9001 num. 8.3.4).","i":["Registra el proyecto, la versión de los planos y el verificador. El verificador debe ser una persona distinta al diseñador.","Verifica cada punto técnico (dimensionamiento, caídas de presión, ventilación, ubicación de artefactos y materiales) y marca Cumple, No cumple o N/A.","Registra el resultado: aprobado para entrega o devuelto con correcciones."]},"DI-FO-04":{"c":"DI-FO-04","t":"Validación del diseño","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Evidencias de validación","k":["Acta de prueba de hermeticidad conforme (CN-FO-04 N.º ___)","Certificado de inspección reglamentaria sin defectos críticos (organismo y N.º ___)","Puesta en servicio satisfactoria (GI-FO-23 N.º ___)","CO ambiente < 15 ppm en recintos con artefactos","Cliente recibe a satisfacción"]},{"t":"2. Decisión","p":["Diseño validado (sí/no)","Lecciones aprendidas","Firma director técnico","Fecha"]}],"d":"Valida que el diseño, una vez construido, funciona para el uso previsto por el cliente (ISO 9001 num. 8.3.4).","i":["Marca las evidencias de validación disponibles: prueba de hermeticidad, puesta en servicio, aprobación del distribuidor y conformidad del cliente.","Registra la decisión: validado o no validado, con las observaciones y la firma del director técnico."]},"DI-FO-05":{"c":"DI-FO-05","t":"Control de cambios del diseño","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Cambio","p":["Proyecto","N.º de cambio","Solicitado por","Fecha","Descripción","Motivo"]},{"t":"2. Evaluación","k":["Recalculados caudales y diámetros afectados","Evaluado el efecto en partes ya construidas","Evaluado el efecto en ventilación/evacuación","Requiere nueva aprobación del distribuidor","Riesgos HSEQ del cambio evaluados"]},{"t":"3. Aprobación","p":["Aprobó","Fecha","Nueva versión de planos","Comunicado a obra (fecha)"]}],"d":"Controla los cambios al diseño después de aprobado, para que ninguno se haga sin evaluar su impacto (ISO 9001 num. 8.3.6).","i":["Describe el cambio, quién lo solicita y por qué.","Evalúa su impacto en los cálculos, en otros planos, en la obra en curso y en los requisitos del distribuidor.","Registra la aprobación y la nueva versión de los planos; informa al residente de obra."]},"MT-FO-01":{"c":"MT-FO-01","t":"Orden de servicio de mantenimiento y reparación","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["N.º de orden","Fecha","Cliente / usuario","Dirección","Tipo (preventivo / correctivo / reparación / emergencia)","Técnico (certificado N.º)","Gas","Equipo de medición usado (serie)"]},{"t":"2. Diagnóstico","g":{"h":["Elemento revisado","Hallazgo","Medición (ppm CO / kPa / % LEL)","Defecto (crítico / no crítico / ninguno)"],"r":6}},{"t":"3. Trabajos ejecutados y materiales","g":{"h":["Actividad","Material / repuesto","Cantidad","Certificado"],"r":5}},{"t":"4. Verificación final","k":["Prueba de hermeticidad del tramo intervenido conforme","Sin fugas detectadas con detector o solución jabonosa","CO ambiente < 15 ppm","Artefactos funcionando correctamente","Usuario informado de uso seguro y de defectos pendientes"]},{"t":"5. Suspensión por defecto crítico (si aplica)","x":"Artefacto/instalación suspendido: ____. Motivo: ____. Notificado al usuario ☐ al distribuidor ☐. Hora: ____."},{"t":"6. Cierre","p":["Firma del técnico","Firma del usuario","Próximo mantenimiento","Observaciones"]}],"d":"Orden de servicio de mantenimiento o reparación: registra el diagnóstico, los trabajos y los materiales, y la verificación final de seguridad. Si hay un defecto crítico, deja constancia de la suspensión del servicio.","i":["Registra el usuario, la dirección, la fecha, el técnico y el motivo del servicio.","En Diagnóstico, anota cada hallazgo y su causa.","Lista los trabajos ejecutados y los materiales usados.","Haz la verificación final (hermeticidad, funcionamiento y CO) y márcala.","Si encuentras un defecto crítico, suspende el servicio, descríbelo en la sección 5 e informa al usuario y al distribuidor. Cierra con la firma del usuario."]},"IV-FO-01":{"c":"IV-FO-01","t":"Registro de hallazgos de interventoría","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Proyecto","Contratante","Contratista","Interventor","Fecha de visita","N.º de visita"]},{"t":"2. Hallazgos","g":{"h":["N.º","Descripción y evidencia (foto, medición, documento)","Requisito incumplido","Clasificación","Plazo de corrección","Fecha de cierre verificada"],"r":6}},{"t":"3. Puntos de espera presenciados","g":{"h":["Actividad","Resultado","Registro del contratista","Firma interventor"],"r":3}},{"t":"4. Firmas","p":["Interventor","Representante del contratista","Fecha","Observaciones"]}],"d":"Registro de los hallazgos de la interventoría y de los puntos de espera presenciados en obra. Es la evidencia independiente del cumplimiento técnico del contratista.","i":["Registra el contrato, el contratista, la obra y la fecha de la visita.","Por cada hallazgo, anota la descripción, la clasificación, el requisito incumplido, la acción exigida y el plazo.","Registra los puntos de espera presenciados: actividad, resultado y quién la liberó.","Adjunta fotos como evidencia. Firman el interventor y el representante del contratista."]},"TH-FO-02":{"c":"TH-FO-02","t":"Registro de asistencia a formación, charlas y reuniones","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Tema","Tipo (formación / charla / reunión / simulacro)","Facilitador","Duración (h)","Lugar / proyecto"]},{"t":"2. Asistentes","g":{"h":["N.º","Nombre","Documento","Cargo","Miembro / empresa","Firma"],"r":12,"pre":["1","2","3","4","5","6","7","8","9","10","11","12"]}},{"t":"3. Contenido tratado y material","x":"Escribe aquí."}],"d":"Registro de asistencia a formación, charlas de seguridad y reuniones. Es la evidencia de la formación y de la comunicación con el personal (ISO 9001 num. 7.2 y 7.4; Decreto 1072).","i":["Registra el tema, la fecha, la duración, el lugar y el facilitador.","Cada asistente escribe su nombre, documento y cargo y firma.","Resume el contenido tratado y el material usado (presentación, video, procedimiento).","Toma una foto del grupo como evidencia (opcional)."]},"TH-FO-03":{"c":"TH-FO-03","t":"Evaluación de la eficacia de la formación","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Formación evaluada","Fecha de la formación","Evaluado","Cargo","Evaluador (jefe inmediato)","Fecha de evaluación (30 a 90 días después)"]},{"t":"2. Evaluación","g":{"h":["Criterio","Deficiente (1)","Aceptable (2)","Bueno (3)","Excelente (4)","Evidencia"],"r":4,"pre":["Aplica lo aprendido en su trabajo","Reducción de errores o hallazgos relacionados","Cumple el procedimiento sin supervisión","Transmite el conocimiento a otros"]}},{"t":"3. Conclusión","p":["¿Formación eficaz? (promedio ≥ 2,5)","Acción si no es eficaz","Firma evaluador","Firma evaluado"]}],"d":"Evalúa si la formación logró su objetivo, es decir, si la persona aplica lo aprendido en su trabajo (ISO 9001 num. 7.2).","i":["Diligéncialo entre 30 y 90 días después de la formación; lo hace el jefe inmediato.","Registra la formación evaluada y su fecha.","Califica a cada participante según lo que se observa en su trabajo, no solo con un examen.","Concluye si la formación fue eficaz; si no lo fue, define el refuerzo necesario."]},"TH-FO-09":{"c":"TH-FO-09","t":"Registro de inducción y reinducción","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Nombre","Documento","Cargo","Miembro","Fecha de ingreso","Tipo (inducción / reinducción)"]},{"t":"2. Temas","k":["Estructura de la red, rol de la función central y del miembro","Política del SIG y objetivos","Código de ética y canal de reporte","Reglamento interno de trabajo y de higiene y seguridad","Peligros y riesgos del cargo y controles (GI-MZ-04)","Aspectos ambientales del cargo (GI-MZ-05)","Plan de emergencias y protocolo de fuga de gas","Permisos de trabajo y derecho a detener un trabajo inseguro","Reporte de incidentes y accidentes","Procedimientos del cargo y uso de la plataforma","COPASST/vigía y Comité de Convivencia","Protección de datos y confidencialidad"]},{"t":"3. Evaluación y firmas","p":["Resultado de la evaluación","Firma del trabajador","Responsable de la inducción","Fecha"]}],"d":"Registro de la inducción del personal nuevo y de la reinducción periódica en el SIG, la seguridad y el puesto de trabajo.","i":["Diligéncialo el primer día de vinculación, antes de iniciar labores, y en cada reinducción.","Registra los datos del trabajador, el cargo y la fecha.","Marca cada tema tratado: políticas, peligros del cargo, procedimientos, emergencias y derechos y deberes.","Aplica la evaluación y registra el resultado; firman el trabajador y quien hace la inducción."]},"CP-FO-01":{"c":"CP-FO-01","t":"Selección y evaluación de proveedores","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos del proveedor","p":["Razón social","NIT","Producto / servicio","Crítico (sí/no)","Tipo de evaluación (selección / desempeño)","Periodo evaluado"]},{"t":"2. Requisitos habilitantes (selección)","k":["Existencia legal y RUT","Certificado de conformidad de producto vigente (materiales de gas)","Acreditación ONAC vigente con alcance aplicable (laboratorios, organismos de inspección)","Licencia ambiental/registro de gestor (residuos)","SG-SST con estándares mínimos (subcontratistas) y afiliación a seguridad social","Certificados de competencia del personal (subcontratistas de gas)"]},{"t":"3. Evaluación de desempeño","g":{"h":["Criterio","Peso","Calificación (0-100)","Ponderado"],"r":5,"pre":["Calidad / conformidad del producto","Cumplimiento de plazos","Cumplimiento HSEQ","Atención y respuesta a reclamos","Precio y condiciones"]}},{"t":"4. Resultado","p":["Puntaje total","Clasificación (aprobado ≥ 70 / condicionado 50-69 / retirado < 50)","Evaluó","Fecha"]}],"d":"Selección y evaluación periódica de proveedores y contratistas, para comprar solo a quien cumple los requisitos (ISO 9001 num. 8.4).","i":["Registra los datos del proveedor y el producto o servicio que suministra.","Para seleccionarlo, verifica los requisitos habilitantes: legales, técnicos, certificados de producto y seguridad social. Marca cada uno.","Evalúa su desempeño periódicamente (calidad, cumplimiento, seguridad y servicio) con su puntaje.","Registra el resultado: aprobado, condicionado o descartado."]},"MI-FO-01":{"c":"MI-FO-01","t":"Hoja de vida de equipo de seguimiento y medición","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Identificación","p":["Código interno","Equipo","Marca / modelo","N.º de serie","Rango y resolución","Clase de exactitud / grado (p. ej. grado D ASME B40.100)","Miembro propietario","Fecha de adquisición","Uso (prueba de hermeticidad / detección / análisis de combustión / laboratorio)","Error máximo permitido para el uso"]},{"t":"2. Calibraciones y verificaciones","g":{"h":["Fecha","Tipo (calibración / verificación intermedia)","Laboratorio (acreditación ONAC)","N.º certificado","Error / incertidumbre encontrados","¿Conforme con el EMP?","Próxima fecha"],"r":6}},{"t":"3. Mantenimientos y reparaciones","g":{"h":["Fecha","Actividad","Ejecutó","Observaciones"],"r":4}},{"t":"4. Equipo no conforme","x":"Si una calibración resulta fuera del EMP, evaluar la validez de los resultados previos (pruebas realizadas desde la última calibración conforme) según MI-PR-01 y registrar la evaluación aquí."}],"d":"Hoja de vida de cada equipo de medición (manómetros, detectores de gas, analizadores de CO): asegura que las mediciones son confiables y trazables (ISO 9001 num. 7.1.5).","i":["Identifica el equipo: nombre, marca, modelo, serie, rango, resolución y ubicación.","Registra cada calibración o verificación con su fecha, el laboratorio, el número de certificado, el resultado y la próxima fecha.","Registra los mantenimientos y reparaciones.","Si el equipo resulta no conforme, descríbelo y evalúa qué mediciones anteriores pudieron verse afectadas."]},"EM-FO-01":{"c":"EM-FO-01","t":"Plan de auditoría","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Auditoría N.º","Sitio / miembro","Fechas","Auditor líder","Equipo auditor","Tipo"]},{"t":"2. Objetivo, alcance y criterios","p":["Objetivo","Alcance (procesos, sitios, proyectos)","Criterios","Documentos de referencia"]},{"t":"3. Agenda","g":{"h":["Fecha / hora","Proceso / requisito","Auditado","Auditor","Lugar (incluye frente de obra)"],"r":8}},{"t":"4. Aprobación","p":["Elaboró (auditor líder)","Aceptó (auditado)","Fecha","Observaciones"]}],"d":"Plan de una auditoría interna o de admisión: define objetivo, alcance, criterios y agenda, y se comunica antes de la auditoría (ISO 19011).","i":["Registra la empresa auditada, la fecha, el auditor líder y el equipo auditor.","Define el objetivo, el alcance (procesos, sedes, proyectos) y los criterios (normas y documentos del SIG).","Arma la agenda con hora, proceso, auditado y auditor.","Comunica el plan al auditado con anticipación y registra la aprobación."]},"EM-FO-02":{"c":"EM-FO-02","t":"Lista de verificación de auditoría","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Auditoría N.º","Proceso","Auditor","Fecha"]},{"t":"2. Verificación","g":{"h":["Requisito (norma y numeral / documento)","Pregunta o verificación","Evidencia revisada (registro, entrevista, observación)","Resultado (C / NC mayor / NC menor / Obs / OM)"],"r":12}}],"d":"Lista de verificación que guía al auditor durante la auditoría: qué revisar, qué evidencia se encontró y la conclusión de cada punto.","i":["Registra los datos de la auditoría y el proceso auditado.","Por cada requisito, anota la evidencia objetiva revisada (documento, registro, entrevista u observación) y la conclusión: conforme, no conforme u observación.","Sé específico: identifica el registro, la fecha y el lugar de la evidencia."]},"EM-FO-03":{"c":"EM-FO-03","t":"Informe de auditoría","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Auditoría N.º","Sitio / miembro","Fechas","Equipo auditor","Objetivo","Alcance","Criterios","Auditados"]},{"t":"2. Resumen ejecutivo","x":"Conclusión sobre la conformidad y eficacia del SIG en el sitio, fortalezas y principales riesgos."},{"t":"3. Hallazgos","g":{"h":["N.º","Tipo (NC mayor / NC menor / observación / oportunidad de mejora)","Requisito","Descripción y evidencia","Proceso"],"r":8}},{"t":"4. Conclusión sobre el estado del miembro","k":["Mantener estado Adscrito","Adscrito con plan de acción (NC menores)","Recomendar SUSPENSIÓN (NC mayor; ver GI-PR-09)","Recomendar RETIRO"]},{"t":"5. Firmas","p":["Auditor líder","Responsable SIG del miembro","Fecha de entrega","Plazo para plan de acción (≤ 15 días hábiles)"]}],"d":"Informe final de la auditoría con sus hallazgos y la conclusión sobre el estado del miembro frente al SIG.","i":["Registra los datos de la auditoría.","Redacta el resumen ejecutivo: fortalezas, debilidades y conclusión general.","Lista cada hallazgo con su tipo (no conformidad mayor, menor u observación), el requisito y la evidencia.","Marca la conclusión sobre el estado del miembro y firma con el auditado."]},"EM-FO-04":{"c":"EM-FO-04","t":"Reporte de no conformidad y acción correctiva","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Identificación","p":["N.º","Fecha","Fuente (auditoría, PQRS, incidente, inspección, salida no conforme, indicador, revisión por la dirección)","Proceso / miembro","Reportó","Clasificación (mayor / menor)"]},{"t":"2. Descripción de la no conformidad","x":"Requisito incumplido, evidencia objetiva y alcance (¿ocurre en otros proyectos o miembros?)."},{"t":"3. Corrección inmediata","p":["Acción","Responsable","Fecha","Verificó"]},{"t":"4. Análisis de causa raíz (5 porqués / espina de pescado)","x":"¿Por qué 1? ____ ¿Por qué 2? ____ ¿Por qué 3? ____ ¿Por qué 4? ____ ¿Por qué 5? ____ Causa raíz: ____"},{"t":"5. Plan de acción","g":{"h":["Acción","Responsable","Fecha","Recursos","Evidencia de ejecución"],"r":4}},{"t":"6. Verificación de eficacia","p":["Fecha de verificación","Criterio de eficacia","¿Eficaz? (sí/no)","Verificó","¿Requiere actualizar riesgos u oportunidades?","¿Requiere cambios al SIG?"]}],"d":"Reporte de una no conformidad y de su acción correctiva: corrige el problema, elimina la causa raíz y verifica que no se repita (ISO 9001 num. 10.2).","i":["Identifica la no conformidad: fuente (auditoría, queja, inspección), fecha y proceso.","Describe qué pasó, dónde y cuál requisito se incumplió.","Registra la corrección inmediata.","Analiza la causa raíz con 5 porqués o espina de pescado. Busca la causa del sistema, no el culpable.","Define el plan de acción con responsables y fechas y, después, verifica su eficacia."]},"EM-FO-05":{"c":"EM-FO-05","t":"Acta de revisión por la dirección","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Periodo revisado","Participantes","Lugar / medio"]},{"t":"2. Entradas revisadas (ISO 9001:2026 num. 9.3.2; ISO 14001; ISO 45001; ISO 56001; Decreto 1072 art. 2.2.4.6.31)","k":["Estado de acciones de revisiones anteriores","Cambios en cuestiones externas e internas, incluido el cambio climático","Cambios en necesidades y expectativas de partes interesadas y requisitos legales","Satisfacción del cliente y PQRS","Grado de logro de objetivos (DE-MZ-02)","Desempeño de procesos y conformidad de servicios","No conformidades y acciones correctivas","Resultados de seguimiento y medición (EM-MZ-01)","Resultados de auditorías internas y externas","Desempeño de proveedores","Estado de los miembros (adscritos, suspendidos, retirados)","Desempeño de SST: accidentalidad, ausentismo, cumplimiento del plan anual, consulta y participación","Desempeño ambiental y aspectos significativos","Desempeño del portafolio de innovación","Adecuación de recursos","Eficacia de las acciones frente a riesgos y oportunidades","Oportunidades de mejora","Cultura de calidad y comportamiento ético"]},{"t":"3. Conclusiones sobre conveniencia, adecuación y eficacia del SIG","x":"Escribe aquí."},{"t":"4. Decisiones (salidas)","g":{"h":["Decisión / acción","Tipo (mejora, cambio al SIG, recursos)","Responsable","Fecha"],"r":6}},{"t":"5. Firmas","p":["Gerente — función central","Coordinador del SIG","Fecha","Próxima revisión"]}],"d":"Acta de la revisión por la dirección: la alta dirección analiza el desempeño del SIG y decide mejoras, recursos y cambios (ISO 9001 num. 9.3).","i":["Registra la fecha y los participantes.","Marca cada entrada revisada: auditorías, satisfacción, objetivos, no conformidades, riesgos, SST, ambiente e I+D+i.","Escribe la conclusión sobre la conveniencia, adecuación y eficacia del SIG.","Registra cada decisión con responsable y fecha. Firman los participantes."]},"EM-FO-06":{"c":"EM-FO-06","t":"Reporte de salida no conforme","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Identificación","p":["N.º de reporte","Fecha","Miembro","Proyecto / cliente","Detectado por","Etapa (diseño / obra / prueba / inspección / entrega / posentrega)"]},{"t":"2. Descripción","n":"Una instalación con defecto crítico (por ejemplo fuga o CO ≥ 50 ppm) no se entrega ni se pone en servicio. Los defectos no críticos se corrigen dentro del plazo reglamentario.","p":["Producto o servicio afectado","Requisito incumplido (norma, plano, contrato)","Evidencia (foto, medición, registro)","Clasificación (crítico / no crítico / documental)"]},{"t":"3. Tratamiento","k":["Identificada y detenida su entrega o uso","Corrección / reproceso","Reemplazo","Concesión aceptada por escrito por el cliente (nunca para defectos de seguridad)","Informado el cliente y, si aplica, el distribuidor","Verificación posterior conforme (nueva prueba o inspección)"]},{"t":"4. Decisión y cierre","p":["Decidió (director técnico)","Fecha","¿Requiere acción correctiva EM-FO-04? (sí/no)","Cerrado por / fecha"]}],"d":"Reporte de un producto o servicio que no cumple los requisitos (salida no conforme), para controlarlo y que no llegue al cliente sin tratamiento (ISO 9001 num. 8.7).","i":["Identifica el proyecto, el entregable y la fecha de detección.","Describe la no conformidad y el requisito incumplido.","Marca el tratamiento: corrección, separación, información al cliente o concesión.","Registra la decisión, quién la autoriza y el cierre. Si es recurrente, abre una acción correctiva (EM-FO-04)."]},"DE-PL-01":{"c":"DE-PL-01","t":"Plan estratégico 2027-2029","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Objetivo","n":"Definir la orientación estratégica de la red y los resultados que el SIG debe lograr para alcanzar la certificación multisitio y sostenerla.","x":"Ajustes al objetivo para tu empresa (opcional)"},{"t":"Propósito, misión y visión (propuesta para aprobación)","g":{"h":["Elemento","Texto propuesto"],"r":3,"ini":[["Propósito","Que las personas y empresas de ingeniería del Hub presten servicios de gas y de tecnología seguros, legales y confiables, sin perder su identidad."],["Misión","Proveer, a través de ENTALPIA LABS, un sistema integrado de gestión compartido, controlado y verificable para diseñar, construir, mantener, reparar e interventorear instalaciones de gas y para desarrollar soluciones de automatización, telemetría y datos."],["Visión 2029","Ser la red de ingeniería con certificación multisitio ISO 9001, ISO 14001, ISO 45001 y gestión de la innovación ISO 56001 de referencia en la región, con cero accidentes graves y cero instalaciones rechazadas por defecto crítico."]]}},{"t":"Ejes y metas","g":{"h":["Eje","Meta","Iniciativas","Responsable","Plazo"],"r":7,"ini":[["1. Legalidad y gobierno","Industrias I.A. Col constituida; convenio de adhesión revisado por abogado","Registro mercantil, RUT, convenio CE-CO-01, póliza de responsabilidad civil","Gerente","2027-T1"],["2. Implementación del SIG","100 % de documentos aprobados y publicados; módulo SGC del portal en producción","Aprobación del manual y del lote documental; fases 1 a 3 de la especificación del portal","Coordinador del SIG","2027-T2"],["3. Red de miembros","Al menos 3 miembros adscritos con un ciclo completo de auditoría interna","Convocatoria, diagnóstico GI-FO-09, acompañamiento","Coordinador del SIG","2027-T3"],["4. Certificación","Certificado multisitio ISO 9001:2026; ISO 14001 e ISO 45001 en la misma auditoría o en la siguiente","Selección del organismo acreditado (ONAC/IAF), auditoría de etapa 1 y 2","Gerente","2027-T4"],["5. Seguridad y competencia","100 % del personal de gas con certificado de competencia vigente; índice de frecuencia de AT por debajo de la línea base","Plan de formación TH-PL-01, permisos de trabajo GI-FO-20 a 26","Líder de SST","Continuo"],["6. Innovación","2 proyectos I+D+i validados y uno transferido a servicio","Portafolio ID-PR-01, vigilancia tecnológica ID-PR-02","Líder de I+D+i","2028"],["7. Sostenibilidad financiera","Cuotas de membresía cubren el costo del SIG y la certificación","Modelo tarifario, presupuesto anual del SIG","Gerente","2027-T2"]]}},{"t":"Seguimiento","n":"El avance se mide con los indicadores de EM-MZ-01 y se revisa trimestralmente en el comité del SIG y anualmente en la revisión por la dirección.","x":"Describe cómo lo aplicas en tu empresa o proyecto"}],"d":"Plan estratégico de la empresa: su propósito, misión, visión, ejes y metas a tres años, y la forma de hacerles seguimiento.","i":["Revisa el propósito, la misión y la visión propuestos y ajústalos a tu empresa.","En Ejes y metas, define para cada eje su meta medible, las iniciativas, el responsable y el plazo.","En Seguimiento, describe cada cuánto y cómo se revisará el avance (se recomienda en la revisión por la dirección, EM-FO-05)."]},"DE-MZ-01":{"c":"DE-MZ-01","t":"Matriz de contexto y partes interesadas","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["Tipo","Factor","Cuestión","Efecto (+/−)","Proceso afectado","Parte interesada","Necesidad o expectativa","¿Es requisito obligatorio?","Tratamiento / vínculo","Responsable","Fecha de revisión"],"r":15,"ini":[["Externo","Legal","Prórrogas sucesivas de la Res. 90902 de 2013 y posible reglamento sustituto","−","DI, CN, MT, IV","Ministerio de Minas y Energía / SIC","Cumplir el reglamento técnico vigente","Sí","Normograma GI-MZ-01; vigilancia normativa trimestral","Coordinador del SIG","2026-10-10"],["Externo","Legal","Registro de productores e importadores e inspección obligatoria de instalaciones","−","CN, MT","Organismos de inspección acreditados ONAC","Instalaciones que superen la inspección sin defectos críticos","Sí","CN-PR-01; CN-IN-01; EM-PR-03","Director técnico de gas","2026-10-10"],["Externo","Ambiental","Cambio climático: lluvias intensas y deslizamientos afectan redes enterradas y frentes de obra","−","CN, MT","Comunidad / distribuidor","Continuidad y seguridad del suministro","No","Riesgo R-CC-01 en GI-MZ-02; plan de emergencias GI-PL-01","Líder de SST","2026-10-10"],["Externo","Ambiental","Transición energética: hidrógeno en mezcla, biometano, electrificación","+","ID, DI","Distribuidores / clientes industriales","Soluciones compatibles con nuevos gases","No","Oportunidad O-ID-01; vigilancia tecnológica ID-PR-02","Líder de I+D+i","2026-10-10"],["Externo","Tecnológico","Telemetría y medición inteligente de consumo","+","ID, MT","Distribuidores","Datos confiables y ciberseguros","No","ID-PR-01; TI-PR-01","Líder de I+D+i","2026-10-10"],["Externo","Económico","Competencia informal de instaladores sin certificación","−","CO","Clientes","Precio competitivo","No","Propuesta de valor de la red; DE-PL-01 eje 3","Gerente","2026-10-10"],["Externo","Social","Percepción de riesgo del gas en la comunidad","−","CO, CN","Usuarios finales","Instalaciones seguras y atención de fugas","Sí (Ley 142 de 1994)","GI-PL-01; atención de quejas CO-PR-01","Líder comercial","2026-10-10"],["Externo","Normativo","Transición a ISO 9001:2026 e ISO 14001:2026 (3 años desde su publicación)","+","Todos","Organismo de certificación","Sistema diseñado con la edición 2026","Sí para certificar","Manual SIG sección 3","Coordinador del SIG","2026-10-10"],["Interno","Organizacional","Industrias I.A. Col en proceso de constitución legal","−","DE","Organismo de certificación","Entidad legal titular del certificado","Sí","DE-PL-01 eje 1","Gerente","2026-10-10"],["Interno","Organizacional","Modelo de red: miembros con identidad propia y diferente madurez","−","Todos","Miembros","Usar el SIG sin perder identidad","Contractual","GI-PR-09; convenio de adhesión","Coordinador del SIG","2026-10-10"],["Interno","Tecnológico","Portal ENTALPIA LABS como plataforma documental única","+","GI, TI","Miembros / auditores","Acceso controlado y trazable","No","Especificación del módulo SGC; TI-PR-01","Líder de TI","2026-10-10"],["Interno","Cultura","Cultura de calidad y ética (nuevo énfasis ISO 9001:2026)","+","Todos","Trabajadores","Reglas claras y liderazgo visible","Sí para certificar","DE-PO-02; recorridos GI-FO-12","Gerente","2026-10-10"],["Interno","Talento","Disponibilidad de técnicos con certificación de competencia laboral en gas","−","CN, MT","Trabajadores","Formación y certificación","Sí","TH-PL-01; TH-MZ-01","Líder de talento humano","2026-10-10"],["Externo","Parte interesada","ARL","","GI","ARL","Reporte de AT en 2 días hábiles, plan de trabajo SST","Sí","GI-PR-07; GI-PL-02","Líder de SST","2026-10-10"],["Externo","Parte interesada","Autoridad ambiental y municipio","","CN","Autoridad ambiental / alcaldía","Permisos de rotura de vía, manejo de RCD","Sí","GI-MZ-05; CN-PL-01","Director de obra","2026-10-10"]]}}],"d":"Identifica las cuestiones internas y externas que afectan a la empresa y las necesidades y expectativas de sus partes interesadas (ISO 9001, 14001 y 45001, numerales 4.1 y 4.2). Es la base para definir riesgos, objetivos y el alcance del SIG.","i":["La tabla trae ejemplos de la red; ajústalos a la realidad de tu empresa, borra las filas que no apliquen y agrega las tuyas.","En Tipo, indica si la cuestión es interna o externa, o si se trata de una parte interesada.","En Efecto, marca + si la cuestión favorece a la empresa o − si la afecta.","Para cada parte interesada, escribe su necesidad o expectativa e indica si es un requisito obligatorio (ley o contrato).","En Tratamiento, vincula la fila con un riesgo (GI-MZ-02), un objetivo o un documento, y asigna un responsable y una fecha de revisión."]},"DE-MZ-02":{"c":"DE-MZ-02","t":"Matriz de objetivos del SIG","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["N.º","Compromiso de la política","Objetivo","Indicador","Fórmula","Meta","Frecuencia","Responsable","Recursos","Fecha límite","Resultado","Evaluación"],"r":10,"ini":[["1","Cumplir requisitos del cliente","Aumentar la satisfacción del cliente","Índice de satisfacción","Promedio de encuestas CO-FO-02 (escala 1–5) × 20","≥ 85 %","Semestral","Líder comercial","Encuesta en plataforma","2027-12-31","",""],["2","Instalaciones verificadas","Lograr instalaciones aprobadas en la primera inspección","Aprobación en primera inspección","Instalaciones aprobadas sin defectos / instalaciones inspeccionadas × 100","≥ 95 %; 0 defectos críticos","Mensual","Director técnico de gas","Inspección interna previa","2027-12-31","",""],["3","Condiciones de trabajo seguras","Reducir la accidentalidad","Índice de frecuencia de AT (Res. 0312)","N.º AT en el mes / N.º trabajadores en el mes × 100","≤ línea base − 20 %; 0 AT mortales","Mensual","Líder de SST","Permisos de trabajo, EPP","2027-12-31","",""],["4","Condiciones de trabajo seguras","Cumplir el plan de trabajo anual de SST","Cumplimiento del plan","Actividades ejecutadas / programadas × 100","≥ 90 %","Trimestral","Líder de SST","GI-PL-02","2027-12-31","",""],["5","Prevenir la contaminación","Minimizar emisiones de metano en purgas","Purgas controladas","Purgas con registro GI-FO-23 y venteo controlado / purgas ejecutadas × 100","100 %","Mensual","Director de obra","Quemador o venteo seguro","2027-12-31","",""],["6","Prevenir la contaminación","Disponer correctamente residuos de obra y RAEE","Residuos con gestor autorizado","kg entregados a gestor con certificado / kg generados × 100","100 %","Trimestral","Líder ambiental","Gestores autorizados","2027-12-31","",""],["7","Competencia","Mantener la competencia del personal de gas","Personal con certificado vigente","Técnicos con certificado vigente / técnicos que ejecutan × 100","100 %","Mensual","Líder de talento humano","TH-PL-01","Continuo","",""],["8","Innovación","Validar soluciones de I+D+i","Proyectos validados","N.º proyectos con validación aprobada ID-PR-03 en el año","≥ 2","Anual","Líder de I+D+i","Laboratorio, prototipos","2028-12-31","",""],["9","Mejora continua","Cerrar acciones correctivas eficazmente","Eficacia de acciones","Acciones cerradas eficaces / acciones vencidas × 100","≥ 90 %","Trimestral","Coordinador del SIG","EM-FO-07","Continuo","",""],["10","Ética y uso del SIG","Asegurar que solo miembros adscritos usen el SIG","Usos indebidos detectados","N.º usos indebidos del SIG en el periodo","0","Trimestral","Coordinador del SIG","Bitácora de la plataforma","Continuo","",""]]}}],"d":"Define los objetivos medibles del SIG de la empresa, alineados con la política, con su indicador, su meta y su seguimiento (ISO 9001 num. 6.2).","i":["Parte de cada compromiso de la política (DE-PO-01) y formula al menos un objetivo por compromiso.","Para cada objetivo, define el indicador, la fórmula exacta, la meta numérica y la frecuencia de medición.","Asigna un responsable, los recursos y una fecha límite.","En cada periodo, registra el Resultado y la Evaluación (cumple o no cumple). Si no cumple, abre una acción (EM-FO-04)."]},"GI-PL-01":{"c":"GI-PL-01","t":"Plan de prevención, preparación y respuesta ante emergencias","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Objetivo","n":"Prevenir, prepararse y responder a las emergencias que puedan presentarse en sedes y frentes de trabajo, con énfasis en fugas de gas, incendio y explosión.","x":"Ajustes al objetivo para tu empresa (opcional)"},{"t":"Análisis de amenazas y vulnerabilidad","g":{"h":["Amenaza","Origen","Escenario típico","Probabilidad","Controles preventivos"],"r":10,"ini":[["Fuga de gas","Tecnológico","Daño a tubería durante excavación; unión defectuosa; prueba fallida","Media","Planos de redes existentes, detector, permiso de excavación GI-FO-24, CN-IN-01"],["Incendio o explosión","Tecnológico","Fuga + fuente de ignición; trabajo en caliente cerca de gas","Baja / consecuencia catastrófica","Permiso GI-FO-22, medición de explosividad (LEL < 10 %), extintores"],["Intoxicación por CO","Tecnológico","Gasodoméstico mal ventilado durante puesta en servicio","Media","Medición de CO en ambiente (Res. 90902: ≥ 50 ppm es defecto crítico)"],["Caída de altura","Operativo","Montaje de tubería en fachada o cubierta","Media","Permiso GI-FO-20, sistemas de protección contra caídas"],["Atrapamiento en espacio confinado","Operativo","Cámaras, sótanos, cajas de válvulas","Baja","Permiso GI-FO-21, monitoreo atmosférico, vigía y plan de rescate"],["Derrumbe de zanja","Operativo","Excavación > 1,5 m sin entibado","Baja","GI-FO-24, entibado o taludes"],["Contacto eléctrico","Operativo","Trabajo en tableros, prototipos de I+D+i","Media","GI-FO-25, cinco reglas de oro RETIE"],["Sismo","Natural","Sede o frente de obra","Media (según zona)","Rutas de evacuación, punto de encuentro"],["Inundación / deslizamiento","Natural (cambio climático)","Zanjas abiertas en temporada de lluvias","Media","Programación según pronóstico IDEAM, cierre de zanjas"],["Accidente de tránsito","Social","Desplazamiento a obras","Media","GI-FO-26, política de seguridad vial"]]}},{"t":"Protocolo de respuesta ante fuga de gas (PON-01)","x":"Describe cómo lo aplicas en tu empresa o proyecto"},{"t":"Protocolos complementarios","n":"• PON-02 Incendio: uso de extintor solo en conato y con ruta de escape; si el fuego es alimentado por gas, no extinguir la llama sin cortar antes el suministro.\n• PON-03 Rescate en alturas: plan de rescate específico antes de iniciar (Res. 4272 de 2021).\n• PON-04 Rescate en espacio confinado: no ingresar a rescatar sin equipo y entrenamiento; activar rescate externo.\n• PON-05 Primeros auxilios y traslado: directorio de centros asistenciales cercanos al frente de obra.\n• PON-06 Sismo y evacuación.\n• PON-07 Derrame o liberación ambiental: contener, recoger y disponer como residuo peligroso con gestor autorizado.","x":"Describe cómo lo aplicas en tu empresa o proyecto"},{"t":"Recursos y preparación","g":{"h":["Recurso","Requisito mínimo por frente de obra"],"r":6,"ini":[["Extintor","Polvo químico seco ABC de 20 lb, inspeccionado mensualmente y recargado anualmente"],["Detector","Detector de gas combustible / multigás con verificación funcional diaria (bump test) y calibración vigente"],["Botiquín","Según el número de trabajadores; inventario mensual"],["Brigada","Al menos un brigadista con formación en primeros auxilios y control de incendios por frente"],["Comunicación","Directorio de emergencias visible: 123, 164, ARL, bomberos, centro asistencial"],["Simulacros","Al menos uno al año por sede y uno por proyecto con duración > 3 meses; participación en el simulacro nacional"]]}}],"d":"Plan de prevención, preparación y respuesta ante emergencias: identifica amenazas, define cómo responder (fuga de gas, incendio, CO, caída y espacio confinado) y los recursos mínimos por frente de obra (Decreto 1072 art. 2.2.4.6.25).","i":["Revisa el análisis de amenazas y ajusta la probabilidad y los controles a tus frentes de obra.","Lee el protocolo de respuesta ante fuga de gas y adáptalo: números de emergencia locales, punto de encuentro y responsables.","En Recursos y preparación, confirma que cada frente de obra cuente con el mínimo exigido.","Programa al menos un simulacro al año y registra su informe."]},"GI-PL-02":{"c":"GI-PL-02","t":"Plan anual de trabajo del SG-SST","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["Ciclo PHVA","Estándar Res. 0312","Actividad","Responsable","Recursos","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic","Indicador / evidencia","% ejecución"],"r":17,"ini":[["P","Est. 1.1.1","Designar responsable del SG-SST con licencia y curso de 50 horas","Representante legal","Talento humano","P","","","","","","","","","","","","Carta de designación",""],["P","Est. 1.1.8","Conformar o renovar COPASST/vigía","Representante legal","Votación","P","","","","","","","","","","","","Actas",""],["P","Est. 1.2.1","Ejecutar programa de capacitación anual (TH-PL-01)","Líder de SST","Presupuesto formación","P","P","P","P","P","P","P","P","P","P","P","P","Cobertura de formación",""],["P","Est. 2.1.1","Revisar y divulgar la política del SIG","Gerencia","—","P","","","","","","","","","","","","Política firmada",""],["P","Est. 2.7.1","Actualizar matriz legal GI-MZ-01","Coordinador del SIG","—","","","P","","","P","","","P","","","P","Matriz actualizada",""],["P","Est. 4.1.2","Actualizar matriz de peligros GI-MZ-04 con participación de trabajadores","Líder de SST","COPASST","","P","","","","","","P","","","","","Matriz firmada",""],["H","Est. 3.1.4","Evaluaciones médicas ocupacionales de ingreso, periódicas y retiro","Talento humano","IPS ocupacional","","","P","","","","","","P","","","","Certificados de aptitud",""],["H","Est. 3.1.9","Programa de trabajo en alturas: certificados vigentes y coordinador","Líder de SST","Centro de entrenamiento","P","","","P","","","P","","","P","","","% trabajadores certificados",""],["H","Est. 4.2.5","Inspección de EPP, arneses y líneas de vida","Supervisor","Formatos","P","P","P","P","P","P","P","P","P","P","P","P","Inspecciones",""],["H","Est. 4.2.4","Inspecciones de seguridad a frentes de obra (GI-FO-12)","COPASST","—","","","P","","","P","","","P","","","P","N.º inspecciones",""],["H","Est. 5.1.1","Actualizar plan de emergencias y realizar simulacro","Líder de SST","Brigada","","","","","","","","","","P","","","Informe de simulacro",""],["H","Est. 5.1.2","Capacitar y dotar brigada de emergencias","Líder de SST","ARL","","","","P","","","","","","","","","Brigadistas formados",""],["V","Est. 6.1.1","Medir indicadores de estructura, proceso y resultado","Líder de SST","—","P","P","P","P","P","P","P","P","P","P","P","P","EM-MZ-01",""],["V","Est. 6.1.2","Auditoría interna anual con participación del COPASST","Coordinador del SIG","Auditores","","","","","","","","","P","","","","Informe EM-FO-03",""],["V","Est. 6.1.4","Revisión por la dirección","Gerencia","—","","","","","","","","","","","P","","Acta EM-FO-05",""],["A","Est. 7.1.1","Seguimiento a acciones correctivas y de mejora","Coordinador del SIG","—","","","P","","","P","","","P","","","P","EM-FO-07",""],["V","—","Autoevaluación de estándares mínimos y reporte al Ministerio del Trabajo / ARL","Líder de SST","Plataforma Fondo de Riesgos Laborales","","","","","","","","","","","","P","Calificación de estándares",""]]}}],"d":"Plan anual de trabajo del SG-SST: las actividades del año con responsables, recursos y cronograma, organizadas según el ciclo PHVA y los estándares mínimos de la Res. 0312 de 2019.","i":["La tabla trae las actividades base; ajústalas a tu empresa y agrega las que surjan de tu autoevaluación de estándares mínimos.","Asigna el responsable y los recursos de cada actividad.","En los meses, marca P cuando la actividad esté programada y E cuando se haya ejecutado.","Registra la evidencia o el indicador y el % de ejecución. El plan lo firman el empleador y el responsable del SG-SST."]},"GI-MZ-01":{"c":"GI-MZ-01","t":"Normograma (matriz de requisitos legales y otros requisitos)","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["N.º","Tipo","Norma","Emisor","Año","Artículos / numerales aplicables","Requisito","Proceso","Evidencia de cumplimiento","Estado","Fecha de verificación","Observaciones"],"r":28,"ini":[["1","Reglamento técnico","Resolución 90902","MinEnergía","2013","Todo; num. 6.1, 6.2, 6.3, Anexo 2","Reglamento técnico de instalaciones internas de gas combustible","DI, CN, MT, IV","CN-PR-01, CN-IN-01, certificados de competencia","Por verificar","","Modificada por Res. 40488/2015, 40120/2016, 41385/2017; prórrogas 40497/2023, 40311/2024, 40342/2025, 40348/2026. Verificar vigencia trimestralmente."],["2","NTC","NTC 2505","ICONTEC","2006","Tablas 1 y 2, pruebas, purga","Instalaciones para suministro de gas en edificaciones residenciales y comerciales","DI, CN, MT","CN-IN-01, CN-FO-04","Por verificar","","Edición citada por el reglamento"],["3","NTC","NTC 3728","ICONTEC","2001","Profundidades, separaciones, pruebas de PE","Gasoductos. Líneas de servicio y acometidas","DI, CN","Planos, CN-FO-04","Por verificar","",""],["4","NTC","NTC 3838","ICONTEC","—","Presiones de operación","Presiones de operación permisibles para gas combustible","DI","Memoria de cálculo","Por verificar","","Verificar edición vigente"],["5","NTC","NTC 3833","ICONTEC","—","Ventilación y evacuación de productos de combustión","Dimensionamiento, construcción, montaje y evaluación de sistemas de evacuación","DI, CN, MT","Memoria de cálculo, actas","Por verificar","","Verificar edición vigente"],["6","NTC","NTC 4282","ICONTEC","2003","Instalaciones industriales","Instalaciones para suministro de gas destinadas a usos industriales","DI, CN","Memoria de cálculo","Brecha","","La copia disponible es de 1997; adquirir la edición 2003"],["7","Reglamento técnico","RETIE (Resolución 40284)","MinEnergía","2026","Instalaciones de uso final, productos","Instalaciones eléctricas de equipos de control, automatización y telemetría","ID, CN","Declaración de cumplimiento","Por verificar","","Verificar régimen de transición"],["8","Decreto","Decreto 1072","MinTrabajo","2015","Libro 2, Parte 2, Título 4, Capítulo 6","SG-SST","GI, TH","Plan anual GI-PL-02","Por verificar","",""],["9","Resolución","Resolución 0312","MinTrabajo","2019","Estándares mínimos según tamaño y riesgo","Estándares mínimos del SG-SST","GI","Autoevaluación anual","Por verificar","",""],["10","Resolución","Resolución 4272","MinTrabajo","2021","Todo","Trabajo seguro en alturas","CN, MT","GI-FO-20, certificados","Por verificar","",""],["11","Resolución","Resolución 0491","MinTrabajo","2020","Todo","Trabajo en espacios confinados","CN, MT","GI-FO-21","Por verificar","",""],["12","Resolución","Resolución 1401","MinProtección","2007","Todo","Investigación de incidentes y accidentes","GI","GI-PR-07","Por verificar","",""],["13","Resolución","Resolución 2346","MinProtección","2007","Todo","Evaluaciones médicas ocupacionales","TH","Certificados de aptitud","Por verificar","","Modificada por Res. 1918 de 2009"],["14","Ley","Ley 2050","Congreso","2020","Art. 110 Ley 1955 modificado","Plan estratégico de seguridad vial (si aplica)","GI","PESV, GI-FO-26","Por verificar","","Metodología Res. 40595 de 2022"],["15","Resolución","Resolución 1257","MinAmbiente","2021","Todo","Gestión de residuos de construcción y demolición (RCD)","CN","Certificados de gestor","Por verificar","",""],["16","Decreto","Decreto 1076","MinAmbiente","2015","Residuos peligrosos (Título 6)","Gestión de RESPEL","CN, ID","Certificados de gestor","Por verificar","",""],["17","Ley","Ley 1672","Congreso","2013","Todo","Gestión de RAEE","ID","Certificados de gestor","Por verificar","","Reglamentada por Decreto 284 de 2018"],["18","Ley","Ley 1581","Congreso","2012","Todo; Decreto 1377 de 2013","Protección de datos personales","TI, CO","TI-PR-02, autorizaciones","Por verificar","","Registro de bases de datos ante la SIC si aplica"],["19","Decisión / Ley","Decisión 486 CAN, Ley 23 de 1982 y Ley 1915 de 2018","CAN / Congreso","—","Patentes, derechos de autor, software","Propiedad intelectual","ID","ID-PR-02","Por verificar","",""],["20","Ley","Ley 1474","Congreso","2011","Todo","Estatuto anticorrupción","DE","DE-PO-02","Por verificar","",""],["21","Ley","Ley 842","Congreso","2003","Matrícula profesional y responsabilidad","Ejercicio de la ingeniería","DI, IV","Matrículas COPNIA vigentes","Por verificar","",""],["22","Ley","Ley 1480","Congreso","2011","Garantía","Estatuto del consumidor","CO, MT","Garantía escrita","Por verificar","",""],["23","Norma ISO","ISO 9001","ISO","2026","Todo","Sistema de gestión de calidad","Todos","Manual SIG","En implementación","",""],["24","Norma ISO","ISO 14001","ISO","2026","Todo","Sistema de gestión ambiental","Todos","Manual SIG","En implementación","",""],["25","Norma ISO","ISO 45001","ISO","2018 (revisión en curso)","Todo","Sistema de gestión de SST","Todos","Manual SIG","En implementación","","Seguir la publicación de la nueva edición"],["26","Norma ISO","ISO 56001 / NTC 5801","ISO / ICONTEC","2024 / 2018","Todo","Gestión de la innovación e I+D+i","ID","ID-PR-01","En implementación","",""],["27","Documento IAF","IAF MD 1","IAF","2023","Todo","Certificación de organizaciones multisitio","DE, GI","GI-PR-09, convenio de adhesión","En implementación","",""],["28","Contrato","Convenio de adhesión a la red (CE-CO-01)","Industrias I.A. Col","—","Todo","Obligaciones de los miembros","Todos","Convenio firmado","Pendiente","","Tras constitución legal y revisión jurídica"]]}}],"d":"Normograma: lista los requisitos legales y otros requisitos que aplican a la empresa y la evidencia de cómo los cumple (ISO 14001 num. 6.1.3; ISO 45001 num. 6.1.3).","i":["La tabla trae las normas base de la red (Res. 90902, NTC 2505, Decreto 1072, Res. 0312, entre otras); verifica cuáles aplican a tu empresa y agrega las locales.","Para cada norma, escribe los artículos o numerales que te aplican y el requisito concreto.","En Evidencia de cumplimiento, indica el registro o documento que lo demuestra.","Registra el Estado (cumple, en proceso o no cumple) y la fecha de verificación. Revísalo al menos una vez al año y cada vez que salga una norma nueva."]},"GI-MZ-02":{"c":"GI-MZ-02","t":"Matriz de riesgos y oportunidades","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["ID","Proceso","Tipo (R/O)","Fuente (contexto / parte interesada)","Descripción","Causas","Consecuencias","Probabilidad (1-5)","Impacto (1-5)","Nivel (P×I)","Zona","Tratamiento","Acciones","Responsable","Fecha","Eficacia (sí/no)"],"r":13,"ini":[["R-GI-01","GI","R","Modelo de red","Un miembro incumple y se pierde la certificación multisitio","Baja madurez, falta de control","Suspensión del certificado para toda la red","3","5","15","Crítico","Reducir","Admisión con GI-FO-09, auditoría interna a 100 % de miembros/año, suspensión inmediata","Coordinador del SIG","",""],["R-GI-02","GI","R","Ética","Uso del SIG por miembro no adscrito o en proyectos fuera del alcance","Presión comercial","Sanción del organismo de certificación, publicidad engañosa","3","4","12","Alto","Reducir","Leyenda controlada sgcLeyenda, bitácora, DE-PO-02","Coordinador del SIG","",""],["R-CN-01","CN","R","Reglamento técnico","Instalación con defecto crítico entregada","Prueba no realizada, personal no competente","Fuga, intoxicación, sanción","2","5","10","Alto","Reducir","CN-IN-01, liberación por director técnico, EM-PR-03","Director técnico de gas","",""],["R-CN-02","CN","R","Seguridad","Daño a redes existentes en excavación","Sin planos de redes, sin sondeo","Fuga, explosión","2","5","10","Alto","Reducir","GI-FO-24, consulta de redes al distribuidor","Director de obra","",""],["R-TH-01","TH","R","Talento","Técnico con certificado de competencia vencido ejecuta","Sin alertas","Incumplimiento Res. 90902","3","4","12","Alto","Reducir","Alertas de vencimiento en plataforma a 60 días","Líder de talento humano","",""],["R-MI-01","MI","R","Metrología","Manómetro sin calibración usado en prueba","Control deficiente","Resultado de prueba no válido","2","4","8","Alto","Reducir","MI-PR-01, etiqueta de estado, bloqueo en plataforma","Líder de metrología","",""],["R-TI-01","TI","R","Tecnológico","Pérdida o fuga de información de la plataforma","Credenciales compartidas, sin respaldo","Pérdida de evidencia, sanción Ley 1581","2","4","8","Alto","Reducir","TI-PR-01, TI-PR-02, MFA, copias de respaldo","Líder de TI","",""],["R-CC-01","CN/MT","R","Cambio climático","Lluvias intensas afectan zanjas y redes enterradas","Variabilidad climática","Derrumbes, retrasos","3","3","9","Alto","Reducir","Programación según IDEAM, entibado, cierre diario de zanjas","Director de obra","",""],["R-ID-01","ID","R","Propiedad intelectual","Infracción de derechos de terceros o pérdida de la propiedad propia","Sin vigilancia ni acuerdos","Litigios, pérdida de valor","2","4","8","Alto","Reducir","ID-PR-02, acuerdos de confidencialidad","Líder de I+D+i","",""],["R-DE-01","DE","R","Legal","Retraso en la constitución de Industrias I.A. Col","Trámites","No se puede firmar contrato de certificación","3","4","12","Alto","Reducir","DE-PL-01 eje 1","Gerente","",""],["O-ID-01","ID","O","Transición energética","Servicios para mezclas con hidrógeno y biometano","Tendencia del sector","Nuevos mercados","3","4","12","Prioridad alta","Aprovechar","Vigilancia tecnológica, proyecto piloto","Líder de I+D+i","",""],["O-MT-01","MT","O","Tecnológico","Mantenimiento predictivo con telemetría","Capacidad de I+D+i propia","Contratos recurrentes","3","4","12","Prioridad alta","Aprovechar","Integrar ID con MT","Líder de mantenimiento","",""],["O-CO-01","CO","O","Mercado","Clientes que exigen proveedor certificado","Exigencias de compras","Acceso a contratos industriales","4","4","16","Prioridad alta","Aprovechar","Certificación multisitio 2027","Gerente","",""]]}}],"d":"Matriz de riesgos y oportunidades de los procesos, con su valoración (probabilidad × impacto) y su tratamiento (ISO 9001 num. 6.1).","i":["Por cada riesgo u oportunidad, identifica el proceso, la fuente (cuestión del contexto o parte interesada), las causas y las consecuencias.","Califica la probabilidad y el impacto de 1 a 5; el nivel es P × I.","Ubica la zona con la escala del procedimiento GI-PR-02: Crítico de 15 o más, Alto de 8 a 14, Moderado de 4 a 7.","Define el tratamiento, las acciones, el responsable y la fecha; luego verifica la eficacia (sí o no)."]},"GI-MZ-03":{"c":"GI-MZ-03","t":"Matriz de roles, responsabilidades y autoridades (RACI)","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["Actividad","Gerente función central","Coordinador del SIG","Director técnico de gas","Líder de SST","Líder de I+D+i","Representante legal del miembro","Responsable SIG del miembro","Director de obra / supervisor","Técnico instalador","Auditor interno"],"r":15,"ini":[["Aprobar política, manual y procedimientos","A","R","C","C","C","I","I","I","I","I"],["Admitir, suspender o retirar miembros","A","R","C","C","I","I","C","I","I","C"],["Diseñar instalación de gas (diseñador con matrícula bajo el director técnico)","I","I","A/R","C","I","I","I","C","I","I"],["Emitir permiso de trabajo de alto riesgo","I","I","C","C","I","I","I","A/R","C","I"],["Ejecutar prueba de hermeticidad","I","I","C","I","I","I","I","A","R","I"],["Liberar instalación para inspección y puesta en servicio","I","I","A","I","I","I","I","R","C","I"],["Reportar accidente a ARL","I","I","I","C","I","A","R","C","I","I"],["Investigar accidente","I","I","C","R","I","A","C","C","C","I"],["Planificar y ejecutar auditoría interna","A","R","C","C","C","I","C","I","I","R"],["Aprobar validación de prototipo I+D+i","A","C","C","C","R","I","I","I","I","I"],["Cargar registros en la plataforma","I","C","I","I","I","A","R","R","I","I"],["Detener un trabajo inseguro","I","I","R","R","R","R","R","R","R","R"],["Revisión por la dirección","A/R","R","C","C","C","C","C","I","I","I"],["Seleccionar proveedor crítico","I","C","C","C","C","A","R","C","I","I"],["Convención","R = responsable de ejecutar; A = aprueba / rinde cuentas; C = consultado; I = informado","","","","","","","","",""]]}}],"d":"Matriz RACI: define quién ejecuta (R), quién aprueba y responde (A), a quién se consulta (C) y a quién se informa (I) en cada actividad del SIG.","i":["Escribe en cada celda la letra que corresponda: R, A, C o I.","Cada actividad debe tener exactamente una A.","Ajusta los roles a tu empresa: escribe los nombres de las personas en un anexo o en las observaciones del perfil (TH-MZ-01).","Comunica la matriz al personal y revísala cuando cambie la estructura."]},"GI-MZ-04":{"c":"GI-MZ-04","t":"Matriz de identificación de peligros, evaluación y valoración de riesgos (GTC 45)","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["Proceso","Zona / lugar","Actividad","Tarea","Rutinaria (S/N)","Peligro: descripción","Peligro: clasificación","Efectos posibles","Control existente: fuente","Control existente: medio","Control existente: individuo","ND","NE","NP (ND×NE)","Interpretación NP","NC","NR (NP×NC)","Interpretación NR","Aceptabilidad","N.º expuestos","Peor consecuencia","Requisito legal","Eliminación","Sustitución","Controles de ingeniería","Controles administrativos","EPP"],"r":11,"ini":[["CN","Frente de obra","Construcción de red interna","Prueba de hermeticidad y purga","S","Fuga de gas combustible / atmósfera explosiva","Condiciones de seguridad — tecnológico (explosión, incendio)","Quemaduras, muerte","Válvulas de corte","Detector de gas","Formación","6","3","18","Alto","100","1800","I","No aceptable: intervención urgente antes de ejecutar","","Muerte","Res. 90902; NTC 2505","Probar con aire o gas inerte","—","Venteo controlado al exterior","CN-IN-01, GI-FO-23","Ropa ignífuga, gafas"],["CN","Fachadas, cubiertas","Montaje de tubería","Trabajo a más de 2 m","S","Trabajo en alturas","Condiciones de seguridad — locativo","Fracturas, muerte","—","Líneas de vida, andamios certificados","Certificado de alturas","6","3","18","Alto","100","1800","I","No aceptable: intervención urgente antes de ejecutar","","Muerte","Res. 4272 de 2021","Prefabricar a nivel de piso","Plataformas elevadoras","Barandas","GI-FO-20, plan de rescate","Arnés, eslinga, casco con barbuquejo"],["CN","Vía pública","Acometida enterrada","Excavación de zanja","S","Derrumbe / contacto con redes existentes","Condiciones de seguridad — locativo","Atrapamiento, fuga","—","Entibado","—","6","2","12","Alto","60","720","I","No aceptable: intervención urgente antes de ejecutar","","Muerte","NTC 3728","—","Perforación horizontal dirigida","Entibado, taludes","GI-FO-24, consulta de redes","Casco, botas"],["CN/MT","Cámaras, sótanos","Inspección de válvulas","Ingreso a espacio confinado","N","Atmósfera peligrosa (O2 < 19,5 %, LEL > 10 %, CO, H2S)","Condiciones de seguridad — espacio confinado","Asfixia, intoxicación, muerte","—","Ventilación forzada","Monitor multigás","6","1","6","Medio","100","600","I","No aceptable: intervención urgente antes de ejecutar","","Muerte","Res. 0491 de 2020","Operar desde el exterior","—","Ventilación","GI-FO-21, vigía","Equipo de rescate, arnés"],["CN/MT","Frente de obra","Unión de tubería metálica","Soldadura, corte, termofusión","S","Trabajo en caliente cerca de gas","Condiciones de seguridad — tecnológico","Quemaduras, incendio","—","Extintor","Formación","6","2","12","Alto","60","720","I","No aceptable: intervención urgente antes de ejecutar","","Lesión grave","Decreto 1072","Uniones mecánicas o roscadas","Prensado en frío","Aislamiento de la línea","GI-FO-22, medición LEL","Careta, guantes de cuero, ropa ignífuga"],["MT","Vivienda / comercio","Puesta en servicio de gasodomésticos","Medición de CO","S","Monóxido de carbono","Químico — gases","Intoxicación","—","Ventilación","Analizador de CO","2","3","6","Medio","60","360","II","Aceptable con control específico","","Muerte","Res. 90902 Anexo 2","—","—","Ductos de evacuación","Suspender servicio con CO ≥ 50 ppm","—"],["ID","Laboratorio","Prototipos de automatización","Pruebas eléctricas","S","Contacto eléctrico directo/indirecto","Condiciones de seguridad — eléctrico","Electrocución, quemaduras","Protecciones diferenciales","Aislamiento","Formación","2","3","6","Medio","60","360","II","Aceptable con control específico","","Lesión grave","RETIE","Trabajar desenergizado","Baja tensión de seguridad","Tableros con protección","GI-FO-25, cinco reglas de oro","Guantes dieléctricos"],["Todos","Vías","Desplazamiento a obras","Conducción","S","Accidente de tránsito","Condiciones de seguridad — tránsito","Lesiones, muerte","—","Mantenimiento vehicular","Licencia","2","3","6","Medio","100","600","I","No aceptable: intervención urgente antes de ejecutar","","Muerte","Ley 2050 de 2020","—","Transporte público","—","GI-FO-26","Casco y chaleco para moto"],["Todos","Oficina","Diseño y gestión","Uso de computador","S","Posturas prolongadas y movimientos repetitivos","Biomecánico","DME","—","Mobiliario","Pausas activas","2","4","8","Medio","10","80","III","Mejorable","","DME","Decreto 1072","—","—","Puesto ergonómico","Pausas activas","—"],["Todos","Todos","Trabajo bajo presión de plazos","Gestión de proyectos","S","Carga mental y jornada","Psicosocial","Estrés","—","—","—","2","3","6","Medio","25","150","II","Aceptable con control específico","","Enfermedad","Res. 2764 de 2022 (batería psicosocial)","—","—","—","Planificación de cargas","—"],["Leyenda","ND: 10 muy alto, 6 alto, 2 medio, 0 bajo. NE: 4 continua, 3 frecuente, 2 ocasional, 1 esporádica. NC: 100 mortal, 60 muy grave, 25 grave, 10 leve. NR I: 4000-600; II: 500-150; III: 120-40; IV: 20.","","","","","","","","","","","","","","","","","","","","","","","","",""]]}}],"d":"Matriz de identificación de peligros y valoración de riesgos con la metodología GTC 45: es la base del SG-SST para definir controles y priorizar acciones.","i":["Por cada proceso, zona, actividad y tarea, identifica los peligros con su descripción y su clasificación (GTC 45).","Registra los controles existentes en la fuente, el medio y el individuo.","Calcula: NP = ND × NE y NR = NP × NC. Interprétalos con las tablas de la GTC 45 (la leyenda está en la última fila).","Define la aceptabilidad, el número de expuestos, la peor consecuencia y el requisito legal.","Propón controles en orden de jerarquía: eliminación, sustitución, ingeniería, administrativos y EPP. Los riesgos de nivel I no son aceptables y requieren intervención inmediata."]},"GI-MZ-05":{"c":"GI-MZ-05","t":"Matriz de aspectos e impactos ambientales","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["Proceso","Actividad","Etapa del ciclo de vida","Aspecto ambiental","Impacto ambiental","Condición (N/A/E)","Frecuencia (1-5)","Severidad (1-5)","Alcance (1-5)","Requisito legal (S=5/N=1)","Partes interesadas (1-5)","Puntaje","Significativo (≥ 15)","Control operacional","Requisito legal aplicable","Responsable"],"r":9,"ini":[["CN/MT","Purga y puesta en servicio","Uso","Emisión de gas metano por venteo","Contribución al cambio climático (GEI); riesgo de atmósfera explosiva","N","4","4","3","1","4","16","Sí","Purga controlada GI-FO-23; minimizar volumen","ISO 14001:2026 num. 4.1","Director de obra"],["CN","Excavación y reposición de vía","Construcción","Generación de RCD","Ocupación de suelo, contaminación","N","4","3","2","5","3","17","Sí","Gestor de RCD autorizado, certificados","Res. 1257 de 2021","Director de obra"],["CN","Instalación","Construcción","Residuos de tubería, retales de PE, cobre y acero","Agotamiento de recursos","N","4","2","1","1","2","10","No","Separación y aprovechamiento","—","Director de obra"],["CN/MT","Uso de soldadura y solventes","Construcción","Generación de residuos peligrosos (envases, trapos)","Contaminación de suelo y agua","N","3","4","2","5","2","16","Sí","Almacenamiento y gestor RESPEL","Decreto 1076 de 2015","Líder ambiental"],["ID","Prototipado electrónico","Diseño y fin de vida","Generación de RAEE y baterías","Contaminación por metales","N","3","4","2","5","3","17","Sí","Gestor RAEE, diseño para desensamble","Ley 1672 de 2013","Líder de I+D+i"],["Todos","Desplazamientos","Operación","Consumo de combustibles","Emisiones GEI y contaminación del aire","N","5","2","3","1","2","13","No","Planeación de rutas","—","Coordinador del SIG"],["CN","Prueba con fuga no detectada","Uso","Emisión accidental de gas","Explosión, GEI","E","1","5","4","5","5","20","Sí","GI-PL-01, CN-IN-01","Res. 90902","Director técnico de gas"],["DI","Diseño","Diseño","Selección de equipos de alta eficiencia","Reducción de consumo de energía (positivo)","N","3","3","2","1","4","13","No (oportunidad)","Criterio de diseño DI-PR-01","—","Director técnico de gas"],["Todos","Oficina","Operación","Consumo de papel y energía","Agotamiento de recursos","N","5","1","1","1","1","9","No","Plataforma digital","—","Coordinador del SIG"]]}}],"d":"Matriz de aspectos e impactos ambientales: identifica cómo afectan al ambiente las actividades de la empresa y cuáles son significativos (ISO 14001 num. 6.1.2).","i":["Por cada actividad, identifica el aspecto ambiental (por ejemplo, generación de residuos) y su impacto (por ejemplo, contaminación del suelo).","Indica la etapa del ciclo de vida y la condición: normal, anormal o de emergencia.","Califica frecuencia, severidad, alcance, requisito legal y partes interesadas; el puntaje es la suma.","Un puntaje de 15 o más es significativo: define el control operacional, el requisito legal y el responsable."]},"GI-MZ-06":{"c":"GI-MZ-06","t":"Matriz de comunicaciones","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["Qué se comunica","Tipo (interna/externa)","Quién comunica","A quién","Cuándo","Cómo (medio)","Registro"],"r":13,"ini":[["Política, objetivos y cambios del SIG","Interna","Coordinador del SIG","Miembros y trabajadores","Al aprobar o cambiar","Plataforma, inducción","Constancia de lectura"],["Documentos nuevos o actualizados","Interna","Coordinador del SIG","Responsables SIG de miembros","Al publicar","Notificación de la plataforma","Bitácora"],["Estado de los miembros (adscrito, suspendido, retirado)","Interna / externa","Coordinador del SIG","Miembros, organismo de certificación","Al cambiar","Plataforma, correo","Bitácora"],["Resultados de auditorías","Interna","Auditor líder","Miembro auditado, gerencia","Al cerrar auditoría","Informe EM-FO-03","Informe"],["Peligros, riesgos y controles","Interna","Líder de SST","Trabajadores","Inducción, charla diaria","Presencial","TH-FO-02"],["Accidentes y lecciones aprendidas","Interna","Coordinador del SIG","Toda la red","Tras investigación","Boletín","Boletín"],["Reporte de accidente de trabajo","Externa","Empleador","ARL, EPS","2 días hábiles","FURAT","FURAT"],["Emergencia de gas","Externa","Supervisor","Distribuidor (164), 123","Inmediato","Teléfono","Constancia"],["Propuestas, contratos y cambios del cliente","Externa","Líder comercial","Cliente","Según contrato","Correo, plataforma","CO-FO-02"],["Quejas y reclamos","Externa","Líder comercial","Cliente","Respuesta en ≤ 15 días hábiles","Correo","Registro de PQR"],["Uso de la marca de certificación","Externa","Gerente","Público","Según reglas del organismo","Publicidad","Aprobación previa"],["Cambios normativos","Interna","Coordinador del SIG","Líderes de proceso","Trimestral","Plataforma","GI-MZ-01"],["Información ambiental relevante","Externa","Líder ambiental","Autoridad ambiental","Cuando la norma lo exija","Formato oficial","Radicado"]]}}],"d":"Matriz de comunicaciones: define qué se comunica, quién, a quién, cuándo y cómo, tanto interna como externamente (ISO 9001 num. 7.4).","i":["Ajusta las comunicaciones de ejemplo a tu empresa y agrega las tuyas.","Para cada una, indica el tipo (interna o externa), quién comunica, a quién, cuándo y el medio.","En Registro, indica la evidencia que queda de la comunicación."]},"GI-MZ-07":{"c":"GI-MZ-07","t":"Tabla de retención de registros","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["Registro","Código","Responsable de custodia","Medio","Ubicación","Protección / acceso","Tiempo de retención","Disposición final","Fundamento"],"r":13,"ini":[["Actas de prueba de hermeticidad","CN-FO-04","Miembro ejecutor","Digital","Plataforma","Solo lectura tras carga","10 años después de la entrega","Conservación histórica","Código de Comercio art. 60; responsabilidad civil"],["Diseños, planos y memorias de cálculo","DI-FO-01..05","Miembro diseñador","Digital","Plataforma","Solo lectura","10 años","Conservación","Código de Comercio art. 60; Ley 842 de 2003"],["Certificados de calibración y hojas de vida de equipos","MI-FO-01","Miembro","Digital","Plataforma","Solo lectura","Vida útil del equipo + 5 años","Eliminación segura","ISO 9001 num. 7.1.5"],["Certificados de competencia laboral y formación","TH-FO-02/03","Miembro","Digital","Plataforma","Datos personales","Vínculo + 20 años","Eliminación segura","Decreto 1072 art. 2.2.4.6.13"],["Evaluaciones médicas ocupacionales","—","IPS / médico","Físico/digital","Custodia del prestador","Reserva","Según Res. 2346 de 2007 (custodia del prestador de salud ocupacional)","Según norma","Res. 2346 de 2007"],["Investigaciones de accidentes","—","Miembro","Digital","Plataforma","Restringido","20 años","Conservación","Decreto 1072 art. 2.2.4.6.13"],["Permisos de trabajo de alto riesgo","GI-FO-20..25","Miembro","Digital","Plataforma","Solo lectura","20 años","Conservación","Decreto 1072 art. 2.2.4.6.13"],["Informes de auditoría y acciones","EM-FO-01..07","Función central","Digital","Plataforma","Solo lectura","5 años (cubre el ciclo de certificación de 3 años)","Eliminación","ISO 9001 num. 9.2"],["Actas de revisión por la dirección","EM-FO-05","Función central","Digital","Plataforma","Solo lectura","5 años","Conservación","ISO 9001 num. 9.3"],["Expedientes de proyectos I+D+i","ID-PR-01","Líder de I+D+i","Digital","Plataforma","Confidencial","Vigencia de la protección de PI + 5 años","Conservación","Decisión 486 CAN"],["Evaluación de proveedores","CP-FO-01","Miembro","Digital","Plataforma","Solo lectura","5 años","Eliminación","ISO 9001 num. 8.4"],["Expediente de admisión del miembro","GI-FO-09","Función central","Digital","Plataforma","Confidencial","Permanencia + 10 años","Conservación","IAF MD 1"],["Bitácora de la plataforma","—","Líder de TI","Digital","Plataforma","Inmutable","6 años","Archivo","Trazabilidad"]]}}],"d":"Tabla de retención de registros: define dónde y cuánto tiempo se conserva cada registro del SIG y qué se hace al final de ese tiempo.","i":["Revisa cada registro listado y confirma el responsable de custodia, el medio y la ubicación en tu empresa.","Respeta los tiempos mínimos de retención (fundamentos legales); puedes ampliarlos, pero no reducirlos.","Define la protección o el acceso y la disposición final (eliminación segura o conservación)."]},"CN-PL-01":{"c":"CN-PL-01","t":"Plan de calidad, SST y ambiente del proyecto (plantilla)","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Objetivo","n":"Establecer, para un proyecto específico, cómo se aplican los procesos, recursos, controles y registros del SIG.","x":"Ajustes al objetivo para tu empresa (opcional)"},{"t":"1. Datos del proyecto","g":{"h":["Campo","Información"],"r":7,"ini":[["Proyecto / código",""],["Cliente",""],["Miembro ejecutor",""],["Fecha de ingreso al SIG del proyecto",""],["Alcance y entregables",""],["Normas y especificaciones aplicables",""],["Interventoría (si la hay)",""]]}},{"t":"2. Organización del proyecto","g":{"h":["Rol","Nombre","Competencia / certificado","Vigencia"],"r":5,"ini":[["Director de obra","","",""],["Director técnico de gas","","",""],["Responsable SST en obra","","",""],["Coordinador de alturas","","",""],["Técnicos instaladores","","",""]]}},{"t":"3. Matriz de control de calidad (inspección y ensayo)","g":{"h":["Actividad","Control","Criterio de aceptación","Frecuencia","Responsable","Registro","Punto de espera"],"r":6,"ini":[["Recepción de materiales","Certificados de conformidad, inspección visual","Material certificado, sin daños","Cada lote","Director de obra","Remisión firmada","No"],["Excavación","Profundidad y separaciones","NTC 3728","Cada tramo","Supervisor","GI-FO-24","Sí"],["Uniones","Inspección visual, procedimiento calificado (termofusión/soldadura)","Sin defectos","Cada unión","Supervisor","Bitácora","No"],["Prueba de hermeticidad","CN-IN-01","Sin caída de presión en el tiempo de la norma","Cada instalación/tramo","Técnico + director técnico","CN-FO-04","Sí"],["Inspección reglamentaria","Organismo acreditado","Sin defectos críticos","Cada instalación","Director técnico","Certificado","Sí"],["Purga y puesta en servicio","GI-FO-23","CO < 15 ppm; sin fugas","Cada instalación","Técnico","GI-FO-23","Sí"]]}},{"t":"4. Peligros, aspectos y controles del proyecto","n":"Extraer de GI-MZ-04 y GI-MZ-05 los peligros y aspectos aplicables, y añadir los específicos del sitio. Indicar los permisos de trabajo requeridos (GI-FO-20 a GI-FO-25).","x":"Describe cómo lo aplicas en tu empresa o proyecto"},{"t":"5. Equipos de medición del proyecto","g":{"h":["Equipo","Serie","Rango","Fecha de calibración","Vence"],"r":3,"ini":[["Manómetro","","","",""],["Detector de gas","","","",""],["Analizador de CO","","","",""]]}},{"t":"6. Plan de emergencias del sitio","n":"Directorio, centro asistencial más cercano, punto de encuentro, brigadistas (anexo A de GI-PL-01).","x":"Describe cómo lo aplicas en tu empresa o proyecto"},{"t":"7. Comunicación con el cliente, el distribuidor y la interventoría","n":"Comités de obra, informes, canal para cambios (DI-FO-05).","x":"Describe cómo lo aplicas en tu empresa o proyecto"},{"t":"8. Entrega","n":"Dossier: planos récord, actas de prueba, certificado de inspección, registros de puesta en servicio, garantía y manual de uso seguro para el usuario.","x":"Describe cómo lo aplicas en tu empresa o proyecto"}],"d":"Plan de calidad, SST y ambiente de un proyecto: se diligencia uno por proyecto antes de iniciar la obra y reúne la organización, los controles de calidad, los peligros, los equipos, las emergencias y la entrega.","i":["Diligéncialo antes de iniciar el proyecto; solo los proyectos creados desde la fecha de adscripción quedan bajo el SIG.","Completa los datos del proyecto y la organización con el nombre, la competencia y la vigencia de cada rol.","Revisa la matriz de control de calidad: ajusta actividades, criterios de aceptación y puntos de espera.","Describe los peligros, aspectos y controles propios del sitio, el plan de emergencias del sitio y la comunicación con el cliente, el distribuidor y la interventoría.","Registra los equipos de medición con su calibración vigente y lo que se entregará al cierre."]},"TH-MZ-01":{"c":"TH-MZ-01","t":"Matriz de perfiles y competencias","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["Cargo / rol","Proceso","Educación mínima","Formación / certificación obligatoria","Experiencia mínima","Habilidades","Requisito legal","Vigencia a controlar"],"r":12,"ini":[["Director técnico de gas","DI, CN, MT","Ingeniero mecánico, de petróleos, químico o afín","Matrícula profesional COPNIA; conocimiento de Res. 90902 y NTC aplicables","3 años en instalaciones de gas","Liderazgo, análisis técnico","Ley 842 de 2003","Matrícula"],["Diseñador / verificador","DI","Ingeniero","Matrícula COPNIA; NTC 2505, 3728, 4282, 3833","2 años en diseño de gas","Cálculo hidráulico, CAD","Ley 842 de 2003","Matrícula"],["Técnico instalador de gas","CN, MT","Bachiller o técnico","Certificado de competencia laboral vigente (SENA u OCP acreditado ONAC) en la norma aplicable al tipo de instalación, e inscripción vigente en el registro de la SIC","1 año","Lectura de planos, uniones, pruebas","Res. 90902 num. 6.1 y 6.2","Certificado de competencia e inscripción SIC"],["Técnico en alturas","CN, MT","—","Certificado de trabajo seguro en alturas nivel avanzado o trabajador autorizado","—","—","Res. 4272 de 2021","Reentrenamiento anual"],["Coordinador de trabajo en alturas","CN, MT","—","Curso de coordinador (80 h) vigente","1 año","Liderazgo SST","Res. 4272 de 2021","Actualización"],["Responsable del SG-SST","GI","Profesional, especialista o tecnólogo/técnico en SST según tamaño y riesgo","Licencia en SST vigente; curso virtual de 50 horas y actualización de 20 horas","Según Res. 0312","Gestión","Res. 0312 de 2019","Licencia y curso"],["Interventor","IV","Ingeniero","Matrícula COPNIA","3 años en proyectos de gas","Independencia, redacción técnica","Ley 842 de 2003","Matrícula"],["Investigador / desarrollador I+D+i","ID","Profesional en ingeniería electrónica, mecatrónica, sistemas o afín","Según proyecto; RETIE cuando haya instalaciones eléctricas","1 año","Programación, prototipado","—","—"],["Auditor interno","EM","Profesional o tecnólogo","Curso de auditor interno ISO 19011 en las normas del SIG (mín. 40 h)","2 auditorías como observador","Objetividad","ISO 19011","—"],["Coordinador del SIG","GI","Profesional","Formación en ISO 9001:2026, 14001:2026, 45001, 56001 y Decreto 1072","2 años en sistemas de gestión","Gestión documental, liderazgo","—","—"],["Responsable SIG del miembro","GI","Técnico o profesional","Inducción en el SIG y en la plataforma","—","Organización","—","—"],["Conductor","Todos","—","Licencia de conducción vigente de la categoría; curso de manejo defensivo si aplica PESV","—","—","Ley 2050 de 2020","Licencia"]]}}],"d":"Matriz de perfiles y competencias: define para cada cargo la educación, la formación, las certificaciones y la experiencia mínimas (ISO 9001 num. 7.2).","i":["Ajusta los cargos a tu empresa.","Para cada cargo, define la educación mínima, la formación o certificación obligatoria (por ejemplo, competencia laboral en gas o trabajo en alturas), la experiencia y las habilidades.","Indica el requisito legal y la vigencia que se debe controlar (por ejemplo, el vencimiento del certificado de alturas).","Compara a cada persona con su perfil; las brechas se cierran con el plan de formación (TH-PL-01)."]},"TH-PL-01":{"c":"TH-PL-01","t":"Plan anual de formación y toma de conciencia","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["Tema","Dirigido a","Tipo (inducción / técnica / SST / ambiental / SIG / I+D+i)","Intensidad (h)","Facilitador","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic","Método de evaluación de eficacia","Cobertura %"],"r":12,"ini":[["Inducción al SIG, política y código de ética","Todo el personal nuevo","Inducción","4","Coordinador del SIG","P","P","P","P","P","P","P","P","P","P","P","P","Evaluación escrita ≥ 80 %",""],["Res. 90902 y NTC 2505: pruebas y defectos","Técnicos e ingenieros","Técnica","8","Director técnico","","P","","","","","","P","","","","","Evaluación práctica",""],["Preparación para certificación de competencia laboral en gas","Técnicos sin certificado","Técnica","40","SENA / OCP","","","P","","","","","","P","","","","Certificado obtenido",""],["Trabajo seguro en alturas (reentrenamiento)","Técnicos","SST","8","Centro autorizado","","","","P","","","","","","","","","Certificado",""],["Espacios confinados y monitoreo atmosférico","Técnicos MT/CN","SST","8","Líder de SST / ARL","","","","","P","","","","","","","","Práctica",""],["Respuesta a fugas de gas y uso de extintores","Todo el personal operativo","SST","4","Brigada / bomberos","","","P","","","","","","P","","","","Simulacro",""],["Manejo de residuos de obra, RESPEL y RAEE","Personal operativo y de I+D+i","Ambiental","2","Líder ambiental","","","","","","P","","","","","","","Inspección en obra",""],["Uso de la plataforma ENTALPIA LABS y cargue de registros","Responsables SIG de miembros","SIG","3","Líder de TI","P","","","","","","P","","","","","","Registros completos en plataforma",""],["Auditor interno ISO 19011 en normas del SIG","Auditores","SIG","40","Externo","","","","P","","","","","","","","","Certificado + auditoría acompañada",""],["Gestión de la innovación ISO 56001 y propiedad intelectual","Equipo I+D+i","I+D+i","8","Líder de I+D+i","","","","","","","","P","","","","","Proyecto formulado",""],["Seguridad vial y manejo defensivo","Conductores","SST","4","ARL","","","","","","","P","","","","","","Evaluación",""],["Reinducción anual","Todo el personal","Inducción","2","Talento humano","","","","","","","","","","","P","","Evaluación",""]]}}],"d":"Plan anual de formación y toma de conciencia: programa las capacitaciones del año según las brechas de competencia y los requisitos legales.","i":["Incluye los temas que salen de la matriz de perfiles (TH-MZ-01), de la matriz de peligros y de los requisitos legales.","Indica a quién va dirigido cada tema, el tipo, la intensidad en horas y el facilitador.","En los meses, marca P (programado) y E (ejecutado).","Define cómo evaluarás la eficacia (TH-FO-03) y registra la cobertura alcanzada en %."]},"MI-PG-01":{"c":"MI-PG-01","t":"Programa de calibración, verificación y mantenimiento de equipos","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["Código","Equipo","Serie","Miembro","Rango","Uso","Frecuencia de calibración","Última calibración","Próxima calibración","Laboratorio","Verificación intermedia (frecuencia)","Estado (apto / vencido / fuera de servicio)","Observaciones"],"r":7,"ini":[["MI-MAN-001","Manómetro analógico","","","0–100 kPa (para pruebas a 34,5 kPa en 25–75 % del rango)","Prueba de hermeticidad baja presión","12 meses","","","Acreditado ONAC","Comparación con patrón cada 3 meses","","Grado D ASME B40.100 o clase NTC 2263"],["MI-MAN-002","Manómetro analógico","","","0–600 kPa","Prueba de hermeticidad media presión (207/414 kPa)","12 meses","","","Acreditado ONAC","Cada 3 meses","",""],["MI-DET-001","Detector de gas combustible","","","0–100 % LEL","Detección de fugas y atmósferas","6 meses","","","Acreditado o servicio del fabricante","Bump test diario","",""],["MI-MGA-001","Monitor multigás (O2, LEL, CO, H2S)","","","Según sensor","Espacios confinados","6 meses","","","Servicio autorizado","Bump test diario","",""],["MI-ACO-001","Analizador de CO / combustión","","","0–2000 ppm","Puesta en servicio y mantenimiento","12 meses","","","Acreditado ONAC","Verificación con gas patrón cada 6 meses","",""],["MI-REG-001","Registrador digital de presión","","","Según modelo","Pruebas con registro continuo","12 meses","","","Acreditado ONAC","Cada 6 meses","",""],["MI-MUL-001","Multímetro","","","Según modelo","Laboratorio I+D+i y eléctrico","12 meses","","","Acreditado ONAC","—","",""]]}}],"d":"Programa de calibración, verificación y mantenimiento de los equipos de medición: asegura que ningún equipo se use con la calibración vencida.","i":["Lista todos los equipos de medición de la empresa, cada uno con su hoja de vida (MI-FO-01).","Registra el rango, el uso, la frecuencia de calibración, la última y la próxima calibración y el laboratorio.","Define las verificaciones intermedias, por ejemplo la prueba funcional diaria del detector de gas.","Mantén actualizado el Estado. Un equipo vencido o fuera de servicio no se usa."]},"EM-PG-01":{"c":"EM-PG-01","t":"Programa anual de auditorías internas","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["Auditoría N.º","Sitio (función central / miembro)","Procesos","Normas / criterios","Tipo (admisión / interna / seguimiento / extraordinaria)","Auditor líder","Auditor(es)","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic","Estado","Observaciones"],"r":6,"ini":[["AI-2027-01","Función central","DE, GI, TI, EM, CP, TH","ISO 9001:2026, ISO 14001:2026, ISO 45001, ISO 56001, Decreto 1072, IAF MD 1","Interna","","","","","P","","","","","","","","","","Programada","Primera auditoría completa"],["AI-2027-02","Miembro 1","CO, DI, CN, MT, MI, TH","ISO 9001, 14001, 45001; Res. 90902","Interna","","","","","","P","","","","","","","","","Programada","Incluir visita a frente de obra activo"],["AI-2027-03","Miembro 2","CO, IV, TH","ISO 9001; DE-PO-02 (independencia)","Interna","","","","","","","P","","","","","","","","Programada",""],["AI-2027-04","Miembro 3","ID, TI, CP","ISO 56001, ISO 9001","Interna","","","","","","","","P","","","","","","","Programada",""],["AI-2027-05","Todos los sitios","SG-SST","Decreto 1072, Res. 0312 (participación del COPASST)","Interna","","","","","","","","","","","P","","","","Programada","Requisito anual del SG-SST"],["Criterio","Cada sitio se audita al menos una vez al año antes de la auditoría externa (IAF MD 1). Los procesos con desempeño deficiente o cambios se auditan con mayor frecuencia. El auditor no audita su propio trabajo.","","","","","","","","","","","","","","","","","","",""]]}}],"d":"Programa anual de auditorías internas: planifica qué sitios, procesos y normas se auditan en el año, con quién y cuándo (ISO 9001 num. 9.2).","i":["Incluye todos los procesos y sitios al menos una vez al año, y con mayor frecuencia los de más riesgo o con hallazgos previos.","Define el tipo de auditoría, los criterios, el auditor líder y los auditores. Nadie audita su propio trabajo.","Marca en los meses cuándo se hará cada auditoría.","Actualiza el Estado (programada, ejecutada o reprogramada) y las observaciones."]},"EM-MZ-01":{"c":"EM-MZ-01","t":"Matriz de indicadores de gestión","v":"01","f":"2026-10-10","firmas":false,"tab":1,"s":[{"t":"Matriz","n":"Ajusta las filas de ejemplo a tu empresa: edítalas, quita las que no apliquen y agrega las tuyas.","g":{"h":["Proceso","Indicador","Tipo (estructura / proceso / resultado)","Fórmula","Meta","Frecuencia","Fuente de datos","Responsable","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic","Análisis"],"r":24,"ini":[["CO","Satisfacción del cliente","Resultado","Promedio encuestas × 20","≥ 85 %","Semestral","CO-FO-02","Líder comercial","","","","","","","","","","","","",""],["CO","Oportunidad de respuesta a PQRS","Proceso","PQRS respondidas en ≤ 15 días hábiles / total × 100","100 %","Trimestral","Registro de PQRS","Líder comercial","","","","","","","","","","","","",""],["DI","Diseños verificados sin observaciones mayores","Proceso","Diseños conformes en primera verificación / verificados × 100","≥ 90 %","Trimestral","DI-FO-03","Director técnico","","","","","","","","","","","","",""],["CN","Aprobación en primera inspección","Resultado","Aprobadas sin defectos / inspeccionadas × 100","≥ 95 %","Mensual","Certificados de inspección","Director técnico","","","","","","","","","","","","",""],["CN","Defectos críticos detectados por terceros","Resultado","N.º","0","Mensual","Certificados de inspección","Director técnico","","","","","","","","","","","","",""],["MT","Atención de emergencias de fuga a tiempo","Proceso","Atendidas en ≤ 2 h / total × 100","≥ 95 %","Mensual","MT-FO-01","Líder de mantenimiento","","","","","","","","","","","","",""],["IV","Hallazgos de interventoría cerrados a tiempo","Proceso","Cerrados en plazo / total × 100","≥ 90 %","Mensual","IV-FO-01","Director de interventoría","","","","","","","","","","","","",""],["ID","Proyectos que superan compuerta","Resultado","Proyectos que avanzan / proyectos evaluados × 100","Seguimiento","Semestral","Actas de compuerta","Líder de I+D+i","","","","","","","","","","","","",""],["GI-SST","Frecuencia de accidentalidad","Resultado","N.º AT mes / N.º trabajadores mes × 100","Reducir 20 %","Mensual","FURAT","Líder de SST","","","","","","","","","","","","",""],["GI-SST","Severidad de accidentalidad","Resultado","Días de incapacidad por AT + días cargados mes / N.º trabajadores mes × 100","Seguimiento","Mensual","Incapacidades","Líder de SST","","","","","","","","","","","","",""],["GI-SST","Proporción de AT mortales","Resultado","AT mortales año / AT año × 100","0","Anual","FURAT","Líder de SST","","","","","","","","","","","","",""],["GI-SST","Prevalencia e incidencia de enfermedad laboral","Resultado","Según Res. 0312 de 2019","Seguimiento","Anual","EPS/ARL","Líder de SST","","","","","","","","","","","","",""],["GI-SST","Ausentismo por causa médica","Resultado","Días de ausencia por incapacidad / días programados × 100","Seguimiento","Mensual","Nómina","Líder de SST","","","","","","","","","","","","",""],["GI-SST","Cumplimiento del plan anual SST","Proceso","Ejecutadas / programadas × 100","≥ 90 %","Trimestral","GI-PL-02","Líder de SST","","","","","","","","","","","","",""],["GI-AMB","Residuos dispuestos con gestor autorizado","Resultado","kg con certificado / kg generados × 100","100 %","Trimestral","Certificados","Líder ambiental","","","","","","","","","","","","",""],["TH","Personal de gas con certificado vigente","Estructura","Vigentes / técnicos activos × 100","100 %","Mensual","Plataforma","Talento humano","","","","","","","","","","","","",""],["TH","Cumplimiento del plan de formación","Proceso","Ejecutadas / programadas × 100","≥ 90 %","Trimestral","TH-PL-01","Talento humano","","","","","","","","","","","","",""],["MI","Equipos con calibración vigente","Estructura","Vigentes / activos × 100","100 %","Mensual","MI-PG-01","Líder de metrología","","","","","","","","","","","","",""],["CP","Proveedores críticos aprobados","Resultado","Críticos con puntaje ≥ 70 / críticos × 100","≥ 90 %","Semestral","CP-FO-01","Compras","","","","","","","","","","","","",""],["TI","Disponibilidad de la plataforma","Resultado","Horas disponibles / horas del periodo × 100","≥ 99 %","Mensual","Monitoreo","Líder de TI","","","","","","","","","","","","",""],["EM","Eficacia de acciones correctivas","Resultado","Eficaces / verificadas × 100","≥ 90 %","Trimestral","EM-FO-07","Coordinador del SIG","","","","","","","","","","","","",""],["EM","Cumplimiento del programa de auditorías","Proceso","Ejecutadas / programadas × 100","100 %","Anual","EM-PG-01","Coordinador del SIG","","","","","","","","","","","","",""],["GI","Miembros adscritos sin NC mayores abiertas","Resultado","Miembros sin NC mayor / adscritos × 100","100 %","Trimestral","Plataforma","Coordinador del SIG","","","","","","","","","","","","",""],["FI","Ejecución del presupuesto del SIG","Proceso","Ejecutado / presupuestado × 100","90–105 %","Trimestral","Contabilidad","Gerente","","","","","","","","","","","","",""]]}}],"d":"Matriz de indicadores de gestión: define cómo se mide el desempeño de cada proceso y registra sus resultados mes a mes (ISO 9001 num. 9.1).","i":["Revisa los indicadores de ejemplo y ajusta las metas a tu empresa.","Para cada indicador, confirma la fórmula, la meta, la frecuencia, la fuente de datos y el responsable.","Registra el resultado de cada mes.","En Análisis, explica las tendencias y abre acciones (EM-FO-04) si no se alcanza la meta."]}};
