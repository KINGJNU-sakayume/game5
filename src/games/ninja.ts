// 4. 닌자 수련 — 날아오는 통나무를 박자에 맞춰 플릭해서 베기
import type { ChartBuilder, Cue } from '../core/chart';
import type { Frame, GameDef, Scene, SceneCtx } from '../core/game';
import { OUT, Particles, circle, dizzyEye, ellipse, happyEye, line, limb, poly, rrect, star, sweat, vgrad, type G } from '../core/gfx';
import { WIN_BARELY, type Rank } from '../core/judge';
import { bounce, frac, hash01, lerp } from '../core/util';
import { epilogueFrame, pattern } from './common';

const ID = 'ninja';
const BPM = 126;
const STAGE_K = 1.25;
type Kind = 'log' | 'bell';

function launch(b: ChartBuilder, beat: number, kind: Kind, side: number) {
  if (kind === 'bell') {
    b.sfx(beat, 'dong', 0.9);
    b.cue(beat + 2, 'flick', 'bell', { launchBeat: beat, side: 0 }, { cat: 'bell', weight: 1.5 });
  } else {
    b.sfx(beat, 'tock', 1, 0, side * 0.4);
    b.cue(beat + 1, 'flick', 'log', { launchBeat: beat, side }, { cat: 'log' });
  }
}

let sideCounter = 0;
function place(b: ChartBuilder, start: number, str: string) {
  pattern(b, start, 0.5, str, (ch, beat) => {
    if (ch === 'l') launch(b, beat, 'log', (sideCounter++ % 2) * 2 - 1);
    else if (ch === 'p') {
      launch(b, beat, 'log', -1);
      b.cues[b.cues.length - 1].cat = 'pair';
      launch(b, beat + 0.5, 'log', 1);
      b.cues[b.cues.length - 1].cat = 'pair';
    } else if (ch === 'b') launch(b, beat, 'bell', 0);
  });
}

const CHART: string[] = [
  // A (2~9)
  'l...l...', 'l...l...', 'l...l...', 'l.l.l...', 'l...l...', 'l...l...', 'l...l.l.', 'l.......',
  // B (10~17) 두 개씩
  'p...l...', 'l...l...', 'p...l...', 'l...p...', 'p...p...', 'l...l...', 'p...l...', 'l.l.l...',
  // C (18~25) 큰 종
  'b.......', 'l...l...', 'b...l...', 'p...l...', 'b.......', 'l.l.l...', 'b...l...', 'p.......',
  // D (26~33)
  'l...p...', 'b...l...', 'p...p...', 'l.l.l...', 'b...p...', 'l...l...', 'p...l...', 'l.l.l...',
  // 엔딩 (34)
  'b.......',
];

const MEL_A = [
  'D5 . F5 G5 A5 - G5 .', 'F5 . D5 . C5 - . .', 'D5 . F5 G5 A5 . C6 .', 'A5 - G5 . F5 - . .',
  'D5 . F5 G5 A5 - C6 .', 'D6 - C6 . A5 - G5 .', 'F5 . G5 . A5 . F5 .', 'D5 - - - . . . .',
].join(' ');
const MEL_B = [
  'A5 - C6 . A5 . G5 .', 'G5 - F5 . D5 . . .', 'F5 . G5 . A5 . D6 .', 'C6 - A5 . G5 . E5 .',
  'D5 . F5 . G5 . A5 .', 'G5 . F5 . D5 . C5 .', 'D5 - - - A4 . C5 .', 'D5 - - - . . . .',
].join(' ');
const PROG_A = 'Dm C Bb C Dm C Bb C';
const PROG_B = 'F C Dm Am Bb C Dm Dm';

function beat(b: ChartBuilder, bar: number, bars: number, heavy = false) {
  for (let i = 0; i < bars; i++) {
    const s = b.bar(bar + i);
    b.drums(s, 0.5, { tk: heavy ? 'x..xx.x.' : 'x..x..x.', b: '..x...x.', sh: 'xxxxxxxx' }, { vel: 0.85 });
    if (heavy) b.drums(s, 0.5, { k: 'x...x...' }, { vel: 0.7 });
  }
}

