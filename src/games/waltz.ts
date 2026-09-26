// 8. 요정 왈츠 (3/4박자) — 꽃밭을 도는 요정이 앞을 지날 때마다 탭
import type { ChartBuilder, Cue } from '../core/chart';
import type { Frame, GameDef, Scene, SceneCtx } from '../core/game';
import { OUT, Particles, circle, ellipse, happyEye, line, rgrad, rrect, sparkle, star, text, vgrad, type G } from '../core/gfx';
import type { Rank } from '../core/judge';
import { TAU, clamp01, easeOutBack, frac, hash01, lerp } from '../core/util';
import { epilogueFrame } from './common';

const ID = 'waltz';
const BPM = 144;
const BPB = 3;

type Kind = 'bar' | 'half' | 'slow';

function pass(b: ChartBuilder, beat: number, kind: Kind) {
  b.cue(beat, 'tap', kind, {}, { cat: kind === 'half' ? 'half' : kind === 'slow' ? 'slow' : 'bar', weight: kind === 'slow' ? 1.3 : 1 });
}

/** 섹션 계획: [시작 마디, 끝 마디(미포함), 종류] */
const PLAN: [number, number, Kind][] = [
  [2, 15, 'bar'],
  [15, 21, 'half'],
  [21, 30, 'bar'],
  [30, 37, 'slow'],
  [37, 46, 'bar'],
  [46, 54, 'half'],
  [54, 59, 'bar'],
];

function place(b: ChartBuilder) {
  for (const [s, e, kind] of PLAN) {
    for (let bar = s; bar < e; bar++) {
      const st = b.bar(bar);
      if (kind === 'bar') pass(b, st, 'bar');
      else if (kind === 'half') {
        pass(b, st, 'half');
        pass(b, st + 1.5, 'half');
      } else if ((bar - s) % 2 === 0) pass(b, st, 'slow');
    }
  }
  // 전환 예고음
  b.sfx(b.bar(14), 'sparkle', 0.9);
  b.sfx(b.bar(45), 'sparkle', 0.9);
  b.sfx(b.bar(29), 'glissUp', 0.7);
  b.marker(b.bar(14), 'hint', { text: '빨라져요!' });
  b.marker(b.bar(45), 'hint', { text: '빨라져요!' });
  b.marker(b.bar(29), 'hint', { text: '느긋하게~' });
  // 마지막 한 바퀴
  pass(b, b.bar(59), 'bar');
}

function waltz(b: ChartBuilder, bar: number, prog: string, soft = false) {
  const chords = prog.split(' ');
  chords.forEach((ch, i) => {
    const s = b.bar(bar + i);
    b.bassline(s, 3, ch, 'R-----', 'bassSoft', { vel: soft ? 0.45 : 0.55, low: 40 });
    b.chords(s, 3, ch, 'strings', { rhythm: '..x.x.', center: 64, vel: soft ? 0.45 : 0.6 });
    b.chords(s, 3, ch, 'ep', { rhythm: '..x.x.', center: 70, vel: 0.25 });
    b.drums(s, 0.5, { k: 'x.....', tri: i % 4 === 0 ? 'x.....' : '', sh: '..x.x.' }, { vel: 0.55 });
  });
}

const MEL_A = [
  'F#5 - - A5 - D6', 'C#6 - - B5 - A5', 'B5 - - G5 - B5', 'A5 - - - - .',
  'F#5 - - A5 - D6', 'E6 - - D6 - C#6', 'D6 - - A5 - F#5', 'D5 - - - - .',
].join(' ');
const MEL_B = [
  'G5 - - B5 - D6', 'F#5 - - A5 - D6', 'E5 - - G5 - C#6', 'D6 - - - - .',
  'B5 - - A5 - G5', 'A5 - - F#5 - D5', 'E5 - - F#5 - G5', 'A5 - - - - .',
].join(' ');
// 헤미올라 (점4분 리듬)
const MEL_H = ['D6 - - A5 - -', 'F#5 - - A5 - -', 'B5 - - G5 - -', 'E5 - - C#6 - -', 'D6 - - A5 - -', 'F#5 - - D6 - -'].join(' ');
const PROG_A = 'D A7 G D D A7 D D';
const PROG_B = 'G D A7 D G D A7 A7';

