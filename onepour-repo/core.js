/* One Pour — deterministic game engine.
 * Pure logic, no DOM. Works in browsers (window.OnePourCore) and Node (module.exports).
 */
(function (root) {
  'use strict';

  const W = 96;            // grid width (cells)
  const H = 150;           // grid height (cells)
  const EMPTY = 0, WALL = 1; // sand cells are 2..9 (8 shades)
  const STEPS_PER_SEC = 120;
  const SPOUT_Y = 2;
  const SETTLE_QUIET_STEPS = 24;
  const MAX_SETTLE_STEPS = 2400;
  const MAX_TRY_STEPS = 120 * 180; // 3 minutes hard cap

  // Puzzle #1 is Monday 2026-11-16.
  const EPOCH_UTC = Date.UTC(2026, 10, 16);

  // ---------- small utils ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) { // local calendar date of the player
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function keyToUTC(key) {
    const p = key.split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  }
  function puzzleNumber(key) { return Math.round((keyToUTC(key) - EPOCH_UTC) / 86400000) + 1; }
  function weekdayIndex(key) { // 0 = Monday … 6 = Sunday
    return (new Date(keyToUTC(key)).getUTCDay() + 6) % 7;
  }
  function addDays(key, n) {
    const d = new Date(keyToUTC(key) + n * 86400000);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  function isValidKey(key) { return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key); }

  // ---------- difficulty table (Mon..Sun) ----------
  const DIFF = [
    { name: 'Monday',    k: [1, 1], defl: 0, speed: 0.30, wMin: 44, wMax: 56, hMin: 46, hMax: 58, f: [0.40, 0.62] },
    { name: 'Tuesday',   k: [2, 2], defl: 0, speed: 0.32, wMin: 50, wMax: 64, hMin: 48, hMax: 60, f: [0.40, 0.70] },
    { name: 'Wednesday', k: [2, 2], defl: 0, speed: 0.38, wMin: 54, wMax: 68, hMin: 50, hMax: 62, f: [0.25, 0.78] },
    { name: 'Thursday',  k: [3, 3], defl: 1, speed: 0.40, wMin: 60, wMax: 74, hMin: 50, hMax: 64, f: [0.30, 0.75] },
    { name: 'Friday',    k: [3, 3], defl: 1, speed: 0.48, wMin: 60, wMax: 76, hMin: 52, hMax: 66, f: [0.25, 0.80] },
    { name: 'Saturday',  k: [4, 4], defl: 2, speed: 0.52, wMin: 66, wMax: 80, hMin: 52, hMax: 66, f: [0.25, 0.80] },
    { name: 'Sunday',    k: [2, 2], defl: 1, speed: 0.36, wMin: 62, wMax: 76, hMin: 46, hMax: 58, f: [0.35, 0.70] },
  ];

  // ---------- seasons / palettes ----------
  const SEASONS = [
    { name: 'Winter Glass', hue: [195, 230] }, // Jan
    { name: 'Rose Dunes', hue: [330, 360] },   // Feb
    { name: 'Spring Clay', hue: [80, 120] },   // Mar
    { name: 'Tulip Fields', hue: [340, 380] }, // Apr
    { name: 'Aegean', hue: [180, 215] },       // May
    { name: 'Saffron', hue: [35, 55] },        // Jun
    { name: 'Coral Reef', hue: [5, 25] },      // Jul
    { name: 'Desert Gold', hue: [30, 48] },    // Aug
    { name: 'Olive Harvest', hue: [60, 95] },  // Sep
    { name: 'Copper Leaves', hue: [15, 35] },  // Oct
    { name: 'Desert Dunes', hue: [25, 45] },   // Nov
    { name: 'Snow Globe', hue: [200, 250] },   // Dec
  ];
  const RARE_COLOURS = [
    { name: 'Lapis', hue: 225 }, { name: 'Malachite', hue: 150 }, { name: 'Amethyst', hue: 275 },
    { name: 'Carnelian', hue: 8 }, { name: 'Turquoise', hue: 178 }, { name: 'Saffron', hue: 45 },
    { name: 'Rose Quartz', hue: 340 }, { name: 'Obsidian', hue: 250, dark: true },
  ];
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    const f = (n) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
  }
  function makePalette(rng, hueRange) {
    const h1 = hueRange[0] + rng() * (hueRange[1] - hueRange[0]);
    const h2 = h1 + 8 + rng() * 26; // stay within the season's mood
    const out = [];
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const h = h1 + (h2 - h1) * t;
      const l = 0.70 - 0.32 * t + (i % 2 ? 0.05 : 0);
      out.push(hslToRgb(h, 0.55 + 0.15 * (i % 2), l));
    }
    return out;
  }
  function rarePalette(idx) {
    const r = RARE_COLOURS[idx % RARE_COLOURS.length];
    const out = [];
    for (let i = 0; i < 8; i++) {
      const l = r.dark ? 0.18 + 0.05 * (i % 4) : 0.72 - 0.05 * i;
      out.push(hslToRgb(r.hue + i * 3, 0.6, l));
    }
    return out;
  }

  // ---------- level generation ----------
  function randInt(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

  function generateLevel(seedKey, opts) {
    opts = opts || {};
    const rng = mulberry32(hashStr('onepour:v1:' + seedKey));
    const wd = opts.weekday != null ? opts.weekday : (isValidKey(seedKey) ? weekdayIndex(seedKey) : randInt(rng, 0, 6));
    const D = DIFF[wd];
    const grid = new Uint8Array(W * H);
    const target = new Uint8Array(W * H);
    const set = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) grid[y * W + x] = v; };

    for (let x = 0; x < W; x++) grid[(H - 1) * W + x] = WALL; // ground

    const floorY = H - 10;                       // lowest interior row
    const width = randInt(rng, D.wMin, D.wMax);
    let cx0 = Math.floor((W - width) / 2) + randInt(rng, -3, 3);
    cx0 = Math.max(5, Math.min(W - 5 - width, cx0));
    const cx1 = cx0 + width - 1;
    const rimY = floorY - randInt(rng, D.hMin, D.hMax);

    // outer walls (2 thick) and floor (2 thick)
    for (let y = rimY; y <= floorY + 2; y++) {
      set(cx0 - 2, y, WALL); set(cx0 - 1, y, WALL); set(cx1 + 1, y, WALL); set(cx1 + 2, y, WALL);
    }
    for (let x = cx0 - 2; x <= cx1 + 2; x++) { set(x, floorY + 1, WALL); set(x, floorY + 2, WALL); }

    // chambers
    const k = randInt(rng, D.k[0], D.k[1]);
    const innerW = width - 2 * (k - 1); // minus dividers
    const weights = [];
    for (let i = 0; i < k; i++) weights.push(0.7 + rng() * 0.6);
    const wsum = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => Math.max(10, Math.floor((innerW * w) / wsum)));
    let rem = innerW - widths.reduce((a, b) => a + b, 0);
    widths[widths.length - 1] += rem;

    const chambers = [];
    const dividerTops = []; // y of top of divider between chamber i and i+1
    let x = cx0;
    for (let i = 0; i < k; i++) {
      const a = x, b = x + widths[i] - 1;
      chambers.push({ a, b });
      x = b + 1;
      if (i < k - 1) {
        const top = rimY + randInt(rng, 6, Math.max(8, Math.floor((floorY - rimY) * 0.45)));
        for (let y = top; y <= floorY; y++) { set(x, y, WALL); set(x + 1, y, WALL); }
        dividerTops.push(top);
        x += 2;
      }
    }

    let targetCount = 0;
    chambers.forEach((c, i) => {
      const tL = i === 0 ? rimY : dividerTops[i - 1];
      const tR = i === k - 1 ? rimY : dividerTops[i];
      const limitTop = Math.max(tL, tR); // lower edge (larger y) of the two
      const avail = floorY - limitTop - 4;
      const f = D.f[0] + rng() * (D.f[1] - D.f[0]);
      const fillH = Math.max(5, Math.round(avail * f));
      c.fillTop = floorY - fillH + 1;
      c.count = 0;
      for (let y = c.fillTop; y <= floorY; y++) for (let xx = c.a; xx <= c.b; xx++) {
        target[y * W + xx] = 1; c.count++;
      }
      targetCount += c.count;
    });

    // deflector ledges (2-cell-thick diagonals) above the jar
    const deflectors = [];
    for (let d = 0; d < D.defl; d++) {
      const len = randInt(rng, 6, 10);
      const dir = rng() < 0.5 ? 1 : -1;
      const yTop = randInt(rng, 22, Math.max(24, rimY - 16));
      const xStart = randInt(rng, cx0 + 4, cx1 - 4 - len);
      for (let i = 0; i < len; i++) {
        const xx = dir > 0 ? xStart + i : xStart + len - 1 - i;
        set(xx, yTop + i, WALL); set(xx + 1, yTop + i, WALL);
      }
      deflectors.push({ x: xStart, y: yTop, len, dir });
    }

    const xmin = Math.max(3, cx0 - 4), xmax = Math.min(W - 4, cx1 + 4);
    const speed = D.speed * (opts.speedScale || 1);
    const phase = rng() * 2 * (xmax - xmin);
    const budget = Math.round(targetCount * 1.6) + 40; // generous: over-pouring is possible and costs points

    const month = isValidKey(seedKey) ? Number(seedKey.split('-')[1]) - 1 : randInt(rng, 0, 11);
    const season = SEASONS[month];
    const palette = makePalette(rng, season.hue);

    return {
      seedKey, weekday: wd, dayName: D.name, grid, target, targetCount, chambers, dividerTops,
      deflectors, floorY, rimY, cx0, cx1, spout: { xmin, xmax, speed, phase }, budget,
      palette, season: season.name,
      number: isValidKey(seedKey) ? puzzleNumber(seedKey) : 0,
    };
  }

  function spoutXAt(level, step) {
    const s = level.spout, L = s.xmax - s.xmin;
    let p = (step * s.speed + s.phase) % (2 * L);
    return p < L ? s.xmin + p : s.xmax - (p - L);
  }

  // ---------- simulation ----------
  function Sim(level) {
    this.level = level;
    this.g = level.grid.slice();
    this.stamp = new Uint32Array(W * H);
    this.step = 0;
    this.emitted = 0;
    this.holding = false;
    this.events = [];      // steps at which hold toggled (first toggle = press)
    this.finishStep = -1;  // step at which the player tapped Settle (or budget ran out)
    this.quiet = 0;
    this.settled = false;
    this.lastMoves = 0;
  }
  Sim.prototype.spoutX = function () { return spoutXAt(this.level, this.step); };
  Sim.prototype.setHold = function (h) {
    if (this.finishStep >= 0) h = false;
    if (h !== this.holding) { this.holding = h; this.events.push(this.step); }
  };
  Sim.prototype.finish = function () {
    if (this.finishStep < 0) {
      if (this.holding) { this.holding = false; this.events.push(this.step); }
      this.finishStep = this.step;
    }
  };
  Sim.prototype.budgetLeft = function () { return this.level.budget - this.emitted; };
  Sim.prototype.tick = function () {
    const g = this.g, stamp = this.stamp, lv = this.level;
    const s = ++this.step;
    // emission
    if (this.holding && this.emitted < lv.budget) {
      const sx = Math.round(spoutXAt(lv, s));
      for (let o = -1; o <= 1; o++) {
        if (this.emitted >= lv.budget) break;
        const idx = SPOUT_Y * W + sx + o;
        if (g[idx] === EMPTY) {
          g[idx] = 2 + Math.min(7, Math.floor((this.emitted * 8) / lv.budget));
          stamp[idx] = s; this.emitted++;
        }
      }
      if (this.emitted >= lv.budget) this.finish();
    }
    // physics: bottom-up, alternating sweep direction
    let moves = 0;
    const ltr = (s & 1) === 0;
    for (let y = H - 2; y >= 0; y--) {
      const row = y * W;
      for (let i = 0; i < W; i++) {
        const x = ltr ? i : W - 1 - i;
        const idx = row + x;
        const c = g[idx];
        if (c < 2 || stamp[idx] === s) continue;
        const b = idx + W;
        if (g[b] === EMPTY) { g[b] = c; g[idx] = EMPTY; stamp[b] = s; moves++; continue; }
        let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1103515245);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        const first = ((h >>> 16) & 1) ? 1 : -1;
        for (let t = 0; t < 2; t++) {
          const d = t === 0 ? first : -first;
          const nx = x + d;
          if (nx < 0 || nx >= W) continue;
          if (g[idx + d] === EMPTY && g[b + d] === EMPTY) {
            g[b + d] = c; g[idx] = EMPTY; stamp[b + d] = s; moves++; break;
          }
        }
      }
    }
    this.lastMoves = moves;
    if (this.finishStep >= 0) {
      this.quiet = moves === 0 ? this.quiet + 1 : 0;
      if (this.quiet >= SETTLE_QUIET_STEPS || s - this.finishStep > MAX_SETTLE_STEPS) this.settled = true;
    }
    if (s >= MAX_TRY_STEPS && this.finishStep < 0) this.finish();
    return moves;
  };

  function scoreGrid(level, g) {
    const t = level.target;
    let sand = 0, inter = 0;
    for (let i = 0; i < g.length; i++) {
      if (g[i] >= 2) { sand++; if (t[i]) inter++; }
    }
    const union = sand + level.targetCount - inter;
    const score = union === 0 ? 0 : Math.round((1000 * inter) / union) / 10;
    return { score, sand, inter, union };
  }

  function gridHash(g) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < g.length; i++) { h ^= g[i]; h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  // Replays a recorded try. Returns the final sim (settled).
  function replay(level, rec, onStep) {
    const sim = new Sim(level);
    const ev = rec.events || [];
    let k = 0;
    while (!sim.settled) {
      while (k < ev.length && ev[k] === sim.step) { sim.setHold(!sim.holding); k++; }
      if (rec.finishStep >= 0 && sim.step === rec.finishStep) sim.finish();
      sim.tick();
      if (onStep) onStep(sim);
      if (sim.step > MAX_TRY_STEPS + MAX_SETTLE_STEPS + 10) break;
    }
    return sim;
  }

  // ---------- ghost / share codes ----------
  function b64urlEncode(str) {
    const b = typeof btoa === 'function' ? btoa(str) : Buffer.from(str, 'binary').toString('base64');
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
  }
  function encodeCode(key, rec, score) {
    const ev = rec.events || [];
    const deltas = ev.map((v, i) => (i === 0 ? v : v - ev[i - 1]));
    const payload = ['1', key, Math.round(score * 10), rec.finishStep, deltas.join('.')].join('~');
    return b64urlEncode(payload);
  }
  function decodeCode(code) {
    try {
      const parts = b64urlDecode(String(code).trim()).split('~');
      if (parts[0] !== '1' || !isValidKey(parts[1])) return null;
      const deltas = parts[4] ? parts[4].split('.').map(Number) : [];
      if (deltas.some((d) => !Number.isFinite(d) || d < 0)) return null;
      const events = [];
      deltas.forEach((d, i) => events.push(i === 0 ? d : events[i - 1] + d));
      const finishStep = Number(parts[3]);
      if (!Number.isFinite(finishStep)) return null;
      return { key: parts[1], score: Number(parts[2]) / 10, rec: { events, finishStep } };
    } catch (e) { return null; }
  }

  // ---------- reference bot (used for tests and difficulty checks) ----------
  function botPlay(level, opts) {
    opts = opts || {};
    const margin = opts.margin != null ? opts.margin : 2;
    const fillRatio = opts.fillRatio != null ? opts.fillRatio : 0.985;
    const sim = new Sim(level);
    const ch = level.chambers;
    const counts = new Array(ch.length).fill(0);
    const recount = () => {
      for (let i = 0; i < ch.length; i++) {
        let n = 0;
        for (let y = 0; y <= level.floorY; y++) {
          const row = y * W;
          for (let x = ch[i].a; x <= ch[i].b; x++) if (sim.g[row + x] >= 2) n++;
        }
        counts[i] = n;
      }
    };
    while (!sim.settled) {
      if (sim.finishStep < 0) {
        if (sim.step % 6 === 0) recount();
        const sx = spoutXAt(level, sim.step + 1);
        let want = false, allDone = true;
        for (let i = 0; i < ch.length; i++) {
          const need = counts[i] < ch[i].count * fillRatio;
          if (need) allDone = false;
          if (need && sx >= ch[i].a + margin && sx <= ch[i].b - margin) want = true;
        }
        if (allDone) sim.finish(); else sim.setHold(want);
      }
      sim.tick();
      if (sim.step > MAX_TRY_STEPS + MAX_SETTLE_STEPS) break;
    }
    const res = scoreGrid(level, sim.g);
    return { score: res.score, rec: { events: sim.events.slice(), finishStep: sim.finishStep }, sim };
  }

  const api = {
    W, H, EMPTY, WALL, STEPS_PER_SEC, DIFF, SEASONS, RARE_COLOURS,
    mulberry32, hashStr, dateKey, puzzleNumber, weekdayIndex, addDays, isValidKey,
    generateLevel, spoutXAt, Sim, scoreGrid, gridHash, replay, encodeCode, decodeCode,
    botPlay, rarePalette,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OnePourCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
