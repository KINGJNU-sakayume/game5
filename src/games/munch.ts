// 11. 냠냠 곰돌이 — 왼쪽에서 오면 왼쪽, 오른쪽에서 오면 오른쪽을 탭! (양쪽이면 두 손가락)
import type { ChartBuilder, Cue } from '../core/chart';
import type { Frame, GameDef, GameInput, Scene, SceneCtx } from '../core/game';
import { OUT, Particles, circle, ellipse, happyEye, line, limb, poly, rrect, star, sweat, text, type G } from '../core/gfx';
import type { Judge, Rank } from '../core/judge';
import { arc, bounce, clamp01, frac, hash01, lerp } from '../core/util';
import { epilogueFrame, pattern } from './common';

const ID = 'munch';
const BPM = 128;
type Side = 'L' | 'R';

function toss(b: ChartBuilder, beat: number, side: Side, both = false) {
  b.sfx(beat, side === 'L' ? 'toss' : 'plop', 1, 0, side === 'L' ? -0.6 : 0.6);
  b.cue(beat + 1, 'tap', side, { callBeat: beat, side }, { cat: both ? 'both' : side === 'L' ? 'left' : 'right' });
}

function place(b: ChartBuilder, start: number, str: string) {
  pattern(b, start, 0.5, str, (ch, beat) => {
    if (ch === 'L' || ch === 'R') toss(b, beat, ch);
    else if (ch === 'B') {
      toss(b, beat, 'L', true);
      toss(b, beat, 'R', true);
    }
  });
}

const CHART: string[] = [
  // A (2~9)
  'L...R...', 'L...R...', 'L...L...', 'R...R...', 'L...R...', 'R...L...', 'L.R.L...', 'R.......',
  // B (10~17) 양쪽 동시
  'L...R...', 'B.......', 'L...R...', 'B.......', 'R...L...', 'B...L...', 'R...B...', 'L.R.....',
  // C (18~25) 빨라짐
  'L.R.L.R.', 'L.R.L...', 'R.L.R.L.', 'B...B...', 'L.L.R.R.', 'R.R.L.L.', 'L.R.B...', 'R.L.....',
  // D (26~33)
  'LR..LR..', 'L.R.B...', 'RL..RL..', 'B.B.....', 'LRL.RLR.', 'L...B...', 'LR..RL..', 'B.......',
];

const PROG_A = 'C G Am F C G F C';
const PROG_B = 'F G Em Am Dm G C C';

function band(b: ChartBuilder, bar: number, prog: string, busy: boolean) {
  const n = prog.split(' ').length;
  b.bassline(b.bar(bar), 4, prog, busy ? 'R.8.R.8.' : 'R...R.5.', 'bass', { vel: 0.65 });
  b.chords(b.bar(bar), 4, prog, 'ep', { rhythm: 'x..x..x.', center: 64, vel: 0.45 });
  for (let i = 0; i < n; i++) {
    b.drums(b.bar(bar + i), 0.5, { k: busy ? 'x..xx...' : 'x...x...', s: '..x...x.', h: 'x.x.x.x.' }, { vel: 0.75 });
  }
}

function music(b: ChartBuilder) {
  band(b, 0, 'C C', false);
  b.countIn(4, 4);
  const melA = [
    'E5 . G5 . C6 - G5 .', 'D5 . G5 . B5 - G5 .', 'C5 . E5 . A5 - E5 .', 'F5 . A5 . C6 - A5 .',
    'G5 . E5 . C5 . E5 .', 'D5 . B4 . G4 . B4 .', 'A4 . C5 . F5 . A5 .', 'G5 - - - . . . .',
  ].join(' ');
  const melB = [
    'A5 . C6 . A5 . F5 .', 'B5 . D6 . B5 . G5 .', 'G5 . E5 . B4 . E5 .', 'A5 - - . E5 . C5 .',
    'F5 . A5 . D6 . A5 .', 'G5 . B5 . D6 . B5 .', 'C6 . G5 . E5 . G5 .', 'C6 - - - . . . .',
  ].join(' ');
  band(b, 2, PROG_A, false);
  b.seq(b.bar(2), 0.5, melA, 'marimba', { vel: 0.55 });
  band(b, 10, PROG_B, false);
  b.seq(b.bar(10), 0.5, melB, 'flute', { vel: 0.6 });
  b.note(b.bar(18), 'crash', 0, 1, 0.8);
  band(b, 18, PROG_A, true);
  b.seq(b.bar(18), 0.5, melA, 'lead', { vel: 0.55 });
  b.chords(b.bar(18), 4, PROG_A, 'pad', { center: 60, vel: 0.45 });
  b.note(b.bar(26), 'crash', 0, 1, 0.8);
  band(b, 26, PROG_B, true);
  b.seq(b.bar(26), 0.5, melB, 'lead', { vel: 0.55 });
  b.seq(b.bar(26), 0.5, melB, 'bell', { vel: 0.25, transpose: 12 });
  // 엔딩: 트림 한 번
  const end = b.bar(34);
  b.note(end, 'crash', 0, 1, 1);
  b.chords(end, 4, 'C', 'ep', { center: 64, vel: 0.8 });
  b.note(end, 'bass', 36, 2, 0.8);
  b.sfx(end + 1, 'burp', 0.9);
}

