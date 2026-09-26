// 3. 풍선 공장 — 누르고 있다가 박자에 맞춰 떼서 풍선 묶기
import type { ChartBuilder, Cue } from '../core/chart';
import type { Frame, GameDef, GameInput, Scene, SceneCtx } from '../core/game';
import { OUT, Particles, circle, ellipse, happyEye, line, limb, poly, rrect, star, sweat, text, vgrad, type G } from '../core/gfx';
import { WIN_BARELY, type Judge, type Rank } from '../core/judge';
import { bounce, clamp01, easeOutQuad, frac, hash01, lerp } from '../core/util';
import { epilogueFrame, pattern } from './common';

const ID = 'balloon';
const STAGE_K = 1.38;
const BPM = 108;
type Size = 'S' | 'M' | 'L';
const HOLD: Record<Size, number> = { S: 1, M: 2, L: 3 };
const RADIUS: Record<Size, number> = { S: 34, M: 48, L: 62 };
const COLOR: Record<Size, string> = { S: '#ff5a6e', M: '#4aa8ff', L: '#ffc93a' };
const HOOK: Record<Size, string> = { S: 'hookS', M: 'hookM', L: 'hookL' };

function addBalloon(b: ChartBuilder, beat: number, size: Size) {
  b.sfx(beat, HOOK[size], 1);
  const rel = beat + HOLD[size];
  b.cue(rel, 'release', size, { arriveBeat: beat, size, pressT: b.t(beat) + 0.04 }, { cat: size, weight: size === 'L' ? 1.4 : 1 });
}

function place(b: ChartBuilder, start: number, str: string) {
  pattern(b, start, 0.5, str, (ch, beat) => {
    if (ch === 'S' || ch === 'M' || ch === 'L') addBalloon(b, beat, ch);
  });
}

// 8분음표 단위 (마디당 8글자)
const CHART: string[] = [
  // A (2~9)
  'S...S...', 'S...S...', 'M.......', 'S...S...', 'S...S...', 'M.......', 'S...S...', 'M.......',
  // B (10~17)
  'M.......', 'S...S...', 'M.......', 'M.......', 'S...S...', 'S..S....', 'M.......', 'S...S...',
  // C (18~25) 큰 풍선
  'L.......', 'S...S...', 'L.......', 'M.......', 'L.......', 'S...S...', 'L.......', 'M.......',
  // D (26~33)
  'S...S...', 'M.......', 'L.......', 'S..S....', 'M.......', 'S...S...', 'L.......', 'S...S...',
  // 엔딩 (34)
  'L.......',
];

const PROG_A = 'C Am F G C Am F G';
const PROG_B = 'F G Em Am Dm G C C';
const MEL_A = [
  'E5 . G5 . C6 . G5 .', 'A5 - G5 . E5 . C5 .', 'F5 . A5 . C6 . A5 .', 'G5 - - . D5 E5 F5 .',
  'E5 . G5 . C6 . D6 .', 'E6 - D6 . C6 . A5 .', 'F5 . E5 . D5 . F5 .', 'E5 - - - . . . .',
].join(' ');
const MEL_B = [
  'A5 . G5 . F5 . A5 .', 'G5 - - . B4 . D5 .', 'E5 . G5 . B5 . G5 .', 'A5 - - . E5 . C5 .',
  'D5 . F5 . A5 . F5 .', 'G5 . F5 . D5 . B4 .', 'C5 . E5 . G5 . E5 .', 'C5 - - - . . . .',
].join(' ');

function groove(b: ChartBuilder, bar: number, bars: number, busy = false) {
  for (let i = 0; i < bars; i++) {
    const s = b.bar(bar + i);
    b.drums(s, 0.5, { k: busy ? 'x.x.x.x.' : 'x...x.x.', c: '..x...x.', h: 'xxxxxxxx' }, { vel: 0.85 });
    if (busy) b.drums(s, 0.25, { sh: 'x.x.x.x.x.x.x.x.' });
  }
}