function music(b: ChartBuilder) {
  beat(b, 0, 2);
  b.countIn(4, 4);
  b.bassline(0, 4, 'Dm Dm', 'R...R.R.', 'bass');
  // A
  beat(b, 2, 8);
  b.bassline(b.bar(2), 4, PROG_A, 'R.R.R8R.', 'bass');
  b.chords(b.bar(2), 4, PROG_A, 'pluck', { rhythm: 'x.xx.x.x', center: 62, vel: 0.5 });
  b.seq(b.bar(2), 0.5, MEL_A, 'flute', { vel: 0.8 });
  // B
  beat(b, 10, 8, true);
  b.bassline(b.bar(10), 4, PROG_B, 'R.R.R8R.', 'bass');
  b.chords(b.bar(10), 4, PROG_B, 'strings', { center: 62, vel: 0.6 });
  b.chords(b.bar(10), 4, PROG_B, 'pluck', { rhythm: 'x.xx.x.x', center: 66, vel: 0.4 });
  b.seq(b.bar(10), 0.5, MEL_B, 'flute', { vel: 0.8 });
  b.seq(b.bar(10), 0.5, MEL_B, 'pluck', { vel: 0.4, transpose: -12 });
  // C (종)
  b.note(b.bar(18), 'crash', 0, 1, 0.8);
  beat(b, 18, 8, true);
  b.bassline(b.bar(18), 4, PROG_A, 'R-..R-8.', 'bass');
  b.chords(b.bar(18), 4, PROG_A, 'choir', { center: 62, vel: 0.8 });
  b.seq(b.bar(18), 0.5, MEL_A, 'lead', { vel: 0.7 });
  b.seq(b.bar(18), 0.5, MEL_A, 'flute', { vel: 0.35, transpose: -12 });
  // D
  b.note(b.bar(26), 'crash', 0, 1, 0.8);
  beat(b, 26, 8, true);
  b.bassline(b.bar(26), 4, PROG_B, 'R.R.R8R.', 'bass');
  b.chords(b.bar(26), 4, PROG_B, 'pluck', { rhythm: 'x.xx.x.x', center: 64, vel: 0.5 });
  b.chords(b.bar(26), 4, PROG_B, 'strings', { center: 60, vel: 0.5 });
  b.seq(b.bar(26), 0.5, MEL_B, 'flute', { vel: 0.8 });
  // 엔딩
  beat(b, 34, 1, true);
  b.bassline(b.bar(34), 2, 'Bb C', 'R.R.', 'bass');
  b.seq(b.bar(34), 0.5, 'F5 . G5 . A5 . C6 .', 'flute');
  b.note(b.bar(35), 'taiko', 0, 1, 1);
  b.note(b.bar(35), 'crash', 0, 1, 0.9);
  b.chords(b.bar(35), 4, 'Dm', 'strings', { center: 62, vel: 0.8, gate: 0.7 });
  b.note(b.bar(35), 'bass', 38, 3, 0.9);
  b.note(b.bar(35), 'flute', 74, 2.5, 0.8);
}

function build(b: ChartBuilder) {
  sideCounter = 0;
  music(b);
  CHART.forEach((p, i) => place(b, b.bar(2 + i), p));
  b.endBeat = b.bar(35) + 3;
}

// ------------------------------------------------------------------ 그림

function drawLog(g: G, s = 1) {
  rrect(g, -30 * s, -13 * s, 60 * s, 26 * s, 11 * s, '#c08a52', OUT, 3);
  ellipse(g, 26 * s, 0, 7 * s, 12 * s, 0, '#f0cf9a', OUT, 2.5);
  ellipse(g, 26 * s, 0, 3 * s, 6 * s, 0, null, '#c08a52', 1.5);
  line(g, -18 * s, -5 * s, 8 * s, -5 * s, '#8a5a30', 2);
  line(g, -22 * s, 4 * s, 2 * s, 4 * s, '#8a5a30', 2);
}

