// 6. 달토끼 배드민턴 — 상대가 친 셔틀콕을 박자에 맞춰 받아치기
import type { ChartBuilder, Cue } from '../core/chart';
import type { Frame, GameDef, Scene, SceneCtx } from '../core/game';
import { OUT, Particles, circle, ellipse, happyEye, dizzyEye, line, limb, poly, rrect, star, sweat, vgrad, type G } from '../core/gfx';
import type { Rank } from '../core/judge';
import { bounce, clamp01, easeOutQuad, frac, hash01, lerp } from '../core/util';
import { epilogueFrame } from './common';

const ID = 'badminton';
const BPM = 124;
type Kind = 'norm' | 'lob' | 'smash';
const FLIGHT: Record<Kind, number> = { norm: 1, lob: 2, smash: 0.5 };

function shot(b: ChartBuilder, beat: number, kind: Kind) {
  if (kind === 'smash') {
    b.sfx(beat - 0.5, 'hup', 0.9, 64);
    b.sfx(beat, 'smash', 1);
  } else b.sfx(beat, kind === 'lob' ? 'lob' : 'racketFar', 1);
  b.cue(beat + FLIGHT[kind], 'tap', kind, { callBeat: beat }, { cat: kind, weight: kind === 'norm' ? 1 : 1.3 });
}

/** 마디 패턴: nn (1,3박), L. (로브 0→2), nS (1, 2.5) */
function bar(b: ChartBuilder, start: number, p: string) {
  if (p === 'nn') {
    shot(b, start, 'norm');
    shot(b, start + 2, 'norm');
  } else if (p === 'L.') shot(b, start, 'lob');
  else if (p === 'nS') {
    shot(b, start, 'norm');
    shot(b, start + 2, 'smash');
  }
}

const CHART: string[] = [
  // A (2~9)
  'nn', 'nn', 'nn', 'nn', 'nn', 'nn', 'nn', 'L.',
  // B (10~17)
  'nn', 'L.', 'nn', 'L.', 'nn', 'nn', 'L.', 'nn',
  // C (18~25)
  'nn', 'nS', 'nn', 'nS', 'L.', 'nS', 'nn', 'nS',
  // D (26~33)
  'nn', 'L.', 'nS', 'nn', 'L.', 'nS', 'nn', 'nn',
  // 엔딩 (34)
  'L.',
];

const MEL_A = [
  'E5 . G5 . B5 . G5 .', 'C6 - B5 . G5 . E5 .', 'D5 . G5 . B5 . D6 .', 'C6 - B5 . A5 - . .',
  'E5 . G5 . B5 . E6 .', 'D6 - C6 . B5 . G5 .', 'A5 . B5 . D6 . B5 .', 'A5 - - - . . . .',
].join(' ');
const MEL_B = [
  'A5 . C6 . E6 . C6 .', 'B5 - G5 . E5 . G5 .', 'C6 . E6 . G6 . E6 .', 'F#6 - - . D6 . A5 .',
  'A5 . C6 . E6 . D6 .', 'B5 - G5 . E5 . B5 .', 'C6 . B5 . A5 . G5 .', 'F#5 - - - . . . .',
].join(' ');
const PROG_A = 'Em C G D Em C G D';
const PROG_B = 'Am Em C D Am Em C D';

function groove(b: ChartBuilder, bar0: number, n: number, drive = false) {
  for (let i = 0; i < n; i++) {
    const s = b.bar(bar0 + i);
    b.drums(s, 0.5, { k: drive ? 'x.x.x.x.' : 'x...x.x.', c: '..x...x.', h: '.x.x.x.x' }, { vel: 0.8 });
    b.drums(s, 0.25, { sh: 'x.xxx.xxx.xxx.xx' }, { vel: 0.5 });
  }
}

