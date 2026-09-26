// 9. 응원단 — 아이돌 노래에 맞춰 박수(탭), "야호!"에 점프(위로 플릭)
import type { ChartBuilder, Cue } from '../core/chart';
import type { Frame, GameDef, Scene, SceneCtx } from '../core/game';
import { OUT, Particles, circle, ellipse, happyEye, line, limb, noteGlyph, rgrad, rrect, star, sweat, text, vgrad, type G } from '../core/gfx';
import type { Rank } from '../core/judge';
import { bounce, clamp01, easeOutBack, frac, hash01 } from '../core/util';
import { mascot } from '../screens/backdrop';
import { bubble, epilogueFrame } from './common';

const ID = 'cheer';
const BPM = 140;

/** 아이돌 노래 한 마디 + 응원 큐. kind: c(짝짝) f(짝짝짝) a(매 박) j(야호!) */
function phrase(b: ChartBuilder, bar: number, kind: string, melo: number[]) {
  const s = b.bar(bar);
  const sing = (beat: number, m: number, len = 0.9) => {
    b.note(s + beat, 'choir', m, len, 1.4);
    b.note(s + beat, 'flute', m, len, 0.45);
  };
  if (kind === 'c') {
    sing(0, melo[0]);
    sing(1, melo[1]);
    for (const k of [2, 3]) {
      b.sfx(s + k, 'clap', 0.35);
      b.cue(s + k, 'tap', 'clap', { bar }, { cat: 'clap' });
    }
    b.marker(s, 'sing', { len: 2 });
  } else if (kind === 'f') {
    sing(0, melo[0], 0.45);
    sing(0.5, melo[1], 0.45);
    sing(1, melo[2] ?? melo[1], 0.9);
    for (const k of [2, 2.5, 3]) {
      b.sfx(s + k, 'clap', 0.35);
      b.cue(s + k, 'tap', 'fast', { bar }, { cat: 'fast' });
    }
    b.marker(s, 'sing', { len: 2 });
  } else if (kind === 'a') {
    sing(0, melo[0], 1.8);
    sing(2, melo[1], 1.8);
    for (let k = 0; k < 4; k++) {
      b.sfx(s + k, 'clap', 0.35);
      b.cue(s + k, 'tap', 'every', { bar }, { cat: 'clap' });
    }
    b.marker(s, 'sing', { len: 4 });
  } else if (kind === 'j') {
    // "다 같이~" 올라가는 세 음 뒤에 야호!
    sing(0, melo[0], 0.9);
    sing(1, melo[1], 0.9);
    sing(2, melo[2] ?? melo[1] + 2, 0.9);
    b.sfx(s + 2, 'glissUp', 0.6);
    b.sfx(s + 3, 'hey', 0.8, 64);
    b.cue(s + 3, 'flick', 'jump', { bar }, { cat: 'jump', weight: 1.5 });
    b.marker(s, 'sing', { len: 3, jump: true });
  }
}

// 마디별 구성과 아이돌 멜로디 (A 장조)
const PLAN: [string, number[]][] = [
  // A (2~9)
  ['c', [69, 71]], ['c', [73, 71]], ['c', [69, 71]], ['c', [73, 76]],
  ['c', [74, 73]], ['c', [71, 69]], ['c', [71, 73]], ['j', [69, 71, 73]],
  // B (10~17)
  ['c', [76, 74]], ['c', [73, 71]], ['f', [73, 74, 76]], ['c', [78, 76]],
  ['c', [74, 73]], ['c', [71, 73]], ['f', [71, 73, 76]], ['j', [73, 74, 76]],
  // 후렴 (18~21)
  ['a', [81, 80]], ['a', [78, 76]], ['a', [74, 76]], ['j', [76, 78, 80]],
  // C (22~29)
  ['c', [69, 71]], ['f', [73, 74, 76]], ['c', [78, 76]], ['j', [74, 76, 78]],
  ['c', [76, 74]], ['f', [73, 71, 73]], ['f', [74, 76, 78]], ['j', [76, 78, 81]],
  // 후렴 2 (30~33)
  ['a', [81, 80]], ['a', [78, 76]], ['a', [74, 76]], ['j', [78, 80, 81]],
];

const PROGS = ['A E F#m D', 'D E C#m F#m', 'D E A A'];

