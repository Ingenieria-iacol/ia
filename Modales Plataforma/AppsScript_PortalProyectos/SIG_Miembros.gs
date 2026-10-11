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
  Registros: ['registroId', 'miembroId', 'codigo', 'titulo', 'origen', 'fileId', 'creadoPor', 'fecha', 'estado', 'pdfId', 'sha256', 'cerradoPor', 'fechaCierre'],
  Auditorias: ['token', 'email', 'miembroId', 'expira', 'creadoPor', 'fecha', 'estado', 'motivo'],
  Solicitudes: ['token', 'miembroId', 'codigo', 'email', 'proyecto', 'mensaje', 'expira', 'creadoPor', 'fecha', 'estado', 'registroId', 'fechaRespuesta'],
  DocsMarca: ['miembroId', 'docId', 'clave', 'pdfId', 'fecha'],
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
      case 'sgcDiligenciar':     return sigDiligenciar(u, b.id);
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
function sigDiligenciar(u, id) {
  const n = sigNivel_(u);
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
  sigAgregar_('Registros', { registroId: rid, miembroId: n.m.miembroId, codigo: d.codigo, titulo: d.nombre, origen: 'plantilla', fileId: copia.getId(), creadoPor: u.email, fecha: sigAhora_(), estado: 'abierto' });
  sigBitacora_(u.email, n.m.miembroId, 'registro_creado', { registroId: rid, codigo: d.codigo });
  return { registroId: rid, url: copia.getUrl(), sinAcceso: sinAcceso };
}
function sigRegistrosDe_(miembroId) {
  return sigLeer_('Registros').filter(r => miembroId === '*' || r.miembroId === miembroId).reverse().map(r => ({
    registroId: r.registroId, miembroId: r.miembroId, codigo: r.codigo, titulo: r.titulo, origen: r.origen, creadoPor: r.creadoPor,
    fecha: r.fecha instanceof Date ? r.fecha.toISOString() : r.fecha, estado: r.estado, sha256: r.sha256, cerradoPor: r.cerradoPor,
    fechaCierre: r.fechaCierre instanceof Date ? r.fechaCierre.toISOString() : r.fechaCierre, fileId: r.fileId,
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
  const codigo = String(b.codigo || '').toUpperCase().slice(0, 12), nombre = String(b.nombre || 'registro').slice(0, 120);
  const sha = sigShaBytes_(bytes), rid = 'REG-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  const f = sigCarpetaRegistros_(n.m).createFile(Utilities.newBlob(bytes, String(b.mime || 'application/octet-stream'), n.m.miembroId + ' · ' + (codigo ? codigo + ' · ' : '') + nombre));
  f.setDescription('Evidencia ' + rid + ' · SHA-256 ' + sha + ' · cargada por ' + u.email);
  sigAgregar_('Registros', { registroId: rid, miembroId: n.m.miembroId, codigo: codigo, titulo: nombre, origen: 'cargado', fileId: f.getId(), creadoPor: u.email, fecha: sigAhora_(), estado: 'cerrado', pdfId: f.getId(), sha256: sha, cerradoPor: u.email, fechaCierre: sigAhora_() });
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
  const proyecto = String(b.proyecto || '').slice(0, 120), msg = String(b.mensaje || '').slice(0, 500), m = n.m, nom = m.nombreComercial || m.razonSocial;
  let logo = null; if (m.logoFileId && b.enviar !== false) { try { logo = DriveApp.getFileById(m.logoFileId).getBlob().setName('logo'); } catch (e) {} }
  const out = [];
  correos.forEach(em => {
    const tk = 'F' + Utilities.getUuid().replace(/-/g, '');
    sigAgregar_('Solicitudes', { token: tk, miembroId: m.miembroId, codigo: F.c, email: em, proyecto: proyecto, mensaje: msg, expira: ex, creadoPor: u.email, fecha: sigAhora_(), estado: 'pendiente' });
    const link = b.base + '?f=' + tk; out.push({ email: em, link: link });
    if (b.enviar === false) return;
    const html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #dde3ee;border-radius:10px;overflow:hidden">' +
      '<div style="background:#0a1a3d;color:#fff;padding:18px;text-align:center">' + (logo ? '<img src="cid:logo" style="max-height:60px;max-width:200px;background:#fff;border-radius:6px;padding:4px"><br>' : '') +
      '<b style="font-size:18px">' + sigEsc_(nom) + '</b><br><span style="font-size:12px;color:#9fb3d9">' + sigEsc_(m.miembroId) + ' · Sistema Integrado de Gestión</span></div>' +
      '<div style="padding:20px;color:#1f2937"><p>Hola,</p><p><b>' + sigEsc_(nom) + '</b> te solicita diligenciar en línea el formato:</p>' +
      '<p style="font-size:17px;background:#eef4ff;border-radius:8px;padding:12px"><b>' + sigEsc_(F.c) + '</b> · ' + sigEsc_(F.t) + (proyecto ? '<br><span style="font-size:13px">Proyecto: ' + sigEsc_(proyecto) + '</span>' : '') + '</p>' +
      (msg ? '<p style="border-left:3px solid #3d8bff;padding-left:10px;color:#374151">' + sigEsc_(msg) + '</p>' : '') +
      '<p style="text-align:center;margin:26px 0"><a href="' + link + '" style="background:#1d5fd8;color:#fff;text-decoration:none;padding:14px 26px;border-radius:8px;font-weight:bold;font-size:16px">Diligenciar en línea</a></p>' +
      '<p style="font-size:12px;color:#6b7280">Se abre en el navegador de tu celular o computador; no necesitas cuenta. El enlace es personal, sirve una sola vez y vence el ' + Utilities.formatDate(new Date(ex), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') + '.</p></div>' +
      '<div style="background:#f3f5f9;color:#6b7280;font-size:11px;padding:10px;text-align:center">SIG administrado por ' + sigEsc_(SIG.TITULAR) + ' · ' + sigEsc_(SIG.RED) + '</div></div>';
    try { MailApp.sendEmail({ to: em, subject: F.c + ' · ' + F.t + ' — ' + nom, htmlBody: html, name: nom, noReply: true, inlineImages: logo ? { logo: logo } : {} }); } catch (e) { out[out.length - 1].error = 'No se pudo enviar el correo'; }
  });
  sigBitacora_(u.email, m.miembroId, 'formulario_enviado', { codigo: F.c, destinatarios: correos, proyecto: proyecto });
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
      const html = sigFormHtml_(F, m, sigLogoDataUrl_(m), datos, { rid: rid, fecha: ahora, email: s.email, proyecto: s.proyecto, sha: shaDatos });
      const nom = m.miembroId + ' · ' + F.c + ' · ' + rid;
      const pdf = Utilities.newBlob(html, 'text/html', nom + '.html').getAs('application/pdf').setName(nom + '.pdf');
      const carpeta = sigCarpetaRegistros_(m), pf = carpeta.createFile(pdf), sha = sigShaBytes_(pdf.getBytes());
      const jf = carpeta.createFile(Utilities.newBlob(txt, 'application/json', nom + '.json'));
      pf.setDescription('Formulario en línea ' + rid + ' · SHA-256 PDF ' + sha + ' · datos ' + shaDatos + ' · ' + s.email);
      sigAgregar_('Registros', { registroId: rid, miembroId: m.miembroId, codigo: F.c, titulo: F.c + ' ' + F.t + (s.proyecto ? ' · ' + s.proyecto : ''), origen: 'formulario', fileId: jf.getId(), creadoPor: s.email, fecha: ahora, estado: 'cerrado', pdfId: pf.getId(), sha256: sha, cerradoPor: s.email, fechaCierre: ahora });
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
    if (b.g) { const filas = Array.isArray(d['s' + i + '.g']) ? d['s' + i + '.g'] : [];
      o += '<table style="width:100%;border-collapse:collapse"><tr>' + b.g.h.map(h => '<td style="' + th + '">' + e(h) + '</td>').join('') + '</tr>';
      (filas.length ? filas : [[]]).forEach(f => { o += '<tr>' + b.g.h.map((h, c) => '<td style="' + td + '">' + val((f || [])[c]) + '&nbsp;</td>').join('') + '</tr>'; }); o += '</table>'; }
  });
  o += '<h4 style="color:#12408f;margin:14px 0 4px">Diligenciado por</h4><table style="width:100%;border-collapse:collapse"><tr><td style="' + th + ';width:22%">Nombre</td><td style="' + td + '">' + e(d._nombre) + '</td><td style="' + th + ';width:18%">Documento</td><td style="' + td + '">' + e(d._doc) + '</td></tr>' +
    '<tr><td style="' + th + '">Correo</td><td style="' + td + '">' + e(meta.email) + '</td><td style="' + th + '">Ubicación GPS</td><td style="' + td + '">' + e(d._gps || 'No registrada') + '</td></tr>' +
    '<tr><td style="' + th + '">Firma</td><td style="' + td + '" colspan="3">' + val(d._firma) + '</td></tr></table>';
  const fotos = (Array.isArray(d._fotos) ? d._fotos : []).filter(sigImg_).slice(0, 4);
  if (fotos.length) o += '<h4 style="color:#12408f;margin:14px 0 4px">Registro fotográfico</h4>' + fotos.map(f => '<img src="' + f + '" style="width:48%;margin:0 1% 8px 0">').join('');
  o += '<p style="font-size:7.5pt;color:#555;border-top:1px solid #c9d2e3;margin-top:14px;padding-top:6px">Registro generado en línea en la plataforma ENTALPIA LABS · SIG administrado por ' + e(SIG.TITULAR) + '. Huella SHA-256 de los datos: ' + e(meta.sha) + '. Documento cerrado: no admite modificaciones.</p></body></html>';
  return o;
}

// ---------- DEFINICIONES DE LOS FORMULARIOS EN LÍNEA (31 formatos del SIG; generado desde formularios.json) ----------
const SIG_FORMS_LOCAL = {"CN-FO-04":{"c":"CN-FO-04","t":"Acta de prueba de hermeticidad","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Identificación","p":["Miembro (razón social)","NIT","Proyecto (código)","Cliente","Dirección / ubicación","Distribuidor","Uso (residencial / comercial / red PE)","Tipo de gas (GN / GLP)","Fecha","Tramo o sección probada"]},{"t":"2. Condiciones de la prueba","n":"Valores según CN-IN-01, tabla A. Medio de prueba: aire o gas inerte. Prohibidos oxígeno, agua y gas combustible.","p":["Presión de operación","Presión de ensayo exigida","Medio de prueba","Tiempo mínimo exigido","Sellante anaeróbico usado (sí/no)","Tiempo de curado cumplido (sí/no)","Medidores, reguladores y artefactos desconectados (sí/no)","Temperatura ambiente"]},{"t":"3. Instrumento de medición","p":["Código del manómetro","Rango","Clase / grado de precisión","Calibración vigente hasta","Presión de ensayo como % del rango (25 % a 75 %)","Laboratorio de calibración"]},{"t":"4. Lecturas","g":{"h":["Intento","Hora inicial","Lectura inicial","Hora final","Lectura final","Variación","Resultado"],"r":3,"pre":["1","2","3"]}},{"t":"5. Fugas encontradas y correcciones","g":{"h":["Ubicación de la fuga","Método de detección","Corrección realizada","Repetición de prueba (intento N.º)"],"r":3}},{"t":"6. Verificaciones","k":["Todas las salidas taponadas con tapón metálico y sellante especificado","Válvulas maniobradas durante la prueba y herméticas","Sin fuentes de ignición en el área durante la prueba","Cero variación de lectura en el último intento","Instalación despresurizada y taponada al terminar"]},{"t":"7. Resultado y firmas","x":"Resultado final:   ☐ CONFORME   ☐ NO CONFORME (no se libera)","g":{"h":["Rol","Nombre","Certificado de competencia / matrícula","Inscripción SIC","Firma"],"r":3,"pre":["Ejecutor","Testigo","Libera (director técnico)"]}}]},"GI-FO-01":{"c":"GI-FO-01","t":"Solicitud de creación, modificación o anulación de documentos","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos de la solicitud","p":["Fecha","N.º de solicitud","Solicitante","Cargo / miembro","Proceso","Tipo de solicitud (crear / modificar / anular)"]},{"t":"2. Documento","p":["Código (si existe)","Título","Versión actual","Tipo de documento"]},{"t":"3. Descripción y justificación del cambio","x":"Describa el cambio propuesto (adjunte borrador con control de cambios) y la razón: cambio normativo, hallazgo de auditoría, mejora, cambio de proceso, solicitud de cliente."},{"t":"4. Análisis de impacto","k":["¿Afecta otros documentos del SIG?","¿Requiere formación del personal?","¿Afecta requisitos legales o del cliente?","¿Afecta peligros, riesgos o aspectos ambientales?","¿Afecta la configuración de la plataforma?"]},{"t":"5. Decisión","p":["Revisó (líder de proceso)","Fecha","Aprobó (gerente)","Fecha","Decisión (aprobada / rechazada)","Nueva versión"]}]},"GI-FO-05":{"c":"GI-FO-05","t":"Solicitud y evaluación de cambios","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Identificación del cambio","p":["Fecha","N.º de cambio","Solicitante","Proceso / miembro","Tipo (organizacional, legal, tecnológico, de proceso, de personal, de proveedor, de diseño)","Fecha prevista de implementación"]},{"t":"2. Descripción, propósito y consecuencias potenciales","x":"Qué cambia, por qué y qué podría salir mal (ISO 9001:2026 num. 6.3)."},{"t":"3. Evaluación de riesgos del cambio","g":{"h":["Peligro / riesgo / aspecto","Calidad","SST","Ambiente","Control propuesto","Responsable"],"r":5}},{"t":"4. Recursos, responsabilidades y comunicación","k":["Recursos disponibles","Responsables asignados","Documentos a actualizar identificados","Formación necesaria identificada","Partes interesadas informadas","Consulta con trabajadores realizada (ISO 45001 num. 5.4)"]},{"t":"5. Aprobación y verificación posterior","p":["Aprobó","Fecha","Verificación de eficacia (fecha)","Resultado"]}]},"GI-FO-09":{"c":"GI-FO-09","t":"Lista de verificación de admisión de miembros","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos del solicitante","p":["Razón social o nombre","NIT / documento","Representante legal","Cuenta oficial en el portal","Servicios solicitados en el alcance","Sedes / sitios","N.º de trabajadores","Fecha de solicitud"]},{"t":"2. Requisitos legales y contractuales","k":["Existencia y representación legal vigente (≤ 30 días) o RUT para persona natural","Convenio de adhesión firmado (CE-CO-01)","Afiliación a seguridad social y ARL de todos los trabajadores","Autoevaluación de estándares mínimos SG-SST (Res. 0312) con plan de mejora","Póliza de responsabilidad civil extracontractual vigente (si aplica)","Adopción por escrito de la política DE-PO-01 y del código DE-PO-02","Autorización de tratamiento de datos personales"]},{"t":"3. Competencia técnica","k":["Técnicos de gas con certificado de competencia laboral vigente (Res. 90902 num. 6.1)","Ingenieros con matrícula profesional COPNIA vigente","Certificados de trabajo en alturas vigentes (si aplica)","Responsable del SG-SST con licencia y curso de 50 horas","Responsable SIG del miembro designado y formado en el SIG"]},{"t":"4. Infraestructura y equipos","k":["Inventario de equipos de medición cargado en la plataforma","Certificados de calibración vigentes de manómetros y detectores","Herramientas y EPP adecuados al alcance"]},{"t":"5. Implementación del SIG","k":["Uso de documentos vigentes demostrado","Al menos un servicio piloto ejecutado con registros completos POSTERIOR a la fecha de solicitud (sin retroactividad)","Auditoría interna de admisión sin no conformidades mayores abiertas"]},{"t":"6. Decisión","p":["Resultado (aprobado: pasa a Adscrito / no aprobado: vuelve a Implementación con plan de acción)","Fecha de ingreso al SIG","Alcance aprobado","Firma Coordinador del SIG","Firma Gerente","Observaciones"]}]},"GI-FO-12":{"c":"GI-FO-12","t":"Inspección planeada y recorrido gerencial HSEQ","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Miembro","Proyecto / sede","Inspector(es)","Participación COPASST/vigía (sí/no)","Tipo (recorrido gerencial / inspección planeada)"]},{"t":"2. Verificaciones","k":["Documentos vigentes disponibles en sitio (plano aprobado, plan de calidad)","Personal con certificados de competencia y alturas vigentes","Permisos de trabajo diligenciados antes de iniciar","Equipos de medición con etiqueta de calibración vigente","EPP completo y en buen estado","Detector de gas con prueba funcional del día","Extintor y botiquín disponibles","Señalización y aislamiento del área","Orden y aseo; separación de residuos","Zanjas con entibado/talud y señalización nocturna","Registros diligenciados en tiempo real","Trabajadores conocen la política y cómo detener un trabajo inseguro"]},{"t":"3. Hallazgos y acciones","g":{"h":["Hallazgo","Tipo (acto / condición / documental)","Acción inmediata","Responsable","Fecha de cierre"],"r":5}}]},"GI-FO-20":{"c":"GI-FO-20","t":"Permiso de trabajo en alturas","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos del trabajo","n":"Obligatorio para trabajos a 2,0 m o más sobre un nivel inferior (Res. 4272 de 2021). Vigencia máxima: la jornada. Se revalida si cambian las condiciones.","p":["Fecha","Hora de inicio / fin","Proyecto / dirección","Altura aproximada (m)","Descripción de la tarea","Emisor del permiso (coordinador de alturas)"]},{"t":"2. Trabajadores autorizados","g":{"h":["Nombre","Documento","Certificado de alturas (nivel y vigencia)","Aptitud médica vigente","Firma"],"r":4}},{"t":"3. Verificación previa","k":["Análisis de riesgos de la tarea realizado y socializado","Medidas de prevención: barandas, delimitación, señalización","Sistema de protección: arnés cuerpo entero, eslinga con absorbedor, conectores, anclajes certificados (≥ 5000 lb por persona)","Inspección preuso de equipos realizada y sin defectos","Andamios/escaleras inspeccionados y certificados","Plan de rescate específico disponible y rescatista designado","Condiciones climáticas adecuadas (sin lluvia ni viento fuerte)","Líneas eléctricas a distancia de seguridad (RETIE)","Ayudante de seguridad designado"]},{"t":"4. Autorización y cierre","p":["Firma del emisor","Firma del responsable de la tarea","Hora de cierre","Observaciones de cierre"]}]},"GI-FO-21":{"c":"GI-FO-21","t":"Permiso de ingreso a espacios confinados","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","n":"Res. 0491 de 2020. Ningún trabajador ingresa sin monitoreo atmosférico previo y continuo, vigía en el exterior y plan de rescate.","p":["Fecha","Hora de inicio / fin","Espacio (cámara, sótano, tanque)","Clasificación (con o sin permiso)","Tarea","Supervisor de entrada"]},{"t":"2. Monitoreo atmosférico","g":{"h":["Hora","O2 (19,5–23,5 %)","LEL (< 10 %)","CO (< 25 ppm)","H2S (< 10 ppm)","Equipo (serie y calibración)","Firma"],"r":5}},{"t":"3. Verificación previa","k":["Aislamiento de energías y fluidos (bloqueo y etiquetado)","Ventilación forzada instalada","Vigía designado y comunicado con el entrante","Equipo de rescate (trípode, malacate, arnés) en sitio","Plan de rescate y número de emergencia","Entrantes con formación en espacios confinados","Iluminación y herramientas antichispa","EPP respiratorio adecuado"]},{"t":"4. Personal y autorización","g":{"h":["Nombre","Rol (entrante / vigía / supervisor / rescatista)","Hora entrada","Hora salida","Firma"],"r":4}}]},"GI-FO-22":{"c":"GI-FO-22","t":"Permiso de trabajo en caliente","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Hora de inicio / fin","Ubicación","Tarea (soldadura, corte, esmerilado, termofusión)","Emisor","Ejecutor"]},{"t":"2. Verificación","k":["Línea de gas aislada, despresurizada y purgada o confirmada fuera de servicio","Medición de explosividad en radio de 11 m: LEL 0 % (registrar valor)","Material combustible retirado o protegido en radio de 11 m","Extintor ABC de 20 lb a menos de 5 m","Vigía contra incendio durante el trabajo y 30 minutos después","Equipos de soldadura inspeccionados (cilindros asegurados, válvulas antirretroceso)","EPP: careta, guantes, peto, ropa ignífuga"]},{"t":"3. Mediciones","g":{"h":["Hora","% LEL","Equipo","Firma"],"r":3}},{"t":"4. Cierre","p":["Hora de finalización","Hora de fin de vigilancia post-trabajo","Firma del emisor","Firma del vigía"]}]},"GI-FO-23":{"c":"GI-FO-23","t":"Registro de purga y puesta en servicio","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos de la instalación","n":"Solo se purga una instalación que superó la prueba de hermeticidad (CN-FO-04) y, cuando aplica, la inspección reglamentaria. La purga se realiza hacia el exterior, en sitio ventilado, lejos de fuentes de ignición, con la mínima emisión posible de gas.","p":["Fecha","Proyecto / dirección","Tipo de instalación (residencial / comercial / industrial)","Gas (natural / GLP)","Acta de hermeticidad N.º","Presión de suministro (kPa)","Técnico (certificado de competencia N.º)","Supervisor"]},{"t":"2. Verificación antes de la purga","k":["Válvulas de los artefactos cerradas","Área ventilada y sin fuentes de ignición","Detector de gas operativo","Extintor disponible","Usuario informado y ausente del área"]},{"t":"3. Purga","g":{"h":["Punto de purga","Método (venteo exterior / quemador)","Tiempo (s)","Verificación de gas en el punto (detector)","Firma"],"r":4}},{"t":"4. Puesta en servicio de artefactos","g":{"h":["Artefacto","Marca / tipo","Encendido correcto","Prueba de fugas con solución jabonosa / detector","CO ambiente (ppm)","Evacuación de humos conforme"],"r":5}},{"t":"5. Resultado","p":["Instalación en servicio (sí/no)","Defectos encontrados","Firma del técnico","Firma del usuario"]}]},"GI-FO-24":{"c":"GI-FO-24","t":"Permiso de excavación","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Ubicación","Longitud × ancho × profundidad (m)","Tipo de suelo","Emisor","Responsable de la excavación"]},{"t":"2. Verificación previa","k":["Planos de redes existentes (gas, energía, acueducto, telecomunicaciones) consultados con los operadores","Apiques o sondeo manual en cruces con redes existentes","Permiso de rotura de vía o espacio público (si aplica)","Señalización diurna y nocturna, cerramiento y pasos peatonales","Entibado o talud para profundidad ≥ 1,5 m","Material excavado a ≥ 0,6 m del borde","Escalera de acceso cada 7,5 m de zanja con profundidad ≥ 1,2 m","Pronóstico de lluvias revisado; drenaje previsto","Profundidad mínima de la red según NTC 3728 verificada en diseño"]},{"t":"3. Cierre","p":["Cinta de advertencia instalada sobre la tubería","Relleno y compactación conforme","Firma emisor","Fecha de cierre"]}]},"GI-FO-25":{"c":"GI-FO-25","t":"Permiso de trabajo eléctrico","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Ubicación / equipo","Tensión (V)","Tarea","Emisor","Ejecutor (matrícula / certificado)"]},{"t":"2. Cinco reglas de oro (RETIE)","k":["1. Corte visible de todas las fuentes de tensión","2. Bloqueo y etiquetado (LOTO) de los elementos de corte","3. Verificación de ausencia de tensión con detector probado","4. Puesta a tierra y en cortocircuito","5. Señalización y delimitación de la zona de trabajo"]},{"t":"3. Verificación adicional","k":["Herramientas aisladas en buen estado","EPP dieléctrico (guantes, casco clase E, calzado dieléctrico)","Trabajo con tensión solo con procedimiento específico y personal calificado","En atmósferas con posible presencia de gas: equipo apto para área clasificada"]},{"t":"4. Cierre","p":["Retiro de puestas a tierra","Reenergización autorizada por","Hora","Firma"]}]},"GI-FO-26":{"c":"GI-FO-26","t":"Inspección preoperacional de vehículos","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Placa","Tipo (automóvil / camioneta / motocicleta)","Conductor","Licencia de conducción (categoría y vigencia)","Kilometraje"]},{"t":"2. Documentos","k":["SOAT vigente","Revisión técnico-mecánica vigente","Póliza de responsabilidad civil (si aplica)","Tarjeta de propiedad"]},{"t":"3. Estado del vehículo","k":["Frenos","Luces y direccionales","Llantas (labrado ≥ 1,6 mm) y repuesto","Niveles de aceite, refrigerante y líquido de frenos","Espejos y pito","Cinturones de seguridad","Kit de carretera y extintor","Carga asegurada; cilindros de gas en posición vertical y ventilados","Para moto: casco certificado y chaleco reflectivo"]},{"t":"4. Resultado","p":["Apto para operar (sí/no)","Observaciones","Firma del conductor","Firma del supervisor"]}]},"CO-FO-02":{"c":"CO-FO-02","t":"Revisión de requisitos del servicio, conflicto de interés y satisfacción","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Cliente y servicio","p":["Fecha","N.º de proyecto","Cliente","NIT / CC","Dirección del servicio","Contacto","Servicio (diseño / construcción / mantenimiento / reparación / interventoría / I+D+i)","Tipo de usuario (residencial / comercial / industrial)","Gas (natural / GLP / otro)","Distribuidor"]},{"t":"2. Requisitos identificados","k":["Requisitos del cliente documentados (alcance, plazo, entregables)","Requisitos legales y reglamentarios identificados (Res. 90902, NTC aplicables, RETIE si aplica)","Requisitos del distribuidor (planos, solicitudes, inspección)","Requisitos implícitos (seguridad, garantía)","Requisitos de entrega y posentrega definidos","Licencias y permisos (rotura de vía, propiedad horizontal)"]},{"t":"3. Capacidad para cumplir","k":["Servicio dentro del alcance aprobado del miembro en el SIG","Personal competente y con certificados vigentes disponible","Equipos calibrados disponibles","Plazo factible","Riesgos HSEQ identificados y controlables","Diferencias entre solicitud y oferta resueltas"]},{"t":"4. Declaración de conflicto de interés (obligatoria en interventoría e I+D+i con terceros)","x":"Declaro que no tengo vínculo societario, contractual, laboral ni familiar (hasta cuarto grado de consanguinidad, segundo de afinidad o primero civil) con el ejecutor o diseñador objeto del servicio, y que el ejecutor no es otro miembro de la red. Sí ☐  No ☐ existe conflicto. Descripción: ____________. Firma: ____________"},{"t":"5. Encuesta de satisfacción (al cierre)","g":{"h":["Aspecto","1","2","3","4","5","Comentario"],"r":6,"pre":["Cumplimiento del plazo","Calidad del trabajo","Seguridad y orden en la obra","Atención y comunicación","Claridad de la documentación entregada","¿Nos recomendaría?"]}},{"t":"6. Aprobación","p":["Revisó (director técnico)","Fecha","Aprobó (representante legal)","Fecha"]}]},"DI-FO-01":{"c":"DI-FO-01","t":"Planificación y datos de entrada del diseño","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Planificación","p":["Proyecto","Cliente","Diseñador (matrícula)","Verificador (matrícula)","Fecha de revisión prevista","Fecha de verificación prevista","Entregables","Interfaces (cliente, distribuidor, interventor)"]},{"t":"2. Datos generales","p":["Tipo de usuario","Gas y poder calorífico","Presión de suministro (kPa)","Distribuidor","N.º de unidades / pisos","Norma de diseño aplicable"]},{"t":"3. Artefactos","g":{"h":["Recinto","Artefacto","Tipo (A/B/C)","Potencia (kW)","Caudal (m³/h)","Volumen del recinto (m³)","Observaciones"],"r":6}},{"t":"4. Requisitos adicionales del cliente y consecuencias potenciales de falla"}]},"DI-FO-02":{"c":"DI-FO-02","t":"Acta de revisión del diseño","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Proyecto","Etapa revisada","Fecha","Participantes"]},{"t":"2. Evaluación","k":["El diseño responde a todos los datos de entrada","Se cumplen los requisitos del distribuidor","Las rutas son constructibles y seguras","Se identificaron interferencias con otras redes","Los riesgos HSEQ de la construcción fueron considerados"]},{"t":"3. Problemas identificados y acciones","g":{"h":["Problema","Acción","Responsable","Fecha","Cerrado"],"r":4}}]},"DI-FO-03":{"c":"DI-FO-03","t":"Lista de verificación del diseño","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Proyecto","Versión de planos","Verificador","Fecha"]},{"t":"2. Verificación técnica","k":["Caudales calculados con potencias nominales y factor de simultaneidad justificado","Diámetros recalculados; caída de presión dentro del límite de la norma","Presión de prueba especificada según NTC 2505 tabla 2 / NTC 3728","Materiales y accesorios certificados y compatibles con el gas","Ventilación de recintos conforme (aberturas y volúmenes)","Evacuación de productos de combustión conforme a NTC 3833","Ubicación de medidor, regulador y válvulas de corte accesible y ventilada","Profundidades y separaciones de tubería enterrada conforme a NTC 3728","Tuberías no pasan por ductos prohibidos","Planos con firmas, matrícula, escala, convenciones e isométrico"]},{"t":"3. Resultado","p":["Conforme (sí/no)","Observaciones","Firma verificador","Fecha"]}]},"DI-FO-04":{"c":"DI-FO-04","t":"Validación del diseño","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Evidencias de validación","k":["Acta de prueba de hermeticidad conforme (CN-FO-04 N.º ___)","Certificado de inspección reglamentaria sin defectos críticos (organismo y N.º ___)","Puesta en servicio satisfactoria (GI-FO-23 N.º ___)","CO ambiente < 15 ppm en recintos con artefactos","Cliente recibe a satisfacción"]},{"t":"2. Decisión","p":["Diseño validado (sí/no)","Lecciones aprendidas","Firma director técnico","Fecha"]}]},"DI-FO-05":{"c":"DI-FO-05","t":"Control de cambios del diseño","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Cambio","p":["Proyecto","N.º de cambio","Solicitado por","Fecha","Descripción","Motivo"]},{"t":"2. Evaluación","k":["Recalculados caudales y diámetros afectados","Evaluado el efecto en partes ya construidas","Evaluado el efecto en ventilación/evacuación","Requiere nueva aprobación del distribuidor","Riesgos HSEQ del cambio evaluados"]},{"t":"3. Aprobación","p":["Aprobó","Fecha","Nueva versión de planos","Comunicado a obra (fecha)"]}]},"MT-FO-01":{"c":"MT-FO-01","t":"Orden de servicio de mantenimiento y reparación","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["N.º de orden","Fecha","Cliente / usuario","Dirección","Tipo (preventivo / correctivo / reparación / emergencia)","Técnico (certificado N.º)","Gas","Equipo de medición usado (serie)"]},{"t":"2. Diagnóstico","g":{"h":["Elemento revisado","Hallazgo","Medición (ppm CO / kPa / % LEL)","Defecto (crítico / no crítico / ninguno)"],"r":6}},{"t":"3. Trabajos ejecutados y materiales","g":{"h":["Actividad","Material / repuesto","Cantidad","Certificado"],"r":5}},{"t":"4. Verificación final","k":["Prueba de hermeticidad del tramo intervenido conforme","Sin fugas detectadas con detector o solución jabonosa","CO ambiente < 15 ppm","Artefactos funcionando correctamente","Usuario informado de uso seguro y de defectos pendientes"]},{"t":"5. Suspensión por defecto crítico (si aplica)","x":"Artefacto/instalación suspendido: ____. Motivo: ____. Notificado al usuario ☐ al distribuidor ☐. Hora: ____."},{"t":"6. Cierre","p":["Firma del técnico","Firma del usuario","Próximo mantenimiento","Observaciones"]}]},"IV-FO-01":{"c":"IV-FO-01","t":"Registro de hallazgos de interventoría","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Proyecto","Contratante","Contratista","Interventor","Fecha de visita","N.º de visita"]},{"t":"2. Hallazgos","g":{"h":["N.º","Descripción y evidencia (foto, medición, documento)","Requisito incumplido","Clasificación","Plazo de corrección","Fecha de cierre verificada"],"r":6}},{"t":"3. Puntos de espera presenciados","g":{"h":["Actividad","Resultado","Registro del contratista","Firma interventor"],"r":3}},{"t":"4. Firmas","p":["Interventor","Representante del contratista","Fecha","Observaciones"]}]},"TH-FO-02":{"c":"TH-FO-02","t":"Registro de asistencia a formación, charlas y reuniones","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Tema","Tipo (formación / charla / reunión / simulacro)","Facilitador","Duración (h)","Lugar / proyecto"]},{"t":"2. Asistentes","g":{"h":["N.º","Nombre","Documento","Cargo","Miembro / empresa","Firma"],"r":12,"pre":["1","2","3","4","5","6","7","8","9","10","11","12"]}},{"t":"3. Contenido tratado y material"}]},"TH-FO-03":{"c":"TH-FO-03","t":"Evaluación de la eficacia de la formación","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Formación evaluada","Fecha de la formación","Evaluado","Cargo","Evaluador (jefe inmediato)","Fecha de evaluación (30 a 90 días después)"]},{"t":"2. Evaluación","g":{"h":["Criterio","Deficiente (1)","Aceptable (2)","Bueno (3)","Excelente (4)","Evidencia"],"r":4,"pre":["Aplica lo aprendido en su trabajo","Reducción de errores o hallazgos relacionados","Cumple el procedimiento sin supervisión","Transmite el conocimiento a otros"]}},{"t":"3. Conclusión","p":["¿Formación eficaz? (promedio ≥ 2,5)","Acción si no es eficaz","Firma evaluador","Firma evaluado"]}]},"TH-FO-09":{"c":"TH-FO-09","t":"Registro de inducción y reinducción","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Nombre","Documento","Cargo","Miembro","Fecha de ingreso","Tipo (inducción / reinducción)"]},{"t":"2. Temas","k":["Estructura de la red, rol de la función central y del miembro","Política del SIG y objetivos","Código de ética y canal de reporte","Reglamento interno de trabajo y de higiene y seguridad","Peligros y riesgos del cargo y controles (GI-MZ-04)","Aspectos ambientales del cargo (GI-MZ-05)","Plan de emergencias y protocolo de fuga de gas","Permisos de trabajo y derecho a detener un trabajo inseguro","Reporte de incidentes y accidentes","Procedimientos del cargo y uso de la plataforma","COPASST/vigía y Comité de Convivencia","Protección de datos y confidencialidad"]},{"t":"3. Evaluación y firmas","p":["Resultado de la evaluación","Firma del trabajador","Responsable de la inducción","Fecha"]}]},"CP-FO-01":{"c":"CP-FO-01","t":"Selección y evaluación de proveedores","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos del proveedor","p":["Razón social","NIT","Producto / servicio","Crítico (sí/no)","Tipo de evaluación (selección / desempeño)","Periodo evaluado"]},{"t":"2. Requisitos habilitantes (selección)","k":["Existencia legal y RUT","Certificado de conformidad de producto vigente (materiales de gas)","Acreditación ONAC vigente con alcance aplicable (laboratorios, organismos de inspección)","Licencia ambiental/registro de gestor (residuos)","SG-SST con estándares mínimos (subcontratistas) y afiliación a seguridad social","Certificados de competencia del personal (subcontratistas de gas)"]},{"t":"3. Evaluación de desempeño","g":{"h":["Criterio","Peso","Calificación (0-100)","Ponderado"],"r":5,"pre":["Calidad / conformidad del producto","Cumplimiento de plazos","Cumplimiento HSEQ","Atención y respuesta a reclamos","Precio y condiciones"]}},{"t":"4. Resultado","p":["Puntaje total","Clasificación (aprobado ≥ 70 / condicionado 50-69 / retirado < 50)","Evaluó","Fecha"]}]},"MI-FO-01":{"c":"MI-FO-01","t":"Hoja de vida de equipo de seguimiento y medición","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Identificación","p":["Código interno","Equipo","Marca / modelo","N.º de serie","Rango y resolución","Clase de exactitud / grado (p. ej. grado D ASME B40.100)","Miembro propietario","Fecha de adquisición","Uso (prueba de hermeticidad / detección / análisis de combustión / laboratorio)","Error máximo permitido para el uso"]},{"t":"2. Calibraciones y verificaciones","g":{"h":["Fecha","Tipo (calibración / verificación intermedia)","Laboratorio (acreditación ONAC)","N.º certificado","Error / incertidumbre encontrados","¿Conforme con el EMP?","Próxima fecha"],"r":6}},{"t":"3. Mantenimientos y reparaciones","g":{"h":["Fecha","Actividad","Ejecutó","Observaciones"],"r":4}},{"t":"4. Equipo no conforme","x":"Si una calibración resulta fuera del EMP, evaluar la validez de los resultados previos (pruebas realizadas desde la última calibración conforme) según MI-PR-01 y registrar la evaluación aquí."}]},"EM-FO-01":{"c":"EM-FO-01","t":"Plan de auditoría","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Auditoría N.º","Sitio / miembro","Fechas","Auditor líder","Equipo auditor","Tipo"]},{"t":"2. Objetivo, alcance y criterios","p":["Objetivo","Alcance (procesos, sitios, proyectos)","Criterios","Documentos de referencia"]},{"t":"3. Agenda","g":{"h":["Fecha / hora","Proceso / requisito","Auditado","Auditor","Lugar (incluye frente de obra)"],"r":8}},{"t":"4. Aprobación","p":["Elaboró (auditor líder)","Aceptó (auditado)","Fecha","Observaciones"]}]},"EM-FO-02":{"c":"EM-FO-02","t":"Lista de verificación de auditoría","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Auditoría N.º","Proceso","Auditor","Fecha"]},{"t":"2. Verificación","g":{"h":["Requisito (norma y numeral / documento)","Pregunta o verificación","Evidencia revisada (registro, entrevista, observación)","Resultado (C / NC mayor / NC menor / Obs / OM)"],"r":12}}]},"EM-FO-03":{"c":"EM-FO-03","t":"Informe de auditoría","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Auditoría N.º","Sitio / miembro","Fechas","Equipo auditor","Objetivo","Alcance","Criterios","Auditados"]},{"t":"2. Resumen ejecutivo","x":"Conclusión sobre la conformidad y eficacia del SIG en el sitio, fortalezas y principales riesgos."},{"t":"3. Hallazgos","g":{"h":["N.º","Tipo (NC mayor / NC menor / observación / oportunidad de mejora)","Requisito","Descripción y evidencia","Proceso"],"r":8}},{"t":"4. Conclusión sobre el estado del miembro","k":["Mantener estado Adscrito","Adscrito con plan de acción (NC menores)","Recomendar SUSPENSIÓN (NC mayor; ver GI-PR-09)","Recomendar RETIRO"]},{"t":"5. Firmas","p":["Auditor líder","Responsable SIG del miembro","Fecha de entrega","Plazo para plan de acción (≤ 15 días hábiles)"]}]},"EM-FO-04":{"c":"EM-FO-04","t":"Reporte de no conformidad y acción correctiva","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Identificación","p":["N.º","Fecha","Fuente (auditoría, PQRS, incidente, inspección, salida no conforme, indicador, revisión por la dirección)","Proceso / miembro","Reportó","Clasificación (mayor / menor)"]},{"t":"2. Descripción de la no conformidad","x":"Requisito incumplido, evidencia objetiva y alcance (¿ocurre en otros proyectos o miembros?)."},{"t":"3. Corrección inmediata","p":["Acción","Responsable","Fecha","Verificó"]},{"t":"4. Análisis de causa raíz (5 porqués / espina de pescado)","x":"¿Por qué 1? ____ ¿Por qué 2? ____ ¿Por qué 3? ____ ¿Por qué 4? ____ ¿Por qué 5? ____ Causa raíz: ____"},{"t":"5. Plan de acción","g":{"h":["Acción","Responsable","Fecha","Recursos","Evidencia de ejecución"],"r":4}},{"t":"6. Verificación de eficacia","p":["Fecha de verificación","Criterio de eficacia","¿Eficaz? (sí/no)","Verificó","¿Requiere actualizar riesgos u oportunidades?","¿Requiere cambios al SIG?"]}]},"EM-FO-05":{"c":"EM-FO-05","t":"Acta de revisión por la dirección","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Datos","p":["Fecha","Periodo revisado","Participantes","Lugar / medio"]},{"t":"2. Entradas revisadas (ISO 9001:2026 num. 9.3.2; ISO 14001; ISO 45001; ISO 56001; Decreto 1072 art. 2.2.4.6.31)","k":["Estado de acciones de revisiones anteriores","Cambios en cuestiones externas e internas, incluido el cambio climático","Cambios en necesidades y expectativas de partes interesadas y requisitos legales","Satisfacción del cliente y PQRS","Grado de logro de objetivos (DE-MZ-02)","Desempeño de procesos y conformidad de servicios","No conformidades y acciones correctivas","Resultados de seguimiento y medición (EM-MZ-01)","Resultados de auditorías internas y externas","Desempeño de proveedores","Estado de los miembros (adscritos, suspendidos, retirados)","Desempeño de SST: accidentalidad, ausentismo, cumplimiento del plan anual, consulta y participación","Desempeño ambiental y aspectos significativos","Desempeño del portafolio de innovación","Adecuación de recursos","Eficacia de las acciones frente a riesgos y oportunidades","Oportunidades de mejora","Cultura de calidad y comportamiento ético"]},{"t":"3. Conclusiones sobre conveniencia, adecuación y eficacia del SIG"},{"t":"4. Decisiones (salidas)","g":{"h":["Decisión / acción","Tipo (mejora, cambio al SIG, recursos)","Responsable","Fecha"],"r":6}},{"t":"5. Firmas","p":["Gerente — función central","Coordinador del SIG","Fecha","Próxima revisión"]}]},"EM-FO-06":{"c":"EM-FO-06","t":"Reporte de salida no conforme","v":"01","f":"2026-10-10","firmas":false,"s":[{"t":"1. Identificación","p":["N.º de reporte","Fecha","Miembro","Proyecto / cliente","Detectado por","Etapa (diseño / obra / prueba / inspección / entrega / posentrega)"]},{"t":"2. Descripción","n":"Una instalación con defecto crítico (por ejemplo fuga o CO ≥ 50 ppm) no se entrega ni se pone en servicio. Los defectos no críticos se corrigen dentro del plazo reglamentario.","p":["Producto o servicio afectado","Requisito incumplido (norma, plano, contrato)","Evidencia (foto, medición, registro)","Clasificación (crítico / no crítico / documental)"]},{"t":"3. Tratamiento","k":["Identificada y detenida su entrega o uso","Corrección / reproceso","Reemplazo","Concesión aceptada por escrito por el cliente (nunca para defectos de seguridad)","Informado el cliente y, si aplica, el distribuidor","Verificación posterior conforme (nueva prueba o inspección)"]},{"t":"4. Decisión y cierre","p":["Decidió (director técnico)","Fecha","¿Requiere acción correctiva EM-FO-04? (sí/no)","Cerrado por / fecha"]}]}};
