'use strict';
/* Katia AI – hesap çekirdeği (sadece sunucuda çalışır, tarayıcıya gönderilmez)
   - benzersiz isimler (büyük/küçük harf ve Türkçe harf farkı yok sayılır)
   - Leko yönetici modu (şifre cihaz başına bir kez)
   - ban / ban kaldırma kuralları, kullanıcı ayarlarını uzaktan değiştirme */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PERSONAS = ['katia', 'ayaz', 'friday', 'emma', 'ultron', 'horror', 'leko', 'gizem'];
const PASS_SALT = 'katia-leko-v1';
// Leko şifresinin scrypt özeti (düz metin kodda durmaz). Render'da LEKO_PASS tanımlarsan o geçerli olur.
const DEFAULT_PASS_HASH = 'f9d496cab8b06dc55055c6ba27067411fa5d89f3b12c4b812f931baf8e075333';
const normPass = p => String(p || '').trim().normalize('NFC').replace(/ı/g, 'i').replace(/İ/g, 'I');
const hashPass = p => crypto.scryptSync(normPass(p), PASS_SALT, 32);
function passOk(p) {
  const want = process.env.LEKO_PASS ? hashPass(process.env.LEKO_PASS) : Buffer.from(DEFAULT_PASS_HASH, 'hex');
  return crypto.timingSafeEqual(hashPass(p), want);
}

// İsim anahtarı: Ayaz = AYaz = aYaz = "a y a z" = Ayaz. Türkçe harfler (ı, İ, ş, ğ, ü, ö, ç) sadeleştirilir.
function nameKey(n) {
  return String(n || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/[^a-z0-9]/g, '');
}
const NAME_RE = /^[A-Za-zÇĞİÖŞÜçğıöşü0-9 _.\-]{2,20}$/;
const RESERVED = new Set(['admin', 'administrator', 'yonetici', 'sistem', 'system', 'moderator']);

