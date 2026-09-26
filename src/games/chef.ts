// 1. 촙촙 셰프 — 날아오는 재료를 박자에 맞춰 탭해서 썰기
import type { ChartBuilder, Cue } from '../core/chart';
import type { Frame, GameDef, Scene, SceneCtx } from '../core/game';
import {
  OUT,
  Particles,
  circle,
  dizzyEye,
  ellipse,
  happyEye,
  line,
  limb,
  poly,
  pow,
  rrect,
  star,
  sweat,
  text,
  vgrad,
  withT,
  type G,
} from '../core/gfx';
import type { Rank } from '../core/judge';
import { arc, bounce, clamp01, easeOutQuad, frac, lerp } from '../core/util';
import { epilogueFrame, pattern, shadow } from './common';

const ID = 'chef';
const STAGE_K = 1.28;
const BPM = 120;

type Kind = 'norm' | 'rice' | 'melon';
const DELAY: Record<Kind, number> = { norm: 1, rice: 1.5, melon: 2 };
const VEG = ['tomato', 'carrot', 'onion', 'pepper', 'mushroom'];

let vegCounter = 0;
function toss(b: ChartBuilder, beat: number, kind: Kind) {
  const snd = kind === 'norm' ? 'toss' : kind === 'rice' ? 'slideUp' : 'heave';
  b.sfx(beat, snd, 1, 0, 0.3);
  b.cue(beat + DELAY[kind], 'tap', kind, { callBeat: beat, veg: VEG[vegCounter++ % VEG.length] }, { weight: kind === 'melon' ? 1.5 : 1 });
}

function place(b: ChartBuilder, start: number, str: string) {
  pattern(b, start, 0.5, str, (ch, beat) => {
    if (ch === 'n') toss(b, beat, 'norm');
    else if (ch === 'r') toss(b, beat, 'rice');
    else if (ch === 'w') toss(b, beat, 'melon');
  });
}

const CHART: string[] = [
  // A (2~9)
  'n...n...', 'n...n...', 'n...n...', 'n.n.n...',
  'n...n...', 'n...n...', 'n...n.n.', 'n.......',
  // B (10~17) 떡 등장
  'r...n...', 'n...n...', 'r...n...', 'n.n.n...',
  'r...r...', 'n...n...', 'r...n...', 'n.n.r...',
  // 피버 (18~21)
  'n.n.n.n.', 'n.n.n.n.', 'n.n.n.n.', 'n.n.n...',
  // C (22~29) 수박 등장
  'w.......', 'n...n...', 'w...n...', 'n.n.n...',
  'w.......', 'r...n...', 'w...n...', 'n.......',
  // D (30~37)
  'n...r...', 'n.n.n...', 'w...r...', 'n...n...',
  'r...r...', 'n.n.n.n.', 'w...n...', 'n.n.n...',
  // 엔딩 (38)
  'w.......',
];

const MEL_A = [
  'C5 . A4 C5 . F5 . C5', 'D5 - C5 A4 . F4 . A4', 'Bb4 . D5 F5 . D5 . Bb4', 'C5 - - . G4 A4 Bb4 .',
  'C5 . A4 C5 . F5 . A5', 'G5 - F5 D5 . C5 . A4', 'Bb4 . C5 D5 . F5 . D5', 'C5 - - - . . . .',
].join(' ');
const MEL_B = [
  'F5 - D5 . Bb4 . D5 .', 'E5 - C5 . G4 . C5 .', 'E5 . C5 E5 . A5 . G5', 'F5 - - D5 . . A4 .',
  'Bb4 . D5 . G5 . F5 .', 'E5 . D5 . C5 . Bb4 .', 'A4 . C5 . F5 - - .', '. . . . C5 D5 E5 .',
].join(' ');
const MEL_F = ['F5 . F5 . A5 . C6 .', 'A5 . F5 . C5 . F5 .', 'D6 . Bb5 . F5 . D5 .', 'E5 . G5 . C6 - - .'].join(' ');
const MEL_C = [
  'D5 - - A4 . D5 . E5', 'F5 - - D5 . Bb4 . D5', 'C5 - - A4 . F4 . A4', 'G4 - - . C5 . E5 .',
  'F5 - - E5 . D5 . A4', 'Bb4 - - C5 . D5 . F5', 'E5 - - D5 . C5 . E5', 'G5 - - - . . . .',
].join(' ');

function drumsA(b: ChartBuilder, bar: number, bars: number, extra = false) {
  for (let i = 0; i < bars; i++) {
    const s = b.bar(bar + i);
    const fill = i === bars - 1;
    b.drums(s, 0.5, {
      k: fill ? 'x..x.x..' : 'x..x..x.',
      s: fill ? '..x.xxXX' : '..x...x.',
      h: fill ? 'xxxx....' : 'xoxoxoxo',
      ...(extra ? { t: '..x...x.' } : {}),
    });
  }
}