function music(b: ChartBuilder) {
  groove(b, 0, 2);
  b.bassline(0, 4, 'Em Em', 'R.R.R.R.', 'bass');
  b.countIn(4, 4);
  b.chords(0, 8, 'Em', 'pad', { center: 64, vel: 0.5 });
  // A
  groove(b, 2, 8);
  b.bassline(b.bar(2), 4, PROG_A, 'R.R8R.R8', 'bass');
  b.chords(b.bar(2), 4, PROG_A, 'pad', { center: 64, vel: 0.6 });
  b.arp(b.bar(2), 4, PROG_A, 'chip', { step: 0.25, center: 72, vel: 0.35, order: [0, 1, 2, 3, 2, 1] });
  b.seq(b.bar(2), 0.5, MEL_A, 'lead', { vel: 0.75 });
  // B
  groove(b, 10, 8, true);
  b.bassline(b.bar(10), 4, PROG_B, 'R.R8R.R8', 'bass');
  b.chords(b.bar(10), 4, PROG_B, 'strings', { center: 64, vel: 0.7 });
  b.arp(b.bar(10), 4, PROG_B, 'chip', { step: 0.25, center: 76, vel: 0.3, order: [0, 2, 1, 2] });
  b.seq(b.bar(10), 0.5, MEL_B, 'lead', { vel: 0.75 });
  // C
  b.note(b.bar(18), 'crash', 0, 1, 0.8);
  groove(b, 18, 8, true);
  b.bassline(b.bar(18), 4, PROG_A, 'R8R8R8R8', 'bass');
  b.chords(b.bar(18), 4, PROG_A, 'brass', { rhythm: 'x..x..x.', center: 67, vel: 0.4 });
  b.chords(b.bar(18), 4, PROG_A, 'pad', { center: 60, vel: 0.5 });
  b.seq(b.bar(18), 0.5, MEL_A, 'lead', { vel: 0.8 });
  b.seq(b.bar(18), 0.5, MEL_A, 'bell', { vel: 0.3, transpose: 12 });
  // D
  b.note(b.bar(26), 'crash', 0, 1, 0.8);
  groove(b, 26, 8, true);
  b.bassline(b.bar(26), 4, PROG_B, 'R.R8R.R8', 'bass');
  b.chords(b.bar(26), 4, PROG_B, 'pad', { center: 64, vel: 0.6 });
  b.arp(b.bar(26), 4, PROG_B, 'chip', { step: 0.25, center: 72, vel: 0.35, order: [0, 1, 2, 3, 2, 1] });
  b.seq(b.bar(26), 0.5, MEL_B, 'lead', { vel: 0.8 });
  // 엔딩
  groove(b, 34, 1);
  b.bassline(b.bar(34), 2, 'C D', 'R.R.', 'bass');
  b.seq(b.bar(34), 0.5, 'C6 . B5 . A5 . F#5 .', 'lead');
  b.note(b.bar(35), 'crash', 0, 1, 1);
  b.note(b.bar(35), 'kick', 0, 1, 1);
  b.chords(b.bar(35), 4, 'Em', 'pad', { center: 64, vel: 0.8 });
  b.note(b.bar(35), 'bass', 40, 3, 0.9);
  b.note(b.bar(35), 'lead', 76, 2.5, 0.8);
}

function build(b: ChartBuilder) {
  music(b);
  CHART.forEach((p, i) => bar(b, b.bar(2 + i), p));
  b.endBeat = b.bar(35) + 3;
}

// ------------------------------------------------------------------ 그림

interface RabbitOpts {
  swing: number; // 0..1
  face: 'normal' | 'happy' | 'hurt' | 'sweat' | 'hup';
  bob: number;
  t: number;
  back?: boolean;
  scarf: string;
  jump?: number;
}

