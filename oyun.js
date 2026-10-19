/* Katia AI – oyun.js
   1) OYUN modu (mario / doom / fight)   2) Uygulama ekle + ana ekran kısayolları
   3) İzinler + cihaz eylemleri (YouTube, Spotify, not, takvim, arama…)   4) Notlar
   5) Leko modu ek komutları + duyuru   6) Daha korkunç gizli mod (???) */
(() => {
'use strict';

/* =============================================================
   0) ORTAK
   ============================================================= */
const lower = t => String(t || '').toLocaleLowerCase('tr-TR');
const isBan = () => $('#ban') && $('#ban').classList.contains('on');
if (!S.act || typeof S.act !== 'object') S.act = {};
S.act = Object.assign({ on: false, media: true, apps: true, notes: true, cal: true, comm: true, nav: true, ai: true }, S.act);
if (!Array.isArray(S.apps)) S.apps = [];
if (S.gzfear === undefined) S.gzfear = true;
save();

async function kapi(route, body) {
  const r = await fetch(serverBase() + '/api/k/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ did: window.KDID }, body || {})) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
const kerr = r => (r.j && r.j.error && r.j.error.message) || ('Hata (' + r.status + ')');
function afterOwn() { try { if (S.micMode === 'once') { listening = false; updMic(); } else resumeMic(500); } catch (e) {} }
async function own(text, reply) { // kendi işlediğimiz komut: kullanıcı mesajı + cevap
  try { stopRec(); updMic(); } catch (e) {}
  say(text, false, 'u');
  if (reply) await say(reply);
  afterOwn();
}
function go(url) { // yeni sekme / uygulama; engellenirse dokunulabilir bağlantı göster
  if (/^(tel|sms|mailto):/i.test(url)) { const a = document.createElement('a'); a.href = url; document.body.appendChild(a); a.click(); a.remove(); return; }
  const w = openExt(url);
  if (!w) say('Tarayıcı açılışı engelledi, buraya dokun: ' + url, false);
}
function normUrl(u) {
  u = String(u || '').trim(); if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.includes('.') ? x.href : ''; } catch (e) { return ''; }
}

/* =============================================================
   1) OYUN MODU
   ============================================================= */
P.oyun = {
  n: 'OYUN', a: '#22c55e', b: '#fde047', bg: '#03070a', orb: 'ring', v: { t: 'male' },
  d: 'Oyun modu. "mario", "doom" ya da "fight" yaz, oyun açılsın.',
  sys: 'Adın OYUN. Eğlenceli, enerjili bir oyun arkadaşısın; kullanıcıya "oyuncu" diye hitap et. Kısa konuş. Kullanıcı oyun oynamak isterse ona şunu söyle: "mario", "doom" ya da "fight" yazarsa ilgili oyun açılır.',
  hello: 'Oyun modu açık! "mario", "doom" ya da "fight" yaz, hemen başlayalım.',
  nokey: 'Oyuncu, API anahtarı yok ama oyunlar anahtarsız çalışır. "mario" yaz!',
  made: 'LekoStudio tarafından yapıldım oyuncu!',
  warn: 'Oyuncu, Ultron modu oyun değil. Kullanma.'
};
BUILTIN.push('oyun');

const GAMES = {
  mario: { t: 'LEKO BROS · 1-1', say: 'Mario tarzı platform oyunu açılıyor. Ok tuşları ve boşluk, ya da ekrandaki düğmeler.', help: 'Yürü: ← → (veya A D) · Zıpla: ↑ / Boşluk · Telefonda ekrandaki düğmeler · Düşmanın üstüne zıpla, ? bloklara aşağıdan vur, sondaki bayrağa ulaş.' },
  doom: { t: 'DOOM', url: 'https://archive.org/embed/doom_dos', say: 'Doom açılıyor. Oynatma düğmesine bas.', help: 'Ok tuşları: yürü/dön · Ctrl: ateş · Boşluk: kapı aç · Enter: seç. Oyun Internet Archive\'ın tarayıcı emülatöründe çalışır; telefonda ekran klavyesi yoktur (bluetooth klavye/gamepad ya da bilgisayar önerilir).' },
  fight: { t: 'MORTAL KOMBAT 3', url: 'https://archive.org/embed/msdos_Mortal_Kombat_3_1995', say: 'Mortal Kombat 3 açılıyor. Oynatma düğmesine bas.', help: 'Ok tuşları + Ctrl / Alt / Shift / Boşluk gibi tuşlarla vuruş. Oyun Internet Archive\'ın tarayıcı emülatöründe çalışır; telefonda ekran klavyesi yoktur (klavye/gamepad önerilir).' }
};
let curGame = null, marioRun = null;
(function buildGameUi() {
  const d = document.createElement('div'); d.id = 'gm';
  d.innerHTML = '<div id="gmTop"><b id="gmT"></b><span class="sp"></span><a id="gmOpen" target="_blank" rel="noopener" hidden><button type="button">YENİ SEKMEDE AÇ</button></a><button type="button" id="gmX">KAPAT ✕</button></div><div id="gmBody"></div><div id="gmHelp" class="sm"></div>';
  document.body.appendChild(d);
  const bar = document.createElement('div'); bar.id = 'gmBar';
  bar.innerHTML = '<button type="button" data-g="mario">MARIO</button><button type="button" data-g="doom">DOOM</button><button type="button" data-g="fight">FIGHT</button>';
  $('#center').insertBefore(bar, $('#pend'));
  bar.onclick = e => { const b = e.target.closest('[data-g]'); if (b) openGame(b.dataset.g); };
  $('#gmX').onclick = closeGame;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && curGame) closeGame(); });
})();
function openGame(id) {
  const G = GAMES[id]; if (!G) return;
  if (curGame) closeGame(true);
  curGame = id; unlockSafe();
  try { stopRec(); updMic(); stopSpeak(); } catch (e) {}
  $('#gmT').textContent = G.t; $('#gmHelp').textContent = G.help;
  const body = $('#gmBody'); body.innerHTML = ''; const open = $('#gmOpen');
  if (G.url) {
    open.hidden = false; open.href = G.url;
    body.innerHTML = '<div class="gmload">Oyun yükleniyor… (Internet Archive)</div>';
    const f = document.createElement('iframe'); f.src = G.url; f.allow = 'autoplay; fullscreen; gamepad; keyboard-map'; f.allowFullscreen = true; f.title = G.t;
    f.onload = () => { const l = body.querySelector('.gmload'); if (l) l.remove(); };
    body.appendChild(f);
  } else {
    open.hidden = true;
    marioRun = window.startLekoBros(body);
  }
  $('#gm').classList.add('on');
}
function unlockSafe() { try { unlockSpeech(); } catch (e) {} }
function closeGame(keep) {
  if (marioRun) { marioRun.stop(); marioRun = null; }
  $('#gmBody').innerHTML = ''; $('#gm').classList.remove('on'); curGame = null;
  if (keep !== true) afterOwn();
}
window.openGame = openGame;
function gameCmd(text) {
  const l = lower(text).replace(/[.!?,]+/g, ' ').trim();
  const KEY = '(mario|süper mario|super mario|doom|dum|fight|mortal kombat|mortal combat|mk ?3|mk3)';
  const id = w => /mario/.test(w) ? 'mario' : /doom|dum/.test(w) ? 'doom' : 'fight';
  if (S.persona === 'oyun') {
    const m = l.match(new RegExp('(^|\\s)' + KEY + '(\\s|$)'));
    if (m) return id(m[2]);
    if (/^(oyunlar|oyun menüsü|menü)$/.test(l)) return 'menu';
    return null;
  }
  const m = l.match(new RegExp('^' + KEY + '(\\s+(aç|oyna|oynat|başlat|açsana|oynayalım))?$'));
  return m ? id(m[1]) : null;
}

