// 5. 펭귄 행진 — 박자에 맞춰 제자리 행진, 호루라기 신호에 엇박자로 바꾸기
import type { ChartBuilder, Cue } from '../core/chart';
import type { Frame, GameDef, Scene, SceneCtx } from '../core/game';
import { OUT, circle, dizzyEye, ellipse, happyEye, poly, rrect, star, sweat, text, vgrad, type G } from '../core/gfx';
import type { Rank } from '../core/judge';
import { clamp01, easeOutBack, frac, hash01 } from '../core/util';
import { bubble, epilogueFrame } from './common';

const ID = 'penguin';
const BPM = 120;

type Mode = 'on' | 'off';

/** 한 마디 동안의 걸음 (mode에 따라 정박/엇박) */
function steps(b: ChartBuilder, bar: number, mode: Mode, from = 0, to = 4, sw = 0) {
  const s = b.bar(bar);
  for (let i = from; i < to; i++) {
    const beat = s + i + (mode === 'off' ? 0.5 : 0);
    const isSwitch = sw > 0;
    b.sfx(beat, 'step', 0.35);
    b.cue(beat, 'tap', mode, { mode }, { cat: isSwitch ? 'switch' : mode });
    if (sw > 0) sw--;
  }
}

/** 정박 → 엇박 전환 마디: 삑 삑 삑 삑 삐익! */
function toOff(b: ChartBuilder, bar: number) {
  const s = b.bar(bar);
  for (let i = 0; i < 4; i++) {
    b.sfx(s + i, 'whistle', 0.9, 91);
    b.cue(s + i, 'tap', 'on', { mode: 'on' }, { cat: 'on' });
    b.sfx(s + i, 'step', 0.35);
  }
  b.sfx(s + 3.5, 'whistleLong', 1, 95);
  b.marker(s + 3.5, 'mode', { mode: 'off' });
  b.marker(s, 'call', { mode: 'off' });
  b.sfx(s + 3.5, 'step', 0.35);
  b.cue(s + 3.5, 'tap', 'off', { mode: 'off' }, { cat: 'switch', weight: 1.2 });
}

/** 엇박 → 정박 전환 마디: (엇박) 삑 삑 삑 → 삐익! (정박) */
function toOn(b: ChartBuilder, bar: number) {
  const s = b.bar(bar);
  for (let i = 0; i < 3; i++) {
    b.sfx(s + i + 0.5, 'whistle', 0.9, 91);
    b.cue(s + i + 0.5, 'tap', 'off', { mode: 'off' }, { cat: 'off' });
    b.sfx(s + i + 0.5, 'step', 0.35);
  }
  b.sfx(s + 3, 'whistleLong', 1, 95);
  b.marker(s + 3, 'mode', { mode: 'on' });
  b.marker(s, 'call', { mode: 'on' });
  b.sfx(s + 3, 'step', 0.35);
  b.cue(s + 3, 'tap', 'on', { mode: 'on' }, { cat: 'switch', weight: 1.2 });
}

// 구성: 문자열 한 글자 = 한 마디 (o 정박, x 엇박, > 정박→엇박 전환, < 엇박→정박 전환, . 쉼)
const PLAN = '..oooooo>xxxxx<ooooo>xxx<oo><ooo>xxx<oo';