/* ---------------- depolama ---------------- */
function fileStore(file) {
  return {
    kind: 'dosya',
    async load() { try { return JSON.parse(await fs.promises.readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } },
    async save(d) { await fs.promises.mkdir(path.dirname(file), { recursive: true }); const t = file + '.tmp'; await fs.promises.writeFile(t, JSON.stringify(d)); await fs.promises.rename(t, file); }
  };
}
function upstashStore(url, token) {
  const base = String(url).replace(/\/+$/, '');
  const call = async cmd => {
    const r = await fetch(base, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
    return j.result;
  };
  return {
    kind: 'upstash',
    async load() { const v = await call(['GET', 'katia_db']); return v ? JSON.parse(v) : null; },
    async save(d) { await call(['SET', 'katia_db', JSON.stringify(d)]); }
  };
}
function memStore() {
  let d = null;
  return { kind: 'bellek', async load() { return d ? JSON.parse(JSON.stringify(d)) : null; }, async save(x) { d = JSON.parse(JSON.stringify(x)); } };
}
function autoStore() {
  const u = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (u && t) return upstashStore(u, t);
  return fileStore(path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'db.json'));
}

/* ---------------- çekirdek ---------------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const validDid = d => typeof d === 'string' && /^[a-f0-9]{32}$/.test(d);

function cleanSettings(s) {
  const o = {}; s = s || {};
  if (PERSONAS.includes(s.persona) && s.persona !== 'leko') o.persona = s.persona;
  if (['short', 'mid', 'long'].includes(s.len)) o.len = s.len;
  if (s.temp != null && s.temp !== '' && isFinite(+s.temp)) o.temp = clamp(+s.temp, 0, 1.5);
  if (s.fs != null && s.fs !== '' && isFinite(+s.fs)) o.fs = clamp(Math.round(+s.fs), 11, 26);
  if (typeof s.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.accent)) o.accent = s.accent;
  if (s.voice === true || s.voice === false) o.voice = s.voice;
  if (typeof s.aname === 'string' && s.aname.trim()) o.aname = s.aname.trim().slice(0, 20);
  if (typeof s.extra === 'string' && s.extra.trim()) o.extra = s.extra.trim().slice(0, 500);
  return o;
}

function createCore(store) {
  let db = null, ready = null, timer = null, due = 0, saving = Promise.resolve();
  const fails = new Map(); // şifre denemeleri
  const fresh = () => ({ v: 1, users: {}, devices: {}, owner: '', bannedDevices: {} });

  async function open() {
    if (db) return;
    if (!ready) {
      ready = (async () => {
        const d = await store.load(); // hata verirse boş veritabanıyla ÜZERİNE YAZMAMAK için fırlatır
        db = d && d.users ? d : fresh();
      })().catch(e => { ready = null; throw e; });
    }
    await ready;
  }
  function schedule(ms) {
    const at = Date.now() + ms;
    if (timer && due <= at) return;
    if (timer) clearTimeout(timer);
    due = at;
    timer = setTimeout(() => { timer = null; due = 0; saving = saving.then(() => store.save(db)).catch(e => console.error('db kaydı:', e.message)); }, ms);
    if (timer.unref) timer.unref();
  }
  const touch = () => schedule(250);      // önemli değişiklik
  const soft = () => schedule(60000);     // sadece "son görülme" gibi şeyler
  async function flush() { if (timer) { clearTimeout(timer); timer = null; due = 0; saving = saving.then(() => store.save(db)); } await saving; }

  const userOf = did => (validDid(did) && db.devices[did]) ? db.users[db.devices[did]] || null : null;
  const me = u => ({
    ok: true, registered: true, name: u.name, key: u.key, banned: !!u.banned, banReason: u.banReason || '',
    admin: !!u.admin, owner: db.owner === u.key,
    settings: u.banned ? null : (u.settings || null), ver: u.ver || 0, lock: !!u.lock, msg: u.msg || '', msgId: u.msgId || 0
  });
  const pub = u => ({
    key: u.key, name: u.name, created: u.created, last: u.last || 0, banned: !!u.banned, banReason: u.banReason || '',
    bannedBy: u.bannedBy || '', admin: !!u.admin, owner: db.owner === u.key, info: u.info || {},
    settings: u.settings || null, lock: !!u.lock, msg: u.msg || ''
  });
  const res = (status, body) => ({ status, body });
  const err = (status, message) => res(status, { error: { message } });
  const adminOf = did => { const u = userOf(did); return u && u.admin && !u.banned ? u : null; };

  async function handle(route, b, ip) {
    await open();
    b = b && typeof b === 'object' ? b : {};
    const did = b.did;
    if (!validDid(did)) return err(400, 'Cihaz kimliği geçersiz.');

    switch (route) {
      case 'kayit': {
        const ex = userOf(did);
        if (ex) return res(200, me(ex));
        if (db.bannedDevices[did]) return err(403, 'Bu cihaz banlı.');
        const name = String(b.name || '').trim().replace(/\s+/g, ' ');
        if (!NAME_RE.test(name)) return err(400, 'İsim 2-20 karakter olmalı; sadece harf, rakam, boşluk, _ . - kullanabilirsin.');
        const key = nameKey(name);
        if (key.length < 2) return err(400, 'İsimde en az 2 harf veya rakam olmalı.');
        if (RESERVED.has(key)) return err(409, 'Bu isim ayrılmış, başka bir isim seç.');
        if (db.users[key]) return err(409, 'Bu isim alınmış. (Büyük/küçük harf ve Türkçe harf farkı sayılmaz: Ayaz = AYaz = ayaz.) Başka bir isim dene.');
        if (Object.keys(db.users).length >= 20000) return err(503, 'Kayıt kapasitesi doldu.');
        const u = { key, name, did, created: Date.now(), last: Date.now(), banned: false, admin: false, settings: null, ver: 0, lock: false, msg: '', msgId: 0, info: {} };
        db.users[key] = u; db.devices[did] = key; touch();
        return res(200, me(u));
      }
      case 'ben': {
        const u = userOf(did);
        if (!u) return res(200, { ok: true, registered: false });
        u.last = Date.now();
        if (b.info && typeof b.info === 'object') u.info = { persona: clip(b.info.persona, 16), w: clamp(+b.info.w || 0, 0, 20000) };
        soft();
        return res(200, me(u));
      }
      case 'admin/giris': {
        const u = userOf(did);
        if (!u) return err(401, 'Önce bir isim seçmelisin.');
        if (u.banned) return err(403, 'Banlısın.');
        if (u.admin) return res(200, me(u));
        const fk = (ip || '?') + '|' + did, now = Date.now();
        const f = (fails.get(fk) || []).filter(t => now - t < 600000);
        const fi = 'ip:' + (ip || '?'); const g = (fails.get(fi) || []).filter(t => now - t < 600000);
        if (f.length >= 5 || g.length >= 25) return err(429, 'Çok fazla yanlış deneme. 10 dakika sonra tekrar dene.');
        if (!passOk(b.pass)) { f.push(now); g.push(now); fails.set(fk, f); fails.set(fi, g); return err(401, 'Şifre yanlış. (' + (5 - f.length) + ' hakkın kaldı)'); }
        u.admin = true; u.adminAt = now;
        if (!db.owner) db.owner = u.key; // Leko moduna ilk giren = kurucu
        touch();
        return res(200, me(u));
      }
      case 'admin/liste': {
        const a = adminOf(did); if (!a) return err(403, 'Yetkin yok.');
        a.last = Date.now();
        const users = Object.values(db.users).sort((x, y) => (db.owner === y.key) - (db.owner === x.key) || (!!y.admin - !!x.admin) || (y.last || 0) - (x.last || 0)).slice(0, 2000).map(pub);
        return res(200, { ok: true, users, now: Date.now(), me: { key: a.key, owner: db.owner === a.key }, depo: store.kind });
      }
      case 'admin/ban': {
        const a = adminOf(did); if (!a) return err(403, 'Yetkin yok.');
        const t = db.users[String(b.target || '')]; if (!t) return err(404, 'Kullanıcı bulunamadı.');
        if (t.key === a.key) return err(400, 'Kendini banlayamazsın.');
        if (t.key === db.owner) return err(403, 'Kurucu banlanamaz.');
        if (t.admin && a.key !== db.owner) return err(403, 'Leko modundaki hesapları sadece kurucu (Leko moduna ilk giren) banlayabilir.');
        t.banned = true; t.banReason = clip(b.reason, 120); t.bannedBy = a.name; t.bannedAt = Date.now();
        db.bannedDevices[t.did] = true; touch();
        return res(200, { ok: true, user: pub(t) });
      }
      case 'admin/unban': {
        const a = adminOf(did); if (!a) return err(403, 'Yetkin yok.');
        const t = db.users[String(b.target || '')]; if (!t) return err(404, 'Kullanıcı bulunamadı.');
        if (t.admin && a.key !== db.owner) return err(403, 'Leko modundaki hesapların banını sadece kurucu kaldırabilir.');
        t.banned = false; t.banReason = ''; t.bannedBy = ''; delete t.bannedAt; delete db.bannedDevices[t.did]; touch();
        return res(200, { ok: true, user: pub(t) });
      }
      case 'admin/ayar': {
        const a = adminOf(did); if (!a) return err(403, 'Yetkin yok.');
        const t = db.users[String(b.target || '')]; if (!t) return err(404, 'Kullanıcı bulunamadı.');
        if (t.key === a.key) return err(400, 'Kendi ayarlarını normal Ayarlar menüsünden değiştir.');
        if (t.admin && a.key !== db.owner) return err(403, 'Leko modundaki hesapların ayarını sadece kurucu değiştirebilir.');
        const s = cleanSettings(b.settings);
        t.settings = Object.keys(s).length ? s : null; t.ver = (t.ver || 0) + 1; t.lock = !!b.lock && !!t.settings;
        if (typeof b.msg === 'string' && b.msg.trim()) { t.msg = clip(b.msg, 300); t.msgId = Date.now(); }
        touch();
        return res(200, { ok: true, user: pub(t) });
      }
      default:
        return err(404, 'Bilinmeyen istek.');
    }
  }

  // Sohbet / ses isteklerinden önce çağrılır: kayıtlı mı, banlı mı, Leko yetkisi var mı?
  async function gate(did, persona) {
    await open();
    const u = userOf(did);
    if (!u) return { ok: false, status: 401, message: 'Önce bir isim seçmelisin. Sayfayı yenile.' };
    if (u.banned) return { ok: false, status: 403, message: 'Banlandın.' + (u.banReason ? ' Sebep: ' + u.banReason : '') };
    if (persona === 'leko' && !u.admin) return { ok: false, status: 403, message: 'Leko modu için yetkin yok.' };
    u.last = Date.now(); soft();
    return { ok: true };
  }
  const info = () => ({ depo: store.kind, kalici: store.kind !== 'dosya' && store.kind !== 'bellek', kullanici: db ? Object.keys(db.users).length : null });

  return { handle, gate, flush, info, open };
}

module.exports = { createCore, autoStore, fileStore, upstashStore, memStore, nameKey, passOk, PERSONAS };