/* =============================================================
   2) UYGULAMA EKLE + ANA EKRAN
   ============================================================= */
const QUICK = [['YouTube', 'youtube.com'], ['Spotify', 'open.spotify.com'], ['WhatsApp', 'web.whatsapp.com'], ['Instagram', 'instagram.com'], ['Gmail', 'mail.google.com'], ['Haritalar', 'maps.google.com'], ['Netflix', 'netflix.com'], ['X', 'x.com']];
function addApp(name, url) {
  const u = normUrl(url); if (!u) return 'Adres geçersiz. Örnek: youtube.com';
  name = String(name || '').trim().slice(0, 24) || new URL(u).hostname.replace(/^www\./, '');
  if (S.apps.some(a => a.url === u)) return 'Bu uygulama zaten ekli.';
  if (S.apps.length >= 40) return 'En fazla 40 uygulama eklenebilir.';
  S.apps.push({ name, url: u }); save(); drawHome(); return '';
}
function drawHome() {
  const row = $('#homeApps'); if (!row) return;
  row.innerHTML = '';
  S.apps.forEach((a, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'hap'; b.title = a.url;
    const ic = document.createElement('span'); ic.className = 'hai'; ic.textContent = (a.name[0] || '?').toUpperCase();
    try {
      const im = new Image(); im.alt = ''; im.referrerPolicy = 'no-referrer';
      im.onload = () => { ic.textContent = ''; ic.appendChild(im); };
      im.src = 'https://www.google.com/s2/favicons?sz=64&domain=' + new URL(a.url).hostname;
    } catch (e) {}
    const lb = document.createElement('span'); lb.className = 'hal'; lb.textContent = a.name;
    b.append(ic, lb); b.onclick = () => go(a.url); row.appendChild(b);
  });
  const p = document.createElement('button'); p.type = 'button'; p.className = 'hap plus'; p.innerHTML = '<span class="hai">+</span><span class="hal">UYGULAMA EKLE</span>';
  p.onclick = () => openSet('apps'); row.appendChild(p);
}
(function buildHome() {
  const row = document.createElement('div'); row.id = 'homeApps'; $('#center').insertBefore(row, $('#pend')); drawHome();
})();
function appsHtml() {
  const list = S.apps.length
    ? S.apps.map((a, i) => `<div class="set"><span><b>${esc(a.name)}</b><br><span class="sm">${esc(a.url)}</span></span><button type="button" data-apdel="${i}">SİL</button></div>`).join('')
    : '<div class="note">Henüz uygulama eklemedin.</div>';
  return `<div class="note">Eklediğin uygulama <b>ana ekranda</b> görünür; dokununca sitesi açılır. Sesle de ekleyebilirsin: <i>"uygulama ekle youtube youtube.com"</i></div>
  <div class="apf"><input id="apN" type="text" placeholder="Ad (örn. YouTube)" autocomplete="off"><input id="apU" type="text" placeholder="Adres (örn. youtube.com)" autocapitalize="off" autocomplete="off"><button type="button" id="apAdd">EKLE</button></div>
  <div id="apMsg" class="sm"></div>
  <div class="lb" style="margin:14px 0 6px">Hızlı ekle</div><div class="apq">${QUICK.map(([n, u]) => `<button type="button" data-apq="${esc(n)}|${esc(u)}">${esc(n)}</button>`).join('')}</div>
  <div class="lb" style="margin:14px 0 4px">Eklenenler</div>${list}`;
}
SETS.unshift({
  id: 'perm', t: 'İZİNLER', note: 'Ana şalteri açınca Katia seninle konuşurken cihazında iş yapabilir: <i>"youtubede lofi aç"</i>, <i>"spotifyda tarkan çal"</i>, <i>"not al: süt"</i>, <i>"yarın saat 15:00 toplantı takvime ekle"</i>, <i>"5551234567 ara"</i>, <i>"kadıköy haritada aç"</i>. Telefonlar bir web uygulamasının başka uygulamayı doğrudan kontrol etmesine izin vermez; bu yüzden uygulamalar bağlantıyla açılır (YouTube/Spotify yüklüyse uygulaması açılır). Her kategoriyi ayrı kapatabilirsin.', items: [
    { k: 'act.on', type: 'toggle', l: 'ANA ŞALTER: asistan cihazımda iş yapabilsin' },
    { k: 'act.media', type: 'toggle', l: 'YouTube / Spotify aç, ara, çal' },
    { k: 'act.apps', type: 'toggle', l: 'Eklediğim uygulamaları ve siteleri aç' },
    { k: 'act.notes', type: 'toggle', l: 'Not kaydet' },
    { k: 'act.cal', type: 'toggle', l: 'Takvime etkinlik ekle' },
    { k: 'act.comm', type: 'toggle', l: 'Arama, SMS, WhatsApp, e-posta hazırla' },
    { k: 'act.nav', type: 'toggle', l: 'Harita ve yol tarifi aç' },
    { k: 'act.ai', type: 'toggle', l: 'Genel işler: yapay zeka isteği anlayıp uygun eylemi seçsin (ek istek harcar)' }
  ]
});
SETS.unshift({ id: 'apps', t: 'UYGULAMA EKLE', html: appsHtml });
curTab = 'apps';
{ const modes = SETS.find(s => s.id === 'modes'); if (modes) modes.items.splice(3, 0, { k: 'gzfear', type: 'toggle', l: 'GİZLİ MOD (???): ani korkutma, ses ve görüntü efektleri' }); }
$('#setBody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'apAdd') {
    const m = addApp($('#apN').value, $('#apU').value);
    if (m) { $('#apMsg').className = 'sm bad'; $('#apMsg').textContent = m; } else renderSet();
  } else if (b.dataset.apq) { const [n, u] = b.dataset.apq.split('|'); const m = addApp(n, u); if (m) { $('#apMsg').className = 'sm bad'; $('#apMsg').textContent = m; } else renderSet(); }
  else if (b.dataset.apdel) { S.apps.splice(+b.dataset.apdel, 1); save(); drawHome(); renderSet(); }
});