function build(b: ChartBuilder) {
  music(b);
  CHART.forEach((p, i) => place(b, b.bar(2 + i), p));
  b.endBeat = b.bar(34) + 3;
}

// ------------------------------------------------------------------ 그림

function drawDonut(g: G, s = 1) {
  circle(g, 0, 0, 22 * s, '#e8a860', OUT, 3);
  circle(g, 0, -2 * s, 18 * s, '#ff8ab8');
  circle(g, 0, 0, 7 * s, '#fff4e0', OUT, 2.5);
  const cols = ['#fff', '#6bc6ff', '#ffe14d', '#6be3a0'];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 12 * s;
    line(g, Math.cos(a) * r - 2, Math.sin(a) * r - 3, Math.cos(a) * r + 2, Math.sin(a) * r - 1, cols[i % 4], 2.5);
  }
}

function drawCake(g: G, s = 1) {
  poly(g, [-20 * s, 16 * s, 20 * s, 16 * s, 16 * s, -8 * s, -16 * s, -8 * s], '#fff0d8', OUT, 3);
  rrect(g, -20 * s, -14 * s, 40 * s, 10 * s, 5 * s, '#fff', OUT, 2.5);
  line(g, -18 * s, 4 * s, 18 * s, 4 * s, '#ff8ab8', 3);
  circle(g, 0, -20 * s, 7 * s, '#ff4d5e', OUT, 2.5);
  line(g, 0, -27 * s, 3 * s, -32 * s, '#3a9a4a', 2);
}

interface BearOpts {
  look: number; // -1 왼쪽, 1 오른쪽
  open: number; // 입 벌림 0..1
  chomp: number; // 씹기 경과
  face: 'normal' | 'happy' | 'bonk' | 'sweat';
  bonkSide: number;
  bob: number;
  t: number;
}

