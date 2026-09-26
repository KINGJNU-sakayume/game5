// 2. 짹짹 트리오 — 두 마리가 짹, 짹 하면 같은 간격으로 내가 짹!
import type { ChartBuilder, Cue } from '../core/chart';
import type { Frame, GameDef, Scene, SceneCtx } from '../core/game';
import { OUT, Particles, circle, ellipse, happyEye, line, noteGlyph, poly, rrect, sweat, text, vgrad, type G } from '../core/gfx';
import type { Rank } from '../core/judge';
import { bounce, clamp01, easeOutBack, frac, lerp } from '../core/util';
import { epilogueFrame } from './common';

const ID = 'trio';
const BPM = 100;
const PITCH = [88, 92, 95];
const D: Record<string, number> = { q: 1, e: 0.5, t: 1 / 3, h: 2, d: 0.75 };
const CAT: Record<string, string> = { q: 'normal', h: 'normal', d: 'tricky', e: 'fast', t: 'fast', A: 'together' };

function seq(b: ChartBuilder, beat: number, k: string) {
  if (k === 'A') {
    b.sfx(beat, 'twinkle', 0.8, 84);
    b.sfx(beat + 1, 'flap', 0.8);
    b.sfx(beat + 2, 'chirp', 1, PITCH[0], -0.5);
    b.sfx(beat + 2, 'chirp', 1, PITCH[1], 0);
    b.cue(beat + 2, 'tap', 'A', { b1: beat + 2, b2: beat + 2, start: beat }, { cat: 'together', weight: 1.5 });
    return;
  }
  const d = D[k];
  b.sfx(beat, 'chirp', 1, PITCH[0], -0.5);
  b.sfx(beat + d, 'chirp', 1, PITCH[1], 0);
  b.cue(beat + 2 * d, 'tap', k, { b1: beat, b2: beat + d, start: beat }, { cat: CAT[k] });
}

function place(b: ChartBuilder, barStart: number, str: string) {
  for (const tok of str.split(/\s+/).filter(Boolean)) {
    const k = tok[0];
    const off = parseFloat(tok.slice(1) || '0');
    seq(b, barStart + off, k);
  }
}

const CHART: string[] = [
  // A (2~9)
  'q0', 'q0', 'q0', 'q0', 'q0', 'e0 e2', 'q0', 'q0',
  // B (10~17)
  'e0 e2', 'q0', 'e0 e2', 'e0 e2', 'q0', 'e0 e2', 'e0 e2', 'A0',
  // C (18~21)
  'q0', 'e0 e2', 'q0', 'A0',
  // D (22~29)
  't0 t2', 'q0', 't0 t2', 'e0 t2', 'd0', 't0 e2', 'd0', 'A0',
  // E (30~36)
  'h0', '', 'h0', '', 'e0 e2', 't0 e2', 'A0',
];

const MEL_A = [
  'B4 - D5 . F#5 - E5 .', 'D5 - B4 . G4 - . .', 'C5 - E5 . G5 - F#5 .', 'E5 - D5 . C5 - A4 .',
  'B4 - D5 . G5 - F#5 .', 'E5 - D5 . B4 - G4 .', 'A4 - C5 . E5 - D5 .', 'D5 - - - . . . .',
].join(' ');
const MEL_B = [
  'E5 - G5 . B5 - A5 .', 'F#5 - D5 . B4 - . .', 'G5 - F#5 . E5 - D5 .', 'C#5 - E5 . A5 - G5 .',
  'E5 - C5 . A4 - C5 .', 'F#5 - E5 . D5 - C5 .', 'B4 - - - D5 - G5 .', 'F#5 - - - . . . .',
].join(' ');
const PROG_A = 'Gmaj7 Em7 Am7 D7 Gmaj7 Em7 Am7 D7';
const PROG_B = 'Cmaj7 Bm7 Em7 A7 Am7 D7 Gmaj7 D7';

function band(b: ChartBuilder, bar: number, prog: string, soft = false) {
  const n = prog.split(' ').length;
  b.bassline(b.bar(bar), 4, prog, 'R..5R..5', 'bassSoft', { vel: 0.75 });
  b.chords(b.bar(bar), 4, prog, 'ep', { rhythm: 'x..x..x.', center: 64, vel: soft ? 0.35 : 0.45 });
  for (let i = 0; i < n; i++) {
    const s = b.bar(bar + i);
    b.drums(s, 0.5, { k: 'x..xx..x', r: i % 2 ? '..x..x..' : 'x..x..x.' }, { vel: 0.7 });
    b.drums(s, 0.25, { sh: 'xoxoxoxoxoxoxoxo' }, { vel: 0.8 });
  }
}