function music(b: ChartBuilder) {
  // 인트로
  b.drums(0, 0.5, { k: 'x...x...', tl: '....x.x.', th: '.....x.x' });
  b.drums(4, 0.5, { k: 'x.x.x.x.', h: 'x.x.x.x.' });
  b.countIn(4, 4);
  b.bassline(0, 4, 'F F', 'R...R...', 'bass');
  // A
  drumsA(b, 2, 8);
  b.bassline(b.bar(2), 4, 'F Dm Bb C F Dm Bb C', 'R.R8.R5.');
  b.chords(b.bar(2), 4, 'F Dm Bb C F Dm Bb C', 'ep', { rhythm: '.x.x.x.x', center: 65, vel: 0.55 });
  b.seq(b.bar(2), 0.5, MEL_A, 'lead', { vel: 0.8 });
  // B
  drumsA(b, 10, 8, true);
  b.bassline(b.bar(10), 4, 'Bb C Am Dm Gm C F F', 'R.R8.R5.');
  b.chords(b.bar(10), 4, 'Bb C Am Dm Gm C F F', 'pad', { center: 64, vel: 0.7 });
  b.chords(b.bar(10), 4, 'Bb C Am Dm Gm C F F', 'ep', { rhythm: '.x.x.x.x', center: 67, vel: 0.4 });
  b.seq(b.bar(10), 0.5, MEL_B, 'lead', { vel: 0.8 });
  // 피버
  b.note(b.bar(18), 'crash', 0, 1, 1);
  for (let i = 0; i < 4; i++) {
    b.drums(b.bar(18 + i), 0.25, { k: 'x...x...x...x...', c: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' });
  }
  b.bassline(b.bar(18), 4, 'F F Bb C', 'R8R8R8R8');
  b.chords(b.bar(18), 4, 'F F Bb C', 'brass', { rhythm: 'X..X..X.', center: 67, vel: 0.7 });
  b.seq(b.bar(18), 0.5, MEL_F, 'lead', { vel: 0.85 });
  b.seq(b.bar(18), 0.5, MEL_F, 'chip', { vel: 0.5, transpose: -12 });
  // C (수박)
  b.note(b.bar(22), 'crash', 0, 1, 0.9);
  for (let i = 0; i < 8; i++) {
    const s = b.bar(22 + i);
    b.drums(s, 0.5, { k: i % 4 === 3 ? 'x.x.x.xx' : 'x.....x.', s: '....x...', h: 'x.x.x.x.', tk: i % 2 ? '' : 'x.......' });
  }
  b.bassline(b.bar(22), 4, 'Dm Bb F C Dm Bb C C', 'R-..R-5.');
  b.chords(b.bar(22), 4, 'Dm Bb F C Dm Bb C C', 'strings', { center: 62, vel: 0.8 });
  b.seq(b.bar(22), 0.5, MEL_C, 'lead', { vel: 0.8 });
  b.seq(b.bar(22), 0.5, MEL_C, 'flute', { vel: 0.35, transpose: -12 });
  // D
  b.note(b.bar(30), 'crash', 0, 1, 0.9);
  drumsA(b, 30, 8, true);
  b.bassline(b.bar(30), 4, 'F Dm Bb C F Dm Bb C', 'R.R8.R5.');
  b.chords(b.bar(30), 4, 'F Dm Bb C F Dm Bb C', 'ep', { rhythm: '.x.x.x.x', center: 65, vel: 0.55 });
  b.chords(b.bar(30), 4, 'F Dm Bb C F Dm Bb C', 'pad', { center: 60, vel: 0.5 });
  b.seq(b.bar(30), 0.5, MEL_A, 'lead', { vel: 0.8 });
  b.seq(b.bar(30), 0.5, MEL_A, 'flute', { vel: 0.35, transpose: -12 });
  // 엔딩
  b.drums(b.bar(38), 0.5, { k: 'x...x...', s: '..x.xxXX', h: 'xxxx....' });
  b.bassline(b.bar(38), 2, 'Bb C', 'R.R.');
  b.chords(b.bar(38), 2, 'Bb C', 'brass', { rhythm: 'X.x.', center: 67, vel: 0.6 });
  b.seq(b.bar(38), 0.5, 'D5 . F5 . E5 . G5 .', 'lead');
  b.note(b.bar(39), 'crash', 0, 1, 1);
  b.note(b.bar(39), 'kick', 0, 1, 1);
  b.chords(b.bar(39), 4, 'F', 'brass', { center: 67, vel: 0.8, gate: 0.6 });
  b.note(b.bar(39), 'bass', 29, 3, 0.9);
  b.note(b.bar(39), 'lead', 77, 2.5, 0.8);
}

function build(b: ChartBuilder) {
  vegCounter = 0;
  music(b);
  CHART.forEach((p, i) => place(b, b.bar(2 + i), p));
  b.marker(b.bar(18), 'fever', { on: true });
  b.marker(b.bar(22), 'fever', { on: false });
  b.endBeat = b.bar(39) + 3;
}

// ------------------------------------------------------------------ 그림

const FLESH: Record<string, [string, string]> = {
  tomato: ['#ff6b5e', '#ffd0a0'],
  carrot: ['#ff9a3c', '#ffc27a'],
  onion: ['#f6e7ff', '#fff'],
  pepper: ['#b8f07a', '#f5ffe8'],
  mushroom: ['#f3e2c8', '#fff5e6'],
  rice: ['#fff6ee', '#ffe1ec'],
  melon: ['#ff5a6e', '#ff8e9c'],
};

function drawItem(g: G, kind: string, s = 1) {
  switch (kind) {
    case 'tomato':
      circle(g, 0, 0, 20 * s, '#ff4d3d', OUT, 3);
      ellipse(g, -6 * s, -7 * s, 6 * s, 4 * s, -0.6, 'rgba(255,255,255,0.55)');
      star(g, 0, -17 * s, 9 * s, 4 * s, 5, -Math.PI / 2, '#4fbf4a', OUT, 2);
      break;
    case 'carrot':
      poly(g, [-10 * s, -18 * s, 10 * s, -18 * s, 0, 26 * s], '#ff8c2a', OUT, 3);
      line(g, -5 * s, -6 * s, 3 * s, -6 * s, OUT, 2);
      line(g, -3 * s, 5 * s, 3 * s, 5 * s, OUT, 2);
      poly(g, [-6 * s, -18 * s, -10 * s, -32 * s, 0, -20 * s, 6 * s, -34 * s, 5 * s, -18 * s], '#4fbf4a', OUT, 2.5);
      break;
    case 'onion':
      g.beginPath();
      g.moveTo(0, -26 * s);
      g.quadraticCurveTo(24 * s, -6 * s, 18 * s, 10 * s);
      g.quadraticCurveTo(0, 26 * s, -18 * s, 10 * s);
      g.quadraticCurveTo(-24 * s, -6 * s, 0, -26 * s);
      g.fillStyle = '#c38be0';
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 3;
      g.stroke();
      line(g, -6 * s, -12 * s, -9 * s, 8 * s, 'rgba(255,255,255,0.6)', 2.5);
      break;
    case 'pepper':
      g.beginPath();
      g.moveTo(-18 * s, -10 * s);
      g.quadraticCurveTo(-22 * s, 20 * s, -8 * s, 22 * s);
      g.quadraticCurveTo(0, 16 * s, 8 * s, 22 * s);
      g.quadraticCurveTo(22 * s, 20 * s, 18 * s, -10 * s);
      g.quadraticCurveTo(0, -20 * s, -18 * s, -10 * s);
      g.fillStyle = '#5ccf4a';
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 3;
      g.stroke();
      rrect(g, -3 * s, -24 * s, 6 * s, 12 * s, 2, '#3a8c33', OUT, 2);
      break;
    case 'mushroom':
      rrect(g, -7 * s, -2 * s, 14 * s, 22 * s, 6 * s, '#fff1dc', OUT, 3);
      g.beginPath();
      g.arc(0, 0, 22 * s, Math.PI, 0);
      g.closePath();
      g.fillStyle = '#c0693b';
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 3;
      g.stroke();
      circle(g, -9 * s, -9 * s, 3.5 * s, '#fff');
      circle(g, 6 * s, -13 * s, 3 * s, '#fff');
      circle(g, 10 * s, -4 * s, 2.5 * s, '#fff');
      break;
    case 'rice':
      rrect(g, -24 * s, -10 * s, 48 * s, 20 * s, 9 * s, '#fffaf3', OUT, 3);
      ellipse(g, 18 * s, 0, 5 * s, 8 * s, 0, '#ffd6e4', OUT, 2);
      line(g, -12 * s, -3 * s, 6 * s, -3 * s, 'rgba(255,180,200,0.7)', 2.5);
      break;
    case 'melon':
      circle(g, 0, 0, 36 * s, '#3fae4a', OUT, 3.5);
      for (const k of [-2, -1, 0, 1, 2]) {
        g.beginPath();
        g.moveTo(k * 13 * s, -35 * s + Math.abs(k) * 5 * s);
        g.quadraticCurveTo(k * 17 * s, 0, k * 13 * s, 35 * s - Math.abs(k) * 5 * s);
        g.strokeStyle = '#1f6e2c';
        g.lineWidth = 5 * s;
        g.stroke();
      }
      ellipse(g, -13 * s, -15 * s, 9 * s, 5 * s, -0.6, 'rgba(255,255,255,0.4)');
      break;
  }
}

function itemSize(kind: string) {
  return kind === 'melon' ? 38 : kind === 'rice' ? 26 : 24;
}

/** 반쪽 그리기 (side: -1 왼쪽, 1 오른쪽) */
function drawHalf(g: G, kind: string, side: number) {
  g.save();
  g.beginPath();
  if (side < 0) g.rect(-100, -100, 100, 200);
  else g.rect(0, -100, 100, 200);
  g.clip();
  drawItem(g, kind);
  const [flesh, core] = FLESH[kind] ?? ['#fff', '#fff'];
  const r = itemSize(kind) * 0.85;
  ellipse(g, 0, 0, 5, r, 0, flesh, OUT, 2);
  if (kind === 'melon') {
    for (let i = -2; i <= 2; i++) ellipse(g, side * 2, i * 9, 1.4, 2.6, 0, '#2a1a1a');
  } else ellipse(g, 0, 0, 2.2, r * 0.5, 0, core);
  g.restore();
}

interface ChefPose {
  arm: number; // 0 올림 ~ 1 내려침
  face: 'normal' | 'happy' | 'hurt' | 'sweat' | 'sad' | 'fire';
  bob: number;
  t: number;
  fever?: boolean;
  noArm?: boolean;
}

function drawChefBody(g: G, x: number, y: number, p: ChefPose) {
  const by = y + p.bob;
  // 몸 (조리복)
  rrect(g, x - 40, by + 40, 80, 110, 30, '#ffffff', OUT, 3.5);
  // 단추
  circle(g, x + 8, by + 72, 3, OUT);
  circle(g, x + 8, by + 92, 3, OUT);
  circle(g, x + 8, by + 112, 3, OUT);
  // 스카프
  poly(g, [x - 22, by + 38, x + 22, by + 38, x + 10, by + 58, x, by + 48, x - 10, by + 58], '#ff4d5e', OUT, 3);
  // 뒷팔 (허리에 손)
  limb(g, [x - 34, by + 60, x - 56, by + 88, x - 36, by + 104], 16, '#ffffff', OUT, 3);
  drawChefHead(g, x, by, p.face, p.t);
}

function drawChefHead(g: G, x: number, hy: number, face: ChefPose['face'], t: number) {
  circle(g, x, hy, 38, '#ffd9b3', OUT, 3.5);
  // 모자
  rrect(g, x - 30, hy - 58, 60, 26, 6, '#fff', OUT, 3);
  circle(g, x - 22, hy - 66, 17, '#fff', OUT, 3);
  circle(g, x + 20, hy - 68, 18, '#fff', OUT, 3);
  circle(g, x, hy - 80, 21, '#fff', OUT, 3);
  rrect(g, x - 28, hy - 50, 56, 18, 4, '#fff');
  line(g, x - 29, hy - 36, x + 29, hy - 36, OUT, 3);
  // 얼굴 (오른쪽을 봄)
  const ex = x + 12;
  if (face === 'hurt') {
    dizzyEye(g, ex - 12, hy - 6, 7, t);
    dizzyEye(g, ex + 12, hy - 6, 7, t + 1);
    // 혹
    circle(g, x - 8, hy - 34, 9, '#ffb3a6', OUT, 2.5);
  } else if (face === 'happy') {
    happyEye(g, ex - 12, hy - 5, 6);
    happyEye(g, ex + 12, hy - 5, 6);
  } else if (face === 'sad') {
    line(g, ex - 17, hy - 9, ex - 7, hy - 5, OUT, 3);
    line(g, ex + 17, hy - 9, ex + 7, hy - 5, OUT, 3);
    circle(g, ex - 12, hy - 1, 3.5, OUT);
    circle(g, ex + 12, hy - 1, 3.5, OUT);
  } else if (face === 'fire') {
    for (const dx of [-12, 12]) {
      circle(g, ex + dx, hy - 5, 6.5, '#fff', OUT, 2);
      circle(g, ex + dx + 1, hy - 5, 3.5, '#ff5a1f');
    }
    line(g, ex - 19, hy - 17, ex - 5, hy - 12, OUT, 3.5);
    line(g, ex + 19, hy - 17, ex + 5, hy - 12, OUT, 3.5);
  } else {
    const blink = frac(t * 0.31) > 0.96 ? 1 : 0;
    for (const dx of [-12, 12]) {
      if (blink) line(g, ex + dx - 5, hy - 5, ex + dx + 5, hy - 5, OUT, 3);
      else ellipse(g, ex + dx + 1, hy - 5, 4, 5.5, 0, OUT);
    }
    line(g, ex - 18, hy - 17, ex - 7, hy - 19, OUT, 3);
    line(g, ex + 18, hy - 17, ex + 7, hy - 19, OUT, 3);
  }
  // 코 + 콧수염
  ellipse(g, ex + 2, hy + 8, 8, 6, 0, '#ffb98c', OUT, 2.5);
  g.beginPath();
  g.moveTo(ex + 2, hy + 15);
  g.bezierCurveTo(ex - 8, hy + 10, ex - 20, hy + 20, ex - 26, hy + 10);
  g.bezierCurveTo(ex - 22, hy + 26, ex - 6, hy + 24, ex + 2, hy + 18);
  g.bezierCurveTo(ex + 10, hy + 24, ex + 26, hy + 26, ex + 30, hy + 10);
  g.bezierCurveTo(ex + 24, hy + 20, ex + 12, hy + 10, ex + 2, hy + 15);
  g.fillStyle = '#3b2a22';
  g.fill();
  if (face === 'happy' || face === 'fire') {
    g.beginPath();
    g.arc(ex + 2, hy + 24, 7, 0, Math.PI);
    g.fillStyle = '#a3263b';
    g.fill();
  }
  if (face === 'sweat') sweat(g, x - 30, hy - 20, 8);
  if (face === 'hurt') {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 3;
      star(g, x + Math.cos(a) * 34, hy - 48 + Math.sin(a) * 8, 7, 3, 5, a, '#ffe45c', OUT, 1.5);
    }
  }
}

function armPoints(x: number, y: number, a: number, bob: number) {
  const sx = x + 30;
  const sy = y + bob + 58;
  // 올린 자세 → 내려친 자세
  const hx = lerp(x + 58, x + 118, a);
  const hy = lerp(y - 22, y + 58, a) - Math.sin(a * Math.PI) * 16;
  const ex = lerp(x + 70, x + 76, a);
  const ey = lerp(y + 40, y + 50, a);
  return { sx, sy, ex, ey, hx, hy: hy + bob };
}

function drawChefArm(g: G, x: number, y: number, a: number, bob: number) {
  const { sx, sy, ex, ey, hx, hy } = armPoints(x, y, a, bob);
  limb(g, [sx, sy, ex, ey], 18, '#ffffff', OUT, 3);
  limb(g, [ex, ey, hx, hy], 15, '#ffd9b3', OUT, 3);
  // 손날
  const ang = Math.atan2(hy - ey, hx - ex);
  withT(g, hx, hy, ang, 1, 1, () => {
    rrect(g, -6, -9, 26, 18, 8, '#ffd9b3', OUT, 3);
    line(g, 4, -9, 4, -3, OUT, 2);
  });
  if (a > 0.6) {
    // 속도선
    g.globalAlpha = (a - 0.6) * 1.5;
    for (let i = 0; i < 3; i++) line(g, hx - 10 + i * 8, hy - 60 - i * 6, hx - 6 + i * 8, hy - 20 - i * 4, '#ffffff', 3);
    g.globalAlpha = 1;
  }
}

function drawKitchen(g: G, W: number, H: number, beat: number, fever: boolean, counterY: number) {
  // 벽
  if (fever) {
    const on = Math.floor(beat) % 2 === 0;
    g.fillStyle = vgrad(g, 0, H, [
      [0, on ? '#ff7a2e' : '#ff4f6b'],
      [1, on ? '#ffd23e' : '#ff9a3c'],
    ]);
    g.fillRect(0, 0, W, H);
    // 집중선
    g.save();
    g.translate(W * 0.45, H * 0.45);
    g.rotate(beat * 0.3);
    for (let i = 0; i < 18; i++) {
      g.rotate((Math.PI * 2) / 18);
      g.beginPath();
      g.moveTo(40, -6);
      g.lineTo(H, -30);
      g.lineTo(H, 30);
      g.lineTo(40, 6);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fill();
    }
    g.restore();
  } else {
    g.fillStyle = '#ffe7b0';
    g.fillRect(0, 0, W, H);
    // 타일
    const ty = H * 0.3;
    g.fillStyle = '#fff4d6';
    g.fillRect(0, ty, W, counterY - ty);
    g.strokeStyle = 'rgba(214,170,110,0.55)';
    g.lineWidth = 2;
    const ts = 34;
    for (let yy = ty; yy < counterY; yy += ts) {
      g.beginPath();
      g.moveTo(0, yy);
      g.lineTo(W, yy);
      g.stroke();
    }
    for (let xx = 0; xx < W; xx += ts) {
      g.beginPath();
      g.moveTo(xx, ty);
      g.lineTo(xx, counterY);
      g.stroke();
    }
    line(g, 0, ty, W, ty, '#d9a867', 4);
    // 창문
    const wx = 16;
    const wy = Math.max(64, H * 0.09);
    rrect(g, wx, wy, 112, 96, 14, '#9fe3ff', OUT, 4);
    ellipse(g, wx + 38, wy + 34, 22, 10, 0, '#ffffff');
    ellipse(g, wx + 60, wy + 30, 15, 9, 0, '#ffffff');
    circle(g, wx + 90, wy + 24, 11, '#fff27a');
    line(g, wx + 56, wy, wx + 56, wy + 96, OUT, 4);
    line(g, wx, wy + 48, wx + 112, wy + 48, OUT, 4);
    rrect(g, wx - 8, wy + 92, 128, 12, 4, '#e58f4c', OUT, 3);
    // 선반과 병
    const sy = wy + 70;
    rrect(g, W - 146, sy, 136, 12, 4, '#c97c3f', OUT, 3);
    const jars = ['#ff8a8a', '#8fd67a', '#ffd45c'];
    jars.forEach((c, i) => {
      const jx = W - 134 + i * 42;
      const bb = bounce(beat + i * 0.33) * 4;
      rrect(g, jx, sy - 38 - bb, 30, 38, 8, c, OUT, 3);
      rrect(g, jx - 2, sy - 46 - bb, 34, 10, 4, '#fff', OUT, 2.5);
    });
    // 걸린 국자
    line(g, W - 40, sy + 30, W - 40, sy + 80, '#8a8a99', 5);
    circle(g, W - 40, sy + 88, 11, '#b9b9c9', OUT, 3);
  }
}

function drawCounter(g: G, W: number, H: number, counterY: number) {
  rrect(g, -10, counterY, W + 20, 22, 6, '#d88a4a', OUT, 4);
  g.fillStyle = '#f2c28a';
  g.fillRect(0, counterY + 22, W, H - counterY - 22);
  line(g, 0, counterY + 22, W, counterY + 22, OUT, 3);
  for (let i = 0; i < 3; i++) {
    const x = (W / 3) * i + 14;
    rrect(g, x, counterY + 40, W / 3 - 28, H - counterY - 20, 12, '#f7d3a4', OUT, 3);
    circle(g, x + W / 3 - 44, counterY + 80, 5, '#c97c3f', OUT, 2);
  }
}

function drawPot(g: G, x: number, y: number, level: number, t: number) {
  // 김
  for (let i = 0; i < 3; i++) {
    const k = frac(t * 0.6 + i / 3);
    g.globalAlpha = 0.5 * (1 - k);
    circle(g, x - 20 + i * 20 + Math.sin(t * 2 + i) * 6, y - 60 - k * 70, 10 + k * 12, '#ffffff');
    g.globalAlpha = 1;
  }
  const soup = level > 0.6 ? '#ff9b4a' : level > 0.3 ? '#ffc36a' : '#ffe08f';
  ellipse(g, x, y - 44, 56, 14, 0, '#3c3c4c', OUT, 3);
  ellipse(g, x, y - 44 + (1 - level) * 5, 50, 10, 0, soup);
  g.beginPath();
  g.moveTo(x - 56, y - 44);
  g.lineTo(x - 50, y);
  g.quadraticCurveTo(x, y + 12, x + 50, y);
  g.lineTo(x + 56, y - 44);
  g.quadraticCurveTo(x, y - 30, x - 56, y - 44);
  g.fillStyle = '#6f7690';
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 3.5;
  g.stroke();
  rrect(g, x - 72, y - 38, 18, 10, 4, '#6f7690', OUT, 3);
  rrect(g, x + 54, y - 38, 18, 10, 4, '#6f7690', OUT, 3);
  ellipse(g, x - 20, y - 22, 14, 5, -0.3, 'rgba(255,255,255,0.3)');
}

function createScene(sc: SceneCtx): Scene {
  const fx = new Particles();
  let lastChop = -99;
  let lastHurt = -99;
  let lastBarely = -99;
  let lastGood = -99;
  let W = 393;
  let H = 852;
  const spb = sc.spb;

  const layout = () => {
    const counterY = H * 0.7;
    const cx = W * 0.3;
    const headY = counterY - 190;
    const px = cx + 112;
    const py = headY + 50;
    return { counterY, cx, headY, px, py, potX: W * 0.84, potY: counterY + 8, startX: W + 50, startY: counterY - 40 };
  };

  const isFever = (t: number) => {
    let on = false;
    for (const m of sc.markers) {
      if (m.type !== 'fever' || m.t > t) continue;
      on = !!m.data?.on;
    }
    return on;
  };

  function flightPos(c: Cue, t: number) {
    const L = layout();
    const callT = c.data.callBeat * spb;
    const dur = c.t - callT;
    const h = 120 + dur * 150;
    const u = (t - callT) / dur;
    return arc(L.startX, L.startY, L.px, L.py, h, Math.min(1, u));
  }

  function drawCueItem(g: G, c: Cue, t: number) {
    const L = layout();
    const callT = c.data.callBeat * spb;
    if (t < callT) return;
    const kind = c.kind === 'norm' ? c.data.veg : c.kind === 'rice' ? 'rice' : 'melon';
    const dur = c.t - callT;
    const spin = (t - callT) * (c.kind === 'rice' ? 9 : 5) * (c.id % 2 ? 1 : -1);
    const hitAt = c.at ?? c.t;
    if (!c.grade || (c.grade === 'miss' && t < c.t + 0.12)) {
      let x: number;
      let y: number;
      if (t <= c.t) [x, y] = flightPos(c, t);
      else {
        // 목표 지점을 지나 셰프 얼굴 쪽으로
        const k = clamp01((t - c.t) / 0.12);
        x = lerp(L.px, L.cx + 30, k);
        y = lerp(L.py, L.headY + 10, k);
      }
      shadow(g, x, L.counterY + 6, 16, 0.12);
      withT(g, x, y, spin, 1, 1, () => drawItem(g, kind));
      return;
    }
    if (c.grade === 'just') {
      const [qx, qy] = hitAt <= c.t ? flightPos(c, hitAt) : [L.px, L.py];
      const k = clamp01((t - hitAt) / 0.55);
      if (k >= 1) return;
      for (const side of [-1, 1]) {
        const tx = L.potX + side * 14;
        const ty = L.potY - 50;
        const [x, y] = arc(qx + side * 6, qy, tx, ty, side < 0 ? 90 : 60, easeOutQuad(k) * 0.7 + k * 0.3);
        withT(g, x, y, side * k * 4 + spin * 0.2, 1, 1, () => drawHalf(g, kind, side));
      }
      if (t - hitAt < 0.12) {
        const s = 1 - (t - hitAt) / 0.12;
        g.globalAlpha = s;
        pow(g, qx, qy, 34 + (1 - s) * 20, '#fff7a8', hitAt);
        g.globalAlpha = 1;
      }
      void dur;
      return;
    }
    if (c.grade === 'barely') {
      const [qx, qy] = hitAt <= c.t ? flightPos(c, hitAt) : [L.px, L.py];
      const dt = t - hitAt;
      if (dt > 1.2) return;
      const x = qx + dt * 110;
      const y = qy - 260 * dt + 0.5 * 1500 * dt * dt;
      const sq = dt < 0.1 ? 0.7 : 1;
      withT(g, x, y, spin + dt * 6, 1 / sq, sq, () => drawItem(g, kind));
      return;
    }
    // miss: 얼굴에 맞고 튕겨 나감
    const dt = t - (c.t + 0.12);
    if (dt > 1.4) return;
    const x = L.cx + 30 + dt * 140;
    const y = L.headY + 10 - 300 * dt + 0.5 * 1600 * dt * dt;
    withT(g, x, y, spin + dt * 8, 1, 1, () => drawItem(g, kind));
  }

  function drawThrowerHand(g: G, t: number) {
    const L = layout();
    let best = -99;
    for (const c of sc.cues) {
      const ct = c.data.callBeat * spb;
      if (ct <= t + 0.05 && ct > best) best = ct;
      if (ct > t + 0.1) break;
    }
    const d = t - best;
    if (d < -0.05 || d > 0.35) return;
    const k = d < 0.08 ? clamp01((d + 0.05) / 0.13) : 1 - clamp01((d - 0.08) / 0.27);
    const x = W + 30 - k * 60;
    const y = L.startY + 10;
    limb(g, [W + 60, y + 20, x, y], 20, '#8bc4ff', OUT, 3);
    circle(g, x - 4, y - 2, 13, '#ffd9b3', OUT, 3);
  }

  return {
    onInput(ev, cue) {
      if (ev.kind !== 'tap') return;
      lastChop = ev.time;
      const L = layout();
      if (!cue) {
        sc.sfx('whiff', 0, 0.9);
        return;
      }
      if (cue.grade === 'just') {
        sc.sfx(cue.kind === 'melon' ? 'chopBig' : 'chop');
        lastGood = ev.time;
        const [qx, qy] = flightPos(cue, Math.min(ev.time, cue.t));
        fx.burst(qx, qy, cue.kind === 'melon' ? 14 : 8, {
          kind: 'star',
          r: 7,
          speed: 260,
          colors: ['#fff27a', '#ffffff', '#ffb35c'],
          max: 0.5,
        });
        void L;
      } else {
        sc.sfx('thud');
        lastBarely = ev.time;
      }
    },
    onMiss(cue) {
      sc.sfx('bonk');
      lastHurt = cue.t + 0.12;
    },
    draw(g: G, f: Frame) {
      // 무대를 크게 (세로로 긴 화면에 맞춰 확대)
      const k = STAGE_K;
      g.save();
      g.scale(k, k);
      W = f.W / k;
      H = f.H / k;
      fx.update(f.dt);
      const t = f.t;
      const L = layout();
      const fever = isFever(t);
      drawKitchen(g, W, H, f.beat, fever, L.counterY);
      const bob = bounce(f.beat) * 4;
      const dc = t - lastChop;
      const a = dc < 0 ? 0 : dc < 0.05 ? dc / 0.05 : dc < 0.16 ? 1 : dc < 0.32 ? 1 - (dc - 0.16) / 0.16 : 0;
      let face: ChefPose['face'] = fever ? 'fire' : 'normal';
      if (t - lastHurt < 0.9 && t >= lastHurt) face = 'hurt';
      else if (t - lastBarely < 0.5 && t >= lastBarely) face = 'sweat';
      else if (t - lastGood < 0.35 && t >= lastGood) face = 'happy';
      const hurtShake = face === 'hurt' ? Math.sin(t * 40) * 3 * Math.max(0, 1 - (t - lastHurt) * 2) : 0;
      if (fever) {
        // 불꽃 오라
        for (let i = 0; i < 7; i++) {
          const ang = -Math.PI / 2 + (i - 3) * 0.35;
          const fl = 1 + 0.2 * Math.sin(t * 20 + i * 2);
          g.beginPath();
          g.moveTo(L.cx + Math.cos(ang - 0.2) * 60, L.headY + 50 + Math.sin(ang - 0.2) * 60);
          g.lineTo(L.cx + Math.cos(ang) * 150 * fl, L.headY + 30 + Math.sin(ang) * 150 * fl);
          g.lineTo(L.cx + Math.cos(ang + 0.2) * 60, L.headY + 50 + Math.sin(ang + 0.2) * 60);
          g.fillStyle = i % 2 ? '#ffe25c' : '#ff7a2e';
          g.fill();
        }
      }
      drawChefBody(g, L.cx + hurtShake, L.headY, { arm: a, face, bob, t, fever });
      drawThrowerHand(g, t);
      for (const c of sc.cues) {
        if (c.data.callBeat * spb > t) break;
        if (c.t < t - 2) continue;
        drawCueItem(g, c, t);
      }
      drawChefArm(g, L.cx + hurtShake, L.headY, a, bob);
      drawCounter(g, W, H, L.counterY);
      // 도마
      rrect(g, L.px - 60, L.counterY - 12, 120, 16, 6, '#f5deb3', OUT, 3);
      let good = 0;
      let total = 0;
      for (const c of sc.cues) {
        if (c.t > t) break;
        total++;
        if (c.grade === 'just' && (c.at ?? 0) + 0.5 < t) good++;
      }
      drawPot(g, L.potX, L.potY, total ? Math.min(1, good / 40) : 0, f.real);
      fx.draw(g);
      g.restore();
    },
  };
}

// ------------------------------------------------------------------ 아이콘/에필로그

function drawIcon(g: G, cx: number, cy: number, s: number, t: number) {
  const k = s / 150;
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  const b = bounce(t * 2) * 4;
  drawChefHead(g, -6, 30 + b, frac(t * 0.5) < 0.5 ? 'happy' : 'normal', t);
  withT(g, 50, 30 - b, Math.sin(t * 3) * 0.3, 1.1, 1.1, () => drawItem(g, 'tomato'));
  g.restore();
}

function drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number) {
  epilogueFrame(g, x, y, w, h, rank === 'try' ? '#c9c2d6' : '#ffe7b0', () => {
    const cx = x + w * 0.38;
    const cy = y + h * 0.42;
    g.save();
    g.translate(cx, cy);
    g.scale(0.75, 0.75);
    drawChefBody(g, 0, 0, { arm: 0, face: rank === 'hi' ? 'happy' : rank === 'ok' ? 'normal' : 'sad', bob: 0, t });
    g.restore();
    const px = x + w * 0.74;
    const py = y + h * 0.78;
    if (rank === 'try') {
      // 컵라면
      rrect(g, px - 30, py - 50, 60, 55, 8, '#fff', OUT, 3);
      rrect(g, px - 34, py - 58, 68, 14, 5, '#ff5a4a', OUT, 3);
      text(g, '라면', px, py - 22, 14, '#ff5a4a');
    } else {
      drawPot(g, px, py, rank === 'hi' ? 1 : 0.5, t);
      if (rank === 'hi') for (let i = 0; i < 4; i++) star(g, px - 50 + i * 33, py - 110 + Math.sin(t * 3 + i) * 6, 9, 4, 5, t, '#fff27a', OUT, 2);
    }
  });
}