function drawBell(g: G, s = 1) {
  g.beginPath();
  g.moveTo(-30 * s, 26 * s);
  g.quadraticCurveTo(-28 * s, -30 * s, 0, -34 * s);
  g.quadraticCurveTo(28 * s, -30 * s, 30 * s, 26 * s);
  g.closePath();
  g.fillStyle = '#e0a93a';
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 3.5;
  g.stroke();
  rrect(g, -36 * s, 22 * s, 72 * s, 10 * s, 5 * s, '#c98a2a', OUT, 3);
  rrect(g, -6 * s, -44 * s, 12 * s, 12 * s, 4 * s, '#c98a2a', OUT, 2.5);
  line(g, -22 * s, -4 * s, 22 * s, -4 * s, '#b07a20', 3);
  ellipse(g, -12 * s, -14 * s, 5 * s, 10 * s, 0.3, 'rgba(255,255,255,0.45)');
}

function drawItem(g: G, kind: string, s = 1) {
  if (kind === 'bell') drawBell(g, s);
  else drawLog(g, s);
}

/** 선분(방향 nx,ny)을 기준으로 한쪽만 그리기 */
function drawSplit(g: G, kind: string, nx: number, ny: number, side: number) {
  g.save();
  // 법선 방향 반평면으로 자르기
  const px = -ny * side;
  const py = nx * side;
  g.beginPath();
  g.moveTo(nx * -200, ny * -200);
  g.lineTo(nx * 200, ny * 200);
  g.lineTo(nx * 200 + px * 200, ny * 200 + py * 200);
  g.lineTo(nx * -200 + px * 200, ny * -200 + py * 200);
  g.closePath();
  g.clip();
  drawItem(g, kind);
  g.restore();
}

interface NinjaPose {
  slash: number; // 0..1 (1=막 벤 순간)
  dir: [number, number];
  face: 'normal' | 'happy' | 'hurt' | 'sweat';
  bob: number;
  t: number;
}

function drawNinja(g: G, x: number, y: number, p: NinjaPose) {
  const by = y + p.bob * 3 - p.slash * 10;
  // 머플러
  g.beginPath();
  g.moveTo(x - 10, by - 44);
  for (let i = 1; i <= 6; i++) {
    const u = i / 6;
    g.lineTo(x - 10 - u * 70, by - 44 + Math.sin(p.t * 12 + u * 5) * 8 * u + u * 20);
  }
  for (let i = 6; i >= 0; i--) {
    const u = i / 6;
    g.lineTo(x - 10 - u * 70, by - 34 + Math.sin(p.t * 12 + u * 5) * 8 * u + u * 20);
  }
  g.closePath();
  g.fillStyle = '#ff4d5e';
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 3;
  g.stroke();
  // 다리
  limb(g, [x - 14, by + 30, x - 30, by + 60, x - 34, by + 78], 16, '#2d2a44', OUT, 3);
  limb(g, [x + 14, by + 30, x + 34, by + 58, x + 38, by + 78], 16, '#2d2a44', OUT, 3);
  // 몸
  rrect(g, x - 30, by - 22, 60, 62, 22, '#2d2a44', OUT, 3.5);
  line(g, x - 26, by + 18, x + 26, by + 18, '#ff4d5e', 5);
  // 칼 든 팔
  const [dx, dy] = p.dir;
  const s = p.slash;
  const ang = s > 0 ? Math.atan2(dy, dx) : -2.3;
  const hx = x + 20 + Math.cos(ang) * (s > 0 ? 44 : 26);
  const hy = by + Math.sin(ang) * (s > 0 ? 44 : 26) - 4;
  limb(g, [x + 18, by - 6, hx, hy], 13, '#2d2a44', OUT, 3);
  // 칼
  const ka = s > 0 ? ang : -2.0;
  const kx = hx + Math.cos(ka) * 70;
  const ky = hy + Math.sin(ka) * 70;
  line(g, hx, hy, kx, ky, OUT, 8);
  line(g, hx + Math.cos(ka) * 12, hy + Math.sin(ka) * 12, kx, ky, '#e8eef8', 4);
  line(g, hx - Math.cos(ka) * 4, hy - Math.sin(ka) * 4, hx + Math.cos(ka) * 10, hy + Math.sin(ka) * 10, '#8a5a30', 7);
  circle(g, hx, hy, 7, '#ffd9b3', OUT, 2.5);
  // 반대팔
  limb(g, [x - 20, by - 6, x - 38, by + 14], 13, '#2d2a44', OUT, 3);
  // 머리
  circle(g, x, by - 50, 30, '#2d2a44', OUT, 3.5);
  rrect(g, x - 26, by - 60, 52, 18, 9, '#ffd9b3', OUT, 2.5);
  line(g, x - 30, by - 64, x + 30, by - 64, '#ff4d5e', 5);
  const ey = by - 51;
  if (p.face === 'hurt') {
    dizzyEye(g, x - 10, ey, 6, p.t);
    dizzyEye(g, x + 10, ey, 6, p.t + 1);
    circle(g, x + 4, by - 84, 9, '#ffb3a6', OUT, 2.5);
    for (let i = 0; i < 3; i++) {
      const a = p.t * 5 + (i * Math.PI * 2) / 3;
      star(g, x + Math.cos(a) * 30, by - 90 + Math.sin(a) * 8, 7, 3, 5, a, '#ffe45c', OUT, 1.5);
    }
  } else if (p.face === 'happy') {
    happyEye(g, x - 10, ey + 2, 5);
    happyEye(g, x + 10, ey + 2, 5);
  } else {
    ellipse(g, x - 10, ey, 3.5, 5, 0, OUT);
    ellipse(g, x + 10, ey, 3.5, 5, 0, OUT);
    line(g, x - 17, ey - 8, x - 5, ey - 5, OUT, 3);
    line(g, x + 17, ey - 8, x + 5, ey - 5, OUT, 3);
    if (p.face === 'sweat') sweat(g, x + 30, by - 70, 7);
  }
}