function music(b: ChartBuilder) {
  waltz(b, 0, 'D A7', true);
  b.countIn(b.bar(1), 3);
  // A (2~14)
  waltz(b, 2, PROG_A);
  b.seq(b.bar(2), 0.5, MEL_A, 'bell', { vel: 0.6 });
  waltz(b, 10, 'G D A7 D A7');
  b.seq(b.bar(10), 0.5, MEL_B.split(' ').slice(0, 30).join(' '), 'flute', { vel: 0.6 });
  // 빠른 구간 (15~20)
  waltz(b, 15, 'D G A7 D G A7');
  b.seq(b.bar(15), 0.5, MEL_H, 'bell', { vel: 0.65 });
  b.seq(b.bar(15), 0.5, MEL_H, 'flute', { vel: 0.4, transpose: -12 });
  // B (21~29)
  waltz(b, 21, PROG_B + ' D');
  b.seq(b.bar(21), 0.5, MEL_B, 'flute', { vel: 0.65 });
  b.seq(b.bar(21), 0.5, MEL_B, 'bell', { vel: 0.3, transpose: 12 });
  // 느린 구간 (30~36)
  waltz(b, 30, 'D D G G A7 A7 D', true);
  b.seq(b.bar(30), 0.5, 'A5 - - - - - | F#5 - - - - - | B5 - - - - - | G5 - - - - - | C#6 - - - - - | E6 - - - - - | D6 - - - - -', 'strings', { vel: 0.6 });
  // C (37~45)
  waltz(b, 37, PROG_A + ' A7');
  b.seq(b.bar(37), 0.5, MEL_A, 'bell', { vel: 0.6 });
  b.seq(b.bar(37), 0.5, MEL_A, 'flute', { vel: 0.4, transpose: -12 });
  // 빠른 구간 (46~53)
  waltz(b, 46, 'D G A7 D G A7 D A7');
  b.seq(b.bar(46), 0.5, MEL_H + ' ' + MEL_H.split(' ').slice(0, 12).join(' '), 'bell', { vel: 0.65 });
  b.seq(b.bar(46), 0.5, MEL_H + ' ' + MEL_H.split(' ').slice(0, 12).join(' '), 'flute', { vel: 0.4, transpose: -12 });
  // 마무리 (54~59)
  waltz(b, 54, 'G D A7 D D');
  b.seq(b.bar(54), 0.5, MEL_A.split(' ').slice(18, 48).join(' '), 'bell', { vel: 0.6 });
  b.note(b.bar(59), 'triangle', 0, 1, 1);
  b.chords(b.bar(59), 3, 'D', 'strings', { center: 64, vel: 0.8 });
  b.note(b.bar(59), 'bassSoft', 38, 3, 0.8);
  b.note(b.bar(59), 'bell', 86, 2, 0.8);
}

function build(b: ChartBuilder) {
  music(b);
  place(b);
  b.endBeat = b.bar(60) + 1;
}

// ------------------------------------------------------------------ 그림

const FLOWER_COLORS = ['#ff7ab8', '#ffd23e', '#8fd0ff', '#c77dff', '#ff9a5a', '#ffffff'];

function drawFlower(g: G, x: number, y: number, s: number, col: string, wilt = 0) {
  if (s <= 0.01) return;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  line(g, 0, 0, 0, -22, '#3a9a4a', 3);
  ellipse(g, 6, -8, 7, 3.5, -0.5, '#4ab85a', OUT, 1.5);
  g.translate(0, -24);
  g.rotate(wilt * 1.2);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    ellipse(g, Math.cos(a) * 7, Math.sin(a) * 7, 7, 5, a, wilt > 0 ? '#9a8a8a' : col, OUT, 1.5);
  }
  circle(g, 0, 0, 4.5, wilt > 0 ? '#7a6a5a' : '#ffe14d', OUT, 1.5);
  g.restore();
}

