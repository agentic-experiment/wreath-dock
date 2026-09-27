(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const PEGS = 5;
  const FLY_TIME = 0.45;

  let W = 0, H = 0, DPR = 1;
  let seaY = 0, pierX = 0, deckY = 0, zoneW = 0;
  let hills = [];

  const G = {
    mode: 'title',
    score: 0,
    best: Number(localStorage.getItem('wreath-dock-best') || 0),
    lives: 3,
    combo: 0,
    wave: 1,
    waveT: 0,
    spawnT: 0,
    ambientT: 0,
    overT: 0,
    banner: 0,
    bannerText: '',
    t: 0,
    shake: 0,
    wreaths: [],
    pegs: [],
    parts: [],
    stars: [],
  };

  let audio = null;

  function beep(freq, dur, type, vol, slide) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, audio.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, audio.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.08, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + dur);
    } catch (e) { /* audio is a nicety, never a failure */ }
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    seaY = H * 0.58;
    pierX = Math.max(110, Math.min(200, W * 0.19));
    deckY = seaY - 26;
    zoneW = Math.max(90, Math.min(150, W * 0.13));

    if (!hills.length) {
      for (let i = 0; i <= 48; i++) hills.push(Math.random());
    }
    if (!G.stars.length) {
      for (let i = 0; i < 90; i++) {
        G.stars.push({ x: Math.random(), y: Math.random() * 0.55, r: rnd(0.4, 1.5), p: rnd(0, 6.3) });
      }
    }
  }

  function pegX(i) { return 20 + i * ((pierX - 40) / (PEGS - 1)); }
  function inZone(x) { return x > pierX + 4 && x < pierX + zoneW; }
  function multiplier() { return 1 + Math.min(4, Math.floor(G.combo / 4)); }

  function resetGame() {
    G.mode = 'playing';
    G.score = 0;
    G.lives = 3;
    G.combo = 0;
    G.wave = 1;
    G.waveT = 0;
    G.spawnT = 0.6;
    G.banner = 1.8;
    G.bannerText = 'TIDE I';
    G.shake = 0;
    G.wreaths.length = 0;
    G.parts.length = 0;
    G.pegs = new Array(PEGS).fill(null);
    for (let i = 0; i < 3; i++) {
      spawn();
      G.wreaths[G.wreaths.length - 1].x = W * (0.46 + i * 0.22) + rnd(0, 50);
    }
    beep(440, 0.18, 'sine', 0.07, 660);
  }

  function gameOver() {
    G.mode = 'over';
    G.overT = 0;
    G.banner = 0;
    if (G.score > G.best) {
      G.best = G.score;
      localStorage.setItem('wreath-dock-best', String(G.best));
    }
    beep(300, 0.5, 'triangle', 0.09, 90);
  }

  function spawn(kind) {
    if (G.wreaths.length > 7) return;
    const thornChance = G.wave < 2 ? 0 : Math.min(0.4, (G.wave - 1) * 0.07);
    const k = kind || (Math.random() < thornChance ? 'thorn' : 'green');
    G.wreaths.push({
      x: W + 40,
      y: seaY + rnd(16, 46),
      r: k === 'thorn' ? rnd(13, 15) : rnd(14, 17),
      kind: k,
      spin: rnd(0, 6.3),
      spinV: rnd(-0.9, 0.9),
      bob: rnd(0, 6.3),
      speed: (W * 0.095) + (G.wave - 1) * (W * 0.01) * rnd(0.9, 1.1),
      state: 'drift',
      fly: null,
    });
  }

  function burst(x, y, n, colors, spread, up) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2);
      const s = rnd(spread * 0.3, spread);
      G.parts.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (up || 0),
        life: rnd(0.4, 1),
        max: 1,
        size: rnd(1.5, 3.5),
        color: colors[(Math.random() * colors.length) | 0],
        g: 220,
      });
    }
  }

  function loseLife(x, y, msg) {
    G.lives--;
    G.combo = 0;
    G.shake = 9;
    burst(x, y, 22, ['#7fd8ff', '#4aa3d8', '#ffffff'], 150, 60);
    beep(160, 0.3, 'sawtooth', 0.06, 60);
    if (msg) { G.bannerText = msg; G.banner = 1.1; }
    if (G.lives <= 0) gameOver();
  }

  function dock(w) {
    let idx = G.pegs.indexOf(null);
    if (idx < 0) {
      G.score += 100;
      G.pegs = new Array(PEGS).fill(null);
      G.bannerText = 'PIER FULL  +100';
      G.banner = 1.6;
      idx = 0;
      beep(520, 0.2, 'sine', 0.07, 1040);
    }
    G.combo++;
    G.score += 10 * multiplier();
    w.state = 'fly';
    w.fly = { p: 0, peg: idx, x0: w.x, y0: w.y, x1: pegX(idx), y1: deckY - 20 };
    burst(w.x, w.y, 14, ['#ffe9a3', '#8ef0bb', '#ffffff'], 90, 40);
    beep(660 + (G.combo % 6) * 60, 0.14, 'sine', 0.06, 990);
  }

  function handlePointer(x, y) {
    if (G.mode === 'title') { resetGame(); return; }
    if (G.mode === 'over') { if (G.overT > 0.7) resetGame(); return; }

    let hit = null, bestD = 1e9;
    for (const w of G.wreaths) {
      if (w.state !== 'drift') continue;
      const d = Math.hypot(w.x - x, w.y - y);
      if (d < w.r + 12 && d < bestD) { bestD = d; hit = w; }
    }
    if (!hit) return;

    if (hit.kind === 'thorn') {
      G.wreaths.splice(G.wreaths.indexOf(hit), 1);
      burst(hit.x, hit.y, 24, ['#b455c8', '#e14b6a', '#5a2b6a'], 130, 30);
      loseLife(hit.x, hit.y, 'THORNS!');
    } else if (inZone(hit.x)) {
      dock(hit);
    } else {
      G.wreaths.splice(G.wreaths.indexOf(hit), 1);
      loseLife(hit.x, hit.y, 'TOO SOON');
    }
  }

  function update(dt) {
    G.t += dt;
    G.shake = Math.max(0, G.shake - dt * 26);
    G.banner = Math.max(0, G.banner - dt);
    if (G.mode === 'over') G.overT += dt;

    const playing = G.mode === 'playing';

    if (playing) {
      G.waveT += dt;
      if (G.waveT >= 16) {
        G.waveT = 0;
        G.wave++;
        G.banner = 1.8;
        G.bannerText = 'TIDE ' + roman(G.wave);
        beep(392, 0.25, 'sine', 0.07, 784);
      }
      G.spawnT -= dt;
      if (G.spawnT <= 0) {
        spawn();
        G.spawnT = Math.max(0.5, 1.35 - (G.wave - 1) * 0.09) * rnd(0.8, 1.25);
      }
    } else {
      G.ambientT -= dt;
      if (G.ambientT <= 0) {
        spawn('green');
        G.ambientT = rnd(2.2, 4);
      }
    }

    for (let i = G.wreaths.length - 1; i >= 0; i--) {
      const w = G.wreaths[i];
      w.spin += w.spinV * dt;

      if (w.state === 'fly') {
        w.fly.p = Math.min(1, w.fly.p + dt / FLY_TIME);
        const p = w.fly.p;
        const e = 1 - Math.pow(1 - p, 3);
        const cx = (w.fly.x0 + w.fly.x1) / 2;
        const cy = Math.min(w.fly.y0, w.fly.y1) - 70;
        const inv = 1 - e;
        w.x = inv * inv * w.fly.x0 + 2 * inv * e * cx + e * e * w.fly.x1;
        w.y = inv * inv * w.fly.y0 + 2 * inv * e * cy + e * e * w.fly.y1;
        w.r = 14 + (11 - 14) * e;
        if (p >= 1) {
          G.pegs[w.fly.peg] = true;
          burst(w.x, w.y, 16, ['#ffe9a3', '#8ef0bb'], 70, 30);
          G.wreaths.splice(i, 1);
        }
        continue;
      }

      w.x -= w.speed * dt;
      w.y += Math.sin(G.t * 2 + w.bob) * 7 * dt;

      if (w.x < pierX - w.r * 0.4) {
        G.wreaths.splice(i, 1);
        if (playing) {
          if (w.kind === 'green') loseLife(pierX, w.y, 'WASHED AWAY');
        }
      }
    }

    for (let i = G.parts.length - 1; i >= 0; i--) {
      const p = G.parts[i];
      p.life -= dt;
      if (p.life <= 0) { G.parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
    }
  }

  function roman(n) {
    const map = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return map[n - 1] || String(n);
  }

  // ---------- drawing ----------

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, seaY + 10);
    g.addColorStop(0, '#050715');
    g.addColorStop(0.5, '#161534');
    g.addColorStop(0.82, '#33244a');
    g.addColorStop(1, '#5a3757');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, seaY + 12);

    for (const s of G.stars) {
      const tw = 0.55 + 0.45 * Math.sin(G.t * 1.7 + s.p);
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#dfe7ff';
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const mx = W * 0.74, my = H * 0.19, mr = Math.max(24, Math.min(40, W * 0.032));
    const glow = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 5);
    glow.addColorStop(0, 'rgba(255,244,214,0.35)');
    glow.addColorStop(0.35, 'rgba(255,236,190,0.10)');
    glow.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff7e2';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(214,199,170,0.55)';
    ctx.beginPath();
    ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, Math.PI * 2);
    ctx.arc(mx + mr * 0.25, my + mr * 0.3, mr * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  function hillPath(baseY, amp, seed) {
    ctx.beginPath();
    ctx.moveTo(-10, baseY);
    for (let i = 0; i <= 48; i++) {
      const x = (i / 48) * (W + 20) - 10;
      const h = hills[i];
      const y = baseY - (Math.sin(i * 0.6 + seed) * 0.4 + h * 0.6) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 10, seaY + 20);
    ctx.lineTo(-10, seaY + 20);
    ctx.closePath();
  }

  function drawHills() {
    ctx.fillStyle = '#100d24';
    hillPath(seaY - 40, 46, 1.3);
    ctx.fill();
    ctx.fillStyle = '#0a0819';
    hillPath(seaY - 12, 30, 4.1);
    ctx.fill();
  }

  function drawSea() {
    const g = ctx.createLinearGradient(0, seaY, 0, H);
    g.addColorStop(0, '#12344d');
    g.addColorStop(0.4, '#0a1f30');
    g.addColorStop(1, '#040d16');
    ctx.fillStyle = g;
    ctx.fillRect(0, seaY, W, H - seaY);

    const mx = W * 0.74;
    const glint = ctx.createLinearGradient(mx - 90, 0, mx + 90, 0);
    glint.addColorStop(0, 'rgba(255,244,214,0)');
    glint.addColorStop(0.5, 'rgba(255,244,214,0.18)');
    glint.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = glint;
    ctx.fillRect(mx - 90, seaY, 180, H - seaY);

    for (let k = 0; k < 5; k++) {
      const y0 = seaY + 8 + k * ((H - seaY - 20) / 5);
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 14) {
        const y = y0 + Math.sin(x * 0.014 + G.t * (0.8 + k * 0.22) + k) * (4 + k * 2);
        if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(150,220,255,${0.16 - k * 0.024})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    for (let i = 0; i < 14; i++) {
      const x = ((i * 173 + G.t * 26 * (1 + (i % 3))) % (W + 120)) - 60;
      const y = seaY + 20 + ((i * 97) % Math.max(30, H - seaY - 40));
      ctx.globalAlpha = 0.10 + 0.08 * Math.sin(G.t * 2 + i);
      ctx.fillStyle = '#bfe9ff';
      ctx.fillRect(x, y, 26, 1.2);
    }
    ctx.globalAlpha = 1;
  }

  function drawPier() {
    const deckH = 18;
    const grad = ctx.createLinearGradient(0, deckY, 0, deckY + deckH + 60);
    grad.addColorStop(0, '#6b462a');
    grad.addColorStop(1, '#301d11');
    ctx.fillStyle = grad;
    for (const sx of [16, 76, pierX - 40]) {
      ctx.fillRect(sx, deckY + 4, 10, 74);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(sx + 7, deckY + 4, 3, 74);
      ctx.fillStyle = grad;
    }

    const dg = ctx.createLinearGradient(0, deckY, 0, deckY + deckH);
    dg.addColorStop(0, '#7d5533');
    dg.addColorStop(0.5, '#5b3b23');
    dg.addColorStop(1, '#3b2616');
    ctx.fillStyle = dg;
    ctx.fillRect(0, deckY, pierX, deckH);
    ctx.fillStyle = 'rgba(255,220,170,0.16)';
    ctx.fillRect(0, deckY, pierX, 2);
    ctx.strokeStyle = 'rgba(20,10,5,0.5)';
    ctx.lineWidth = 1;
    for (let x = 18; x < pierX; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, deckY + 1);
      ctx.lineTo(x, deckY + deckH - 1);
      ctx.stroke();
    }

    for (let i = 0; i < PEGS; i++) {
      const x = pegX(i);
      const filled = G.pegs[i];
      ctx.fillStyle = filled ? '#8a5f36' : '#66432a';
      rr(x - 3.5, deckY - 17, 7, 18, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,230,180,0.35)';
      ctx.fillRect(x - 3.5, deckY - 17, 2, 16);
      if (filled) drawWreath(x, deckY - 20, 11, 'green', 0, 0.95);
    }

    const lx = pierX - 6, ly = deckY - 52;
    const bx = pierX + zoneW;
    ctx.strokeStyle = '#3a2716';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx, deckY);
    ctx.lineTo(lx, ly + 8);
    ctx.stroke();

    const beam = ctx.createLinearGradient(lx, ly, bx, seaY + 30);
    beam.addColorStop(0, 'rgba(255,216,134,0.34)');
    beam.addColorStop(0.55, 'rgba(255,216,134,0.13)');
    beam.addColorStop(1, 'rgba(255,216,134,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(lx - 7, ly - 5);
    ctx.lineTo(bx, seaY - 8);
    ctx.lineTo(bx, seaY + 94);
    ctx.lineTo(lx + 7, ly + 9);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.translate(pierX + zoneW * 0.55, seaY + 34);
    ctx.scale(1, 0.42);
    const pool = ctx.createRadialGradient(0, 0, 4, 0, 0, zoneW * 0.78);
    pool.addColorStop(0, 'rgba(255,226,164,0.32)');
    pool.addColorStop(0.55, 'rgba(255,226,164,0.13)');
    pool.addColorStop(1, 'rgba(255,226,164,0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(0, 0, zoneW * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const pulse = 0.72 + 0.28 * Math.sin(G.t * 3);
    const lg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 26);
    lg.addColorStop(0, `rgba(255,246,214,${0.95 * pulse})`);
    lg.addColorStop(0.4, `rgba(255,208,120,${0.55 * pulse})`);
    lg.addColorStop(1, 'rgba(255,208,120,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(lx, ly, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff4d2';
    rr(lx - 5, ly - 7, 10, 14, 3);
    ctx.fill();

    ctx.setLineDash([7, 9]);
    ctx.lineDashOffset = -G.t * 26;
    ctx.strokeStyle = `rgba(255,214,130,${0.5 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pierX + zoneW, seaY - 8);
    ctx.lineTo(pierX + zoneW, seaY + 94);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawWreath(x, y, r, kind, spin, alpha) {
    const green = kind === 'green';
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(x, y);
    ctx.rotate(spin);

    const glowC = green ? 'rgba(140,255,190,0.30)' : 'rgba(225,80,120,0.28)';
    const glow = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.1);
    glow.addColorStop(0, glowC);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.1, 0, Math.PI * 2);
    ctx.fill();

    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(0, -r * 0.82);
      ctx.rotate(0.6);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.46, r * 0.21, 0, 0, Math.PI * 2);
      if (green) {
        ctx.fillStyle = i % 2 ? '#4fbf7f' : '#2f9a63';
      } else {
        ctx.fillStyle = i % 2 ? '#5c2f6b' : '#3a1f4a';
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    ctx.strokeStyle = green ? '#1d6b45' : '#2a1436';
    ctx.lineWidth = 3;
    ctx.stroke();

    if (green) {
      ctx.fillStyle = '#ffe9a3';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = '#e14b6a';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
        ctx.lineTo(Math.cos(a) * (r * 1.22), Math.sin(a) * (r * 1.22));
        ctx.stroke();
      }
      ctx.fillStyle = '#ff9db1';
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWreaths() {
    for (const w of G.wreaths) {
      if (w.state === 'drift') {
        const bob = Math.sin(G.t * 2 + w.bob) * 3;
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = w.kind === 'green' ? '#6fe0a8' : '#d06a90';
        ctx.beginPath();
        ctx.ellipse(w.x, w.y + 16 + bob, w.r * 1.1, w.r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        drawWreath(w.x, w.y + bob, w.r, w.kind, w.spin, 1);
      } else {
        drawWreath(w.x, w.y, w.r, w.kind, w.spin, 1);
      }
    }
  }

  function drawParts() {
    for (const p of G.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function text(str, x, y, size, color, align, glow) {
    ctx.font = `${size}px Georgia, serif`;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  function drawHUD() {
    text(String(G.score).padStart(4, '0'), 20, 44, 30, '#ffe9a3', 'left', 'rgba(255,220,140,0.7)');
    if (G.combo > 1) {
      text('x' + multiplier(), 22, 70, 17, '#8ef0bb', 'left', 'rgba(120,255,190,0.6)');
    }
    if (G.best > 0) text('best ' + G.best, 20, G.combo > 1 ? 92 : 68, 13, 'rgba(230,235,255,0.6)');

    for (let i = 0; i < 3; i++) {
      const x = W - 26 - i * 26, y = 32;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      if (i < G.lives) {
        ctx.strokeStyle = '#8ef0bb';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = 'rgba(120,255,190,0.7)';
        ctx.shadowBlur = 10;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    text('TIDE ' + roman(G.wave), W - 20, 62, 14, 'rgba(230,235,255,0.65)', 'right');

    if (G.banner > 0) {
      const a = Math.min(1, G.banner * 1.6);
      ctx.globalAlpha = a;
      text(G.bannerText, W / 2, H * 0.34, 34, '#ffe9a3', 'center', 'rgba(255,220,140,0.8)');
      ctx.globalAlpha = 1;
    }
  }

  function drawOverlay() {
    if (G.mode === 'title') {
      ctx.fillStyle = 'rgba(4,7,18,0.45)';
      ctx.fillRect(0, 0, W, H);
      const cx = W / 2;
      text('WREATH DOCK', cx, H * 0.36, Math.min(76, W * 0.1), '#f4efe4', 'center', 'rgba(255,235,180,0.75)');
      text('green wreaths: click inside the lantern light', cx, H * 0.46, 17, '#8ef0bb', 'center');
      text('thorn wreaths: never click them', cx, H * 0.46 + 26, 17, '#e14b6a', 'center');
      const pulse = 0.55 + 0.45 * Math.sin(G.t * 3);
      ctx.globalAlpha = pulse;
      text('click to begin', cx, H * 0.62, 22, '#ffe9a3', 'center', 'rgba(255,220,140,0.7)');
      ctx.globalAlpha = 1;
      if (G.best > 0) text('best ' + G.best, cx, H * 0.62 + 34, 14, 'rgba(230,235,255,0.6)', 'center');
    } else if (G.mode === 'over') {
      ctx.fillStyle = 'rgba(4,7,18,0.62)';
      ctx.fillRect(0, 0, W, H);
      const cx = W / 2;
      text('THE TIDE TOOK THEM', cx, H * 0.4, Math.min(52, W * 0.075), '#f4efe4', 'center', 'rgba(255,235,180,0.6)');
      text('score ' + G.score + (G.score >= G.best && G.score > 0 ? '   NEW BEST' : ''), cx, H * 0.5, 26, '#ffe9a3', 'center');
      text('best ' + G.best, cx, H * 0.5 + 32, 15, 'rgba(230,235,255,0.65)', 'center');
      if (G.overT > 0.7) {
        const pulse = 0.55 + 0.45 * Math.sin(G.t * 3);
        ctx.globalAlpha = pulse;
        text('click to sail again', cx, H * 0.64, 20, '#8ef0bb', 'center');
        ctx.globalAlpha = 1;
      }
    }
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const s = G.shake;
    ctx.save();
    if (s > 0) ctx.translate(rnd(-s, s), rnd(-s, s));

    drawSky();
    drawHills();
    drawSea();
    drawPier();
    drawWreaths();
    drawParts();

    const vig = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.3, W / 2, H * 0.48, Math.max(W, H) * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(2,3,10,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    if (G.mode !== 'title') drawHUD();
    if (G.mode !== 'playing') drawOverlay();

    ctx.restore();
  }

  // ---------- loop ----------

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function pointer(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    handlePointer(cx, cy);
  }

  canvas.addEventListener('pointerdown', pointer);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (G.mode === 'title' || (G.mode === 'over' && G.overT > 0.7)) resetGame();
    }
  });
  window.addEventListener('resize', layout);

  layout();
  G.pegs = new Array(PEGS).fill(null);
  window.__wd = G;
  requestAnimationFrame(frame);
})();