function music(b: ChartBuilder) {
  // 인트로
  groove(b, 0, 2);
  b.bassline(0, 4, 'C G', 'R.8.R.5.', 'bass');
  b.countIn(4, 4);
  // A
  groove(b, 2, 8);
  b.bassline(b.bar(2), 4, PROG_A, 'R.8.R.58', 'bass');
  b.chords(b.bar(2), 4, PROG_A, 'marimba', { rhythm: '.x.x.x.x', center: 67, vel: 0.5 });
  b.seq(b.bar(2), 0.5, MEL_A, 'chip', { vel: 0.9 });
  b.seq(b.bar(2), 0.5, MEL_A, 'marimba', { vel: 0.5, transpose: -12 });
  // B
  groove(b, 10, 8, true);
  b.bassline(b.bar(10), 4, PROG_B, 'R.8.R.58', 'bass');
  b.chords(b.bar(10), 4, PROG_B, 'pad', { center: 62, vel: 0.6 });
  b.chords(b.bar(10), 4, PROG_B, 'brass', { rhythm: 'x..x..x.', center: 67, vel: 0.35 });
  b.seq(b.bar(10), 0.5, MEL_B, 'lead', { vel: 0.75 });
  // C
  b.note(b.bar(18), 'crash', 0, 1, 0.9);
  groove(b, 18, 8);
  b.bassline(b.bar(18), 4, PROG_A, 'R-..R-5.', 'bass');
  b.chords(b.bar(18), 4, PROG_A, 'strings', { center: 64, vel: 0.7 });
  b.seq(b.bar(18), 0.5, MEL_A, 'flute', { vel: 0.7 });
  b.arp(b.bar(18), 4, PROG_A, 'chip', { step: 0.25, center: 76, vel: 0.35, order: [0, 1, 2, 1] });
  // D
  b.note(b.bar(26), 'crash', 0, 1, 0.9);
  groove(b, 26, 8, true);
  b.bassline(b.bar(26), 4, PROG_B, 'R.8.R.58', 'bass');
  b.chords(b.bar(26), 4, PROG_B, 'marimba', { rhythm: '.x.x.x.x', center: 67, vel: 0.5 });
  b.seq(b.bar(26), 0.5, MEL_B, 'chip', { vel: 0.9 });
  b.seq(b.bar(26), 0.5, MEL_B, 'lead', { vel: 0.5, transpose: -12 });
  // 엔딩
  groove(b, 34, 1);
  b.bassline(b.bar(34), 2, 'F G', 'R.R.', 'bass');
  b.seq(b.bar(34), 0.5, 'F5 . A5 . G5 . B5 .', 'chip', { vel: 0.9 });
  b.note(b.bar(35), 'crash', 0, 1, 1);
  b.note(b.bar(35), 'kick', 0, 1, 1);
  b.chords(b.bar(35), 4, 'C', 'brass', { center: 67, vel: 0.7, gate: 0.6 });
  b.note(b.bar(35), 'bass', 36, 3, 0.9);
  b.note(b.bar(35), 'chip', 84, 2, 0.8);
}

function build(b: ChartBuilder) {
  music(b);
  CHART.forEach((p, i) => place(b, b.bar(2 + i), p));
  b.endBeat = b.bar(35) + 3;
}

// ------------------------------------------------------------------ 그림

function drawBalloon(g: G, x: number, y: number, r: number, color: string, squish = 0, wob = 0) {
  if (r < 3) return;
  const rx = r * (1 + squish * 0.15);
  const ry = r * 1.12 * (1 - squish * 0.1);
  g.save();
  g.translate(x, y);
  g.rotate(wob);
  ellipse(g, 0, -ry, rx, ry, 0, color, OUT, 3);
  ellipse(g, -rx * 0.35, -ry * 1.4, rx * 0.2, ry * 0.3, -0.5, 'rgba(255,255,255,0.55)');
  poly(g, [-5, 2, 5, 2, 0, -4], color, OUT, 2.5);
  g.restore();
}

/** 쭈글쭈글한 빈 풍선 */
function drawLimp(g: G, x: number, y: number, color: string, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.beginPath();
  g.moveTo(-4, 0);
  g.quadraticCurveTo(-14, -12, -8, -24);
  g.quadraticCurveTo(0, -30, 8, -24);
  g.quadraticCurveTo(14, -12, 4, 0);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 3;
  g.stroke();
  line(g, -3, -14, 3, -18, 'rgba(0,0,0,0.25)', 2);
  g.restore();
}