function drawRabbit(g: G, x: number, y: number, s: number, o: RabbitOpts) {
  g.save();
  g.translate(x, y - (o.jump ?? 0) * 40);
  g.scale(s, s);
  const by = o.bob * 3;
  // 발
  ellipse(g, -14, 52, 14, 7, 0, '#fff', OUT, 2.5);
  ellipse(g, 14, 52, 14, 7, 0, '#fff', OUT, 2.5);
  // 몸
  ellipse(g, 0, 22 + by, 30, 32, 0, '#ffffff', OUT, 3.5);
  ellipse(g, 0, 28 + by, 18, 20, 0, '#fff0f4');
  // 스카프
  rrect(g, -22, -2 + by, 44, 10, 5, o.scarf, OUT, 2.5);
  // 라켓 팔 (오른쪽)
  const sw = o.swing;
  const a = o.back ? lerp(-2.4, -0.8, sw) : lerp(-2.2, -0.4, sw);
  const hx = 28 + Math.cos(a) * 26;
  const hy = 10 + by + Math.sin(a) * 26;
  limb(g, [22, 8 + by, hx, hy], 12, '#ffffff', OUT, 3);
  const rx = hx + Math.cos(a) * 34;
  const ry = hy + Math.sin(a) * 34;
  line(g, hx, hy, rx, ry, OUT, 5);
  ellipse(g, rx + Math.cos(a) * 14, ry + Math.sin(a) * 14, 16, 12, a, 'rgba(200,240,255,0.5)', OUT, 3);
  limb(g, [-22, 8 + by, -32, 30 + by], 12, '#ffffff', OUT, 3);
  // 머리
  const hy2 = -28 + by;
  // 귀
  for (const side of [-1, 1]) {
    const ear = Math.sin(o.t * 3 + side) * 0.08;
    g.save();
    g.translate(side * 12, hy2 - 22);
    g.rotate(side * 0.15 + ear);
    ellipse(g, 0, -26, 9, 28, 0, '#ffffff', OUT, 3);
    ellipse(g, 0, -24, 4.5, 20, 0, '#ffb8cc');
    g.restore();
  }
  circle(g, 0, hy2, 28, '#ffffff', OUT, 3.5);
  if (!o.back) {
    const ey = hy2 - 2;
    if (o.face === 'hurt') {
      dizzyEye(g, -10, ey, 5, o.t);
      dizzyEye(g, 10, ey, 5, o.t + 1);
    } else if (o.face === 'happy') {
      happyEye(g, -10, ey, 5);
      happyEye(g, 10, ey, 5);
    } else if (o.face === 'hup') {
      line(g, -15, ey - 2, -5, ey + 2, OUT, 3);
      line(g, 15, ey - 2, 5, ey + 2, OUT, 3);
    } else {
      ellipse(g, -10, ey, 4, 5.5, 0, OUT);
      ellipse(g, 10, ey, 4, 5.5, 0, OUT);
      circle(g, -9, ey - 2, 1.4, '#fff');
      circle(g, 11, ey - 2, 1.4, '#fff');
    }
    poly(g, [-3, hy2 + 7, 3, hy2 + 7, 0, hy2 + 10], '#ff7a9a', OUT, 1.5);
    circle(g, -17, hy2 + 8, 4.5, 'rgba(255,140,170,0.5)');
    circle(g, 17, hy2 + 8, 4.5, 'rgba(255,140,170,0.5)');
    if (o.face === 'sweat') sweat(g, 26, hy2 - 16, 7);
    if (o.face === 'hurt') {
      circle(g, 4, hy2 - 28, 8, '#ffb3a6', OUT, 2.5);
      for (let i = 0; i < 3; i++) {
        const aa = o.t * 5 + (i * Math.PI * 2) / 3;
        star(g, Math.cos(aa) * 30, hy2 - 34 + Math.sin(aa) * 8, 7, 3, 5, aa, '#ffe45c', OUT, 1.5);
      }
    }
  } else {
    circle(g, 0, hy2 + 20, 7, '#ffffff', OUT, 2);
  }
  g.restore();
}