function drawNight(g: G, W: number, H: number, beat: number, real: number) {
  g.fillStyle = vgrad(g, 0, H, [
    [0, '#15123a'],
    [0.6, '#3a2a6a'],
    [1, '#6a3a7a'],
  ]);
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    const x = hash01(i * 3) * W;
    const y = hash01(i * 7 + 1) * H * 0.6;
    circle(g, x, y, 1 + hash01(i) * 1.2, `rgba(255,255,255,${0.4 + 0.4 * Math.sin(real * 2 + i)})`);
  }
  // 달
  const mx = W * 0.5;
  const my = H * 0.3;
  circle(g, mx, my, 120, 'rgba(255,240,190,0.12)');
  circle(g, mx, my, 96, '#fff3c4');
  circle(g, mx - 30, my - 20, 14, 'rgba(230,210,150,0.5)');
  circle(g, mx + 26, my + 26, 20, 'rgba(230,210,150,0.4)');
  // 먼 탑 실루엣
  g.fillStyle = '#231c4a';
  const bx = W * 0.14;
  const baseY = H * 0.66;
  for (let i = 0; i < 4; i++) {
    const w = 70 - i * 12;
    const y = baseY - i * 34;
    g.fillRect(bx - w / 4, y - 30, w / 2, 30);
    g.beginPath();
    g.moveTo(bx - w / 2 - 10, y - 26);
    g.quadraticCurveTo(bx, y - 44, bx + w / 2 + 10, y - 26);
    g.fill();
  }
  // 대나무
  for (const [x0, ph] of [
    [W - 30, 0],
    [W - 60, 1.3],
    [22, 2.1],
  ] as const) {
    const sw = Math.sin(real * 0.9 + ph) * 6 + bounce(beat) * 2;
    g.save();
    g.translate(x0, H);
    g.rotate(sw * 0.004);
    rrect(g, -7, -H * 0.8, 14, H * 0.8, 6, '#3a8a5a', OUT, 2.5);
    for (let yy = -H * 0.8 + 50; yy < 0; yy += 60) line(g, -7, yy, 7, yy, OUT, 2.5);
    for (let k = 0; k < 3; k++) {
      const ly = -H * 0.8 + 60 + k * 90;
      poly(g, [0, ly, 34 * (k % 2 ? -1 : 1), ly - 10, 30 * (k % 2 ? -1 : 1), ly + 4], '#4aa86a', OUT, 2);
    }
    g.restore();
  }
  // 벚꽃잎
  for (let i = 0; i < 14; i++) {
    const u = frac(real * 0.08 + hash01(i * 11));
    const x = (hash01(i * 5) * W + Math.sin(real + i) * 30 + u * 60) % W;
    const y = u * H;
    ellipse(g, x, y, 5, 3, real * 2 + i, '#ffc2dc');
  }
}

