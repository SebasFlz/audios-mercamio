// Utilidades de autenticación compartidas por las funciones de Netlify.
// Los usuarios y el secreto viven en variables de entorno de Netlify,
// nunca en el código del navegador.
//
// MERCAMIO_USERS  -> JSON, ejemplo:
//   [{"usuario":"admin","clave":"xxxx","rol":"admin","sede":"Administrador"},
//    {"usuario":"sede1","clave":"yyyy","rol":"sede","sede":"Mercamio Sede 1"}]
// MERCAMIO_SECRET -> texto largo aleatorio para firmar las sesiones

const crypto = require('crypto');

const DURACION_SESION_DIAS = 30;

function getSecret() {
  const s = process.env.MERCAMIO_SECRET;
  if (!s || s.length < 16) return null;
  return s;
}

function getUsuarios() {
  try {
    const lista = JSON.parse(process.env.MERCAMIO_USERS || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    return [];
  }
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function firmar(datos) {
  const secret = getSecret();
  const cuerpo = b64url(JSON.stringify(datos));
  const firma = b64url(crypto.createHmac('sha256', secret).update(cuerpo).digest());
  return `${cuerpo}.${firma}`;
}

function iguales(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function crearToken(u) {
  const exp = Date.now() + DURACION_SESION_DIAS * 24 * 60 * 60 * 1000;
  return firmar({ usuario: u.usuario, rol: u.rol === 'admin' ? 'admin' : 'sede', sede: u.sede || u.usuario, exp });
}

function verificarToken(token) {
  const secret = getSecret();
  if (!secret || !token || typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 2) return null;
  const [cuerpo, firma] = partes;
  const esperada = b64url(crypto.createHmac('sha256', secret).update(cuerpo).digest());
  if (!iguales(firma, esperada)) return null;
  try {
    const datos = JSON.parse(Buffer.from(cuerpo.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!datos.exp || Date.now() > datos.exp) return null;
    // El usuario debe seguir existiendo (si lo borras en Netlify, su sesión deja de servir)
    const existe = getUsuarios().find(u => u.usuario === datos.usuario);
    if (!existe) return null;
    datos.rol = existe.rol === 'admin' ? 'admin' : 'sede';
    return datos;
  } catch (e) {
    return null;
  }
}

function tokenDeEvento(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

// Devuelve null si es admin; si no, la respuesta de error lista para retornar
function exigirAdmin(event) {
  const sesion = verificarToken(tokenDeEvento(event));
  if (!sesion) return { statusCode: 401, body: JSON.stringify({ error: 'Sesión inválida o vencida' }) };
  if (sesion.rol !== 'admin') return { statusCode: 403, body: JSON.stringify({ error: 'Solo el administrador puede usar esta función' }) };
  return null;
}

module.exports = { getSecret, getUsuarios, iguales, crearToken, verificarToken, tokenDeEvento, exigirAdmin };