function drawFairy(g: G, x: number, y: number, s: number, t: number, o: { happy: boolean; sad: boolean; glow: number; front: boolean }) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  // 빛
  g.fillStyle = rgrad(g, 0, 0, 2, 50, [
    [0, `rgba(255,250,200,${0.55 + o.glow * 0.4})`],
    [1, 'rgba(255,250,200,0)'],
  ]);
  g.beginPath();
  g.arc(0, 0, 50, 0, TAU);
  g.fill();
  // 날개
  const fl = Math.sin(t * 30) * 0.3;
  for (const side of [-1, 1]) {
    g.save();
    g.scale(side, 1);
    g.rotate(-0.3 + fl);
    ellipse(g, 16, -12, 16, 9, -0.5, 'rgba(200,240,255,0.75)', OUT, 2);
    ellipse(g, 12, 4, 10, 6, 0.4, 'rgba(255,210,240,0.75)', OUT, 2);
    g.restore();
  }
  // 드레스
  g.beginPath();
  g.moveTo(-6, 0);
  g.lineTo(-14, 20);
  g.quadraticCurveTo(0, 26, 14, 20);
  g.lineTo(6, 0);
  g.closePath();
  g.fillStyle = '#ff9ad5';
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 2.5;
  g.stroke();
  // 머리
  circle(g, 0, -10, 11, '#ffe0c8', OUT, 2.5);
  g.beginPath();
  g.arc(0, -12, 11.5, Math.PI * 1.05, Math.PI * 1.95);
  g.fillStyle = '#ffd23e';
  g.fill();
  if (o.front) {
    if (o.happy) {
      happyEye(g, -4, -9, 2.5);
      happyEye(g, 4, -9, 2.5);
    } else if (o.sad) {
      line(g, -6, -10, -2, -8, OUT, 2);
      line(g, 6, -10, 2, -8, OUT, 2);
    } else {
      circle(g, -4, -9, 1.8, OUT);
      circle(g, 4, -9, 1.8, OUT);
    }
    circle(g, -7, -5, 2, 'rgba(255,130,160,0.5)');
    circle(g, 7, -5, 2, 'rgba(255,130,160,0.5)');
  }
  // 지팡이
  line(g, 10, 2, 22, -14, '#fff', 2.5);
  star(g, 23, -16, 6, 2.6, 5, t * 3, '#fff27a', OUT, 1.5);
  g.restore();
}