function music(b: ChartBuilder, bars: number) {
  // 인트로: 스네어 롤 + 카운트
  b.drums(0, 0.25, { s: 'o.o.o.o.o.o.xxxX' }, { vel: 0.8 });
  b.drums(4, 0.5, { k: 'x.x.x.x.', s: '......XX' });
  b.countIn(4, 4);
  b.bassline(0, 4, 'D A', 'R...R.5.', 'bass');
  const progA = 'D G A D Bm G A D';
  const progB = 'Em A D Bm G A D D';
  const melA = [
    'F#5 . A5 . D6 . A5 .', 'B5 . G5 . D5 . G5 .', 'C#6 . A5 . E5 . A5 .', 'D6 - - . A5 . F#5 .',
    'D6 . B5 . F#5 . B5 .', 'D6 . B5 . G5 . B5 .', 'E6 . C#6 . A5 . C#6 .', 'D6 - - - . . . .',
  ].join(' ');
  const melB = [
    'G5 . B5 . E6 . B5 .', 'A5 . C#6 . E6 . C#6 .', 'D6 . A5 . F#5 . A5 .', 'B5 - - . F#5 . D5 .',
    'G5 . B5 . D6 . B5 .', 'A5 . E5 . A5 . C#6 .', 'D6 . F#6 . E6 . C#6 .', 'D6 - - - . . . .',
  ].join(' ');
  for (let bar = 2; bar < bars; bar += 8) {
    const n = Math.min(8, bars - bar);
    const useB = ((bar - 2) / 8) % 2 === 1;
    const prog = (useB ? progB : progA).split(' ').slice(0, n).join(' ');
    const mel = (useB ? melB : melA).split(' ').slice(0, n * 8).join(' ');
    b.bassline(b.bar(bar), 4, prog, 'R.5.R.5.', 'bass');
    b.chords(b.bar(bar), 4, prog, 'brass', { rhythm: '.x.x.x.x', center: 64, vel: 0.35 });
    b.seq(b.bar(bar), 0.5, mel, 'bell', { vel: 0.5, transpose: -12 });
    b.seq(b.bar(bar), 0.5, mel, 'lead', { vel: 0.45, transpose: -12 });
    if (useB) b.chords(b.bar(bar), 4, prog, 'pad', { center: 60, vel: 0.5 });
    for (let i = 0; i < n; i++) {
      const s = b.bar(bar + i);
      b.drums(s, 0.25, { k: 'x.......x.......', s: '....x.o.....x.oo', h: 'x.x.x.x.x.x.x.x.' }, { vel: 0.8 });
    }
    b.note(b.bar(bar), 'crash', 0, 1, 0.6);
  }
  // 엔딩
  b.note(b.bar(bars), 'crash', 0, 1, 1);
  b.note(b.bar(bars), 'kick', 0, 1, 1);
  b.chords(b.bar(bars), 4, 'D', 'brass', { center: 66, vel: 0.8, gate: 0.6 });
  b.note(b.bar(bars), 'bass', 38, 3, 0.9);
  b.note(b.bar(bars), 'bell', 86, 2, 0.8);
  b.sfx(b.bar(bars), 'whistleLong', 1, 98);
}

function build(b: ChartBuilder) {
  const bars = PLAN.length;
  music(b, bars);
  let mode: Mode = 'on';
  let after = 0;
  b.marker(0, 'mode', { mode: 'on' });
  for (let i = 0; i < bars; i++) {
    const ch = PLAN[i];
    if (ch === 'o' || ch === 'x') {
      steps(b, i, ch === 'o' ? 'on' : 'off', 0, 4, after);
      after = 0;
      mode = ch === 'o' ? 'on' : 'off';
    } else if (ch === '>') {
      toOff(b, i);
      mode = 'off';
      after = 1;
    } else if (ch === '<') {
      toOn(b, i);
      mode = 'on';
      after = 1;
    }
  }
  void mode;
  b.endBeat = b.bar(bars) + 3;
}

// ------------------------------------------------------------------ 그림

interface PengOpts {
  step: number; // 마지막 걸음 후 경과(초)
  count: number; // 걸음 수 (좌/우 발)
  scarf?: boolean;
  face?: 'normal' | 'happy' | 'dizzy' | 'sweat' | 'whistle';
  trip?: number; // 0..1
  t: number;
}

function drawPenguin(g: G, x: number, y: number, s: number, o: PengOpts) {
  const st = o.step;
  const dip = st >= 0 && st < 0.12 ? (1 - st / 0.12) * 6 : 0;
  const lift = clamp01((st - 0.1) / 0.25);
  const leftUp = o.count % 2 === 0;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (o.trip) g.rotate(Math.sin(o.t * 30) * 0.15 * o.trip);
  // 발
  const fy = 44;
  ellipse(g, -14, fy - (leftUp ? lift * 10 : 0), 13, 6, 0, '#ff9a2a', OUT, 2.5);
  ellipse(g, 14, fy - (!leftUp ? lift * 10 : 0), 13, 6, 0, '#ff9a2a', OUT, 2.5);
  g.translate(0, dip);
  // 몸
  ellipse(g, 0, 4, 34, 42, 0, '#2d3148', OUT, 3.5);
  ellipse(g, 0, 12, 24, 32, 0, '#ffffff');
  // 날개
  const wing = Math.sin(o.count * Math.PI) * 0.2;
  ellipse(g, -33, 8, 8, 24, 0.3 + wing, '#2d3148', OUT, 2.5);
  ellipse(g, 33, 8, 8, 24, -0.3 - wing, '#2d3148', OUT, 2.5);
  // 얼굴
  const face = o.face ?? 'normal';
  if (face === 'dizzy') {
    dizzyEye(g, -10, -18, 5, o.t);
    dizzyEye(g, 10, -18, 5, o.t + 1);
  } else if (face === 'happy') {
    happyEye(g, -10, -17, 4.5);
    happyEye(g, 10, -17, 4.5);
  } else {
    circle(g, -10, -18, 5.5, '#fff', OUT, 1.5);
    circle(g, 10, -18, 5.5, '#fff', OUT, 1.5);
    circle(g, -9, -18, 2.6, OUT);
    circle(g, 11, -18, 2.6, OUT);
  }
  if (face === 'whistle') {
    rrect(g, -6, -10, 22, 9, 3, '#c0c8d8', OUT, 2);
  } else poly(g, [-8, -9, 8, -9, 0, 1], '#ffb13b', OUT, 2.5);
  circle(g, -18, -6, 4, 'rgba(255,130,150,0.5)');
  circle(g, 18, -6, 4, 'rgba(255,130,150,0.5)');
  if (o.scarf) {
    rrect(g, -24, -2, 48, 10, 5, '#ff4d5e', OUT, 2.5);
    poly(g, [14, 4, 24, 22, 8, 16], '#ff4d5e', OUT, 2.5);
  }
  if (face === 'sweat') sweat(g, 26, -30, 7);
  g.restore();
}