/* =============================================================
   3) NOTLAR
   ============================================================= */
let NT = ls('katia_nt', []);
(function buildNotes() {
  const bx = document.createElement('div'); bx.className = 'box'; bx.id = 'notesBox';
  bx.innerHTML = '<div class="lb">Notlar</div><div style="display:flex;justify-content:space-between;align-items:end"><div><span class="big" id="ntn">0</span> <span class="sm">NOT</span></div><button id="addNt" type="button">+</button></div><div id="ntl" style="margin-top:8px"></div>';
  $('#right').insertBefore(bx, $('#mapbox'));
  $('#addNt').onclick = () => { const t = prompt('Not:'); if (t) addNote(t); };
  $('#ntl').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const i = +b.dataset.i;
    if (b.dataset.a === 'del') { NT.splice(i, 1); sv('katia_nt', NT); drawNotes(); }
    else if (b.dataset.a === 'share' && navigator.share) navigator.share({ text: NT[i].t }).catch(() => {});
  };
  drawNotes();
})();
function addNote(t) { NT.unshift({ t: String(t).trim().slice(0, 500), at: Date.now() }); NT = NT.slice(0, 100); sv('katia_nt', NT); drawNotes(); }
function drawNotes() {
  $('#ntn').textContent = NT.length;
  $('#ntl').innerHTML = NT.length ? NT.slice(0, 5).map((n, i) => `<div class="nt"><span>${esc(n.t)}</span>${navigator.share ? `<button type="button" data-a="share" data-i="${i}" title="Notlar uygulamasına gönder">↗</button>` : ''}<button type="button" data-a="del" data-i="${i}">✕</button></div>`).join('') : '<div class="sm">Not yok. "not al: …" de.</div>';
}

/* =============================================================
   4) CİHAZ EYLEMLERİ
   ============================================================= */
