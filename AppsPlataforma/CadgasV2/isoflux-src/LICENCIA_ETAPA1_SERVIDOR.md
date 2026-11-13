# Isoflux · Licencia infalsificable (Etapa 1) — Guía de despliegue del servidor

**Qué logra:** hoy la "activación" es un valor en el navegador que cualquiera puede escribir a mano
(falsificable). Con esta etapa, la activación es un **token firmado por el servidor** con una clave
privada RSA que **solo tú tienes**. El equipo del usuario trae embebida únicamente la **clave pública**,
que sirve para *verificar* pero **no para firmar**. Sin la clave privada, nadie puede fabricar una licencia
válida, aunque descargue y edite el HTML.

El cliente ya está listo (V33.34). **Mientras no pegues la clave pública, todo funciona igual que hoy**
(modo compatible, cero riesgo de dejar fuera a un usuario). El modo firmado se "enciende" solo cuando
completas los 3 pasos de abajo.

---

## Paso 1 · Generar el par de llaves (una sola vez)

En cualquier equipo con `openssl` (o en https://www.cryptool.org si no tienes openssl):

```bash
# Clave privada (SECRETA — va solo en el servidor, nunca en el HTML)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out isoflux_priv.pem

# Clave pública en base64 SPKI/DER (esto es lo que se embebe en el HTML)
openssl rsa -in isoflux_priv.pem -pubout -outform DER | base64 -w0 > isoflux_pub_spki.txt
```

- `isoflux_priv.pem` → **guárdala como secreto**. No la subas al repo ni la pegues en el HTML.
- `isoflux_pub_spki.txt` → una sola línea en base64. Es pública, no es sensible.

---

## Paso 2 · Servidor (Apps Script del portal)

1. Abre el proyecto de Apps Script del portal (el mismo que resuelve `sgcPlanoProyectos`).
2. En **Configuración del proyecto → Propiedades del script**, crea una propiedad:
   - Nombre: `ISOFLUX_PRIV`
   - Valor: pega **el contenido completo de `isoflux_priv.pem`** (incluye las líneas
     `-----BEGIN PRIVATE KEY-----` … `-----END PRIVATE KEY-----`).
3. Pega estas dos funciones en el código del proyecto:

```javascript
function b64urlIso_(bytes){
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');
}

// Devuelve { token } firmado para la sesión autenticada `ses` ({email, rol}).
function sgcLicenciaToken_(ses){
  if(!ses || !ses.email) throw { auth:true, msg:'sin sesión' };
  var exp = Math.floor(Date.now()/1000) + 7*24*3600;        // vence en 7 días; se renueva al abrir en línea
  var payload = { email: ses.email, rol: ses.rol || '', exp: exp };
  var payloadB64 = b64urlIso_(Utilities.newBlob(JSON.stringify(payload)).getBytes());
  var priv = PropertiesService.getScriptProperties().getProperty('ISOFLUX_PRIV');
  var sig  = Utilities.computeRsaSha256Signature(payloadB64, priv);   // firma RSA-SHA256 (PKCS#1 v1.5)
  return { token: payloadB64 + '.' + b64urlIso_(sig) };
}
```

4. **Conéctala a tu router**, junto al caso que ya maneja `sgcPlanoProyectos`. Usa EXACTAMENTE la misma
   forma en que hoy resuelves y validas la sesión del usuario. Por ejemplo, si tu router tiene algo como:

```javascript
   // ... dentro de doPost / dispatcher, donde `ses` es la sesión ya validada ...
   if (a === 'sgcPlanoProyectos') { return _json(sgcPlanoProyectos_(ses)); }
   if (a === 'sgcLicenciaToken')  { return _json(sgcLicenciaToken_(ses)); }   // ← AGREGAR
```

   La regla clave: `sgcLicenciaToken` debe exigir sesión válida igual que `sgcPlanoProyectos`
   (si la cuenta no está autorizada, que lance `{auth:true}` como el resto de acciones protegidas).

5. **Vuelve a desplegar** la implementación (Implementar → Administrar implementaciones → Editar → Nueva versión).

---

## Paso 3 · Cliente (encender el modo firmado)

1. En `isoflux-src/iso_base.html`, busca:

```javascript
const PUBKEY_SPKI='';/* ↞ pegar aquí la clave pública RSA del portal (base64 SPKI DER) ... */
```

2. Pega entre las comillas la línea de `isoflux_pub_spki.txt`:

```javascript
const PUBKEY_SPKI='MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...==';
```

3. Reconstruye y publica:

```bash
cd isoflux-src && python3 build.py
```

Listo: desde ese momento la activación exige un token firmado por tu servidor.

---

## Cómo se comporta (resumen)

| Situación | Antes (hoy) | Con modo firmado activo |
|---|---|---|
| Usuario autorizado, en línea (portal/GitHub Pages) | ✅ activa | ✅ activa (recibe token firmado, válido 7 días sin conexión) |
| Usuario autorizado, sin conexión, dentro de la gracia | ✅ | ✅ (token aún vigente) |
| Copia descargada y abierta como archivo (`file://`) | ⚠️ funcionaba | 🔒 **no valida** (no hay servidor ni contexto seguro) |
| Alguien edita el `localStorage` para fingir licencia | ⚠️ **funcionaba** | 🔒 **rechazado** (no tiene firma válida) |
| Clave pública aún no pegada (modo compatible) | — | ✅ idéntico a hoy, sin cambios |

**Importante:** no enciendas el modo firmado (Paso 3) hasta que el servidor ya devuelva el token
(Paso 2 desplegado). Si lo enciendes antes, los usuarios en línea seguirán entrando (hay respaldo al
chequeo clásico mientras el endpoint no exista), pero la activación no persistirá sin conexión hasta que
el endpoint esté arriba. El orden recomendado es: **Paso 1 → Paso 2 (desplegar) → verificar → Paso 3**.

## Verificar que quedó bien (opcional)
Con sesión iniciada en el portal, abre la consola del navegador (F12) y ejecuta:
```javascript
await V19sgc.api({a:'sgcLicenciaToken'})
```
Debe devolver `{token:"xxxx.yyyy"}`. Si devuelve error de autorización, revisa el wiring del router.