function band(b: ChartBuilder, bar: number, n: number, prog: string, loud = false) {
  const chords = Array.from({ length: n }, (_, i) => prog.split(' ')[i % 4]).join(' ');
  b.bassline(b.bar(bar), 4, chords, 'R.R8R.R8', 'bass', { vel: 0.7 });
  b.chords(b.bar(bar), 4, chords, 'pad', { center: 64, vel: 0.5 });
  b.chords(b.bar(bar), 4, chords, loud ? 'brass' : 'ep', { rhythm: '.x.x.x.x', center: 66, vel: loud ? 0.35 : 0.4 });
  for (let i = 0; i < n; i++) {
    b.drums(b.bar(bar + i), 0.5, { k: loud ? 'x.x.x.x.' : 'x...x...', s: '..x...x.', h: 'xoxoxoxo' }, { vel: 0.8 });
    if (loud) b.drums(b.bar(bar + i), 0.25, { sh: 'x.xxx.xxx.xxx.xx' }, { vel: 0.5 });
  }
}

function music(b: ChartBuilder) {
  // 인트로: 함성 + 카운트
  b.sfx(0, 'cheer', 0.8);
  band(b, 0, 2, 'A A A A');
  b.countIn(4, 4);
  band(b, 2, 8, PROGS[0]);
  band(b, 10, 8, PROGS[1]);
  b.note(b.bar(18), 'crash', 0, 1, 0.9);
  band(b, 18, 4, PROGS[2], true);
  b.arp(b.bar(18), 4, 'A E F#m D', 'chip', { step: 0.25, center: 80, vel: 0.25, order: [0, 1, 2, 1] });
  band(b, 22, 8, PROGS[0]);
  b.note(b.bar(30), 'crash', 0, 1, 0.9);
  band(b, 30, 4, PROGS[2], true);
  b.arp(b.bar(30), 4, 'A E F#m D', 'chip', { step: 0.25, center: 80, vel: 0.25, order: [0, 1, 2, 1] });
  // 엔딩
  b.note(b.bar(34), 'crash', 0, 1, 1);
  b.note(b.bar(34), 'kick', 0, 1, 1);
  b.chords(b.bar(34), 4, 'A', 'brass', { center: 66, vel: 0.8, gate: 0.6 });
  b.note(b.bar(34), 'choir', 81, 2.5, 0.9);
  b.note(b.bar(34), 'bass', 45, 3, 0.9);
  b.sfx(b.bar(34), 'cheer', 1);
}

function build(b: ChartBuilder) {
  music(b);
  PLAN.forEach(([k, m], i) => phrase(b, 2 + i, k, m));
  b.endBeat = b.bar(34) + 3;
}

// ------------------------------------------------------------------ 그림

interface FanOpts {
  clap: number; // 경과(초)
  jump: number; // 경과(초)
  me: boolean;
  bob: number;
  t: number;
  sad?: boolean;
  color: string;
}

/** 뒷모습 고양이 팬 */
function drawFan(g: G, x: number, y: number, s: number, o: FanOpts) {
  const jk = o.jump >= 0 && o.jump < 0.45 ? Math.sin((o.jump / 0.45) * Math.PI) : 0;
  const ck = o.clap >= 0 && o.clap < 0.18 ? 1 - o.clap / 0.18 : 0;
  g.save();
  g.translate(x, y - jk * 60 - o.bob * 3);
  g.scale(s, s);
  // 팔 + 야광봉
  const up = jk > 0 ? 1 : 0.55 + ck * 0.45;
  for (const side of [-1, 1]) {
    const hx = side * (ck > 0.5 ? 10 : 34 - up * 6);
    const hy = -70 - up * 40;
    limb(g, [side * 26, -10, side * 34, -40, hx, hy], 13, '#f4c28a', OUT, 3);
    if (!(ck > 0.5 && side > 0)) {
      g.save();
      g.translate(hx, hy);
      g.rotate(side * (0.3 + Math.sin(o.t * 6 + side) * 0.2));
      rrect(g, -4, -38, 8, 36, 4, o.color, OUT, 2.5);
      circle(g, 0, -40, 10, 'rgba(255,255,255,0.25)');
      g.restore();
    }
  }
  if (ck > 0.3) star(g, 0, -122, 12 + ck * 8, 5, 8, 0, '#fff7a8', OUT, 2);
  // 몸 (뒷모습)
  ellipse(g, 0, 10, 34, 40, 0, o.me ? '#ff8ab8' : '#8a7ad8', OUT, 3.5);
  // 머리
  circle(g, 0, -34, 30, '#f4c28a', OUT, 3.5);
  // 귀
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(side * 12, -58);
    g.lineTo(side * 26, -76);
    g.lineTo(side * 28, -50);
    g.closePath();
    g.fillStyle = '#f4c28a';
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 3;
    g.stroke();
  }
  // 줄무늬
  line(g, -8, -60, -6, -48, '#d89a5a', 3);
  line(g, 8, -60, 6, -48, '#d89a5a', 3);
  if (o.me) {
    // 하트 머리띠
    rrect(g, -30, -52, 60, 8, 4, '#ff4d6d', OUT, 2);
    g.save();
    g.translate(0, -66);
    g.scale(0.8, 0.8);
    g.beginPath();
    g.moveTo(0, 8);
    g.bezierCurveTo(-14, -4, -8, -16, 0, -8);
    g.bezierCurveTo(8, -16, 14, -4, 0, 8);
    g.fillStyle = '#ff4d6d';
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 2.5;
    g.stroke();
    g.restore();
  }
  if (o.sad) sweat(g, 30, -50, 7);
  g.restore();
}