function drawBear(g: G, x: number, y: number, s: number, o: BearOpts) {
  g.save();
  g.translate(x, y + o.bob * 3);
  g.scale(s, s);
  // 몸
  ellipse(g, 0, 70, 80, 70, 0, '#b07a4f', OUT, 3.5);
  ellipse(g, 0, 80, 50, 46, 0, '#e8c8a0');
  // 턱받이
  g.beginPath();
  g.moveTo(-40, 26);
  g.quadraticCurveTo(0, 90, 40, 26);
  g.closePath();
  g.fillStyle = '#fff';
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 3;
  g.stroke();
  for (let i = -2; i <= 2; i++) circle(g, i * 12, 40 + Math.abs(i) * -3, 3, '#ff8ab8');
  // 머리 (좌우로 살짝 돌림)
  g.save();
  g.translate(o.look * 10, 0);
  g.rotate(o.look * 0.12);
  circle(g, -44, -58, 18, '#b07a4f', OUT, 3);
  circle(g, 44, -58, 18, '#b07a4f', OUT, 3);
  circle(g, -44, -58, 9, '#e8a888');
  circle(g, 44, -58, 9, '#e8a888');
  circle(g, 0, -20, 58, '#b07a4f', OUT, 3.5);
  ellipse(g, o.look * 6, 2, 30, 22, 0, '#e8c8a0', OUT, 2.5);
  ellipse(g, o.look * 6, -8, 9, 6, 0, OUT);
  // 눈
  const ex = o.look * 6;
  if (o.face === 'happy') {
    happyEye(g, ex - 22, -34, 7);
    happyEye(g, ex + 22, -34, 7);
  } else if (o.face === 'bonk') {
    line(g, ex - 28, -40, ex - 16, -32, OUT, 3.5);
    line(g, ex - 28, -32, ex - 16, -40, OUT, 3.5);
    line(g, ex + 16, -40, ex + 28, -32, OUT, 3.5);
    line(g, ex + 16, -32, ex + 28, -40, OUT, 3.5);
  } else {
    ellipse(g, ex - 22 + o.look * 4, -34, 5, 7, 0, OUT);
    ellipse(g, ex + 22 + o.look * 4, -34, 5, 7, 0, OUT);
    circle(g, ex - 20 + o.look * 4, -37, 2, '#fff');
    circle(g, ex + 24 + o.look * 4, -37, 2, '#fff');
  }
  // 입
  const ch = o.chomp >= 0 && o.chomp < 0.3 ? Math.abs(Math.sin((o.chomp / 0.3) * Math.PI * 2)) : 0;
  const open = Math.max(o.open, ch);
  if (open > 0.05) {
    ellipse(g, ex, 16, 14, 4 + open * 12, 0, '#8a2a3a', OUT, 2.5);
    ellipse(g, ex, 22 + open * 4, 7, 4 * open, 0, '#ff8aa8');
  } else {
    g.beginPath();
    g.moveTo(ex - 10, 12);
    g.quadraticCurveTo(ex - 5, 18, ex, 12);
    g.quadraticCurveTo(ex + 5, 18, ex + 10, 12);
    g.strokeStyle = OUT;
    g.lineWidth = 3;
    g.stroke();
  }
  circle(g, ex - 38, -4, 8, 'rgba(255,130,150,0.45)');
  circle(g, ex + 38, -4, 8, 'rgba(255,130,150,0.45)');
  if (o.face === 'bonk') {
    ellipse(g, o.bonkSide * 50, -10, 12, 9, 0, '#ffb3a6', OUT, 2.5);
  }
  if (o.face === 'sweat') sweat(g, 56, -60, 8);
  g.restore();
  // 팔
  limb(g, [-66, 50, -86, 96], 22, '#b07a4f', OUT, 3);
  limb(g, [66, 50, 86, 96], 22, '#b07a4f', OUT, 3);
  g.restore();
}