function createScene(sc: SceneCtx): Scene {
  const spb = sc.spb;
  let myStep = -99;
  let myCount = 0;
  let lastGood = -99;
  let lastBad = -99;
  let lastMiss = -99;
  let missStreak = 0;

  function modeAt(t: number): Mode {
    let m: Mode = 'on';
    for (const mk of sc.markers) {
      if (mk.type !== 'mode' || mk.t > t) continue;
      m = mk.data.mode;
    }
    return m;
  }

  /** 곧/지금 호루라기 신호 중인지 */
  function callAt(t: number): { k: number; to: Mode } | null {
    for (const mk of sc.markers) {
      if (mk.type !== 'call') continue;
      const d = t - mk.t;
      if (d >= 0 && d < 4 * spb) return { k: d / (4 * spb), to: mk.data.mode };
    }
    return null;
  }

  /** NPC 걸음: t 이전 가장 최근의 정답 시각 */
  function npcStep(t: number): { last: number; count: number } {
    let last = -99;
    let count = 0;
    for (const c of sc.cues) {
      if (c.t > t) break;
      last = c.t;
      count++;
    }
    return { last, count };
  }

  return {
    onInput(ev, cue) {
      if (ev.kind !== 'tap') return;
      myStep = ev.time;
      myCount++;
      if (!cue) {
        sc.sfx('stepBad', 0, 0.5);
        return;
      }
      if (cue.grade === 'just') {
        sc.sfx('step', 0, 0.9);
        lastGood = ev.time;
        missStreak = 0;
      } else {
        sc.sfx('stepBad', 0, 0.8);
        lastBad = ev.time;
      }
    },
    onMiss(c: Cue) {
      lastMiss = c.t + 0.12;
      missStreak++;
      sc.sfx('stepBad', 0, 0.3);
    },
    draw(g: G, f: Frame) {
      const { W, H, t } = f;
      const mode = modeAt(t);
      const off = mode === 'off';
      // 하늘 + 오로라
      g.fillStyle = vgrad(g, 0, H, off
        ? [
            [0, '#3a1050'],
            [0.6, '#8a2a8a'],
            [1, '#ff8ac8'],
          ]
        : [
            [0, '#0e2050'],
            [0.6, '#1f5a8a'],
            [1, '#7fd0ff'],
          ]);
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 30; i++) circle(g, hash01(i * 3) * W, hash01(i * 5) * H * 0.4, 1.2, 'rgba(255,255,255,0.8)');
      for (let band = 0; band < 3; band++) {
        g.beginPath();
        for (let x = 0; x <= W; x += 12) {
          const y = H * (0.14 + band * 0.06) + Math.sin(x * 0.02 + f.real * (0.8 + band * 0.3) + band) * 18;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.strokeStyle = off ? `rgba(255,${120 + band * 40},230,0.35)` : `rgba(${80 + band * 40},255,${180 + band * 20},0.35)`;
        g.lineWidth = 16 - band * 4;
        g.stroke();
      }
      // 빙산 무대
      const floorY = H * 0.46;
      g.fillStyle = off ? '#f3d6ff' : '#e8f7ff';
      g.beginPath();
      g.moveTo(0, floorY);
      g.lineTo(W, floorY - 20);
      g.lineTo(W, H);
      g.lineTo(0, H);
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(0, floorY);
      g.lineTo(W, floorY - 20);
      g.stroke();
      // 정박/엇박 표시 스트라이프
      for (let i = 0; i < 6; i++) {
        const yy = floorY + 40 + i * 70;
        g.fillStyle = off ? 'rgba(200,120,255,0.12)' : 'rgba(120,190,255,0.12)';
        g.fillRect(0, yy, W, 30);
      }
      const npc = npcStep(t);
      const npcSince = t - npc.last;
      // 대열 (뒤에서부터)
      const span = H - f.safe.b - 110 - floorY;
      const rows = [
        { n: 5, y: floorY + span * 0.1, s: 0.72 },
        { n: 4, y: floorY + span * 0.45, s: 0.9 },
        { n: 3, y: floorY + span * 0.86, s: 1.12 },
      ];
      const me = { x: W / 2, y: rows[2].y };
      rows.forEach((r, ri) => {
        for (let i = 0; i < r.n; i++) {
          const x = W / 2 + (i - (r.n - 1) / 2) * (W / (r.n + 0.4));
          if (ri === 2 && i === 1) continue;
          drawPenguin(g, x, r.y, r.s, {
            step: npcSince,
            count: npc.count + (i % 2),
            face: lastMiss > 0 && t - lastMiss < 0.8 && t >= lastMiss && ri === 2 ? 'sweat' : 'normal',
            t: f.real + i,
          });
        }
      });
      // 나
      const tripK = t - lastMiss < 0.6 && t >= lastMiss ? 1 - (t - lastMiss) / 0.6 : 0;
      let face: PengOpts['face'] = 'normal';
      if (missStreak >= 3) face = 'dizzy';
      else if (tripK > 0 || (t - lastBad < 0.4 && t >= lastBad)) face = 'sweat';
      else if (t - lastGood < 0.2 && t >= lastGood) face = 'happy';
      drawPenguin(g, me.x, me.y, 1.25, { step: t - myStep, count: myCount, scarf: true, face, trip: tripK, t: f.real });
      rrect(g, me.x - 18, me.y + 66, 36, 22, 11, '#ff4d5e', OUT, 2.5);
      text(g, '나', me.x, me.y + 77.5, 13, '#fff', { weight: 900 });
      // 대장 펭귄 (호루라기)
      const call = callAt(t);
      const lx = W * 0.16;
      const ly = floorY - 70 + f.safe.t * 0.3;
      rrect(g, lx - 40, ly + 40, 80, 30, 8, '#c9d8ee', OUT, 3);
      drawPenguin(g, lx, ly, 0.85, { step: npcSince, count: npc.count, face: call ? 'whistle' : 'normal', t: f.real });
      poly(g, [lx - 20, ly - 38, lx + 20, ly - 38, lx + 26, ly - 30, lx - 26, ly - 30], '#2d3148', OUT, 2.5);
      rrect(g, lx - 16, ly - 58, 32, 22, 6, '#2d3148', OUT, 2.5);
      star(g, lx, ly - 47, 7, 3, 5, -Math.PI / 2, '#ffd23e');
      if (call) {
        const k = easeOutBack(clamp01(call.k * 4));
        g.save();
        g.translate(lx + 88, ly - 40);
        g.scale(k, k);
        bubble(g, 0, 0, call.to === 'off' ? '엇박자로!' : '정박으로!', 17, -40, 12);
        g.restore();
      }
      // 모드 표시
      const pillW = 110;
      rrect(g, W - pillW - 16, f.safe.t + 12, pillW, 34, 17, off ? '#ff7ad9' : '#6bc6ff', OUT, 3);
      text(g, off ? '엇박자' : '정박자', W - pillW / 2 - 16, f.safe.t + 29.5, 16, '#fff', { weight: 900, stroke: OUT, strokeW: 4 });
      // 박자 점
      const bt = f.beat;
      for (let i = 0; i < 4; i++) {
        const on = Math.floor(frac(bt / 4) * 4) === i;
        circle(g, W - pillW - 16 + 22 + i * 22, f.safe.t + 60, on ? 6 : 4, on ? '#fff' : 'rgba(255,255,255,0.4)');
      }
    },
  };
}