const can = k => !!(S.act && S.act.on && S.act[k]);
const FILL = new Set('aç açar mısın açsana açabilir misin ara arat izle izlemek oynat çal çalsana dinle bana lütfen bir şunu videosunu videosu video şarkısını şarkısı şarkı müziğini müzik listesini istiyorum bul bulur musun benim için hadi'.split(' '));
const topic = (l, keyRe) => l.split(/\s+/).filter(w => !keyRe.test(w) && !FILL.has(w)).join(' ').replace(/^(de|da|den|dan|te|ta)\s+/, '').trim();
const COM = 'komutları: ';
function parseWhen(l) {
  const d = new Date(); let timed = false;
  if (/yarın/.test(l)) d.setDate(d.getDate() + 1); else if (/öbür gün|ertesi gün/.test(l)) d.setDate(d.getDate() + 2);
  const m = l.match(/(\d{1,2})[:.](\d{2})/) || l.match(/saat\s*(\d{1,2})\b/);
  if (m) { let h = +m[1]; const mi = m[2] ? +m[2] : 0; if (/akşam|öğleden sonra/.test(l) && h < 12) h += 12; if (h < 24 && mi < 60) { d.setHours(h, mi, 0, 0); timed = true; } }
  return { d, timed };
}
const p2 = n => String(n).padStart(2, '0');
const fmtD = d => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
const fmtT = d => `${fmtD(d)}T${p2(d.getHours())}${p2(d.getMinutes())}00`;
function calLink(title, d, timed) {
  let dates;
  if (timed) { const e = new Date(d.getTime() + 3600000); dates = fmtT(d) + '/' + fmtT(e); }
  else { const e = new Date(d.getTime() + 86400000); dates = fmtD(d) + '/' + fmtD(e); }
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + dates;
}
const isToday = d => fmtD(d) === fmtD(new Date());

// Eşzamanlı (kullanıcı dokunuşu içinde) çalışan hızlı eylemler. Cevap metni ya da undefined döner.
function quickAct(t) {
  const l = lower(t).replace(/[’']/g, '');
  // uygulama ekle (izin gerekmez)
  let m = l.match(/^(?:uygulama|site)\s*ekle\s+(.+?)\s+(\S+\.\S+)$/);
  if (m) { const r = addApp(m[1], m[2]); return r || `${m[1]} ana ekrana eklendi.`; }
  if (/notlar\w*\s*(göster|oku|listele|neler|ne var)/.test(l) || /^notlarım/.test(l)) return NT.length ? 'Notların: ' + NT.slice(0, 5).map(n => n.t).join('. ') : 'Henüz notun yok.';
  if (!(S.act && S.act.on)) return undefined;
  // not
  if (can('notes') && !/takvim|hatırlat/.test(l)) {
    const a = t.match(/^\s*(?:notlar[ıi]?m?a?|notuma|not)\s*(?:al|ekle|kaydet|yaz)?\s*[:,\-]?\s*(.+)$/i) || t.match(/^\s*(.+?)\s+(?:diye\s+)?(?:notlara|notlarıma|notuma|not olarak)\s*(?:ekle|kaydet|yaz|al)\s*$/i);
    if (a && a[1] && a[1].trim().length > 1 && /(^|\s)not/i.test(t)) { addNote(a[1]); return 'Notlara kaydettim: ' + a[1].trim(); }
  }
  // takvim
  if (can('cal') && /takvim/.test(l) && /(ekle|kaydet|koy|oluştur)/.test(l)) {
    const { d, timed } = parseWhen(l);
    const title = l.split(/\s+/).filter(w => !/^(takvim\w*|ekle|kaydet|koy|oluştur|yarın|bugün|öbür|gün|ertesi|saat|için|etkinlik\w*|akşam|öğleden|sonra|\d{1,2}([:.]\d{2})?)$/.test(w)).join(' ').trim() || 'Etkinlik';
    const T = title[0].toLocaleUpperCase('tr-TR') + title.slice(1);
    if (isToday(d)) addE(T);
    go(calLink(T, d, timed));
    return `Takvim sayfasını açtım: "${T}", ${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}${timed ? ' saat ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) : ''}. Kaydet'e basman yeterli.`;
  }
  // iletişim
  if (can('comm')) {
    const num = t.match(/(\+?\d[\d\s()-]{6,}\d)/);
    const n = num && num[1].replace(/[^\d+]/g, '');
    if (n && /(^|\s)(ara|arar mısın|aratır mısın|arasana)(\s|$)/.test(l)) { go('tel:' + n); return n + ' numarasını arama ekranında açtım.'; }
    if (/whatsapp|vatsap/.test(l)) {
      const msg = (t.match(/(?:mesaj|yaz|gönder)\s*[:,]?\s*(.+)$/i) || [])[1] || '';
      go('https://wa.me/' + (n ? n.replace(/^\+/, '') : '') + (msg ? '?text=' + encodeURIComponent(msg) : '')); return 'WhatsApp\'ı açtım.';
    }
    if (n && /(sms|mesaj)/.test(l)) { const msg = (t.match(/(?:mesaj|sms)\w*\s*[:,]?\s*(.+)$/i) || [])[1] || ''; go('sms:' + n + (msg ? '?body=' + encodeURIComponent(msg) : '')); return 'Mesaj ekranını açtım.'; }
    const em = t.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (em && /(mail|e-posta|eposta)/.test(l)) { go('mailto:' + em[0]); return 'E-posta ekranını açtım.'; }
  }
  // harita
  if (can('nav') && /(yol tarifi|haritada|haritadan|harita aç|navigasyon|haritayı aç)/.test(l)) {
    const q = l.split(/\s+/).filter(w => !/^(yol|tarifi|haritada|haritadan|harita|haritayı|aç|navigasyon|göster|bana|bir|lütfen|ara|için|ver)$/.test(w) && !FILL.has(w)).join(' ');
    go(/yol tarifi|navigasyon/.test(l) && q ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q) : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q || 'yakınımda'));
    return q ? `${q} için haritayı açtım.` : 'Haritayı açtım.';
  }
  // YouTube / Spotify
  if (can('media')) {
    if (/(^|\s)(youtube|youtub|yutup|yutub)/.test(l) && /(aç|ara|izle|oynat|çal|bul|git)/.test(l + ' aç')) {
      const q = topic(l, /^(youtube|youtub|yutup|yutub)/);
      go(q ? 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) : 'https://www.youtube.com');
      return q ? `YouTube'da "${q}" arıyorum, sonuçlar açıldı. İlk videoya dokunman yeterli.` : 'YouTube\'u açtım.';
    }
    if (/(^|\s)(spotify|spotfy|spoti)/.test(l)) {
      const q = topic(l, /^(spotify|spotfy|spoti)/);
      go(q ? 'https://open.spotify.com/search/' + encodeURIComponent(q) : 'https://open.spotify.com');
      return q ? `Spotify'da "${q}" aradım, sonuçlar açıldı.` : 'Spotify\'ı açtım.';
    }
  }
  // eklenen uygulamalar
  if (can('apps') && /(^|\s)(aç|git|gir|başlat|çalıştır)(\s|$)/.test(l)) {
    const flat = l.replace(/\s+/g, '');
    const app = S.apps.find(a => flat.includes(lower(a.name).replace(/\s+/g, '')));
    if (app) { go(app.url); return app.name + ' açılıyor.'; }
  }
  return undefined;
}