function drawIdol(g: G, x: number, y: number, s: number, beat: number, singing: number, jump: boolean, t: number) {
  // 스포트라이트
  g.fillStyle = rgrad(g, x, y, 10, 140 * s, [
    [0, 'rgba(255,250,210,0.55)'],
    [1, 'rgba(255,250,210,0)'],
  ]);
  g.beginPath();
  g.arc(x, y, 140 * s, 0, Math.PI * 2);
  g.fill();
  const sway = Math.sin(beat * Math.PI) * 0.12;
  g.save();
  g.translate(x, y);
  g.rotate(sway);
  mascot(g, 0, 0, 70 * s, beat, singing > 0 ? 'happy' : 'normal');
  // 마이크
  line(g, 38 * s, 20 * s, 52 * s, -6 * s, OUT, 4);
  circle(g, 54 * s, -10 * s, 8 * s, '#c9d2e6', OUT, 2.5);
  if (jump) {
    for (let i = 0; i < 5; i++) star(g, Math.cos(i + t * 3) * 90 * s, -80 * s + Math.sin(i * 2 + t * 4) * 20, 7, 3, 5, t * 3 + i, '#fff27a', OUT, 1.5);
  }
  g.restore();
  if (singing > 0) {
    g.globalAlpha = singing;
    noteGlyph(g, x - 70 * s + Math.sin(t * 4) * 6, y - 60 * s - (1 - singing) * 30, 10, '#fff27a');
    noteGlyph(g, x + 80 * s, y - 40 * s - (1 - singing) * 40, 8, '#ff9ad5');
    g.globalAlpha = 1;
  }
}