function createScene(sc: SceneCtx): Scene {
  const fx = new Particles();
  const spb = sc.spb;
  let W = 393;
  let H = 852;
  let lastChomp = -99;
  let chompSide = 0;
  let lastGood = -99;
  let lastBonk = -99;
  let bonkSide = 0;
  let lastBarely = -99;
  const padFlash: Record<Side, number> = { L: -99, R: -99 };

  const lay = () => {
    const tableY = H * 0.72;
    return { tableY, bx: W / 2, by: tableY - 150, mx: W / 2, my: tableY - 150 + 18 * 1.3 };
  };

  const sideOf = (ev: GameInput): Side | null => (ev.x < 0 ? null : ev.x < W / 2 ? 'L' : 'R');

  function flight(c: Cue, t: number): [number, number] {
    const L = lay();
    const ct = c.data.callBeat * spb;
    const u = (t - ct) / (c.t - ct);
    const sx = c.data.side === 'L' ? -40 : W + 40;
    return arc(sx, L.tableY - 60, L.mx + (c.data.side === 'L' ? -14 : 14), L.my, 150, Math.min(1, u));
  }

  return {
    hitSfx: () => [
      { name: 'chop', vel: 0.5 },
      { name: 'plop', vel: 0.8 },
    ],
    judge(ev: GameInput, j: Judge) {
      if (ev.kind !== 'tap') return undefined;
      const side = sideOf(ev);
      if (side) padFlash[side] = ev.time;
      return j.match(ev, (c) => side === null || c.data.side === side);
    },
    onInput(ev, cue) {
      if (ev.kind !== 'tap') return;
      const side = cue ? (cue.data.side as Side) : sideOf(ev) ?? 'L';
      chompSide = side === 'L' ? -1 : 1;
      lastChomp = ev.time;
      if (!cue) {
        sc.sfx('whiff', 0, 0.5);
        return;
      }
      if (cue.grade === 'just') {
        // 성공음(냠)은 hitSfx로 박자에 맞춰 예약됨
        lastGood = ev.time;
        const L = lay();
        fx.burst(L.mx + chompSide * 20, L.my, 6, { kind: 'dot', r: 4, speed: 180, colors: cue.data.side === 'L' ? ['#ff8ab8', '#ffe14d'] : ['#fff', '#ff4d5e'], max: 0.4, g: 500 });
      } else {
        lastBarely = ev.time;
        sc.sfx('thud', 0, 0.8);
      }
    },
    onMiss(c: Cue) {
      lastBonk = c.t + 0.1;
      bonkSide = c.data.side === 'L' ? -1 : 1;
      sc.sfx('bonk', 0, 0.8);
    },
    draw(g: G, f: Frame) {
      W = f.W;
      H = f.H;
      const t = f.t;
      fx.update(f.dt);
      const L = lay();
      // 카페 벽지
      g.fillStyle = '#fff1dc';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 60; i++) {
        const x = (i % 6) * (W / 5) + (Math.floor(i / 6) % 2) * (W / 10);
        const y = Math.floor(i / 6) * 70 + 30;
        circle(g, x, y, 8, 'rgba(255,170,120,0.25)');
      }
      // 간판
      rrect(g, W / 2 - 80, f.safe.t + 30, 160, 50, 25, '#b07a4f', OUT, 3);
      text(g, '냠냠 카페', W / 2, f.safe.t + 56, 20, '#fff', { weight: 900 });
      // 매달린 조명
      for (const lx of [W * 0.2, W * 0.8]) {
        const sw = Math.sin(f.real * 1.2 + lx) * 4;
        line(g, lx, 0, lx + sw, f.safe.t + 70, OUT, 2.5);
        g.beginPath();
        g.moveTo(lx + sw - 28, f.safe.t + 100);
        g.quadraticCurveTo(lx + sw, f.safe.t + 56, lx + sw + 28, f.safe.t + 100);
        g.closePath();
        g.fillStyle = '#ffd23e';
        g.fill();
        g.strokeStyle = OUT;
        g.lineWidth = 3;
        g.stroke();
        circle(g, lx + sw, f.safe.t + 104, 7, '#fff7c8', OUT, 2);
      }
      // 메뉴판
      const my0 = f.safe.t + 140;
      rrect(g, 18, my0, 110, 130, 12, '#3a4a3a', '#8a5a36', 6);
      text(g, 'MENU', 73, my0 + 22, 15, '#fff', { weight: 900 });
      ['도넛', '케이크', '쿠키'].forEach((m, i) => text(g, m + ' ♪', 73, my0 + 52 + i * 24, 13, '#e8f8d8', { weight: 700 }));
      // 케이크 진열장
      rrect(g, W - 132, my0 + 20, 114, 110, 12, 'rgba(200,240,255,0.5)', OUT, 3);
      line(g, W - 132, my0 + 75, W - 18, my0 + 75, OUT, 3);
      for (let i = 0; i < 3; i++) {
        g.save();
        g.translate(W - 110 + i * 36, my0 + 60);
        drawCake(g, 0.55);
        g.restore();
        g.save();
        g.translate(W - 110 + i * 36, my0 + 112);
        drawDonut(g, 0.55);
        g.restore();
      }
      // 곰
      const d = t - lastChomp;
      // 다가오는 간식 쪽으로 고개와 입
      let look = 0;
      let open = 0;
      for (const c of sc.cues) {
        if (c.grade) continue;
        const ct = c.data.callBeat * spb;
        if (ct > t) break;
        const u = (t - ct) / (c.t - ct);
        if (u > 0.4) {
          look += (c.data.side === 'L' ? -1 : 1) * (u - 0.4);
          open = Math.max(open, (u - 0.4) / 0.6);
        }
      }
      if (d >= 0 && d < 0.3) look = chompSide;
      look = Math.max(-1, Math.min(1, look));
      let face: BearOpts['face'] = 'normal';
      if (t - lastBonk < 0.7 && t >= lastBonk) face = 'bonk';
      else if (t - lastBarely < 0.4 && t >= lastBarely) face = 'sweat';
      else if (t - lastGood < 0.35 && t >= lastGood) face = 'happy';
      drawBear(g, L.bx, L.by, 1.3, { look, open: Math.min(1, open), chomp: d, face, bonkSide, bob: bounce(f.beat), t: f.real });
      // 테이블
      rrect(g, -20, L.tableY, W + 40, 30, 10, '#e07a5a', OUT, 4);
      g.fillStyle = '#c8603f';
      g.fillRect(0, L.tableY + 30, W, H - L.tableY - 30);
      line(g, 0, L.tableY + 30, W, L.tableY + 30, OUT, 3);
      // 접시
      ellipse(g, W / 2, L.tableY + 4, 70, 12, 0, '#fff', OUT, 3);
      // 던지는 손 (좌/우)
      for (const side of [-1, 1] as const) {
        let best = -99;
        for (const c of sc.cues) {
          if ((c.data.side === 'L' ? -1 : 1) !== side) continue;
          const ct = c.data.callBeat * spb;
          if (ct <= t + 0.05 && ct > best) best = ct;
          if (ct > t + 0.1) break;
        }
        const dd = t - best;
        if (dd > -0.05 && dd < 0.3) {
          const k = dd < 0.08 ? clamp01((dd + 0.05) / 0.13) : 1 - clamp01((dd - 0.08) / 0.22);
          const hx = side < 0 ? -20 + k * 50 : W + 20 - k * 50;
          limb(g, [side < 0 ? -60 : W + 60, L.tableY - 40, hx, L.tableY - 70], 20, '#ffffff', OUT, 3);
          circle(g, hx, L.tableY - 72, 13, '#ffd9b3', OUT, 3);
        }
      }
      // 간식
      for (const c of sc.cues) {
        const ct = c.data.callBeat * spb;
        if (ct > t) break;
        if (c.t < t - 2) continue;
        const left = c.data.side === 'L';
        const draw = (x: number, y: number, rot: number, sc2 = 1) => {
          g.save();
          g.translate(x, y);
          g.rotate(rot);
          if (left) drawDonut(g, sc2);
          else drawCake(g, sc2);
          g.restore();
        };
        const spin = (t - ct) * 6 * (left ? 1 : -1);
        if (!c.grade || (c.grade === 'miss' && t < c.t + 0.12)) {
          if (t <= c.t) {
            const [x, y] = flight(c, t);
            draw(x, y, spin);
          } else {
            const k = (t - c.t) / 0.12;
            draw(lerp(L.mx, L.mx + (left ? 1 : -1) * -44, k) + (left ? -14 : 14), L.my - k * 10, spin);
          }
          continue;
        }
        const at = c.at ?? c.t;
        const dt = t - at;
        if (c.grade === 'just') {
          if (dt < 0.12) draw(L.mx + (left ? -14 : 14), L.my, spin, 1 - dt / 0.12);
        } else if (c.grade === 'barely') {
          if (dt > 1) continue;
          draw(L.mx + (left ? -1 : 1) * (20 + dt * 120), L.my - 150 * dt + 0.5 * 1400 * dt * dt, spin + dt * 10);
        } else {
          const d2 = t - (c.t + 0.12);
          if (d2 > 1) continue;
          draw(L.mx + (left ? -58 : 58) + (left ? -1 : 1) * d2 * 80, L.my - 10 - 150 * d2 + 0.5 * 1500 * d2 * d2, spin + d2 * 8);
        }
      }
      fx.draw(g);
      // 좌/우 터치 패드 표시
      const py = H - f.safe.b - 70;
      for (const side of ['L', 'R'] as const) {
        const px = side === 'L' ? W * 0.25 : W * 0.75;
        const flash = clamp01(1 - (t - padFlash[side]) / 0.18);
        rrect(g, px - 70, py - 32, 140, 64, 26, `rgba(255,255,255,${0.35 + flash * 0.5})`, 'rgba(42,33,48,0.5)', 2.5);
        g.save();
        g.translate(px, py);
        circle(g, 0, 6, 12, '#b07a4f');
        for (let i = -1; i <= 1; i++) circle(g, i * 11, -10 - Math.abs(i) * -3, 5.5, '#b07a4f');
        g.restore();
        text(g, side === 'L' ? '왼쪽' : '오른쪽', px + (side === 'L' ? 42 : -42), py + 1, 13, 'rgba(42,33,48,0.7)', { weight: 800 });
      }
      void hash01;
      void frac;
      void star;
    },
  };
}