function drawBear(g: G, x: number, y: number, press: number, face: 'normal' | 'happy' | 'sweat' | 'shock', t: number, bob: number) {
  const by = y + bob * 3;
  // 몸 (멜빵바지)
  rrect(g, x - 44, by + 30, 88, 100, 34, '#c98a55', OUT, 3.5);
  rrect(g, x - 36, by + 64, 72, 66, 20, '#4a7ad8', OUT, 3);
  line(g, x - 26, by + 64, x - 20, by + 36, '#4a7ad8', 7);
  line(g, x + 26, by + 64, x + 20, by + 36, '#4a7ad8', 7);
  circle(g, x - 20, by + 70, 4, '#ffd23e', OUT, 2);
  circle(g, x + 20, by + 70, 4, '#ffd23e', OUT, 2);
  // 머리
  circle(g, x - 30, by - 34, 14, '#c98a55', OUT, 3);
  circle(g, x + 30, by - 34, 14, '#c98a55', OUT, 3);
  circle(g, x - 30, by - 34, 7, '#f0b88a');
  circle(g, x + 30, by - 34, 7, '#f0b88a');
  circle(g, x, by - 6, 40, '#c98a55', OUT, 3.5);
  ellipse(g, x, by + 8, 20, 14, 0, '#f0d0a8', OUT, 2.5);
  ellipse(g, x, by + 1, 7, 5, 0, OUT);
  // 모자
  rrect(g, x - 34, by - 50, 68, 18, 8, '#ffd23e', OUT, 3);
  rrect(g, x - 26, by - 62, 52, 16, 8, '#ffd23e', OUT, 3);
  // 눈
  if (face === 'happy') {
    happyEye(g, x - 15, by - 12, 6);
    happyEye(g, x + 15, by - 12, 6);
  } else if (face === 'shock') {
    circle(g, x - 15, by - 12, 7, '#fff', OUT, 2);
    circle(g, x + 15, by - 12, 7, '#fff', OUT, 2);
    circle(g, x - 15, by - 12, 2.5, OUT);
    circle(g, x + 15, by - 12, 2.5, OUT);
  } else {
    const blink = frac(t * 0.27) > 0.96;
    for (const dx of [-15, 15]) {
      if (blink) line(g, x + dx - 5, by - 12, x + dx + 5, by - 12, OUT, 3);
      else ellipse(g, x + dx, by - 12, 4, 5.5, 0, OUT);
    }
  }
  if (face === 'sweat') sweat(g, x + 40, by - 30, 8);
  if (face === 'happy' || face === 'shock') {
    g.beginPath();
    g.arc(x, by + 14, face === 'shock' ? 5 : 6, 0, face === 'shock' ? Math.PI * 2 : Math.PI);
    g.fillStyle = '#a3263b';
    g.fill();
  }
  // 팔: 펌프 손잡이를 누름
  const hy = by + 20 + press * 30;
  limb(g, [x - 36, by + 44, x + 30, hy + 4], 16, '#c98a55', OUT, 3);
  limb(g, [x + 36, by + 44, x + 58, hy], 16, '#c98a55', OUT, 3);
}

function drawPump(g: G, x: number, y: number, press: number) {
  // 몸통
  rrect(g, x - 26, y - 70, 52, 90, 10, '#e0e6f0', OUT, 3.5);
  rrect(g, x - 26, y - 10, 52, 30, 8, '#b8c0d0', OUT, 3);
  // 게이지
  circle(g, x, y - 40, 16, '#fff', OUT, 3);
  const a = -Math.PI * 0.8 + press * Math.PI * 0.6;
  line(g, x, y - 40, x + Math.cos(a) * 12, y - 40 + Math.sin(a) * 12, '#ff4d5e', 3);
  // 손잡이 막대
  const hy = y - 110 + press * 30;
  line(g, x, y - 70, x, hy, '#8a92a6', 7);
  rrect(g, x - 34, hy - 10, 68, 14, 7, '#ff6b8b', OUT, 3);
}