function drawRoof(g: G, W: number, H: number, y: number) {
  g.fillStyle = '#4a4a6a';
  g.beginPath();
  g.moveTo(-20, y + 20);
  g.quadraticCurveTo(W / 2, y - 12, W + 20, y + 20);
  g.lineTo(W + 20, H);
  g.lineTo(-20, H);
  g.closePath();
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 4;
  g.stroke();
  for (let x = -20; x < W + 20; x += 26) line(g, x, y + 16 + Math.abs(x - W / 2) * 0.03, x - 10, H, 'rgba(0,0,0,0.25)', 3);
  rrect(g, -20, y - 4, W + 40, 16, 8, '#6a6a8a', OUT, 3);
}

function createScene(sc: SceneCtx): Scene {
  const fx = new Particles();
  const spb = sc.spb;
  let lastSlash = -99;
  let slashDir: [number, number] = [0.8, -0.6];
  let lastHurt = -99;
  let lastBad = -99;
  let lastGood = -99;
  let W = 393 / STAGE_K;
  let H = 852 / STAGE_K;

  const L = () => {
    const roofY = H * 0.74;
    return { roofY, nx: W * 0.42, ny: roofY - 78, hx: W * 0.58, hy: H * 0.43 };
  };

  function path(c: Cue, t: number): [number, number, number] {
    const lay = L();
    const lt = c.data.launchBeat * spb;
    const T = c.t - lt;
    const x0 = c.kind === 'bell' ? lay.hx : c.data.side < 0 ? W * 0.08 : W * 0.95;
    const y0 = H + 60;
    const xa = lay.hx + (c.kind === 'bell' ? 0 : c.data.side * 12);
    const ya = lay.hy;
    const gy = (2 * (y0 - ya)) / (T * T);
    const u = t - lt;
    const x = lerp(x0, xa, Math.min(1, u / T)) + (u > T ? (xa - x0) / T * (u - T) * 0.3 : 0);
    const y = y0 - gy * T * u + 0.5 * gy * u * u;
    const rot = u * (c.kind === 'bell' ? 0.6 : 7) * (c.data.side || 1);
    return [x, y, rot];
  }

  return {
    hitSfx: (cue) => ({ name: cue.kind === 'bell' ? 'bellHit' : 'slash' }),
    onInput(ev, cue) {
      if (ev.kind !== 'flick') return;
      lastSlash = ev.time;
      const d = Math.hypot(ev.dx, ev.dy) || 1;
      slashDir = [ev.dx / d, ev.dy / d];
      if (!cue) {
        sc.sfx('whiff', 0, 0.9);
        return;
      }
      if (cue.grade === 'just') {
        // 성공음(베기)은 hitSfx로 박자에 맞춰 예약됨
        lastGood = ev.time;
        const [x, y] = path(cue, Math.min(ev.time, cue.t));
        fx.burst(x, y, cue.kind === 'bell' ? 14 : 8, { kind: 'spark', r: 7, speed: 280, colors: ['#ffffff', '#fff3c4', '#ffc2dc'], max: 0.45 });
      } else {
        sc.sfx('clonk');
        lastBad = ev.time;
      }
    },
    onMiss(c: Cue) {
      sc.sfx('bonk');
      lastHurt = c.t + 0.3;
    },
    draw(g: G, f: Frame) {
      const t = f.t;
      fx.update(f.dt);
      const k = STAGE_K;
      g.save();
      g.scale(k, k);
      W = f.W / k;
      H = f.H / k;
      const lay = L();
      drawNight(g, W, H, f.beat, f.real);
      const ds = t - lastSlash;
      const slash = ds >= 0 && ds < 0.22 ? 1 - ds / 0.22 : 0;
      let face: NinjaPose['face'] = 'normal';
      if (t - lastHurt < 0.9 && t >= lastHurt) face = 'hurt';
      else if (t - lastBad < 0.5 && t >= lastBad) face = 'sweat';
      else if (t - lastGood < 0.35 && t >= lastGood) face = 'happy';
      // 목표물 (지붕 뒤에서 튀어오름)
      for (const c of sc.cues) {
        const lt = c.data.launchBeat * spb;
        if (lt > t) break;
        if (c.t < t - 3) continue;
        const kind = c.kind;
        if (!c.grade || (c.grade === 'miss' && t < c.t + 0.3)) {
          const [x, y, rot] = path(c, t);
          g.save();
          g.translate(x, y);
          g.rotate(rot);
          drawItem(g, kind);
          g.restore();
          continue;
        }
        const at = c.at ?? c.t;
        const dt = t - at;
        if (c.grade === 'just') {
          if (dt > 1.2) continue;
          const [x, y, rot] = path(c, Math.min(at, c.t));
          const ix = c.ix ?? { dx: 0.8, dy: -0.6 };
          const n = Math.hypot(ix.dx, ix.dy) || 1;
          const nx = ix.dx / n;
          const ny = ix.dy / n;
          for (const side of [-1, 1]) {
            const sep = dt * 120;
            const px = -ny * side * sep;
            const py = nx * side * sep + 0.5 * 900 * dt * dt;
            g.save();
            g.translate(x + px, y + py);
            g.rotate(side * dt * 3);
            g.rotate(0);
            // 자르는 방향은 월드 기준 → 회전 보정
            g.rotate(rot);
            const cr = Math.cos(-rot);
            const sr = Math.sin(-rot);
            drawSplit(g, kind, nx * cr - ny * sr, nx * sr + ny * cr, side);
            g.restore();
          }
          if (dt < 0.2) {
            // 칼날 궤적
            const a = 1 - dt / 0.2;
            g.globalAlpha = a;
            line(g, x - nx * 90, y - ny * 90, x + nx * 90, y + ny * 90, '#ffffff', 10 * a + 2);
            g.globalAlpha = 1;
          }
        } else if (c.grade === 'barely') {
          if (dt > 1.2) continue;
          const [x, y, rot] = path(c, Math.min(at, c.t));
          g.save();
          g.translate(x + dt * 160, y - 200 * dt + 0.5 * 1400 * dt * dt);
          g.rotate(rot + dt * 12);
          drawItem(g, kind);
          g.restore();
        } else {
          // 머리에 떨어진 뒤 튕겨나감
          const d2 = t - (c.t + 0.3);
          if (d2 > 1.2) continue;
          const x = lay.nx + 10 + d2 * 120;
          const y = lay.ny - 100 - 260 * d2 + 0.5 * 1500 * d2 * d2;
          g.save();
          g.translate(x, y);
          g.rotate(d2 * 9);
          drawItem(g, kind);
          g.restore();
        }
      }
      drawRoof(g, W, H, lay.roofY);
      drawNinja(g, lay.nx, lay.ny, { slash, dir: slashDir, face, bob: bounce(f.beat), t: f.real });
      fx.draw(g);
      g.restore();
      void WIN_BARELY;
    },
  };
}