function drawIcon(g: G, cx: number, cy: number, s: number, t: number) {
  const k = s / 130;
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  const beat = t * 2;
  const since = frac(beat) * 0.5;
  drawPenguin(g, -40, 6, 0.8, { step: since, count: Math.floor(beat), t });
  drawPenguin(g, 40, 6, 0.8, { step: since, count: Math.floor(beat) + 1, t });
  drawPenguin(g, 0, 16, 1.0, { step: since, count: Math.floor(beat), scarf: true, face: 'happy', t });
  g.restore();
}

function drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number) {
  epilogueFrame(g, x, y, w, h, rank === 'try' ? '#c9c2d6' : '#bfe6ff', () => {
    g.fillStyle = '#e8f7ff';
    g.fillRect(x, y + h * 0.6, w, h * 0.4);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const me = i === 2;
      drawPenguin(g, x + w * (0.12 + i * 0.19), y + h * 0.55, me ? 0.85 : 0.7, {
        step: 1,
        count: 0,
        scarf: me,
        face: rank === 'hi' ? 'happy' : me && rank === 'try' ? 'dizzy' : 'normal',
        trip: me && rank === 'try' ? 1 : 0,
        t,
      });
    }
    if (rank === 'hi') for (let i = 0; i < 6; i++) star(g, x + 20 + i * (w - 40) / 5, y + 24 + Math.sin(t * 3 + i) * 6, 8, 3.5, 5, t, '#ffe14d', OUT, 1.5);
  });
}