function drawShuttle(g: G, x: number, y: number, s: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  poly(g, [-3, 0, -13, -22, 13, -22, 3, 0], '#ffffff', OUT, 2.5);
  line(g, -6, -18, -3, -2, 'rgba(0,0,0,0.25)', 1.5);
  line(g, 6, -18, 3, -2, 'rgba(0,0,0,0.25)', 1.5);
  circle(g, 0, 3, 6, '#ff5a6e', OUT, 2.5);
  g.restore();
}

function createScene(sc: SceneCtx): Scene {
  const fx = new Particles();
  const spb = sc.spb;
  let mySwing = -99;
  let lastGood = -99;
  let lastBad = -99;
  let lastHurt = -99;
  let W = 393;
  let H = 852;

  const lay = () => {
    const netY = H * 0.5;
    return {
      ox: W * 0.5,
      oy: H * 0.33,
      px: W * 0.52,
      py: H * 0.8,
      // 셔틀이 도달하는 라켓 위치
      opx: W * 0.5 + 14,
      opy: H * 0.33 - 30,
      ppx: W * 0.52 + 50,
      ppy: H * 0.8 - 70,
      netY,
    };
  };

  function nextCall(c: Cue): number | null {
    let best: number | null = null;
    for (const d of sc.cues) {
      const ct = d.data.callBeat * spb;
      if (ct > c.t + 0.01 && (best === null || ct < best)) best = ct;
      if (ct > c.t + 5) break;
    }
    return best;
  }

  /** 들어오는 셔틀 위치 */
  function incoming(c: Cue, t: number): [number, number, number] {
    const L = lay();
    const ct = c.data.callBeat * spb;
    const T = c.t - ct;
    const u = (t - ct) / T;
    const h = c.kind === 'lob' ? H * 0.42 : c.kind === 'smash' ? -20 : H * 0.12;
    const x = lerp(L.opx, L.ppx, u);
    const y = lerp(L.opy, L.ppy, u) - h * 4 * u * (1 - u);
    const s = lerp(0.55, 1.35, clamp01(u));
    return [x, y, s];
  }

  function opponentSwing(t: number): number {
    let best = -99;
    for (const c of sc.cues) {
      const ct = c.data.callBeat * spb;
      if (ct <= t && ct > best) best = ct;
      if (ct > t) break;
    }
    return t - best;
  }

  function upcomingSmash(t: number): number {
    for (const c of sc.cues) {
      if (c.kind !== 'smash') continue;
      const ct = c.data.callBeat * spb;
      if (t >= ct - spb * 0.6 && t < ct + 0.1) return clamp01((t - (ct - spb * 0.6)) / (spb * 0.6));
    }
    return 0;
  }

  return {
    hitSfx: (cue) => ({ name: cue.kind === 'smash' ? 'smash' : 'racket' }),
    onInput(ev, cue) {
      if (ev.kind !== 'tap') return;
      mySwing = ev.time;
      if (!cue) {
        sc.sfx('whiff', 0, 0.8);
        return;
      }
      if (cue.grade === 'just') {
        // 성공음(라켓)은 hitSfx로 박자에 맞춰 예약됨
        lastGood = ev.time;
        const [x, y] = incoming(cue, Math.min(ev.time, cue.t));
        fx.burst(x, y, 7, { kind: 'star', r: 6, speed: 220, colors: ['#fff27a', '#ffffff', '#9fe3ff'], max: 0.45 });
      } else {
        sc.sfx('thud');
        lastBad = ev.time;
      }
    },
    onMiss(c: Cue) {
      sc.sfx('bonk');
      lastHurt = c.t + 0.1;
    },
    draw(g: G, f: Frame) {
      W = f.W;
      H = f.H;
      const t = f.t;
      fx.update(f.dt);
      const L = lay();
      // 우주
      g.fillStyle = vgrad(g, 0, H, [
        [0, '#05061a'],
        [0.4, '#141a4a'],
        [1, '#1a1030'],
      ]);
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 60; i++) {
        const tw = 0.5 + 0.5 * Math.sin(f.real * 2 + i * 1.7);
        circle(g, hash01(i * 3) * W, hash01(i * 7) * H * 0.5, 0.8 + tw, `rgba(255,255,255,${0.5 + 0.5 * tw})`);
      }
      // 지구
      const ex = W * 0.8;
      const ey = H * 0.13 + f.safe.t * 0.4;
      circle(g, ex, ey, 44, '#3a7bff', OUT, 3);
      g.save();
      g.beginPath();
      g.arc(ex, ey, 42, 0, Math.PI * 2);
      g.clip();
      ellipse(g, ex - 14, ey - 10, 18, 12, 0.4, '#5ad06a');
      ellipse(g, ex + 16, ey + 14, 14, 10, -0.3, '#5ad06a');
      ellipse(g, ex + 6, ey - 24, 20, 5, 0, 'rgba(255,255,255,0.8)');
      circle(g, ex + 20, ey + 10, 44, 'rgba(0,0,40,0.25)');
      g.restore();
      // 달 표면
      const gy = H * 0.26;
      g.fillStyle = vgrad(g, gy, H, [
        [0, '#cfd3e0'],
        [1, '#9aa0b8'],
      ]);
      g.beginPath();
      g.moveTo(0, gy + 20);
      g.quadraticCurveTo(W / 2, gy - 20, W, gy + 20);
      g.lineTo(W, H);
      g.lineTo(0, H);
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 3.5;
      g.stroke();
      for (let i = 0; i < 9; i++) {
        const cx = hash01(i * 11) * W;
        const cy = gy + 40 + hash01(i * 13) * (H - gy - 60);
        const r = 6 + hash01(i * 17) * 14 * ((cy - gy) / (H - gy) + 0.3);
        ellipse(g, cx, cy, r, r * 0.45, 0, '#b4b9cc', 'rgba(42,33,48,0.4)', 2);
      }
      // 코트 (원근)
      const topY = H * 0.3;
      const botY = H * 0.93;
      g.save();
      g.globalAlpha = 0.9;
      poly(g, [W * 0.3, topY, W * 0.7, topY, W * 0.96, botY, W * 0.04, botY], 'rgba(120,200,255,0.18)', '#ffffff', 3);
      g.restore();
      line(g, W * 0.5, topY, W * 0.5, botY, 'rgba(255,255,255,0.7)', 2);
      // 상대 (뒤쪽)
      const oSince = opponentSwing(t);
      const oSw = oSince >= 0 && oSince < 0.25 ? 1 - oSince / 0.25 : 0;
      const hup = upcomingSmash(t);
      drawRabbit(g, L.ox, L.oy, 0.74, {
        swing: oSw,
        face: hup > 0 ? 'hup' : 'normal',
        bob: bounce(f.beat),
        t: f.real,
        scarf: '#6be3a0',
        jump: hup > 0 ? Math.sin(hup * Math.PI) * 0.8 + (oSw > 0.5 ? 0.3 : 0) : 0,
      });
      // 네트
      const ny = L.netY;
      rrect(g, W * 0.16, ny - 36, 5, 44, 2, '#e0e6f0', OUT, 2);
      rrect(g, W * 0.84 - 5, ny - 36, 5, 44, 2, '#e0e6f0', OUT, 2);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(W * 0.16, ny - 34, W * 0.68, 26);
      for (let x = W * 0.16; x < W * 0.84; x += 8) line(g, x, ny - 34, x, ny - 8, 'rgba(255,255,255,0.5)', 1);
      line(g, W * 0.16, ny - 34, W * 0.84, ny - 34, '#fff', 3);
      // 셔틀
      for (const c of sc.cues) {
        const ct = c.data.callBeat * spb;
        if (ct > t) break;
        if (c.t < t - 3) continue;
        if (!c.grade || (c.grade === 'miss' && t < c.t + 0.12)) {
          if (t <= c.t) {
            const [x, y, s] = incoming(c, t);
            const rot = c.kind === 'smash' ? 0.3 : Math.sin((t - ct) * 6) * 0.3 + Math.PI;
            // 그림자
            ellipse(g, x, lerp(L.oy + 40, L.py + 40, clamp01((t - ct) / (c.t - ct))), 8 * s, 3 * s, 0, 'rgba(0,0,0,0.2)');
            drawShuttle(g, x, y, s, rot);
          } else {
            const k = (t - c.t) / 0.12;
            drawShuttle(g, lerp(L.ppx, L.px, k), lerp(L.ppy, L.py - 70, k), 1.4, Math.PI);
          }
          continue;
        }
        const at = c.at ?? c.t;
        const dt = t - at;
        if (c.grade === 'just') {
          const nc = nextCall(c);
          const back = nc !== null && nc - at < spb * 3 ? nc - at : spb;
          if (dt > back) continue;
          const u = dt / back;
          const [x0, y0] = incoming(c, Math.min(at, c.t));
          const x = lerp(x0, L.opx, u);
          const y = lerp(y0, L.opy, u) - H * 0.15 * 4 * u * (1 - u);
          drawShuttle(g, x, y, lerp(1.35, 0.55, u), -u * 0.6);
          if (dt < 0.1) {
            g.globalAlpha = 1 - dt / 0.1;
            star(g, x0, y0, 30, 12, 8, 0, '#fff7a8', OUT, 2.5);
            g.globalAlpha = 1;
          }
        } else if (c.grade === 'barely') {
          if (dt > 1) continue;
          const [x0, y0] = incoming(c, Math.min(at, c.t));
          drawShuttle(g, x0 + dt * 200, y0 - 300 * dt + 0.5 * 1200 * dt * dt, 1.3, dt * 12);
        } else {
          const d2 = t - (c.t + 0.12);
          if (d2 > 1) continue;
          drawShuttle(g, L.px + d2 * 60, L.py - 70 - 200 * d2 + 0.5 * 1500 * d2 * d2, 1.4, d2 * 10);
        }
      }
      // 나
      const ms = t - mySwing;
      const sw = ms >= 0 && ms < 0.25 ? (ms < 0.06 ? ms / 0.06 : 1 - (ms - 0.06) / 0.19) : 0;
      let face: RabbitOpts['face'] = 'normal';
      if (t - lastHurt < 0.9 && t >= lastHurt) face = 'hurt';
      else if (t - lastBad < 0.5 && t >= lastBad) face = 'sweat';
      else if (t - lastGood < 0.35 && t >= lastGood) face = 'happy';
      drawRabbit(g, L.px, L.py, 1.3, { swing: easeOutQuad(sw), face, bob: bounce(f.beat), t: f.real, scarf: '#ff4d5e', back: false });
      fx.draw(g);
      void frac;
    },
  };
}