export const chef: GameDef = {
  id: ID,
  title: '촙촙 셰프',
  sub: 'Chop Chop Chef',
  desc: '날아오는 재료를 박자에 맞춰 썰어요!',
  howto: '재료가 "뽁!" 하고 날아오면 한 박자 뒤에 탭!\n"삐융~" 떡은 한 박자 반 뒤, "영차!" 수박은 두 박자 뒤에 썰어요.',
  color: '#ff9a3c',
  accent: '#ffe7b0',
  bpm: BPM,
  liveSfx: [
    ['chop', 0],
    ['chopBig', 0],
    ['thud', 0],
    ['bonk', 0],
    ['whiff', 0],
  ],
  build,
  practice: [
    {
      text: '재료가 "뽁!" 날아오면\n한 박자 뒤에 탭해서 썰어요!',
      beats: 4,
      need: 4,
      build(b) {
        toss(b, 0, 'norm');
        toss(b, 2, 'norm');
      },
    },
    {
      text: '"삐융~" 떡은 한 박자 반 뒤!\n엇박자에 썰어요.',
      beats: 8,
      need: 3,
      build(b) {
        toss(b, 0, 'rice');
        toss(b, 4, 'norm');
        toss(b, 6, 'rice');
      },
    },
    {
      text: '"영차!" 수박은 두 박자 뒤에\n크게 썰어요!',
      beats: 8,
      need: 3,
      build(b) {
        toss(b, 0, 'melon');
        toss(b, 4, 'norm');
        toss(b, 6, 'norm');
      },
    },
  ],
  practiceBacking(b, beats) {
    for (let i = 0; i < beats; i += 4) {
      b.drums(i, 0.5, { k: 'x...x...', s: '..x...x.', h: 'x.x.x.x.' });
      b.bassline(i, 4, 'F', 'R.R8.R5.', 'bass');
    }
  },
  createScene,
  drawIcon,
  cats: { norm: '채소', rice: '떡', melon: '수박' },
  comments: {
    good: { norm: '채소를 척척 잘 썰었어요!', rice: '엇박자 떡도 완벽했어요!', melon: '수박을 시원하게 갈랐어요!' },
    bad: { norm: '채소 써는 타이밍이 흔들렸어요.', rice: '떡은 한 박자 반 뒤에 썰어요.', melon: '수박은 두 박자 뒤에 크게!' },
  },
  epilogue: {
    hi: '셰프의 수프가 대박! 가게 앞에 손님들이 줄을 섰어요.',
    ok: '수프 맛은 그럭저럭... 평범한 하루였어요.',
    try: '재료가 엉망진창... 오늘 저녁은 컵라면이에요.',
  },
  drawEpilogue,
  remixPart(b, start, bars, v) {
    const pats = v % 2 ? ['n...r...', 'n.n.n...', 'w...n...', 'n...n...'] : ['n...n...', 'r...n...', 'n.n.n...', 'w.......'];
    for (let i = 0; i < bars; i++) place(b, start + i * b.beatsPerBar, pats[i % pats.length]);
  },
};
