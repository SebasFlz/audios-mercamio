const { exigirAdmin } = require('../lib/auth');

exports.handler = async function (event) {
  const denegado = exigirAdmin(event);
  if (denegado) return denegado;

  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Falta configurar ELEVENLABS_API_KEY en Netlify (Site settings > Environment variables).' })
    };
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey }
    });
    const data = await res.text();
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body: data
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