function drawIcon(g: G, cx: number, cy: number, s: number, t: number) {
  const k = s / 150;
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  const ph = frac(t * 1.2);
  drawBear(g, 0, 10, 0.72, { look: ph < 0.5 ? -1 : 1, open: 0, chomp: (ph % 0.5) * 0.6, face: 'happy', bonkSide: 0, bob: 0, t });
  g.save();
  g.translate(-58, -30);
  drawDonut(g, 0.9);
  g.restore();
  g.save();
  g.translate(58, -30);
  drawCake(g, 0.9);
  g.restore();
  g.restore();
}

function drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number) {
  epilogueFrame(g, x, y, w, h, '#fff1dc', () => {
    const big = rank === 'hi' ? 1.12 : rank === 'ok' ? 1 : 0.92;
    g.save();
    g.translate(x + w / 2, y + h * 0.42);
    g.scale(0.55 * big, 0.55);
    drawBear(g, 0, 0, 1, { look: 0, open: 0, chomp: 99, face: rank === 'try' ? 'sweat' : 'happy', bonkSide: 0, bob: 0, t });
    g.restore();
    const n = rank === 'hi' ? 8 : rank === 'ok' ? 4 : 1;
    for (let i = 0; i < n; i++) {
      g.save();
      g.translate(x + 24 + i * 22, y + h - 20 - (i % 2) * 6);
      rrect(g, -14, -3, 28, 6, 3, '#fff', OUT, 2);
      g.restore();
    }
    if (rank === 'try') {
      g.save();
      g.translate(x + w * 0.8, y + h * 0.75);
      drawDonut(g, 0.8);
      g.restore();
    }
  });
}