function drawIcon(g: G, cx: number, cy: number, s: number, t: number) {
  const k = s / 130;
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  circle(g, 36, -34, 22, '#3a7bff', OUT, 2.5);
  ellipse(g, 30, -38, 8, 6, 0.4, '#5ad06a');
  drawRabbit(g, -14, 18, 0.72, { swing: frac(t) < 0.3 ? 1 : 0, face: 'happy', bob: 0, t, scarf: '#ff4d5e' });
  const u = frac(t * 0.8);
  drawShuttle(g, 30 - u * 20, -4 + Math.sin(u * Math.PI) * -20, 0.9, Math.PI + u);
  g.restore();
}

function drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number) {
  epilogueFrame(g, x, y, w, h, '#141a4a', () => {
    for (let i = 0; i < 20; i++) circle(g, x + hash01(i * 3) * w, y + hash01(i * 7) * h * 0.5, 1.2, '#fff');
    g.fillStyle = '#cfd3e0';
    g.fillRect(x, y + h * 0.65, w, h * 0.35);
    drawRabbit(g, x + w * 0.35, y + h * 0.5, 0.75, { swing: 0, face: rank === 'hi' ? 'happy' : rank === 'ok' ? 'normal' : 'hurt', bob: 0, t, scarf: '#ff4d5e' });
    drawRabbit(g, x + w * 0.68, y + h * 0.5, 0.75, { swing: 0, face: rank === 'try' ? 'sweat' : 'happy', bob: 0, t, scarf: '#6be3a0' });
    if (rank === 'hi') {
      // 트로피
      rrect(g, x + w * 0.5 - 16, y + h * 0.18, 32, 30, 8, '#ffd23e', OUT, 3);
      rrect(g, x + w * 0.5 - 6, y + h * 0.18 + 30, 12, 14, 3, '#ffd23e', OUT, 2.5);
      rrect(g, x + w * 0.5 - 18, y + h * 0.18 + 42, 36, 8, 3, '#c98a2a', OUT, 2.5);
    }
  });
}