function createScene(sc: SceneCtx): Scene {
  const fx = new Particles();
  const spb = sc.spb;
  let downAt: number | null = null;
  let lastUp = -99;
  let pumpSnd: { stop(fade?: number): void } | null = null;
  const info = new Map<number, { start: number | null; early?: boolean; popped?: boolean; limp?: boolean; endR?: number }>();
  let lastGood = -99;
  let lastBad = -99;
  let lastPop = -99;
  let W = 393 / STAGE_K;
  let H = 852 / STAGE_K;

  const arriveT = (c: Cue) => c.data.arriveBeat * spb;
  const layout = () => {
    const floorY = H * 0.8;
    const nx = W * 0.66;
    const ny = floorY - 120;
    return { floorY, nx, ny, bx: W * 0.2, by: floorY - 142 };
  };

  /** 현재 부풀리는 중인 풍선 */
  function active(t: number): Cue | null {
    for (const c of sc.cues) {
      if (arriveT(c) > t + 0.12) break;
      if (!c.grade) return c;
    }
    return null;
  }

  function stopPump() {
    pumpSnd?.stop(0.04);
    pumpSnd = null;
  }

  function sizeAt(c: Cue, t: number): number {
    const inf = info.get(c.id);
    const st = inf?.start;
    if (st == null) return 0;
    const total = c.t - arriveT(c);
    return Math.max(0, (t - st) / (c.t - st > 0 ? c.t - st : total));
  }

  return {
    judge(ev: GameInput, j: Judge) {
      if (ev.kind === 'tap') return null;
      if (ev.kind !== 'release') return undefined;
      const c = active(ev.time);
      if (!c || c.grade) return null;
      const dt = ev.jt - c.t;
      if (Math.abs(dt) <= WIN_BARELY) {
        j.apply(c, ev);
        return c;
      }
      if (dt < -WIN_BARELY && (info.get(c.id)?.start ?? null) != null) {
        // 너무 일찍 뗌 → 바람 빠짐
        info.get(c.id)!.early = true;
        j.forceMiss(c, ev.time);
        return c;
      }
      return null;
    },
    onDown(ev) {
      downAt = ev.time;
      const c = active(ev.time + 0.12);
      if (c) {
        const inf = info.get(c.id) ?? { start: null };
        inf.start = Math.max(ev.time, arriveT(c));
        info.set(c.id, inf);
      }
      stopPump();
      pumpSnd = sc.sfx('inflate', 0, 0.9);
    },
    onUp(ev) {
      downAt = null;
      lastUp = ev.time;
      stopPump();
    },
    onInput(ev, cue) {
      if (ev.kind !== 'release') return;
      const L = layout();
      if (!cue) return;
      const inf = info.get(cue.id) ?? { start: arriveT(cue) };
      info.set(cue.id, inf);
      if (cue.grade === 'just') {
        sc.sfx('tie', 0, 1);
        lastGood = ev.time;
        inf.endR = 1;
        fx.burst(L.nx, L.ny - RADIUS[cue.kind as Size] * 1.6, 8, { kind: 'star', r: 7, speed: 220, colors: ['#fff27a', '#ffffff'], max: 0.5 });
      } else if (cue.grade === 'barely') {
        sc.sfx('tie', 0, 0.6);
        sc.sfx('deflate', 0, 0.3);
        lastBad = ev.time;
        inf.endR = (cue.dt ?? 0) < 0 ? 0.82 : 1.15;
      } else {
        sc.sfx('deflate', 0, 0.9);
        lastBad = ev.time;
        inf.endR = sizeAt(cue, ev.time);
      }
    },
    onMiss(c: Cue) {
      const inf = info.get(c.id) ?? { start: null };
      info.set(c.id, inf);
      if (inf.start != null && downAt != null) {
        inf.popped = true;
        sc.sfx('pop', 0, 1);
        lastPop = c.t + WIN_BARELY;
        const L = layout();
        fx.burst(L.nx, L.ny - RADIUS[c.kind as Size] * 1.5, 14, { kind: 'rect', r: 6, speed: 320, color: COLOR[c.kind as Size], max: 0.6, g: 600 });
        stopPump();
      } else {
        inf.limp = true;
        sc.sfx('bonk', 0, 0.5);
        lastBad = c.t;
      }
    },
    draw(g: G, f: Frame) {
      const t = f.t;
      fx.update(f.dt);
      // 배경: 공장 (실제 화면 크기)
      g.fillStyle = vgrad(g, 0, f.H, [
        [0, '#bff0e0'],
        [1, '#e8fff6'],
      ]);
      g.fillRect(0, 0, f.W, f.H);
      // 천장에 모인 풍선들
      let made = 0;
      for (const c of sc.cues) if (c.grade === 'just' && (c.at ?? 0) + 1.6 < t) made++;
      for (let i = 0; i < Math.min(made, 60); i++) {
        const hx = hash01(i * 7 + 1) * (f.W - 40) + 20;
        const hy = 30 + f.safe.t + hash01(i * 13 + 5) * 90 + (i > 30 ? 60 : 0);
        const col = [COLOR.S, COLOR.M, COLOR.L, '#6be3a0', '#c77dff'][i % 5];
        const sw = Math.sin(f.real * 1.5 + i) * 0.1;
        line(g, hx, hy + 6, hx + sw * 30, hy + 60, 'rgba(60,60,80,0.4)', 1.5);
        drawBalloon(g, hx, hy + 8, 18 + hash01(i) * 6, col, 0, sw);
      }
      const k = STAGE_K;
      g.save();
      g.scale(k, k);
      W = f.W / k;
      H = f.H / k;
      const L = layout();
      if (downAt != null) {
        const c = active(t);
        if (c && arriveT(c) <= t && info.get(c.id)?.start == null) info.set(c.id, { ...(info.get(c.id) ?? {}), start: Math.max(downAt, arriveT(c)) });
      }
      // 벽 장식: 파이프와 창문
      rrect(g, W - 104, H * 0.3, 88, 70, 12, '#9fe3ff', OUT, 3.5);
      line(g, W - 60, H * 0.3, W - 60, H * 0.3 + 70, OUT, 3.5);
      rrect(g, 8, H * 0.18, 20, H * 0.46, 8, '#c9d2e6', OUT, 3);
      rrect(g, -6, H * 0.34, 44, 16, 8, '#c9d2e6', OUT, 3);
      // 컨베이어/바닥
      g.fillStyle = '#9aa6c4';
      g.fillRect(0, L.floorY, W, H - L.floorY);
      line(g, 0, L.floorY, W, L.floorY, OUT, 4);
      for (let x = -((f.beat * 20) % 40); x < W; x += 40) line(g, x, L.floorY + 20, x + 20, L.floorY + 60, 'rgba(255,255,255,0.25)', 6);
      // 펌프 + 노즐
      const holding = downAt != null || sc.holding();
      const press = holding ? 0.6 + 0.4 * Math.abs(Math.sin(t * 14)) : 0;
      drawPump(g, L.bx + 64, L.floorY, press);
      // 호스
      g.beginPath();
      g.moveTo(L.bx + 90, L.floorY - 20);
      g.bezierCurveTo(L.bx + 150, L.floorY - 10, L.nx - 40, L.floorY - 10, L.nx, L.floorY - 40);
      g.strokeStyle = OUT;
      g.lineWidth = 12;
      g.stroke();
      g.strokeStyle = '#6be3a0';
      g.lineWidth = 7;
      g.stroke();
      rrect(g, L.nx - 12, L.ny + 10, 24, L.floorY - L.ny - 10, 6, '#c9d2e6', OUT, 3);
      rrect(g, L.nx - 20, L.ny, 40, 16, 6, '#8a92a6', OUT, 3);
      // 풍선들
      for (const c of sc.cues) {
        const at = arriveT(c);
        if (at - spb > t) break;
        const size = c.kind as Size;
        const R = RADIUS[size];
        const col = COLOR[size];
        const inf = info.get(c.id);
        if (!c.grade) {
          if (t < at) {
            // 위에서 떨어지며 도착
            const k = clamp01((t - (at - spb)) / spb);
            drawLimp(g, L.nx, lerp(L.ny - 260, L.ny, easeOutQuad(k)), col, 1 + (R - 34) / 60);
            continue;
          }
          const k = inf?.start != null && inf.start <= t ? sizeAt(c, t) : 0;
          if (k <= 0.02) drawLimp(g, L.nx, L.ny + Math.sin((t - at) * 30) * 2 * Math.max(0, 1 - (t - at) * 4), col, 1 + (R - 34) / 60);
          else {
            const over = Math.max(0, k - 1);
            const wob = over > 0 ? Math.sin(t * 50) * 0.05 * (1 + over * 4) : 0;
            drawBalloon(g, L.nx, L.ny + 2, R * Math.min(1.5, k), col, 0, wob);
            // 목표선
            g.setLineDash([6, 6]);
            ellipse(g, L.nx, L.ny + 2 - R * 1.12, R, R * 1.12, 0, null, 'rgba(42,33,48,0.35)', 2);
            g.setLineDash([]);
          }
          continue;
        }
        const et = c.at ?? c.t;
        const dt = t - et;
        if (dt < 0) continue;
        if (c.grade === 'just' || c.grade === 'barely') {
          if (dt > 2) continue;
          const r = R * (inf?.endR ?? 1);
          const rise = easeOutQuad(clamp01(dt / 1.8)) * (L.ny + 200);
          const sway = Math.sin(dt * 5) * (c.grade === 'barely' ? 20 : 8);
          const bx = L.nx + sway + (c.grade === 'barely' ? dt * 40 : 0);
          const by = L.ny + 2 - rise;
          line(g, bx, by, bx - sway * 0.5, by + 50, 'rgba(60,60,80,0.6)', 2);
          drawBalloon(g, bx, by, r, col, dt < 0.1 ? 1 - dt * 10 : 0, sway * 0.01);
          if (c.grade === 'just' && dt < 0.4) {
            g.globalAlpha = 1 - dt / 0.4;
            star(g, bx + r * 0.8, by - r * 1.8, 12, 5, 5, dt * 4, '#fff27a', OUT, 2);
            g.globalAlpha = 1;
          }
        } else if (inf?.popped) {
          if (dt < 0.25) {
            g.globalAlpha = 1 - dt / 0.25;
            star(g, L.nx, L.ny - R, R * (1 + dt * 3), R * 0.5, 10, 0, '#ffffff', OUT, 3);
            g.globalAlpha = 1;
          }
          if (dt < 1.2) drawLimp(g, L.nx + dt * 30, L.ny + dt * 200 + 0.5 * 900 * dt * dt * 0.3, col, 0.8);
        } else if (inf?.early) {
          if (dt > 1.6) continue;
          // 바람 빠지며 날아다님
          const r = R * Math.max(0.3, (inf.endR ?? 0.5) * (1 - dt * 0.5));
          const px = L.nx + Math.sin(dt * 9) * 60 * dt;
          const py = L.ny - dt * 220 + Math.cos(dt * 11) * 20;
          drawBalloon(g, px, py, r, col, 0, Math.sin(dt * 15) * 0.6);
        } else {
          // 불지 않은 풍선은 떨어짐
          if (dt > 1.2) continue;
          drawLimp(g, L.nx + dt * 20, L.ny + 0.5 * 1200 * dt * dt, col, 1);
        }
      }
      // 곰 작업자
      let face: 'normal' | 'happy' | 'sweat' | 'shock' = 'normal';
      if (t - lastPop < 0.8 && t >= lastPop) face = 'shock';
      else if (t - lastBad < 0.6 && t >= lastBad) face = 'sweat';
      else if (t - lastGood < 0.5 && t >= lastGood) face = 'happy';
      drawBear(g, L.bx, L.by, press, face, t, bounce(f.beat));
      void lastUp;
      fx.draw(g);
      g.restore();
      g.save();
      g.scale(k, k);
      // 크기 안내
      const cur = active(t);
      if (cur && sc.mode !== 'play') {
        const lbl = { S: '작은 풍선: 1박', M: '중간 풍선: 2박', L: '큰 풍선: 3박' }[cur.kind as Size];
        rrect(g, L.nx - 74, L.floorY + 24, 148, 32, 16, '#fff', OUT, 2.5);
        text(g, lbl, L.nx, L.floorY + 40.5, 14, OUT, { weight: 900 });
      }
      g.restore();
    },
  };
}