function drawIcon(g: G, cx: number, cy: number, s: number, t: number) {
  const k = s / 130;
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  circle(g, 10, -10, 56, '#fff3c4');
  g.save();
  g.translate(-6, 40);
  g.scale(0.62, 0.62);
  drawNinja(g, 0, 0, { slash: frac(t) < 0.3 ? 1 : 0, dir: [0.8, -0.6], face: 'normal', bob: 0, t });
  g.restore();
  g.save();
  g.translate(40, -30);
  g.rotate(0.6);
  drawSplit(g, 'log', 0.8, -0.6, 1);
  g.translate(-6, 8);
  drawSplit(g, 'log', 0.8, -0.6, -1);
  g.restore();
  g.restore();
}

function drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number) {
  epilogueFrame(g, x, y, w, h, '#2a2256', () => {
    circle(g, x + w * 0.7, y + h * 0.3, 44, '#fff3c4');
    const n = rank === 'hi' ? 12 : rank === 'ok' ? 5 : 1;
    for (let i = 0; i < n; i++) {
      g.save();
      g.translate(x + 30 + (i % 6) * 30, y + h - 30 - Math.floor(i / 6) * 26);
      g.scale(0.7, 0.7);
      if (rank === 'try') drawLog(g);
      else drawSplit(g, 'log', 1, 0, i % 2 ? 1 : -1);
      g.restore();
    }
    g.save();
    g.translate(x + w * 0.62, y + h * 0.62);
    g.scale(0.6, 0.6);
    drawNinja(g, 0, 0, { slash: 0, dir: [1, 0], face: rank === 'hi' ? 'happy' : rank === 'ok' ? 'normal' : 'hurt', bob: 0, t });
    g.restore();
  });
}