export const badminton: GameDef = {
  id: ID,
  title: '달토끼 배드민턴',
  sub: 'Moon Rabbit Rally',
  desc: '셔틀콕이 날아오면 박자에 맞춰 받아쳐요!',
  howto: '상대가 "탁!" 치면 한 박자 뒤에 탭!\n"퐁~" 높은 공은 두 박자 뒤에.\n상대가 "읏!" 하고 뛰어오르면 스매시! 반 박자 뒤에 바로 쳐요.',
  color: '#5a6ad8',
  accent: '#dfe3ff',
  bpm: BPM,
  liveSfx: [
    ['racket', 0],
    ['smash', 0],
    ['thud', 0],
    ['bonk', 0],
    ['whiff', 0],
  ],
  build,
  practice: [
    {
      text: '상대가 "탁!" 치면\n한 박자 뒤에 탭해서 받아쳐요!',
      beats: 4,
      need: 4,
      build(b) {
        bar(b, 0, 'nn');
      },
    },
    {
      text: '"퐁~" 높이 뜬 공은\n두 박자 뒤에 쳐요!',
      beats: 8,
      need: 3,
      build(b) {
        bar(b, 0, 'L.');
        bar(b, 4, 'nn');
      },
    },
    {
      text: '"읏!" 하고 뛰면 스매시!\n반 박자 뒤에 바로 쳐요!',
      beats: 8,
      need: 3,
      build(b) {
        bar(b, 0, 'nn');
        bar(b, 4, 'nS');
      },
    },
  ],
  practiceBacking(b, beats) {
    for (let i = 0; i < beats; i += 4) {
      b.drums(i, 0.5, { k: 'x...x.x.', c: '..x...x.', h: '.x.x.x.x' }, { vel: 0.7 });
      b.bassline(i, 4, 'Em', 'R.R8R.R8', 'bass');
    }
  },
  createScene,
  drawIcon,
  cats: { norm: '보통 공', lob: '높은 공', smash: '스매시' },
  comments: {
    good: { norm: '랠리가 척척 이어졌어요!', lob: '높은 공도 침착하게 받았어요!', smash: '스매시를 완벽하게 받아냈어요!' },
    bad: { norm: '보통 공은 한 박자 뒤에 쳐요.', lob: '높은 공은 두 박자를 기다려요.', smash: '스매시는 "읏!" 반 박자 뒤예요.' },
  },
  epilogue: {
    hi: '달나라 배드민턴 대회 우승! 지구에서도 보였대요.',
    ok: '재미있는 랠리였어요. 다음엔 더 길게!',
    try: '셔틀콕이 우주 멀리 날아가 버렸어요...',
  },
  drawEpilogue,
  remixPart(b, start, bars, v) {
    const pats = v % 2 ? ['nn', 'nS', 'L.', 'nn'] : ['nn', 'L.', 'nn', 'nS'];
    for (let i = 0; i < bars; i++) bar(b, start + i * b.beatsPerBar, pats[i % pats.length]);
  },
};