function music(b: ChartBuilder) {
  band(b, 0, 'Gmaj7 Cmaj7', true);
  band(b, 2, PROG_A);
  b.seq(b.bar(2), 0.5, MEL_A, 'flute', { vel: 0.7 });
  band(b, 10, PROG_B);
  b.seq(b.bar(10), 0.5, MEL_B, 'flute', { vel: 0.7 });
  b.chords(b.bar(10), 4, PROG_B, 'pad', { center: 60, vel: 0.5 });
  band(b, 18, 'Gmaj7 Em7 Am7 D7');
  b.seq(b.bar(18), 0.5, MEL_A.split(' ').slice(0, 32).join(' '), 'bell', { vel: 0.55 });
  band(b, 22, 'Em7 Am7 D7 Gmaj7 Cmaj7 Bm7 Am7 D7');
  b.seq(b.bar(22), 0.5, MEL_B, 'marimba', { vel: 0.6, transpose: -12 });
  b.chords(b.bar(22), 4, 'Em7 Am7 D7 Gmaj7 Cmaj7 Bm7 Am7 D7', 'strings', { center: 62, vel: 0.6 });
  band(b, 30, 'Gmaj7 Em7 Am7 D7 Cmaj7 D7 Gmaj7');
  b.seq(b.bar(30), 0.5, MEL_A.split(' ').slice(0, 56).join(' '), 'flute', { vel: 0.7 });
  b.seq(b.bar(30), 0.5, MEL_A.split(' ').slice(0, 56).join(' '), 'bell', { vel: 0.3, transpose: 12 });
  // 엔딩
  b.chords(b.bar(37), 4, 'Gmaj7', 'ep', { center: 64, vel: 0.6 });
  b.note(b.bar(37), 'bassSoft', 43, 3, 0.8);
  b.note(b.bar(37), 'triangle', 0, 1, 0.8);
  b.seq(b.bar(37), 0.5, 'G5 - - - - - . .', 'flute', { vel: 0.7 });
}

function build(b: ChartBuilder) {
  music(b);
  CHART.forEach((p, i) => place(b, b.bar(2 + i), p));
  b.endBeat = b.bar(37) + 3;
}

// ------------------------------------------------------------------ 그림

interface BirdOpts {
  chirp: number; // 짹 후 경과(초), 없으면 큰 값
  look: number;
  glare: boolean;
  scarf: boolean;
  sweat: boolean;
  happy: boolean;
  bob: number;
  t: number;
  flap?: number;
  bad?: boolean;
}

function drawBird(g: G, x: number, y: number, s: number, o: BirdOpts) {
  const ch = o.chirp < 0.25 ? 1 - o.chirp / 0.25 : 0;
  const sy = 1 + ch * 0.12 - o.bob * 0.04;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  // 다리
  line(g, -8, 26, -10, 36, '#e08a3a', 3);
  line(g, 8, 26, 10, 36, '#e08a3a', 3);
  g.translate(0, -o.bob * 3 - ch * 7);
  g.scale(1 / Math.sqrt(sy), sy);
  // 꼬리
  poly(g, [-26, 8, -52, 20, -48, 2, -30, -4], '#7a4a2a', OUT, 3);
  // 몸
  ellipse(g, 0, 0, 34, 30, 0, '#b07a4f', OUT, 3.5);
  ellipse(g, 6, 12, 22, 15, 0, '#f3dfc2');
  // 머리 꼭대기 (갈색 모자)
  g.beginPath();
  g.ellipse(4, -8, 26, 20, 0, Math.PI * 1.05, Math.PI * 1.95);
  g.fillStyle = '#8a5a36';
  g.fill();
  // 볼
  ellipse(g, 14, 2, 12, 9, 0, '#fff');
  circle(g, 16, 5, 3.5, '#3a2a2a');
  // 날개
  const fl = o.flap != null && o.flap < 0.4 ? Math.sin(o.flap * 40) * 0.5 : 0;
  ellipse(g, -10, 6, 17, 12, -0.3 - fl, '#8a5a36', OUT, 2.5);
  line(g, -18, 4, -6, 10, '#6a3a20', 2);
  // 눈
  const ex = 10 + o.look * 3;
  if (o.happy) happyEye(g, ex, -8, 5);
  else {
    ellipse(g, ex, -8, 4, 5, 0, OUT);
    circle(g, ex + 1.3, -9.6, 1.4, '#fff');
    if (o.glare) line(g, ex - 6, -17, ex + 6, -13, OUT, 3);
  }
  // 부리
  const open = ch * 10;
  poly(g, [24, -6, 40, -3 - open * 0.3, 24, 0], '#ffb13b', OUT, 2.5);
  poly(g, [24, 0, 37, 2 + open, 24, 4], '#ff9a1f', OUT, 2.5);
  if (o.scarf) {
    rrect(g, -18, 16, 40, 10, 5, '#ff4d5e', OUT, 2.5);
    poly(g, [-14, 22, -24, 38, -8, 32], '#ff4d5e', OUT, 2.5);
  }
  if (o.sweat) sweat(g, -20, -26, 7);
  g.restore();
  if (ch > 0) {
    // 음표
    const k = 1 - ch;
    g.globalAlpha = ch;
    noteGlyph(g, x + 30 * s + k * 18, y - 40 * s - k * 40, 12 * s, o.bad ? '#8a8494' : '#fff');
    g.globalAlpha = 1;
  }
}