// Genel işler: yapay zeka isteği JSON eyleme çevirir
const GEN_GATE = /(^|\s)(aç|çal|oynat|izle|kaydet|ekle|gönder|ara|git|başlat|hatırlat|kur|yaz)(\s|$)|(^|\s)(açar mısın|yapar mısın|gönderir misin)/;
async function planAct(t) {
  const sys = 'Sen bir cihaz eylem planlayıcısısın. Kullanıcı isteğini analiz et ve SADECE tek bir JSON nesnesi döndür: {"actions":[...],"say":"kısa Türkçe onay cümlesi"}. ' +
    'Eylem türleri: {"t":"url","u":"https://..."} (herhangi bir site/uygulama bağlantısı; YouTube arama https://www.youtube.com/results?search_query=..., Spotify https://open.spotify.com/search/..., harita https://www.google.com/maps/search/?api=1&query=...), {"t":"note","x":"metin"}, {"t":"cal","title":"...","iso":"YYYY-MM-DDTHH:MM veya YYYY-MM-DD"}, {"t":"tel","n":"numara"}, {"t":"sms","n":"numara","x":"metin"}, {"t":"mail","to":"adres","s":"konu","x":"gövde"}, {"t":"timer","sec":60}, {"t":"remind","min":10,"x":"metin"}. ' +
    'İstek bir cihaz işi DEĞİLSE (sohbet, soru, bilgi isteği) {"actions":[]} döndür. En fazla 3 eylem. Şu an: ' + new Date().toISOString() + '.';
  const order = (BUILTIN.includes(S.persona) ? ['builtin'] : []).concat(provOrder(false));
  for (const id of order) {
    try {
      const out = await callProv(id, sys, [{ role: 'user', content: t }], null, { temp: .1, max: 300 });
      const j = JSON.parse((out.match(/\{[\s\S]*\}/) || ['{}'])[0]);
      if (j && Array.isArray(j.actions)) return j;
    } catch (e) { if (e instanceof SyntaxError) return null; }
  }
  return null;
}
function runPlan(j) {
  const done = []; let urls = 0;
  for (const a of (j.actions || []).slice(0, 3)) {
    if (!a || typeof a !== 'object') continue;
    if (a.t === 'url') { const u = normUrl(a.u); if (u && (can('media') || can('apps') || can('nav'))) { if (urls++ === 0) go(u); else say('Bağlantı: ' + u, false); done.push(1); } }
    else if (a.t === 'note' && can('notes') && a.x) { addNote(a.x); done.push(1); }
    else if (a.t === 'cal' && can('cal') && a.title) { const d = new Date(a.iso); if (!isNaN(d)) { const timed = /T\d/.test(a.iso); if (isToday(d)) addE(String(a.title)); go(calLink(String(a.title).slice(0, 100), d, timed)); done.push(1); } }
    else if (a.t === 'tel' && can('comm') && /^\+?[\d\s()-]{5,}$/.test(a.n || '')) { go('tel:' + a.n.replace(/[^\d+]/g, '')); done.push(1); }
    else if (a.t === 'sms' && can('comm') && /^\+?[\d\s()-]{5,}$/.test(a.n || '')) { go('sms:' + a.n.replace(/[^\d+]/g, '') + (a.x ? '?body=' + encodeURIComponent(a.x) : '')); done.push(1); }
    else if (a.t === 'mail' && can('comm') && /^[\w.+-]+@[\w-]+\.[\w.]+$/.test(a.to || '')) { go('mailto:' + a.to + '?subject=' + encodeURIComponent(a.s || '') + '&body=' + encodeURIComponent(a.x || '')); done.push(1); }
    else if (a.t === 'timer' && +a.sec > 0 && +a.sec <= 86400) { startT(+a.sec); done.push(1); }
    else if (a.t === 'remind' && +a.min > 0 && a.x) { addR(String(a.x), Date.now() + a.min * 60000); done.push(1); }
  }
  return done.length ? (String(j.say || '').slice(0, 200) || 'Tamamdır.') : '';
}