export const penguin: GameDef = {
  id: ID,
  title: '펭귄 행진',
  sub: 'Penguin March',
  desc: '박자마다 탭해서 제자리 행진! 신호에 맞춰 엇박자로!',
  howto: '매 박자마다 탭해서 행진해요.\n대장이 "삑 삑 삑 삑 삐익!" 하면 엇박자(박과 박 사이)로 바꿔요.\n엇박자에서 "삑 삑 삑 삐익!" 하면 다시 정박자로!',
  color: '#4aa8ff',
  accent: '#e8f7ff',
  bpm: BPM,
  liveSfx: [
    ['step', 0],
    ['stepBad', 0],
  ],
  build,
  practice: [
    {
      text: '박자마다 탭! 탭! 탭! 탭!\n다 같이 행진해요.',
      beats: 8,
      need: 6,
      build(b) {
        steps(b, 0, 'on');
        steps(b, 1, 'on');
      },
    },
    {
      text: '"삐익!" 하면 엇박자로!\n박과 박 사이에 탭해요.',
      beats: 12,
      need: 8,
      build(b) {
        steps(b, 0, 'on');
        toOff(b, 1);
        steps(b, 2, 'off');
      },
    },
    {
      text: '엇박자에서 "삐익!" 하면\n다시 정박자로 돌아와요.',
      beats: 12,
      need: 8,
      build(b) {
        steps(b, 0, 'off');
        toOn(b, 1);
        steps(b, 2, 'on');
      },
    },
  ],
  practiceBacking(b, beats) {
    for (let i = 0; i < beats; i += 4) {
      b.drums(i, 0.25, { k: 'x.......x.......', s: '....x.o.....x.oo', h: 'x.x.x.x.x.x.x.x.' }, { vel: 0.7 });
      b.bassline(i, 4, 'D', 'R.5.R.5.', 'bass');
    }
  },
  createScene,
  drawIcon,
  cats: { on: '정박자 걸음', off: '엇박자 걸음', switch: '박자 바꾸기' },
  comments: {
    good: { on: '정박자 행진이 늠름했어요!', off: '엇박자도 흔들림이 없었어요!', switch: '박자 바꾸기가 완벽했어요!' },
    bad: { on: '정박자에서 발이 꼬였어요.', off: '엇박자는 박과 박 사이예요.', switch: '"삐익!" 소리에 바로 바꿔요.' },
  },
  epilogue: {
    hi: '남극 최고의 행진단으로 뽑혔어요!',
    ok: '대장 펭귄이 "나쁘지 않군" 하고 고개를 끄덕였어요.',
    try: '오늘도 혼자 반대 발로 걸었어요...',
  },
  drawEpilogue,
  remixPart(b, start, bars, v) {
    // 리믹스: 정박 → (전환) → 엇박 → (전환) → 정박
    const bar0 = start / b.beatsPerBar;
    const plan = bars >= 4 ? (v % 2 ? 'o>x<' : 'oo>x<o').slice(0, bars) : 'o'.repeat(bars);
    for (let i = 0; i < bars; i++) {
      const ch = plan[i] ?? 'o';
      if (ch === 'o' || ch === 'x') steps(b, bar0 + i, ch === 'o' ? 'on' : 'off');
      else if (ch === '>') toOff(b, bar0 + i);
      else if (ch === '<') toOn(b, bar0 + i);
    }
    // 리믹스가 끝나면 정박자로
    if (plan.endsWith('x')) b.marker(start + bars * b.beatsPerBar, 'mode', { mode: 'on' });
  },
};