function createScene(sc: SceneCtx): Scene {
  const fx = new Particles();
  const spb = sc.spb;
  let myClap = -99;
  let myJump = -99;
  let lastMiss = -99;
  let lastGood = -99;

  /** 다른 팬들의 박수/점프 (정답 타이밍) */
  function npc(t: number) {
    let clap = -99;
    let jump = -99;
    for (const c of sc.cues) {
      if (c.t > t) break;
      if (c.input === 'flick') jump = c.t;
      else clap = c.t;
    }
    return { clap, jump };
  }

  function singingAt(t: number): { k: number; jump: boolean } {
    for (const m of sc.markers) {
      if (m.type !== 'sing') continue;
      const d = t - m.t;
      const len = m.data.len * spb;
      if (d >= 0 && d < len) return { k: 1 - (d % spb) / spb, jump: !!m.data.jump };
    }
    return { k: 0, jump: false };
  }

  function flickSoon(t: number): boolean {
    for (const c of sc.cues) {
      if (c.input !== 'flick' || c.grade) continue;
      if (Math.abs(c.t - t) < 0.3) return true;
    }
    return false;
  }

  return {
    onInput(ev, cue) {
      if (ev.kind === 'tap') {
        if (!cue) {
          if (!flickSoon(ev.time)) {
            myClap = ev.time;
            sc.sfx('clap', 0, 0.5);
          }
          return;
        }
        myClap = ev.time;
        if (cue.grade === 'just') {
          sc.sfx('clap', 0, 1.1);
          lastGood = ev.time;
        } else {
          sc.sfx('clap', 0, 0.5);
          sc.sfx('thud', 0, 0.5);
        }
      } else if (ev.kind === 'flick') {
        myJump = ev.time;
        if (cue?.grade === 'just') {
          sc.sfx('hey', 64, 1);
          sc.sfx('cheer', 0, 0.8);
          lastGood = ev.time;
        } else if (cue) sc.sfx('hup', 0, 0.6);
        else sc.sfx('whiff', 0, 0.6);
      }
    },
    onMiss(c: Cue) {
      lastMiss = c.t + 0.1;
    },
    draw(g: G, f: Frame) {
      const { W, H, t } = f;
      fx.update(f.dt);
      // 공연장
      g.fillStyle = vgrad(g, 0, H, [
        [0, '#1a0f3a'],
        [0.5, '#4a1f6a'],
        [1, '#1a0f3a'],
      ]);
      g.fillRect(0, 0, W, H);
      // 조명 빔
      for (let i = 0; i < 4; i++) {
        const a = Math.sin(f.real * 0.8 + i * 1.7) * 0.35;
        const x0 = (W / 5) * (i + 1);
        g.save();
        g.translate(x0, -10);
        g.rotate(a);
        g.beginPath();
        g.moveTo(-8, 0);
        g.lineTo(8, 0);
        g.lineTo(90, H * 0.6);
        g.lineTo(-90, H * 0.6);
        g.closePath();
        g.fillStyle = ['rgba(255,120,200,0.14)', 'rgba(120,200,255,0.14)', 'rgba(255,240,120,0.12)', 'rgba(160,255,180,0.12)'][i];
        g.fill();
        g.restore();
      }
      // 무대
      const stageY = H * 0.5;
      rrect(g, -20, stageY, W + 40, 40, 10, '#6a3a9a', OUT, 3.5);
      for (let i = 0; i < 9; i++) {
        const on = (Math.floor(f.beat) + i) % 3 === 0;
        circle(g, 20 + i * (W - 40) / 8, stageY + 20, 6, on ? '#ffe14d' : '#8a6ab8', OUT, 2);
      }
      // 스크린 (뒤)
      rrect(g, W * 0.15, stageY - 290, W * 0.7, 110, 16, '#2a1a4a', OUT, 3);
      const words = ['반짝반짝', '리듬 별나라', 'LOVE'];
      text(g, words[Math.floor(f.beat / 8) % 3], W / 2, stageY - 235, 28, `hsl(${(f.beat * 20) % 360},90%,70%)`, { weight: 900 });
      const sing = singingAt(t);
      drawIdol(g, W / 2, stageY - 64, 1.3, f.beat, sing.k, sing.jump, f.real);
      // 관객석
      g.fillStyle = '#140a2a';
      g.fillRect(0, stageY + 40, W, H);
      // 뒤쪽 관객 실루엣
      for (let i = 0; i < 9; i++) {
        const hx = (i + 0.5) * (W / 9);
        const jy = bounce(f.beat + i * 0.1) * 4;
        circle(g, hx, stageY + 90 - jy, 20, '#2a1a4a');
        rrect(g, hx - 3, stageY + 40 - jy, 6, 30, 3, ['#ff8ab8', '#8fd0ff', '#fff27a'][i % 3]);
      }
      const n = npc(t);
      const glare = t - lastMiss < 0.6 && t >= lastMiss;
      const fanY = H * 0.86;
      const xs = [W * 0.14, W * 0.38, W * 0.62, W * 0.86];
      xs.forEach((x, i) => {
        const me = i === 2;
        drawFan(g, x, fanY, 1.05, {
          clap: me ? t - myClap : t - n.clap,
          jump: me ? t - myJump : t - n.jump,
          me,
          bob: bounce(f.beat),
          t: f.real + i,
          sad: me && glare,
          color: ['#8fd0ff', '#fff27a', '#ff8ab8', '#a0ffb8'][i],
        });
      });
      rrect(g, xs[2] - 18, fanY + 58, 36, 22, 11, '#ff4d5e', OUT, 2.5);
      text(g, '나', xs[2], fanY + 69.5, 13, '#fff', { weight: 900 });
      // 야호 말풍선
      for (const c of sc.cues) {
        if (c.input !== 'flick') continue;
        const d = t - c.t;
        if (d > -0.05 && d < 0.5) {
          const k = easeOutBack(clamp01((d + 0.05) / 0.2));
          g.save();
          g.translate(W / 2, H * 0.6);
          g.scale(k, k);
          bubble(g, 0, 0, '야호!', 26, 0, 14);
          g.restore();
        }
      }
      if (t - lastGood < 0.05 && t >= lastGood && fx.list.length < 30) fx.burst(xs[2], fanY - 130, 6, { kind: 'star', r: 6, speed: 180, colors: ['#fff27a', '#ff9ad5'], max: 0.5 });
      fx.draw(g);
      void hash01;
      void frac;
      void happyEye;
    },
  };
}