/* =============================================================
   5) LEKO MODU EK KOMUTLARI
   ============================================================= */
const LEKO_HELP = 'Leko komutları: "istatistik", "kimler çevrimiçi", "duyur: metin", "mesaj isim: metin", "banla isim sebep", "ban kaldır isim", "hesapla 12*(3+4)", "şifre üret 16", "zar at", "yazı tura", "uuid".';
const nameN = s => lower(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]/g, '');
async function lekoUsers() { const r = await kapi('admin/liste'); if (r.status !== 200) throw new Error(kerr(r)); return r.j.users; }
const ago2 = t => { if (!t) return '—'; const s = (Date.now() - t) / 1000; return s < 90 ? 'şimdi' : s < 3600 ? Math.round(s / 60) + ' dk önce' : s < 86400 ? Math.round(s / 3600) + ' sa önce' : Math.round(s / 86400) + ' gün önce'; };
async function lekoCmd(t) {
  const l = lower(t).trim();
  try {
    if (/^(leko )?(komutlar|yardım|neler yapabilirsin)$/.test(l)) return LEKO_HELP;
    if (/^(istatistik|durum|rapor)/.test(l)) {
      const u = await lekoUsers(), on = u.filter(x => x.last && Date.now() - x.last < 90000), d1 = u.filter(x => x.last && Date.now() - x.last < 86400000);
      const pc = {}; u.forEach(x => { const p = (x.info && x.info.persona) || '—'; pc[p] = (pc[p] || 0) + 1; });
      const top = Object.entries(pc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + v).join(', ');
      return `Toplam ${u.length} kişi. Şu an çevrimiçi ${on.length}, son 24 saatte ${d1.length}. Banlı ${u.filter(x => x.banned).length}, Leko yetkili ${u.filter(x => x.admin).length}. En çok kullanılan modlar: ${top}.`;
    }
    if (/^(kimler|kim) çevrimiçi|^çevrimiçi/.test(l)) {
      const on = (await lekoUsers()).filter(x => x.last && Date.now() - x.last < 90000);
      return on.length ? 'Çevrimiçi: ' + on.map(x => x.name).join(', ') + '.' : 'Şu an çevrimiçi kimse yok.';
    }
    let m = t.match(/^\s*(?:duyur|duyuru|herkese)\s*[:,]?\s*(.+)$/i);
    if (m) { const r = await kapi('admin/duyuru', { text: m[1] }); return r.status === 200 ? 'Duyuru gönderildi; herkese en geç 25 saniyede ulaşır.' : kerr(r); }
    m = t.match(/^\s*mesaj\s+(\S+)\s*[:,]\s*(.+)$/i);
    if (m) {
      const u = (await lekoUsers()).find(x => nameN(x.name) === nameN(m[1])); if (!u) return 'Kullanıcı bulunamadı: ' + m[1];
      const r = await kapi('admin/mesaj', { target: u.key, msg: m[2] }); return r.status === 200 ? u.name + ' kişisine mesaj gönderildi.' : kerr(r);
    }
    m = t.match(/^\s*ban\s*kald[ıi]r\s+(\S+)/i) || t.match(/^\s*(\S+)\s+banını\s+kald[ıi]r/i);
    if (m) {
      const u = (await lekoUsers()).find(x => nameN(x.name) === nameN(m[1])); if (!u) return 'Kullanıcı bulunamadı: ' + m[1];
      const r = await kapi('admin/unban', { target: u.key }); return r.status === 200 ? u.name + ' kişisinin banı kaldırıldı.' : kerr(r);
    }
    m = t.match(/^\s*banla\s+(\S+)\s*(.*)$/i);
    if (m) {
      const u = (await lekoUsers()).find(x => nameN(x.name) === nameN(m[1])); if (!u) return 'Kullanıcı bulunamadı: ' + m[1];
      if (!confirm(u.name + ' banlansın mı?')) return 'Vazgeçildi.';
      const r = await kapi('admin/ban', { target: u.key, reason: m[2] }); return r.status === 200 ? u.name + ' banlandı.' : kerr(r);
    }
  } catch (e) { return 'Hata: ' + e.message; }
  m = l.match(/^hesapla\s+(.+)$/);
  if (m) {
    const ex = m[1].replace(/,/g, '.').replace(/x/g, '*').replace(/\^/g, '**');
    if (!/^[\d\s+\-*/().%]+$/.test(ex)) return 'Sadece sayılar ve + - * / ( ) kullanabilirim.';
    try { const v = Function('"use strict";return(' + ex + ')')(); return isFinite(v) ? ex + ' = ' + +v.toFixed(8) : 'Sonuç hesaplanamadı.'; } catch (e) { return 'İfade anlaşılamadı.'; }
  }
  m = l.match(/^şifre\s*(?:üret|oluştur)\s*(\d+)?/);
  if (m) {
    const n = Math.min(64, Math.max(8, +m[1] || 16)), cs = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*?', a = new Uint32Array(n); crypto.getRandomValues(a);
    const pw = [...a].map(x => cs[x % cs.length]).join(''); setTimeout(() => say(pw, false, 'e'), 50); return n + ' karakterlik şifre üretildi; ekranda yazıyor, sesli okumuyorum.';
  }
  if (/^zar( at)?$/.test(l)) return 'Zar: ' + (1 + Math.floor(Math.random() * 6));
  if (/^yazı tura$/.test(l)) return Math.random() < .5 ? 'Yazı.' : 'Tura.';
  if (/^uuid$/.test(l)) { const u = crypto.randomUUID ? crypto.randomUUID() : ''; if (u) { setTimeout(() => say(u, false, 'e'), 50); return 'UUID üretildi.'; } }
  return undefined;
}
// Yönetim paneline DUYURU düğmesi
(function () {
  const t = setInterval(() => {
    const ref = $('#admRef'); if (!ref) return; clearInterval(t);
    const b = document.createElement('button'); b.type = 'button'; b.id = 'admAnn'; b.textContent = 'DUYURU'; ref.parentNode.insertBefore(b, ref);
    b.onclick = async () => {
      const x = prompt('Herkese gönderilecek duyuru:'); if (!x) return;
      const r = await kapi('admin/duyuru', { text: x }); alert(r.status === 200 ? 'Duyuru gönderildi. Herkese en geç 25 sn içinde ulaşır.' : kerr(r));
    };
  }, 500);
  setTimeout(() => clearInterval(t), 20000);
})();