function drawSky(g: G, W: number, H: number, beat: number, t: number) {
  // 시간대: 아침 → 낮 → 노을
  const k = clamp01((beat - 60) / 60);
  const top = k < 0.5 ? mix('#7fd0ff', '#5aa8ff', k * 2) : mix('#5aa8ff', '#6a4ab8', (k - 0.5) * 2);
  const bot = k < 0.5 ? mix('#fff4c9', '#dff4ff', k * 2) : mix('#dff4ff', '#ffb27a', (k - 0.5) * 2);
  g.fillStyle = vgrad(g, 0, H, [
    [0, top],
    [0.75, bot],
  ]);
  g.fillRect(0, 0, W, H);
  // 해
  const sunY = lerp(H * 0.14, H * 0.5, k);
  circle(g, W * 0.78, sunY, 34, k > 0.6 ? '#ff8a4a' : '#fff27a');
  // 구름
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 137 + t * (8 + i * 3)) % (W + 160)) - 80;
    const cy = H * (0.1 + i * 0.07);
    g.globalAlpha = 0.9;
    ellipse(g, cx, cy, 34, 14, 0, '#ffffff');
    ellipse(g, cx + 22, cy - 8, 22, 13, 0, '#ffffff');
    ellipse(g, cx - 20, cy - 4, 18, 10, 0, '#ffffff');
    g.globalAlpha = 1;
  }
  // 지붕들
  const baseY = H * 0.78;
  const roofs = [
    [0, 90, '#e0765a'],
    [80, 120, '#5a8ae0'],
    [190, 100, '#e0b35a'],
    [280, 130, '#6ac48a'],
  ] as const;
  for (const [rx, rw, col] of roofs) {
    const hh = 60 + (rx % 50);
    rrect(g, rx, baseY - hh, rw, hh + H, 6, '#f7ead8', OUT, 3);
    poly(g, [rx - 8, baseY - hh, rx + rw / 2, baseY - hh - 40, rx + rw + 8, baseY - hh], col, OUT, 3);
    for (let wx = rx + 16; wx < rx + rw - 20; wx += 32) {
      rrect(g, wx, baseY - hh + 18, 18, 20, 3, k > 0.7 ? '#ffe27a' : '#a8d8ff', OUT, 2);
    }
  }
  g.fillStyle = '#8fcf7a';
  g.fillRect(0, H * 0.9, W, H * 0.1);
  line(g, 0, H * 0.9, W, H * 0.9, OUT, 3);
}