export const munch: GameDef = {
  id: ID,
  title: '냠냠 곰돌이',
  sub: 'Munch Bear',
  desc: '간식이 오는 쪽을 탭해서 냠냠!',
  howto: '왼쪽에서 도넛이 "뽁!" 날아오면 한 박자 뒤에 화면 왼쪽을 탭,\n오른쪽에서 케이크가 "퐁!" 오면 오른쪽을 탭!\n양쪽에서 동시에 오면 두 손가락으로 동시에!',
  color: '#e8a860',
  accent: '#fff1dc',
  bpm: BPM,
  liveSfx: [
    ['chop', 0],
    ['plop', 0],
    ['thud', 0],
    ['bonk', 0],
    ['whiff', 0],
  ],
  build,
  practice: [
    {
      text: '왼쪽에서 오면 한 박자 뒤 왼쪽 탭,\n오른쪽에서 오면 오른쪽 탭!',
      beats: 8,
      need: 4,
      build(b) {
        toss(b, 0, 'L');
        toss(b, 2, 'R');
        toss(b, 4, 'L');
        toss(b, 6, 'R');
      },
    },
    {
      text: '양쪽에서 동시에 오면\n두 손가락으로 동시에 탭!',
      beats: 8,
      need: 4,
      build(b) {
        place(b, 0, 'B.......');
        place(b, 4, 'L...R...');
      },
    },
  ],
  practiceBacking(b, beats) {
    for (let i = 0; i < beats; i += 4) {
      b.drums(i, 0.5, { k: 'x...x...', s: '..x...x.', h: 'x.x.x.x.' }, { vel: 0.7 });
      b.bassline(i, 4, 'C', 'R...R.5.', 'bass', { vel: 0.6 });
    }
  },
  createScene,
  drawIcon,
  cats: { left: '왼쪽 간식', right: '오른쪽 간식', both: '양쪽 동시' },
  comments: {
    good: { left: '왼쪽 도넛을 놓치지 않았어요!', right: '오른쪽 케이크도 냠냠!', both: '양손 동시 냠냠이 완벽했어요!' },
    bad: { left: '왼쪽 "뽁!"은 왼쪽을 탭해요.', right: '오른쪽 "퐁!"은 오른쪽을 탭해요.', both: '양쪽은 두 손가락으로 동시에!' },
  },
  epilogue: {
    hi: '곰돌이가 배불러서 행복한 낮잠에 빠졌어요.',
    ok: '배는 그럭저럭 찼어요. 디저트 하나 더?',
    try: '간식이 얼굴에만 맞았어요... 곰돌이는 아직 배고파요.',
  },
  drawEpilogue,
  remixPart(b, start, bars, v) {
    const pats = v % 2 ? ['L.R.L.R.', 'B...L...', 'R.L.R.L.', 'B.......'] : ['L...R...', 'B.......', 'L.R.L...', 'R...B...'];
    for (let i = 0; i < bars; i++) place(b, start + i * b.beatsPerBar, pats[i % pats.length]);
  },
};
