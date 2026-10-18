const express = require('express');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');
const app = express();
app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));
// Tüm dosyalar aynı klasörde: sunucu/paket dosyalarını dışarı verme
app.use((req, res, next) => {
  if (/^\/(server\.js|package(-lock)?\.json|readme\.md|node_modules|\.env|\.git)/i.test(req.path)) return res.status(404).end();
  next();
});
app.use(express.static(__dirname, { dotfiles: 'allow', index: 'index.html' }));

/* ---------------------------------------------------------------
   /api/relay  — tarayıcı bir yapay zeka servisine doğrudan
   ulaşamazsa (CORS engeli) isteği buradan geçirir.
   API anahtarı kullanıcının kendi cihazından gelir, burada SAKLANMAZ.
   --------------------------------------------------------------- */
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:');
}

const hits = new Map(); // basit hız sınırı: IP başına dakikada 60 istek
setInterval(() => hits.clear(), 60 * 1000).unref();

const APP_ORIGINS = ['https://localhost', 'http://localhost', 'capacitor://localhost', 'file://', 'null'];
app.options('/api/relay', (req, res) => {
  const o = req.headers.origin;
  if (o && (APP_ORIGINS.includes(o) || (process.env.ALLOWED_ORIGINS || '').split(',').includes(o))) {
    res.set({ 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' });
  }
  res.status(204).end();
});

app.post('/api/relay', async (req, res) => {
  try {
    const ip = req.ip || '?';
    const n = (hits.get(ip) || 0) + 1;
    hits.set(ip, n);
    if (n > 60) return res.status(429).json({ error: { message: 'Çok fazla istek. Biraz bekle.' } });

    // Sadece kendi sitenden gelen istekleri kabul et (başka siteler relay'i kullanamasın)
    const origin = req.headers.origin;
    if (origin) {
      let oh = '';
      try { oh = new URL(origin).host; } catch (e) {}
      const okApp = APP_ORIGINS.includes(origin) || (process.env.ALLOWED_ORIGINS || '').split(',').includes(origin);
      if (okApp) res.set({ 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' });
      else if (oh !== req.headers.host) return res.status(403).json({ error: { message: 'İzin verilmeyen kaynak.' } });
    }

    const { url, headers, body } = req.body || {};
    let u;
    try { u = new URL(url); } catch (e) { return res.status(400).json({ error: { message: 'Geçersiz adres.' } }); }
    if (u.protocol !== 'https:') return res.status(400).json({ error: { message: 'Sadece https adreslerine izin var.' } });

    // Yerel / özel ağ adreslerini engelle (SSRF koruması)
    const host = u.hostname;
    const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
    if (!addrs.length || addrs.some(a => isPrivateIp(a.address)))
      return res.status(400).json({ error: { message: 'Bu adrese erişim engellendi.' } });

    const h = {};
    for (const [k, v] of Object.entries(headers || {})) {
      if (/^(host|content-length|connection|origin|referer|cookie)$/i.test(k)) continue;
      h[k] = String(v);
    }
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 90 * 1000);
    const r = await fetch(u.toString(), { method: 'POST', headers: h, body: typeof body === 'string' ? body : JSON.stringify(body), signal: ctl.signal, redirect: 'error' });
    clearTimeout(to);
    const text = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(text);
  } catch (e) {
    res.status(502).json({ error: { message: 'Sunucu bağlantı hatası: ' + e.message } });
  }
});


/* ---------------------------------------------------------------
   Hazır anahtar: Katia / Ayaz / Horror modları (GROQ_API_KEY sadece sunucuda durur)
   --------------------------------------------------------------- */
const GROQ = 'https://api.groq.com/openai/v1';
const BUILTIN = ['katia', 'ayaz', 'horror'];
const hits2 = new Map();
setInterval(() => hits2.clear(), 60 * 1000).unref();
const okOrigin = o => APP_ORIGINS.includes(o) || (process.env.ALLOWED_ORIGINS || '').split(',').includes(o);
function guard(req, res, limit) {
  const n = (hits2.get(req.ip) || 0) + 1; hits2.set(req.ip, n);
  const o = req.headers.origin;
  if (o) {
    let oh = ''; try { oh = new URL(o).host; } catch (e) {}
    if (okOrigin(o)) res.set({ 'Access-Control-Allow-Origin': o, 'Vary': 'Origin' });
    else if (oh !== req.headers.host) { res.status(403).json({ error: { message: 'İzin verilmeyen kaynak.' } }); return false; }
  }
  if (n > limit) { res.status(429).json({ error: { message: 'Çok fazla istek. Biraz bekle.' } }); return false; }
  return true;
}
const preflight = (req, res) => {
  const o = req.headers.origin;
  if (o && okOrigin(o)) res.set({ 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, x-groq-key', 'Vary': 'Origin' });
  res.status(204).end();
};
app.options('/api/chat', preflight);
app.options('/api/stt', preflight);

app.post('/api/chat', async (req, res) => {
  try {
    if (!guard(req, res, 40)) return;
    const key = process.env.GROQ_API_KEY;
    if (!key) return res.status(503).json({ error: { message: 'Sunucuda GROQ_API_KEY tanımlı değil.' } });
    const b = req.body || {};
    if (!BUILTIN.includes(b.persona)) return res.status(403).json({ error: { message: 'Bu mod için hazır anahtar yok. Ayarlardan kendi API anahtarını gir.' } });
    const msgs = (Array.isArray(b.msgs) ? b.msgs : []).slice(-30).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 4000) }));
    if (!msgs.length) return res.status(400).json({ error: { message: 'Mesaj yok.' } });
    const img = typeof b.img === 'string' && b.img.startsWith('data:image/') ? b.img : null;
    if (img) { const l = msgs[msgs.length - 1]; l.content = [{ type: 'text', text: l.content }, { type: 'image_url', image_url: { url: img } }]; }
    const body = {
      model: img ? (process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct') : (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
      messages: [{ role: 'system', content: String(b.sys || '').slice(0, 6000) }, ...msgs],
      temperature: Math.min(1.5, Math.max(0, +b.temp || 0.7)),
      max_tokens: Math.min(1200, Math.max(30, +b.max || 300))
    };
    const r = await fetch(GROQ + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(body) });
    res.status(r.status).type('application/json').send(await r.text());
  } catch (e) { res.status(502).json({ error: { message: 'Sunucu hatası: ' + e.message } }); }
});

// Ses -> metin (iOS / Android WebView / Firefox için). Whisper, Groq üzerinden.
app.post('/api/stt', express.raw({ type: () => true, limit: '10mb' }), async (req, res) => {
  try {
    if (!guard(req, res, 60)) return;
    const key = String(req.headers['x-groq-key'] || '').trim() || process.env.GROQ_API_KEY;
    if (!key) return res.status(503).json({ error: { message: 'GROQ_API_KEY yok.' } });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: { message: 'Ses yok.' } });
    const ct = String(req.headers['content-type'] || 'audio/webm').split(';')[0];
    const ext = /mp4|m4a|aac/.test(ct) ? 'm4a' : /ogg/.test(ct) ? 'ogg' : /wav/.test(ct) ? 'wav' : 'webm';
    const fd = new FormData();
    fd.append('file', new Blob([req.body], { type: ct }), 'ses.' + ext);
    fd.append('model', 'whisper-large-v3-turbo');
    fd.append('language', String(req.query.lang || 'tr').slice(0, 2));
    fd.append('temperature', '0');
    const r = await fetch(GROQ + '/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json(j);
    res.json({ text: (j.text || '').trim() });
  } catch (e) { res.status(502).json({ error: { message: 'Ses tanıma hatası: ' + e.message } }); }
});

app.get('/healthz', (_req, res) => res.send('ok'));

app.listen(process.env.PORT || 3000, () => console.log('Katia çalışıyor'));
