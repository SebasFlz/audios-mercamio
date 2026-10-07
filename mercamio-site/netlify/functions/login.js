const { getSecret, getUsuarios, iguales, crearToken, verificarToken, tokenDeEvento } = require('../lib/auth');

const json = (statusCode, data) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(data)
});

exports.handler = async function (event) {
  if (!getSecret() || getUsuarios().length === 0) {
    return json(500, { error: 'Faltan las variables MERCAMIO_USERS y/o MERCAMIO_SECRET en Netlify.' });
  }

  // GET: validar una sesión guardada
  if (event.httpMethod === 'GET') {
    const sesion = verificarToken(tokenDeEvento(event));
    if (!sesion) return json(401, { error: 'Sesión inválida o vencida' });
    return json(200, { usuario: sesion.usuario, rol: sesion.rol, sede: sesion.sede });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });

  let datos;
  try { datos = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'JSON inválido' }); }

  const usuario = String(datos.usuario || '').trim().toLowerCase();
  const clave = String(datos.clave || '');

  const u = getUsuarios().find(x => String(x.usuario).toLowerCase() === usuario);
  // Pequeña pausa para frenar intentos repetidos
  await new Promise(r => setTimeout(r, 400));
  if (!u || !iguales(clave, u.clave)) {
    return json(401, { error: 'Usuario o contraseña incorrectos' });
  }

  return json(200, {
    token: crearToken(u),
    usuario: u.usuario,
    rol: u.rol === 'admin' ? 'admin' : 'sede',
    sede: u.sede || u.usuario
  });
};