function drawIcon(g: G, cx: number, cy: number, s: number, t: number) {
  const k = s / 120;
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  const ph = frac(t * 0.7);
  line(g, -30, 40, -34, 70, OUT, 2);
  drawBalloon(g, -30, 40, 26, COLOR.S, 0, Math.sin(t * 2) * 0.1);
  line(g, 30, 30, 34, 70, OUT, 2);
  drawBalloon(g, 30, 30, 22 + ph * 16, COLOR.M, 0, -Math.sin(t * 2) * 0.1);
  line(g, 0, 20, 0, 70, OUT, 2);
  drawBalloon(g, 0, 20, 34, COLOR.L, 0, 0);
  g.restore();
}

function drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number) {
  epilogueFrame(g, x, y, w, h, rank === 'try' ? '#c9c2d6' : '#bff0e0', () => {
    const n = rank === 'hi' ? 14 : rank === 'ok' ? 6 : 1;
    for (let i = 0; i < n; i++) {
      const bx = x + 30 + hash01(i * 3 + 1) * (w - 60);
      const by = y + 40 + hash01(i * 5 + 2) * (h * 0.4);
      line(g, bx, by, x + w * 0.5, y + h * 0.62, 'rgba(60,60,80,0.5)', 1.5);
      drawBalloon(g, bx, by, 18 + hash01(i) * 8, [COLOR.S, COLOR.M, COLOR.L, '#6be3a0'][i % 4], 0, Math.sin(t * 2 + i) * 0.1);
    }
    g.save();
    g.translate(x + w * 0.5, y + h * 0.62 - 20 * (rank === 'hi' ? 1 + Math.sin(t * 2) * 0.1 : 0));
    g.scale(0.6, 0.6);
    drawBear(g, 0, 60, 0, rank === 'try' ? 'sweat' : 'happy', t, 0);
    g.restore();
    if (rank === 'try') drawLimp(g, x + w * 0.75, y + h * 0.85, COLOR.S, 1.2);
  });
}