function mix(a: string, b: string, k: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(lerp(v, pb[i], clamp01(k))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function createScene(sc: SceneCtx): Scene {
  const fx = new Particles();
  let lastTap = -99;
  let lastGrade: 'just' | 'barely' | 'whiff' = 'just';
  let lastMiss = -99;
  const spb = sc.spb;

  function npcLast(which: 0 | 1, t: number): number {
    let best = -99;
    for (const c of sc.cues) {
      const bt = (which === 0 ? c.data.b1 : c.data.b2) * spb;
      if (bt <= t && bt > best) best = bt;
      if (c.data.start * spb > t + 1) break;
    }
    return best;
  }

  function flapLast(t: number): number {
    let best = -99;
    for (const c of sc.cues) {
      if (c.kind !== 'A') continue;
      const ft = (c.data.start + 1) * spb;
      if (ft <= t && ft > best) best = ft;
    }
    return best;
  }

  return {
    onInput(ev, cue) {
      if (ev.kind !== 'tap') return;
      lastTap = ev.time;
      if (!cue) {
        lastGrade = 'whiff';
        sc.sfx('chirpBad', 0, 0.5);
        return;
      }
      lastGrade = cue.grade === 'just' ? 'just' : 'barely';
      if (cue.grade === 'just') {
        sc.sfx('chirp', PITCH[2], 1, 0.5);
      } else sc.sfx('chirpBad', 0, 0.8);
    },
    onMiss(c: Cue) {
      lastMiss = c.t + 0.1;
      sc.sfx('chirpBad', 0, 0.4);
    },
    draw(g: G, f: Frame) {
      const { W, H, t } = f;
      fx.update(f.dt);
      drawSky(g, W, H, f.beat, f.real);
      // 전봇대와 전선
      const wy = H * 0.5;
      rrect(g, -14, wy - 150, 26, H, 6, '#9a7a5a', OUT, 3);
      rrect(g, W - 12, wy - 150, 26, H, 6, '#9a7a5a', OUT, 3);
      rrect(g, -30, wy - 140, 60, 10, 4, '#7a5a3a', OUT, 2.5);
      rrect(g, W - 30, wy - 140, 60, 10, 4, '#7a5a3a', OUT, 2.5);
      const sag = 14;
      g.beginPath();
      g.moveTo(-10, wy - 4);
      g.quadraticCurveTo(W / 2, wy + sag * 2 - 4, W + 10, wy - 4);
      g.strokeStyle = '#3a3040';
      g.lineWidth = 3.5;
      g.stroke();
      g.beginPath();
      g.moveTo(-10, wy - 120);
      g.quadraticCurveTo(W / 2, wy - 100, W + 10, wy - 120);
      g.strokeStyle = 'rgba(58,48,64,0.5)';
      g.lineWidth = 2.5;
      g.stroke();
      const wireY = (x: number) => {
        const u = (x + 10) / (W + 20);
        return wy - 4 + sag * 2 * 2 * u * (1 - u) * 1;
      };
      const xs = [W * 0.18, W * 0.5, W * 0.82];
      const bob = bounce(f.beat);
      const glare = t - lastMiss < 0.9 && t >= lastMiss;
      const flap = t - flapLast(t);
      // 다 같이 준비 표시
      for (const c of sc.cues) {
        if (c.kind !== 'A') continue;
        const st = c.data.start * spb;
        if (t >= st && t < c.t + 0.3) {
          const k = clamp01((t - st) / (c.t - st));
          g.globalAlpha = 1 - clamp01((t - c.t) / 0.3);
          rrect(g, W / 2 - 70, wy - 150, 140, 40, 20, '#fff', OUT, 3);
          text(g, '다 같이!', W / 2, wy - 129, 20 + k * 4, '#ff6b8b', { weight: 900 });
          g.globalAlpha = 1;
        }
      }
      for (let i = 0; i < 3; i++) {
        const x = xs[i];
        const s = 1.45;
        const y = wireY(x) - 36 * s;
        if (i < 2) {
          const last = npcLast(i as 0 | 1, t);
          drawBird(g, x, y, s, {
            chirp: t - last,
            look: glare ? 1 : 0,
            glare,
            scarf: false,
            sweat: false,
            happy: false,
            bob,
            t,
            flap,
          });
        } else {
          const since = t - lastTap;
          drawBird(g, x, y, s, {
            chirp: since,
            look: 0,
            glare: false,
            scarf: true,
            sweat: glare || (lastGrade === 'barely' && since < 0.5),
            happy: lastGrade === 'just' && since < 0.4 && since >= 0,
            bob,
            t,
            flap,
            bad: lastGrade !== 'just',
          });
          if (since >= 0 && since < 0.05 && lastGrade === 'just' && fx.list.length < 40) {
            fx.burst(x + 40, y - 30, 6, { kind: 'spark', r: 6, speed: 160, colors: ['#fff', '#fff27a'], max: 0.5 });
          }
        }
      }
      // "나" 표시
      const px = xs[2];
      const py = wireY(px) + 44;
      const k = easeOutBack(clamp01(frac(f.real * 0.5) * 3));
      rrect(g, px - 22, py + 8, 44, 24, 12, '#ff4d5e', OUT, 2.5);
      text(g, '나', px, py + 20.5, 14 * Math.min(1, k + 0.5), '#fff', { weight: 900 });
      fx.draw(g);
    },
  };
}

function drawIcon(g: G, cx: number, cy: number, s: number, t: number) {
  const k = s / 120;
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  line(g, -70, 32, 70, 32, OUT, 3);
  const ph = frac(t * 1.2);
  drawBird(g, -38, 0, 0.62, { chirp: ph < 0.33 ? ph * 3 * 0.25 : 1, look: 0, glare: false, scarf: false, sweat: false, happy: false, bob: 0, t });
  drawBird(g, 0, 0, 0.62, { chirp: ph > 0.33 && ph < 0.66 ? (ph - 0.33) * 0.75 : 1, look: 0, glare: false, scarf: false, sweat: false, happy: false, bob: 0, t });
  drawBird(g, 38, 0, 0.62, { chirp: ph > 0.66 ? (ph - 0.66) * 0.75 : 1, look: 0, glare: false, scarf: true, sweat: false, happy: ph > 0.66, bob: 0, t });
  g.restore();
}

function drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number) {
  epilogueFrame(g, x, y, w, h, rank === 'try' ? '#b8c4d8' : '#bfe6ff', () => {
    const wy = y + h * 0.62;
    line(g, x, wy, x + w, wy + 6, OUT, 3);
    const xs = [x + w * 0.25, x + w * 0.5, x + w * 0.75];
    xs.forEach((bx, i) => {
      const me = i === 2;
      drawBird(g, bx, wy - 30, 0.9, {
        chirp: rank === 'hi' ? frac(t + i * 0.2) * 0.3 : 1,
        look: rank === 'try' && !me ? 1 : 0,
        glare: rank === 'try' && !me,
        scarf: me,
        sweat: rank === 'try' && me,
        happy: rank === 'hi',
        bob: 0,
        t,
      });
    });
    if (rank === 'hi') {
      for (let i = 0; i < 5; i++) noteGlyph(g, x + 30 + i * (w - 60) / 4, y + 30 + Math.sin(t * 3 + i) * 8, 9, '#ff6b8b');
    }
  });
}

export const trio: GameDef = {
  id: ID,
  title: '짹짹 트리오',
  sub: 'Tweet Trio',
  desc: '앞의 두 마리와 같은 간격으로 짹!',
  howto: '첫째가 "짹", 둘째가 "짹" 하면 같은 간격만큼 뒤에 탭!\n간격은 길어지기도, 짧아지기도 해요.\n"뾰로롱~" 소리가 나면 두 박자 뒤에 다 같이 짹!',
  color: '#6bc6ff',
  accent: '#dff4ff',
  bpm: BPM,
  liveSfx: [
    ['chirp', PITCH[2]],
    ['chirpBad', 0],
  ],
  build,
  practice: [
    {
      text: '짹, 짹 하면 같은 간격으로\n마지막에 탭해서 짹!',
      beats: 4,
      need: 3,
      build(b) {
        seq(b, 0, 'q');
      },
    },
    {
      text: '빨라져도 간격은 똑같이!\n짹짹 → 짹!',
      beats: 4,
      need: 4,
      build(b) {
        seq(b, 0, 'e');
        seq(b, 2, 'e');
      },
    },
    {
      text: '"뾰로롱~" 하면\n두 박자 뒤에 다 같이 짹!',
      beats: 8,
      need: 3,
      build(b) {
        seq(b, 0, 'A');
        seq(b, 4, 'q');
      },
    },
  ],
  practiceBacking(b, beats) {
    for (let i = 0; i < beats; i += 4) {
      b.drums(i, 0.5, { k: 'x..xx..x', r: 'x..x..x.' }, { vel: 0.6 });
      b.bassline(i, 4, 'Gmaj7', 'R..5R..5', 'bassSoft', { vel: 0.7 });
    }
  },
  createScene,
  drawIcon,
  cats: { normal: '보통 간격', fast: '빠른 간격', tricky: '엇갈린 간격', together: '다 같이' },
  comments: {
    good: {
      normal: '짹짹짹, 호흡이 척척 맞았어요!',
      fast: '빠른 짹짹도 놓치지 않았어요!',
      tricky: '엇갈린 간격도 완벽했어요!',
      together: '다 같이 짹! 멋진 화음이에요!',
    },
    bad: {
      normal: '간격을 잘 세어 보세요.',
      fast: '빨라지면 조급해졌어요.',
      tricky: '엇갈린 간격이 어려웠나 봐요.',
      together: '"뾰로롱" 뒤 두 박자를 기억해요.',
    },
  },
  epilogue: {
    hi: '세 마리의 합창은 동네의 명물이 되었어요!',
    ok: '그럭저럭 박자를 맞춘 하루였어요.',
    try: '막내 참새는 오늘도 한 박자 늦었어요...',
  },
  drawEpilogue,
  remixPart(b, start, bars, v) {
    const pats = v % 2 ? ['e0 e2', 't0 t2', 'q0', 'A0'] : ['q0', 'e0 e2', 'd0', 'q0'];
    for (let i = 0; i < bars; i++) place(b, start + i * b.beatsPerBar, pats[i % pats.length]);
  },
};