function createScene(sc: SceneCtx): Scene {
  const fx = new Particles();
  const spb = sc.spb;
  let lastTap = -99;
  let lastGood = -99;
  let lastMiss = -99;
  let W = 393;
  let H = 852;

  const lay = () => ({ cx: W / 2, cy: H * 0.63, rx: W * 0.4, ry: H * 0.095 });

  /** 요정의 궤도 각도 (앞 = 0) */
  function angleAt(t: number): { a: number; k: number; lap: number } {
    const cues = sc.cues;
    const normal = spb * BPB;
    if (!cues.length) return { a: 0, k: 0, lap: normal };
    let pi = -1;
    for (let i = 0; i < cues.length; i++) {
      if (cues[i].t <= t) pi = i;
      else break;
    }
    const prev = pi >= 0 ? cues[pi] : null;
    const next = pi + 1 < cues.length ? cues[pi + 1] : null;
    const maxLap = normal * 2.2;
    if (next && (!prev || next.t - prev.t > maxLap)) {
      // 첫 통과 전(또는 긴 쉼 뒤): 다음 통과 한 바퀴 전부터 날아 들어옴
      const after = cues[pi + 2];
      const lap = after && after.t - next.t <= maxLap ? after.t - next.t : normal;
      const u = (t - (next.t - lap)) / lap;
      return { a: TAU * (u - 1), k: clamp01(u * 3), lap };
    }
    if (prev && !next) {
      return { a: TAU * ((t - prev.t) / normal), k: clamp01(1 - (t - prev.t) / normal), lap: normal };
    }
    const lap = next!.t - prev!.t;
    return { a: TAU * ((t - prev!.t) / lap), k: 1, lap };
  }

  function pos(t: number): { x: number; y: number; s: number; front: boolean } {
    const L = lay();
    const { a } = angleAt(t);
    // 앞(아래쪽)에서 시작해 오른쪽 → 뒤 → 왼쪽으로
    const x = L.cx + Math.sin(a) * L.rx;
    const y = L.cy + Math.cos(a) * L.ry - 60;
    const depth = (Math.cos(a) + 1) / 2;
    return { x, y, s: lerp(1.0, 1.9, depth), front: Math.cos(a) > -0.2 };
  }

  return {
    onInput(ev, cue) {
      if (ev.kind !== 'tap') return;
      lastTap = ev.time;
      const p = pos(ev.time);
      if (!cue) {
        sc.sfx('whiff', 0, 0.5);
        return;
      }
      if (cue.grade === 'just') {
        lastGood = ev.time;
        sc.sfx('twinkle', 84, 1);
        fx.burst(p.x, p.y, 12, { kind: 'spark', r: 7, speed: 200, colors: ['#fff27a', '#ffffff', '#ff9ad5', '#8fd0ff'], max: 0.7 });
      } else {
        sc.sfx('twinkle', 72, 0.5);
        sc.sfx('fizzle', 0, 0.5);
      }
    },
    onMiss(c: Cue) {
      lastMiss = c.t + 0.1;
      sc.sfx('fizzle', 0, 0.8);
    },
    draw(g: G, f: Frame) {
      W = f.W;
      H = f.H;
      const t = f.t;
      fx.update(f.dt);
      const L = lay();
      // 밤 정원
      g.fillStyle = vgrad(g, 0, H, [
        [0, '#1a1240'],
        [0.5, '#3a2a70'],
        [1, '#2a4a50'],
      ]);
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 50; i++) {
        const tw = 0.5 + 0.5 * Math.sin(f.real * 1.5 + i * 2.1);
        circle(g, hash01(i * 3) * W, hash01(i * 11) * H * 0.45, 0.8 + tw * 1.2, `rgba(255,255,255,${0.3 + tw * 0.6})`);
      }
      // 초승달
      circle(g, W * 0.2, H * 0.14 + f.safe.t * 0.4, 30, '#fff6cf');
      circle(g, W * 0.2 + 12, H * 0.14 + f.safe.t * 0.4 - 6, 27, '#1f1648');
      // 언덕과 울타리
      g.fillStyle = '#2f6a4a';
      g.beginPath();
      g.moveTo(0, H * 0.46);
      g.quadraticCurveTo(W * 0.5, H * 0.4, W, H * 0.46);
      g.lineTo(W, H);
      g.lineTo(0, H);
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 3;
      g.stroke();
      for (let x = 10; x < W; x += 28) {
        rrect(g, x, H * 0.43 - Math.abs(x - W / 2) * -0.04, 8, 36, 3, '#e8d8c0', OUT, 2);
      }
      // 화단
      ellipse(g, L.cx, L.cy, L.rx + 30, L.ry + 30, 0, '#6a4a3a', OUT, 3.5);
      ellipse(g, L.cx, L.cy - 4, L.rx + 18, L.ry + 20, 0, '#7a5a44');
      // 앞 목표 지점
      const tgt = { x: L.cx, y: L.cy + L.ry + 6 };
      const beatPulse = Math.exp(-frac(f.beat / BPB) * 4);
      ellipse(g, tgt.x, tgt.y, 34 + beatPulse * 6, 10 + beatPulse * 2, 0, 'rgba(255,240,150,0.25)', 'rgba(255,240,150,0.8)', 2.5);
      // 꽃 (성공한 통과마다 하나씩)
      const flowers: { x: number; y: number; s: number; col: string; wilt: number }[] = [];
      sc.cues.forEach((c, i) => {
        if (!c.grade || (c.at ?? c.t) > t) return;
        const h1 = hash01(i * 17 + 3);
        const h2 = hash01(i * 29 + 7);
        const a = h1 * TAU;
        const r = 0.25 + h2 * 0.7;
        const fx2 = L.cx + Math.cos(a) * L.rx * r;
        const fy2 = L.cy + Math.sin(a) * L.ry * r + 6;
        const at = c.at ?? c.t;
        const grow = easeOutBack(clamp01((t - at) / 0.4));
        if (c.grade === 'miss') flowers.push({ x: fx2, y: fy2, s: 0.8 * clamp01((t - at) / 0.3), col: '#999', wilt: 1 });
        else flowers.push({ x: fx2, y: fy2, s: (c.grade === 'just' ? 1.1 : 0.75) * grow, col: FLOWER_COLORS[i % FLOWER_COLORS.length], wilt: 0 });
      });
      flowers.sort((p, q) => p.y - q.y);
      const fp = pos(t);
      const { lap, k } = angleAt(t);
      const fast = lap < spb * 2;
      const happy = t - lastGood < 0.4 && t >= lastGood;
      const sad = t - lastMiss < 0.8 && t >= lastMiss;
      // 뒤쪽이면 먼저 그림
      if (!fp.front && k > 0) {
        g.globalAlpha = k;
        drawFairy(g, fp.x, fp.y, fp.s, f.real, { happy, sad, glow: fast ? 1 : 0, front: false });
        g.globalAlpha = 1;
      }
      // 가운데 등불
      rrect(g, L.cx - 5, L.cy - 70, 10, 70, 4, '#4a4a6a', OUT, 2.5);
      circle(g, L.cx, L.cy - 76, 14, '#fff3a0', OUT, 2.5);
      g.fillStyle = rgrad(g, L.cx, L.cy - 76, 4, 60, [
        [0, 'rgba(255,240,160,0.5)'],
        [1, 'rgba(255,240,160,0)'],
      ]);
      g.beginPath();
      g.arc(L.cx, L.cy - 76, 60, 0, TAU);
      g.fill();
      for (const fl of flowers) drawFlower(g, fl.x, fl.y, fl.s, fl.col, fl.wilt);
      if (fp.front && k > 0) {
        g.globalAlpha = k;
        // 꼬리 반짝이
        for (let i = 1; i <= 6; i++) {
          const q = pos(t - i * 0.035);
          g.globalAlpha = k * (1 - i / 7) * 0.8;
          sparkle(g, q.x, q.y + 10, 5 * q.s * (1 - i / 8), fast ? '#ff9ad5' : '#fff27a');
        }
        g.globalAlpha = k;
        drawFairy(g, fp.x, fp.y, fp.s, f.real, { happy, sad, glow: fast ? 1 : 0, front: true });
        g.globalAlpha = 1;
      }
      // 예고 표시
      for (const m of sc.markers) {
        if (m.type !== 'hint') continue;
        const d = t - m.t;
        if (d < 0 || d > spb * BPB * 1.2) continue;
        const kk = easeOutBack(clamp01(d / 0.25));
        g.save();
        g.translate(W / 2, H * 0.3);
        g.scale(kk, kk);
        rrect(g, -80, -22, 160, 44, 22, '#fff', OUT, 3);
        text(g, m.data.text, 0, 1, 20, '#c77dff', { weight: 900 });
        g.restore();
      }
      void lastTap;
      fx.draw(g);
      // 앞쪽 수풀
      for (let i = 0; i < 7; i++) {
        const bx = (i / 6) * W;
        const by = H - f.safe.b * 0.3 + 10;
        circle(g, bx, by, 46 + (i % 2) * 12, '#23543a', OUT, 3);
        circle(g, bx + 10, by - 30, 5, 'rgba(255,250,170,0.8)');
      }
      // 박 표시
      const bb = Math.floor(frac(f.beat / BPB) * BPB);
      for (let i = 0; i < BPB; i++) circle(g, W / 2 + (i - 1) * 22, H * 0.84, i === bb ? 7 : 5, i === bb ? '#fff27a' : 'rgba(255,255,255,0.35)');
    },
  };
}

