const { exigirAdmin } = require('../lib/auth');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const denegado = exigirAdmin(event);
  if (denegado) return denegado;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Falta configurar ELEVENLABS_API_KEY en Netlify (Site settings > Environment variables).' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { text, voice_id } = payload;
  if (!text || !voice_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta text o voice_id' }) };
  }

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        language_code: 'es',
        apply_text_normalization: 'on',
        voice_settings: {
          stability: 0.65,
          similarity_boost: 0.8,
          style: 0.15,
          use_speaker_boost: true,
          speed: 0.85
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return { statusCode: res.status, body: errText };
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
      body: base64Audio,
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