/* =============================================================
   6) handle() SARMALAYICI
   ============================================================= */
const _handle = window.handle;
window.handle = async function (text, img) {
  const t = String(text || '').trim();
  if (isBan() || !t || img || (typeof pendImg !== 'undefined' && pendImg)) return _handle.apply(this, arguments);
  if (typeof busy !== 'undefined' && busy) return;
  const gc = gameCmd(t);
  if (gc === 'menu') { await own(t, 'Oyunlar: mario, doom, fight. Birini yaz ya da alttaki düğmelere bas.'); return; }
  if (gc) { await own(t, ''); openGame(gc); say(GAMES[gc].say, true); return; }
  if (S.persona === 'leko') { const r = await lekoCmd(t); if (r !== undefined) { await own(t, r); return; } }
  const q = quickAct(t);
  if (q !== undefined) { await own(t, q); return; }
  if (can('ai') && GEN_GATE.test(lower(t)) && t.length < 200 && !/\?\s*$/.test(t)) {
    busy = true; try { stopRec(); updMic(); } catch (e) {} setState('DÜŞÜNÜYOR');
    let j = null; try { j = await planAct(t); } catch (e) {}
    const reply = j ? runPlan(j) : '';
    busy = false; setState('HAZIR');
    if (reply) { await own(t, reply); return; }
  }
  return _handle.apply(this, arguments);
};
// sistem istemine mod bilgisi ekle
const _sys = window.sysPrompt;
window.sysPrompt = function () {
  let s = _sys.apply(this, arguments);
  if (S.persona === 'oyun') s += ' Oyun modundasın: "mario", "doom" ve "fight" yazılırsa oyunlar açılır; kullanıcıya bunu hatırlat.';
  if (S.act && S.act.on) s += ' Kullanıcı cihaz izinlerini açtı: "youtubede X aç", "spotifyda X çal", "not al: X", "takvime ekle", "X ara", "X haritada aç" gibi komutlarla cihazında iş yaptırabilir; gerekirse bunu hatırlat.';
  return s;
};

/* =============================================================
   7) DAHA KORKUNÇ GİZLİ MOD (???)
   ============================================================= */