export const ninja: GameDef = {
  id: ID,
  title: '닌자 수련',
  sub: 'Ninja Training',
  desc: '날아오는 통나무를 박자에 맞춰 싹둑!',
  howto: '"탁!" 하고 통나무가 튀어 오르면 한 박자 뒤에 화면을 쓱 튕기듯 밀어서(플릭) 베어요.\n"탁탁!"은 두 개! "댕~" 큰 종은 두 박자 뒤에 베요.',
  color: '#8a6ad8',
  accent: '#e0d6ff',
  bpm: BPM,
  liveSfx: [
    ['slash', 0],
    ['bellHit', 0],
    ['clonk', 0],
    ['bonk', 0],
    ['whiff', 0],
  ],
  build,
  practice: [
    {
      text: '"탁!" 소리가 나면 한 박자 뒤에\n화면을 쓱 밀어서(플릭) 베어요!',
      beats: 4,
      need: 4,
      build(b) {
        launch(b, 0, 'log', -1);
        launch(b, 2, 'log', 1);
      },
    },
    {
      text: '"탁탁!" 두 개가 오면\n두 번 연속으로 싹둑!',
      beats: 4,
      need: 4,
      build(b) {
        place(b, 0, 'p.......');
      },
    },
    {
      text: '"댕~" 큰 종은 두 박자 뒤에\n크게 베어요!',
      beats: 8,
      need: 3,
      build(b) {
        launch(b, 0, 'bell', 0);
        launch(b, 4, 'log', -1);
        launch(b, 6, 'log', 1);
      },
    },
  ],
  practiceBacking(b, beats) {
    for (let i = 0; i < beats; i += 4) {
      b.drums(i, 0.5, { tk: 'x..x..x.', sh: 'xxxxxxxx' }, { vel: 0.7 });
      b.bassline(i, 4, 'Dm', 'R.R.R8R.', 'bass');
    }
  },
  createScene,
  drawIcon,
  cats: { log: '통나무', pair: '연속 통나무', bell: '큰 종' },
  comments: {
    good: { log: '통나무를 깔끔하게 베었어요!', pair: '연속 베기가 번개 같았어요!', bell: '큰 종이 멋지게 울렸어요!' },
    bad: { log: '통나무는 한 박자 뒤에 베요.', pair: '두 개 연속은 반 박자 간격이에요.', bell: '종은 두 박자 뒤에 베요.' },
  },
  epilogue: {
    hi: '사부님이 인정했어요. 오늘부터 당신은 달빛 닌자!',
    ok: '수련은 계속된다... 조금만 더!',
    try: '통나무에 머리를 너무 많이 맞았어요...',
  },
  drawEpilogue,
  remixPart(b, start, bars, v) {
    const pats = v % 2 ? ['p...l...', 'l...l...', 'b...l...', 'l.l.l...'] : ['l...l...', 'p...l...', 'l...p...', 'b.......'];
    for (let i = 0; i < bars; i++) place(b, start + i * b.beatsPerBar, pats[i % pats.length]);
  },
};