function drawIcon(g: G, cx: number, cy: number, s: number, t: number) {
  const k = s / 130;
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  ellipse(g, 0, 36, 60, 14, 0, '#7a5a44', OUT, 2.5);
  for (let i = 0; i < 5; i++) drawFlower(g, -40 + i * 20, 42 - (i % 2) * 6, 0.9, FLOWER_COLORS[i]);
  const a = t * 2.5;
  drawFairy(g, Math.sin(a) * 40, -6 + Math.cos(a) * 8, 1.2 + Math.cos(a) * 0.2, t, { happy: true, sad: false, glow: 0.5, front: true });
  g.restore();
}

function drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number) {
  epilogueFrame(g, x, y, w, h, '#2a2a60', () => {
    g.fillStyle = '#2f6a4a';
    g.fillRect(x, y + h * 0.6, w, h * 0.4);
    const n = rank === 'hi' ? 16 : rank === 'ok' ? 7 : 2;
    for (let i = 0; i < n; i++) {
      drawFlower(g, x + 20 + hash01(i * 7) * (w - 40), y + h * 0.66 + hash01(i * 3) * h * 0.28, 1, FLOWER_COLORS[i % 6], rank === 'try' ? 1 : 0);
    }
    drawFairy(g, x + w * 0.5, y + h * 0.35 + Math.sin(t * 2) * 6, 1.6, t, { happy: rank !== 'try', sad: rank === 'try', glow: rank === 'hi' ? 1 : 0, front: true });
  });
}

