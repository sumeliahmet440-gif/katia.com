'use strict';
/* LEKO BROS 1-1 — Katia AI için özgün (kendi tasarımımız) platform oyunu.
   Kontroller: ← → / A D yürü · ↑ / W / Boşluk zıpla · mobilde ekrandaki düğmeler.
   Dış dosya yok, tek dosya, ~10 KB. */
window.startLekoBros = function (host, onExit) {
  const W = 320, H = 192, T = 16, COLS = 150, ROWS = 12;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'mcv';
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  host.appendChild(cv);

  /* ---- dokunmatik düğmeler ---- */
  const pad = document.createElement('div'); pad.className = 'mpad';
  pad.innerHTML = '<div><button data-k="left">◀</button><button data-k="right">▶</button></div><div><button data-k="jump" class="mj">ZIPLA</button></div>';
  host.appendChild(pad);

  const keys = { left: false, right: false, jump: false };
  const KM = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump', z: 'jump', Z: 'jump' };
  let state = 'play', raf = 0, last = 0, acc = 0, alive = true;
  const kd = e => {
    const k = KM[e.key];
    if (k) { keys[k] = true; e.preventDefault(); e.stopPropagation(); }
    if ((e.key === 'Enter' || e.key === ' ') && (state === 'over' || state === 'win')) restart(true);
  };
  const ku = e => { const k = KM[e.key]; if (k) { keys[k] = false; e.preventDefault(); e.stopPropagation(); } };
  document.addEventListener('keydown', kd, true); document.addEventListener('keyup', ku, true);
  const pd = e => { const b = e.target.closest('[data-k]'); if (b) { keys[b.dataset.k] = true; e.preventDefault(); sfx(0); } };
  const pu = e => { Object.keys(keys).forEach(k => keys[k] = false); };
  pad.addEventListener('pointerdown', pd); document.addEventListener('pointerup', pu); document.addEventListener('pointercancel', pu);
  cv.addEventListener('pointerdown', () => { if (state === 'over' || state === 'win') restart(true); });

  /* ---- ses (küçük bip'ler) ---- */
  let ac = null;
  function sfx(type) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      const o = ac.createOscillator(), v = ac.createGain(), t = ac.currentTime;
      const P = { 1: [330, 660, .12, 'square'], 2: [880, 1320, .1, 'square'], 3: [300, 90, .25, 'sawtooth'], 4: [200, 120, .08, 'square'], 5: [523, 1046, .5, 'triangle'] }[type];
      if (!P) return;
      o.type = P[3]; o.frequency.setValueAtTime(P[0], t); o.frequency.exponentialRampToValueAtTime(P[1], t + P[2]);
      v.gain.setValueAtTime(.06, t); v.gain.exponentialRampToValueAtTime(.001, t + P[2] + .05);
      o.connect(v); v.connect(ac.destination); o.start(t); o.stop(t + P[2] + .08);
    } catch (e) {}
  }

  /* ---- bölüm ---- */
  let map, enemies, popups, p, cam, score, coins, lives = 3, time, frame;
  function build() {
    map = [...Array(ROWS)].map(() => new Uint8Array(COLS));
    const gaps = [[38, 39], [72, 74], [104, 105], [121, 123]];
    for (let x = 0; x < COLS; x++) { if (gaps.some(([a, b]) => x >= a && x <= b)) continue; map[10][x] = 1; map[11][x] = 1; }
    const put = (x, y, t) => { map[y][x] = t; };
    [16, 20, 22, 24].forEach(x => put(x, 7, 2)); [18, 21, 23].forEach(x => put(x, 7, 3)); put(22, 3 + 1, 3);
    const pipe = (x, h) => { for (let r = 10 - h; r < 10; r++) { put(x, r, 5); put(x + 1, r, 5); } };
    pipe(30, 2); pipe(46, 3); pipe(58, 3); pipe(90, 2); pipe(98, 3);
    for (let x = 50; x <= 55; x++) put(x, 7, 2); put(52, 7, 3); put(53, 7, 3); for (let x = 51; x <= 54; x++) put(x, 3 + 1, 2);
    for (let x = 66; x <= 70; x++) put(x, 6, 2); put(68, 6, 3); put(70, 6, 3);
    for (let x = 76; x <= 78; x++) put(x, 7, 3);
    for (let x = 108; x <= 113; x++) put(x, 7, 2); put(110, 7, 3);
    for (let i = 0; i < 8; i++) for (let r = 9 - i; r < 10; r++) put(128 + i, r, 4);
    for (let i = 0; i < 4; i++) for (let r = 9 - i; r < 10; r++) put(116 + i, r, 4); // küçük merdiven (121-123 boşluğundan önce)
    enemies = [12, 26, 34, 42, 53, 63, 80, 95, 100, 112, 126, 139].filter(x => !(map[10][x] === 0)).map(x => ({ x: x * T, y: 9 * T - 2, w: 12, h: 12, vx: -.45, vy: 0, on: false, alive: true, sq: 0 }));
    popups = []; score = score || 0; coins = coins || 0;
  }
  const FLAGX = 143 * T;
  function reset(full) {
    if (full) { score = 0; coins = 0; lives = 3; }
    build();
    p = { x: 2 * T, y: 9 * T - 4, w: 12, h: 14, vx: 0, vy: 0, on: false, dir: 1, held: false };
    cam = 0; time = 300; frame = 0; state = 'play';
  }
  function restart(full) { reset(full); }

  /* ---- fizik ---- */
  const solidAt = (tx, ty) => tx < 0 || tx >= COLS ? true : (ty < 0 || ty >= ROWS) ? false : map[ty][tx] > 0;
  function move(b) {
    const r = { hitX: false, head: null };
    b.x += b.vx;
    let x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 1) / T), y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 1) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidAt(tx, ty)) {
      if (b.vx > 0) b.x = tx * T - b.w; else if (b.vx < 0) b.x = (tx + 1) * T;
      b.vx = 0; r.hitX = true; x0 = Math.floor(b.x / T); x1 = Math.floor((b.x + b.w - 1) / T);
    }
    b.y += b.vy; b.on = false;
    x0 = Math.floor(b.x / T); x1 = Math.floor((b.x + b.w - 1) / T); y0 = Math.floor(b.y / T); y1 = Math.floor((b.y + b.h - 1) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidAt(tx, ty)) {
      if (b.vy > 0) { b.y = ty * T - b.h; b.on = true; b.vy = 0; }
      else if (b.vy < 0) { b.y = (ty + 1) * T; b.vy = 0; r.head = [tx, ty]; }
      y0 = Math.floor(b.y / T); y1 = Math.floor((b.y + b.h - 1) / T);
    }
    return r;
  }
  function die() { if (state !== 'play') return; state = 'dead'; p.vy = -5; p.dieT = 70; sfx(3); lives--; }
  function bump(tx, ty) {
    if (map[ty][tx] === 3) { map[ty][tx] = 6; coins++; score += 200; popups.push({ x: tx * T + 4, y: ty * T - 4, t: 30 }); sfx(2); }
    else sfx(4);
    enemies.forEach(e => { if (e.alive && Math.abs(e.x + e.w / 2 - (tx * T + 8)) < 12 && Math.abs(e.y + e.h - ty * T) < 3) { e.alive = false; e.sq = 20; score += 100; } });
  }
  function update() {
    frame++;
    if (state === 'dead') { p.vy = Math.min(p.vy + .3, 6); p.y += p.vy; if (--p.dieT <= 0) { if (lives > 0) { const s = score, c = coins; reset(false); score = s; coins = c; } else state = 'over'; } return; }
    if (state !== 'play') return;
    if (frame % 60 === 0 && --time <= 0) { die(); return; }
    const tv = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (tv) p.dir = tv;
    p.vx += (tv * 1.7 - p.vx) * (p.on ? .2 : .1);
    if (Math.abs(p.vx) < .05 && !tv) p.vx = 0;
    if (keys.jump && p.on && !p.held) { p.vy = -5.7; p.held = true; sfx(1); }
    if (!keys.jump) { p.held = false; if (p.vy < -2.4) p.vy = -2.4; }
    p.vy = Math.min(p.vy + .3, 6);
    const r = move(p);
    if (r.head) bump(r.head[0], r.head[1]);
    if (p.y > H + 24) { die(); return; }
    cam = Math.max(0, Math.min(COLS * T - W, p.x - W / 2 + 10));
    for (const e of enemies) {
      if (e.sq) { e.sq--; continue; }
      if (!e.alive) continue;
      if (Math.abs(e.x - p.x) > 400) continue;
      e.vy = Math.min(e.vy + .3, 5); const sx = e.vx; const rr = move(e); if (rr.hitX) e.vx = -sx; else e.vx = sx;
      if (e.y > H + 20) { e.alive = false; continue; }
      if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) {
        if (p.vy > 0 && p.y + p.h - e.y < 10) { e.alive = false; e.sq = 20; p.vy = -3.6; score += 100; sfx(4); popups.push({ x: e.x, y: e.y - 6, t: 24 }); }
        else { die(); return; }
      }
    }
    if (p.x + p.w >= FLAGX) { state = 'win'; score += time * 10; sfx(5); }
  }

  /* ---- çizim ---- */
  function tile(t, x, y, tx, ty) {
    if (t === 1) { g.fillStyle = '#b8601c'; g.fillRect(x, y, T, T); if (!map[ty - 1] || !map[ty - 1][tx]) { g.fillStyle = '#3fae3a'; g.fillRect(x, y, T, 4); g.fillStyle = '#2d8a2a'; g.fillRect(x, y + 4, T, 1); } g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 7, y + 6, 2, 8); g.fillRect(x + 2, y + 10, 4, 2); }
    else if (t === 2) { g.fillStyle = '#c4501b'; g.fillRect(x, y, T, T); g.fillStyle = '#3a1608'; g.fillRect(x, y + 7, T, 1); g.fillRect(x, y + 15, T, 1); g.fillRect(x + 7, y, 1, 7); g.fillRect(x + 3, y + 8, 1, 7); g.fillRect(x + 11, y + 8, 1, 7); }
    else if (t === 3) { const bl = (frame >> 4) & 1; g.fillStyle = bl ? '#ffd23a' : '#f0a800'; g.fillRect(x, y, T, T); g.fillStyle = '#6b3a00'; g.fillRect(x, y, T, 1); g.fillRect(x, y + 15, T, 1); g.fillRect(x, y, 1, T); g.fillRect(x + 15, y, 1, T); g.font = 'bold 12px monospace'; g.fillText('?', x + 4, y + 13); }
    else if (t === 4) { g.fillStyle = '#9aa0a8'; g.fillRect(x, y, T, T); g.fillStyle = '#d6dae0'; g.fillRect(x, y, T, 2); g.fillRect(x, y, 2, T); g.fillStyle = '#4a4f57'; g.fillRect(x, y + 14, T, 2); g.fillRect(x + 14, y, 2, T); }
    else if (t === 5) { const cap = !map[ty - 1] || map[ty - 1][tx] !== 5; g.fillStyle = '#10a53a'; g.fillRect(x, y, T, T); g.fillStyle = '#6fe08a'; g.fillRect(x + 2, y, 3, T); g.fillStyle = '#075a1e'; g.fillRect(x + 13, y, 3, T); if (cap) { g.fillStyle = '#0a7d2b'; g.fillRect(x, y, T, 3); } }
    else if (t === 6) { g.fillStyle = '#7a5a2a'; g.fillRect(x, y, T, T); g.fillStyle = '#4b3515'; g.fillRect(x, y, T, 1); g.fillRect(x, y + 15, T, 1); }
  }
  function deco() {
    g.fillStyle = '#5c94fc'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#3fae3a'; for (let i = -1; i < 8; i++) { const hx = i * 90 - (cam * .3 % 90); g.beginPath(); g.moveTo(hx, 160); g.quadraticCurveTo(hx + 30, 112, hx + 60, 160); g.fill(); }
    g.fillStyle = '#fff'; for (let i = -1; i < 6; i++) { const cx = i * 120 - (cam * .5 % 120) + 20, cy = 26 + (i & 1) * 22; g.beginPath(); g.arc(cx, cy, 10, 0, 7); g.arc(cx + 14, cy + 3, 12, 0, 7); g.arc(cx + 28, cy, 9, 0, 7); g.fill(); }
  }
  function player() {
    const x = Math.round(p.x - cam), y = Math.round(p.y);
    g.save(); g.translate(x + 6, y); g.scale(p.dir, 1); g.translate(-6, 0);
    const run = p.on && Math.abs(p.vx) > .3 ? (frame >> 3) & 1 : 0;
    g.fillStyle = '#2a5bd7'; g.fillRect(2, 0, 8, 3); g.fillRect(6, 2, 6, 2);           // şapka
    g.fillStyle = '#f2c18f'; g.fillRect(2, 3, 9, 5); g.fillStyle = '#111'; g.fillRect(8, 4, 2, 2); // yüz + göz
    g.fillStyle = '#5a3412'; g.fillRect(1, 6, 3, 2);                                    // saç
    g.fillStyle = '#fff'; g.fillRect(1, 8, 10, 3);                                      // gömlek
    g.fillStyle = '#1e3f9a'; g.fillRect(2, 8, 8, 4); g.fillStyle = '#ffd23a'; g.fillRect(3, 9, 1, 1); g.fillRect(8, 9, 1, 1);
    g.fillStyle = '#4a2a10'; if (!p.on) { g.fillRect(0, 12, 5, 2); g.fillRect(7, 11, 5, 3); } else if (run) { g.fillRect(1, 12, 4, 2); g.fillRect(7, 12, 4, 2); } else { g.fillRect(2, 12, 4, 2); g.fillRect(6, 12, 4, 2); }
    g.restore();
  }
  function draw() {
    deco();
    const c0 = Math.floor(cam / T), c1 = c0 + Math.ceil(W / T) + 1;
    for (let ty = 0; ty < ROWS; ty++) for (let tx = c0; tx <= c1 && tx < COLS; tx++) { const t = map[ty][tx]; if (t) tile(t, tx * T - Math.round(cam), ty * T, tx, ty); }
    // bayrak direği
    const fx = FLAGX - Math.round(cam);
    g.fillStyle = '#e8e8e8'; g.fillRect(fx + 6, 3 * T, 3, 7 * T); g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(fx + 7, 3 * T - 2, 4, 0, 7); g.fill();
    g.fillStyle = state === 'win' ? '#22c55e' : '#e11d48'; g.beginPath(); g.moveTo(fx + 9, 3 * T + 2); g.lineTo(fx + 25, 3 * T + 8); g.lineTo(fx + 9, 3 * T + 14); g.fill();
    for (const e of enemies) {
      if (!e.alive && !e.sq) continue;
      const x = Math.round(e.x - cam), y = Math.round(e.y);
      if (x < -20 || x > W + 20) continue;
      if (!e.alive) { g.fillStyle = '#6d28d9'; g.fillRect(x, y + 8, 12, 4); continue; }
      const w = (frame >> 3) & 1;
      g.fillStyle = '#7c3aed'; g.beginPath(); g.arc(x + 6, y + 6, 6, Math.PI, 0); g.fill(); g.fillRect(x, y + 6, 12, 4);
      g.fillStyle = '#fff'; g.fillRect(x + 2, y + 4, 3, 3); g.fillRect(x + 7, y + 4, 3, 3); g.fillStyle = '#111'; g.fillRect(x + 3, y + 5, 1, 2); g.fillRect(x + 8, y + 5, 1, 2);
      g.fillStyle = '#2e1065'; g.fillRect(x + (w ? 0 : 2), y + 10, 4, 2); g.fillRect(x + (w ? 8 : 6), y + 10, 4, 2);
    }
    if (state !== 'dead' || p.dieT > 0) player();
    g.fillStyle = '#fff'; g.font = 'bold 8px monospace';
    popups = popups.filter(q => --q.t > 0); popups.forEach(q => g.fillText('+', q.x - Math.round(cam), q.y - (30 - q.t) * .6));
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, 14);
    g.fillStyle = '#fff'; g.font = 'bold 9px monospace';
    g.fillText('LEKO ' + String(score).padStart(6, '0') + '   ● x' + String(coins).padStart(2, '0') + '   1-1   ♥ ' + Math.max(0, lives) + '   ⏱ ' + Math.max(0, time), 6, 10);
    if (state === 'over' || state === 'win') {
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 60, W, 70); g.fillStyle = '#fff'; g.font = 'bold 16px monospace'; g.textAlign = 'center';
      g.fillText(state === 'win' ? 'BÖLÜM TAMAM!' : 'OYUN BİTTİ', W / 2, 88);
      g.font = 'bold 10px monospace'; g.fillText('Skor: ' + score + '   ·   Tekrar için dokun / Enter', W / 2, 108); g.textAlign = 'left';
    }
  }
  function loop(ts) {
    if (!alive) return;
    if (!last) last = ts; acc += Math.min(100, ts - last); last = ts;
    while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
    draw(); raf = requestAnimationFrame(loop);
  }
  reset(true); raf = requestAnimationFrame(loop);
  return {
    stop() {
      alive = false; cancelAnimationFrame(raf);
      document.removeEventListener('keydown', kd, true); document.removeEventListener('keyup', ku, true);
      document.removeEventListener('pointerup', pu); document.removeEventListener('pointercancel', pu);
      try { ac && ac.close(); } catch (e) {} cv.remove(); pad.remove();
    },
    _state: () => ({ p, state, score, coins, lives, enemies, map }), _keys: keys
  };
};