export const balloon: GameDef = {
  id: ID,
  title: '풍선 공장',
  sub: 'Balloon Factory',
  desc: '누르고 있다가 박자에 맞춰 떼면 풍선 완성!',
  howto: '풍선이 걸리면 화면을 꾹 눌러 바람을 넣어요.\n작은 빨강은 1박, 중간 파랑은 2박, 큰 노랑은 3박 뒤에 손을 떼세요!\n너무 오래 누르면 펑!',
  color: '#6be3a0',
  accent: '#e8fff6',
  bpm: BPM,
  liveSfx: [
    ['inflate', 0],
    ['tie', 0],
    ['pop', 0],
    ['deflate', 0],
    ['bonk', 0],
  ],
  build,
  practice: [
    {
      text: '빨간 풍선이 걸리면 꾹 누르고\n1박 뒤에 손을 떼요!',
      beats: 4,
      need: 3,
      build(b) {
        addBalloon(b, 0, 'S');
      },
    },
    {
      text: '파란 풍선은 2박 동안\n누르고 있다가 떼요!',
      beats: 4,
      need: 3,
      build(b) {
        addBalloon(b, 0, 'M');
      },
    },
    {
      text: '노란 큰 풍선은 3박!\n소리를 잘 들어요.',
      beats: 8,
      need: 3,
      build(b) {
        addBalloon(b, 0, 'L');
        addBalloon(b, 4, 'S');
        addBalloon(b, 6, 'S');
      },
    },
  ],
  practiceBacking(b, beats) {
    for (let i = 0; i < beats; i += 4) {
      b.drums(i, 0.5, { k: 'x...x.x.', c: '..x...x.', h: 'xxxxxxxx' }, { vel: 0.7 });
      b.bassline(i, 4, 'C', 'R.8.R.58', 'bass');
    }
  },
  createScene,
  drawIcon,
  cats: { S: '작은 풍선', M: '중간 풍선', L: '큰 풍선' },
  comments: {
    good: { S: '작은 풍선을 톡톡 잘 묶었어요!', M: '중간 풍선 타이밍이 딱이었어요!', L: '큰 풍선도 빵빵하게 완성!' },
    bad: { S: '작은 풍선은 1박 뒤에 떼요.', M: '중간 풍선은 2박을 세어 봐요.', L: '큰 풍선은 3박을 꾹 참아요.' },
  },
  epilogue: {
    hi: '알록달록 풍선이 하늘을 가득 채웠어요!',
    ok: '풍선이 몇 개 팔렸어요. 나쁘지 않은 하루!',
    try: '펑! 펑! 오늘 공장은 풍선 터지는 소리만...',
  },
  drawEpilogue,
  remixPart(b, start, bars, v) {
    const pats = v % 2 ? ['M.......', 'S...S...', 'L.......', 'S...S...'] : ['S...S...', 'M.......', 'S...S...', 'L.......'];
    for (let i = 0; i < bars; i++) place(b, start + i * b.beatsPerBar, pats[i % pats.length]);
  },
};