export const waltzGame: GameDef = {
  id: ID,
  title: '요정 왈츠',
  sub: 'Fairy Waltz',
  desc: '꽃밭을 도는 요정이 앞을 지날 때 탭!',
  howto: '쿵짝짝 왈츠에 맞춰 요정이 꽃밭을 돌아요.\n요정이 맨 앞(빛나는 자리)을 지날 때마다 탭하면 꽃이 피어요.\n"빨라져요!"면 반 마디마다, "느긋하게~"면 두 마디마다!',
  color: '#c77dff',
  accent: '#f0e0ff',
  bpm: BPM,
  beatsPerBar: BPB,
  liveSfx: [
    ['twinkle', 84],
    ['twinkle', 72],
    ['fizzle', 0],
    ['whiff', 0],
  ],
  build,
  practice: [
    {
      text: '요정이 맨 앞을 지날 때 탭!\n쿵짝짝의 "쿵"에 맞춰요.',
      beats: 6,
      need: 4,
      build(b) {
        pass(b, 0, 'bar');
        pass(b, 3, 'bar');
      },
    },
    {
      text: '"빨라져요!" 하면 요정이\n반 마디마다 지나가요!',
      beats: 6,
      need: 5,
      build(b) {
        pass(b, 0, 'half');
        pass(b, 1.5, 'half');
        pass(b, 3, 'half');
        pass(b, 4.5, 'half');
      },
    },
  ],
  practiceBacking(b, beats) {
    for (let i = 0; i < beats; i += 3) {
      b.bassline(i, 3, 'D', 'R-----', 'bassSoft', { vel: 0.7 });
      b.chords(i, 3, 'D', 'strings', { rhythm: '..x.x.', center: 64, vel: 0.5 });
      b.drums(i, 0.5, { k: 'x.....', sh: '..x.x.' }, { vel: 0.55 });
    }
  },
  createScene,
  drawIcon,
  cats: { bar: '한 마디 왈츠', half: '빠른 왈츠', slow: '느린 왈츠' },
  comments: {
    good: { bar: '우아한 왈츠 스텝이었어요!', half: '빨라진 요정도 완벽히 따라갔어요!', slow: '느긋한 박자도 흔들림 없었어요!' },
    bad: { bar: '"쿵짝짝"의 "쿵"에 맞춰요.', half: '빨라지면 반 마디마다예요.', slow: '느려지면 두 마디를 기다려요.' },
  },
  epilogue: {
    hi: '정원이 꽃으로 가득! 요정의 무도회가 열렸어요.',
    ok: '꽃이 몇 송이 피었어요. 내일 또 춤춰요!',
    try: '꽃들이 시들시들... 요정이 어지러워해요.',
  },
  drawEpilogue,
  remixPart(b, start, bars, v) {
    // 4/4 리믹스에서는 두 박마다 한 바퀴 (홀수 변형은 후반에 한 박마다)
    const total = bars * b.beatsPerBar;
    for (let i = 0; i < total; ) {
      const fast = v % 2 === 1 && i >= total / 2;
      pass(b, start + i, fast ? 'half' : 'bar');
      i += fast ? 1 : 2;
    }
  },
};