function drawIcon(g: G, cx: number, cy: number, s: number, t: number) {
  const k = s / 130;
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  mascot(g, 0, -18, 36, t * 2, 'happy');
  line(g, 20, -8, 28, -24, OUT, 3);
  circle(g, 29, -27, 5, '#c9d2e6', OUT, 2);
  const ph = frac(t * 2);
  drawFan(g, -30, 64, 0.5, { clap: ph * 0.5, jump: 99, me: false, bob: 0, t, color: '#8fd0ff' });
  drawFan(g, 30, 64, 0.5, { clap: ph * 0.5, jump: 99, me: true, bob: 0, t, color: '#ff8ab8' });
  g.restore();
}

function drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number) {
  epilogueFrame(g, x, y, w, h, '#2a1a4a', () => {
    drawIdol(g, x + w / 2, y + h * 0.4, 0.8, t * 2, rank === 'hi' ? 1 : 0, rank === 'hi', t);
    const n = rank === 'hi' ? 4 : rank === 'ok' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      drawFan(g, x + w * ((i + 0.5) / n), y + h + 10, 0.7, { clap: rank === 'try' ? 99 : frac(t * 2 + i * 0.25) * 0.3, jump: 99, me: i === n - 1, bob: 0, t, sad: rank === 'try', color: '#fff27a' });
    }
    if (rank === 'try') text(g, '...', x + w * 0.7, y + h * 0.3, 30, '#fff');
  });
}

export const cheer: GameDef = {
  id: ID,
  title: '응원단',
  sub: 'Star Cheer Squad',
  desc: '아이돌 노래에 맞춰 짝짝! 야호!',
  howto: '반짝이가 두 음을 부르면 "짝! 짝!" 두 번 탭!\n빠르게 세 음이면 짝짝짝, 후렴에서는 매 박자마다 짝!\n"다 같이~" 하고 음이 올라가면 위로 쓱 밀어서(플릭) 야호 점프!',
  color: '#ff6bb5',
  accent: '#ffe0f0',
  bpm: BPM,
  liveSfx: [
    ['clap', 0],
    ['hey', 64],
    ['cheer', 0],
    ['hup', 0],
    ['thud', 0],
    ['whiff', 0],
  ],
  build,
  practice: [
    {
      text: '반짝이가 두 음을 부르면\n짝! 짝! 두 번 탭해요.',
      beats: 8,
      need: 6,
      build(b) {
        phrase(b, 0, 'c', [69, 71]);
        phrase(b, 1, 'c', [73, 71]);
      },
    },
    {
      text: '"다 같이~" 음이 올라가면\n위로 쓱! 플릭해서 야호!',
      beats: 8,
      need: 3,
      build(b) {
        phrase(b, 0, 'c', [69, 71]);
        phrase(b, 1, 'j', [69, 71, 73]);
      },
    },
    {
      text: '빠르게 부르면 짝짝짝!\n세 번 탭해요.',
      beats: 8,
      need: 5,
      build(b) {
        phrase(b, 0, 'f', [73, 74, 76]);
        phrase(b, 1, 'c', [78, 76]);
      },
    },
  ],
  practiceBacking(b, beats) {
    for (let i = 0; i < beats; i += 4) {
      b.drums(i, 0.5, { k: 'x...x...', s: '..x...x.', h: 'xoxoxoxo' }, { vel: 0.7 });
      b.bassline(i, 4, 'A', 'R.R8R.R8', 'bass', { vel: 0.65 });
    }
  },
  createScene,
  drawIcon,
  cats: { clap: '박수', fast: '빠른 박수', jump: '야호 점프' },
  comments: {
    good: { clap: '박수 타이밍이 딱딱 맞았어요!', fast: '빠른 박수도 완벽했어요!', jump: '야호 점프가 무대를 흔들었어요!' },
    bad: { clap: '노래가 끝나는 뒤 박자에 짝!', fast: '짝짝짝은 반 박자 간격이에요.', jump: '음이 세 번 올라간 뒤에 점프!' },
  },
  epilogue: {
    hi: '반짝이가 무대에서 손을 흔들었어요. 나를 본 게 틀림없어!',
    ok: '즐거운 공연이었어요. 목이 조금 쉬었어요.',
    try: '혼자 엇박자로 박수를 쳐서 머쓱했어요...',
  },
  drawEpilogue,
  remixPart(b, start, bars, v) {
    const pats: [string, number[]][] = v % 2
      ? [['c', [69, 71]], ['f', [73, 74, 76]], ['c', [78, 76]], ['j', [74, 76, 78]]]
      : [['c', [73, 71]], ['c', [69, 71]], ['f', [71, 73, 76]], ['j', [73, 74, 76]]];
    for (let i = 0; i < bars; i++) {
      const [k, m] = pats[i % pats.length];
      phrase(b, start / b.beatsPerBar + i, k, m);
    }
  },
};