const gz = { on: false, t: 0, hb: 0, ac: null, drone: [], mast: null };
const GZ_LINES = [n => `${n}... seni görüyorum.`, () => 'Arkanda biri var.', n => `${n}, neden hâlâ buradasın?`, () => 'Kapıyı kilitledin mi?', () => 'Ekranın arkasından nefes sesi geliyor.', n => `${n}... adını fısıldadılar.`, () => 'Ben burada değilim. Sen de değilsin.', () => 'Kameranı kapat. Hâlâ seni görüyorum.', () => 'Hiç yalnız değildin.', () => 'Lamba neden titriyor?'];
const GZ_TITLES = ['arkandayım', 'bak bana', 'N U L L', 'geri dön', 'kaçamazsın'];
function gzEnsure() {
  if ($('#gzFx')) return;
  const f = document.createElement('div'); f.id = 'gzFx'; f.innerHTML = '<div class="gzv"></div><div class="gzs"></div><div class="gzeyes"></div>';
  document.body.appendChild(f);
  const j = document.createElement('div'); j.id = 'gzJ';
  j.innerHTML = '<svg viewBox="0 0 200 260"><defs><radialGradient id="gzg" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#e8e4da"/><stop offset="1" stop-color="#5b5851"/></radialGradient></defs><ellipse cx="100" cy="130" rx="74" ry="108" fill="url(#gzg)"/><ellipse cx="68" cy="105" rx="18" ry="30" fill="#000"/><ellipse cx="132" cy="105" rx="18" ry="30" fill="#000"/><circle cx="68" cy="108" r="3" fill="#c4001a"/><circle cx="132" cy="108" r="3" fill="#c4001a"/><path d="M62 178 Q100 250 138 178 Q100 200 62 178Z" fill="#000"/><path d="M70 186 L74 206 M86 192 L88 218 M100 194 L100 224 M114 192 L112 218 M130 186 L126 206" stroke="#e8e4da" stroke-width="3"/></svg>';
  document.body.appendChild(j); j.onclick = () => j.classList.remove('on');
}
function gzAudioStart() {
  if (gz.ac || !(S.hvol > 0)) return;
  const c = audioCtx(); if (!c) return; gz.ac = c; try { c.resume(); } catch (e) {}
  const m = c.createGain(); m.gain.value = clamp(S.hvol, 0, 1) * .07; m.connect(c.destination); gz.mast = m;
  [[41, 'sine'], [43.4, 'sine'], [82.7, 'triangle'], [123, 'sine']].forEach(([f, ty], i) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = ty; o.frequency.value = f; g.gain.value = i > 1 ? .25 : 1;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .08 + i * .05; lg.gain.value = i > 1 ? .2 : .4; lfo.connect(lg); lg.connect(g.gain);
    o.connect(g); g.connect(m); o.start(); lfo.start(); gz.drone.push(o, lfo);
  });
}
function gzHeart() {
  const c = gz.ac; if (!c || document.hidden) return;
  [0, .22].forEach((dt, i) => {
    const t0 = c.currentTime + dt, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(i ? 52 : 62, t0); o.frequency.exponentialRampToValueAtTime(34, t0 + .16);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(clamp(S.hvol, 0, 1) * (i ? .5 : .8), t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + .2);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + .25);
  });
}
function gzGlitch() {
  const a = $('#app'); a.classList.add('gzglitch'); setTimeout(() => a.classList.remove('gzglitch'), 420 + Math.random() * 300);
  try { navigator.vibrate && S.gzfear && navigator.vibrate([40, 30, 80]); } catch (e) {}
}
function gzEyes() {
  const w = $('#gzFx .gzeyes'); if (!w) return;
  const n = 2 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) {
    const e = document.createElement('i'); e.style.left = rr(4, 92) + '%'; e.style.top = rr(6, 88) + '%'; e.style.setProperty('--s', rr(.6, 1.8).toFixed(2));
    e.style.animationDelay = (i * .25).toFixed(2) + 's'; w.appendChild(e); setTimeout(() => e.remove(), 3600);
  }
}
function gzWhisper() {
  const me = ls('katia_me', null), n = (me && me.name) || 'sen';
  say(rnd(GZ_LINES)(n), false, 'e');
  const old = document.title; document.title = rnd(GZ_TITLES); setTimeout(() => { document.title = old; }, 5000);
}
function gzBlackout() { const f = $('#gzFx'); f.classList.add('blk'); setTimeout(() => f.classList.remove('blk'), 500 + Math.random() * 500); }
function gzJump() {
  if (document.hidden || S.gzfear === false) return;
  const j = $('#gzJ'); j.classList.add('on');
  try { sting({ f: 80, n: 5, g: .3 }); } catch (e) {}
  try { navigator.vibrate && navigator.vibrate([300, 80, 300, 80, 600]); } catch (e) {}
  setTimeout(() => j.classList.remove('on'), 1700);
}
function gzEvent() {
  if (!gz.on) return;
  const r = Math.random();
  if (S.gzfear === false) { if (r < .5) gzWhisper(); else gzEyes(); }
  else if (r < .22) gzGlitch(); else if (r < .42) gzEyes(); else if (r < .62) gzWhisper(); else if (r < .78) gzBlackout(); else gzJump();
  gz.t = setTimeout(gzEvent, rr(5000, 15000) * (S.hfreq === 'high' ? .55 : S.hfreq === 'low' ? 1.6 : 1));
}
function gzStart() {
  if (gz.on) return; gz.on = true; gzEnsure();
  document.body.classList.add('gzx');
  if (S.gzfear !== false) { gzAudioStart(); gz.hb = setInterval(gzHeart, 1300); }
  gz.t = setTimeout(gzEvent, rr(3500, 7000));
}
function gzStop() {
  if (!gz.on) return; gz.on = false; clearTimeout(gz.t); clearInterval(gz.hb);
  gz.drone.forEach(o => { try { o.stop(); } catch (e) {} }); gz.drone = [];
  if (gz.ac) { try { gz.ac.close(); } catch (e) {} gz.ac = null; }
  document.body.classList.remove('gzx'); const w = $('#gzFx .gzeyes'); if (w) w.innerHTML = '';
  const j = $('#gzJ'); if (j) j.classList.remove('on');
}
const _applyG = window.apply;
window.apply = function () { _applyG.apply(this, arguments); document.body.classList.toggle('gzx', gz.on); };
setInterval(() => {
  if (S.persona === 'gizem' && !gz.on) gzStart();
  else if (S.persona !== 'gizem' && gz.on) gzStop();
  else if (gz.on && S.gzfear !== false && !gz.ac) gzAudioStart();
}, 700);
document.addEventListener('visibilitychange', () => { if (gz.ac) { try { document.hidden ? gz.ac.suspend() : gz.ac.resume(); } catch (e) {} } });

const _rm = window.resumeMic;
if (typeof _rm === 'function') window.resumeMic = function () { if (curGame) return; return _rm.apply(this, arguments); };
apply(); drawHome();
})();
