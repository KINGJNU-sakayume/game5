// 12. 불꽃놀이 — 올라가는 카운트다운 소리와 같은 간격으로 발사!
import type { ChartBuilder, Cue } from '../core/chart';
import type { Frame, GameDef, Scene, SceneCtx } from '../core/game';
import { OUT, circle, ellipse, happyEye, line, rgrad, rrect, sparkle, star, sweat, text, vgrad, type G } from '../core/gfx';
import type { Rank } from '../core/judge';
import { TAU, bounce, clamp01, frac, hash01, lerp } from '../core/util';
import { epilogueFrame } from './common';

const ID = 'fireworks';
const BPM = 120;
const TONES = [72, 76, 79];
const INTERVAL: Record<string, number> = { n: 1, f: 0.5, t: 1 / 3, s: 2, N: 1 };
const CAT: Record<string, string> = { n: 'normal', N: 'normal', f: 'fast', t: 'fast', s: 'slow' };

/** 카운트다운 (n: 3음, f: 빠른 3음, t: 셋잇단, s: 느린 2음, N: 피날레) */
function countdown(b: ChartBuilder, beat: number, k: string, base: number[] = TONES) {
  const iv = INTERVAL[k];
  const tones = k === 's' ? [base[0], base[2]] : base;
  tones.forEach((m, i) => {
    b.note(beat + i * iv, 'marimba', m, 0.3, 1.0);
    b.note(beat + i * iv, 'bell', m + 12, 0.3, 0.35);
  });
  const launch = beat + tones.length * iv;
  b.cue(launch, 'tap', k, { callBeat: beat, iv, n: tones.length, big: k === 'N' }, { cat: CAT[k], weight: k === 'N' ? 2 : 1 });
}

function place(b: ChartBuilder, barStart: number, str: string, base: number[] = TONES) {
  for (const tok of str.split(/\s+/).filter(Boolean)) countdown(b, barStart + parseFloat(tok.slice(1) || '0'), tok[0], base);
}

/** 리믹스용: 어느 조에도 잘 어울리는 라-레-미 */
const REMIX_TONES = [69, 74, 76];

const CHART: string[] = [
  // A (2~9)
  'n0', 'n0', 'n0', 'n0', 'n0', 'n0', 'n0', 'n0',
  // B (10~17)
  'n0', 'f0 f2', 'n0', 'f0 f2', 'f0 f2', 'n0', 'f0 f2', 'n0',
  // C (18~25)
  's0', 'f2', 's0', 'f2', 't0 t2', 'n0', 's0', 'f2',
  // D (26~33)
  't0 t2', 'f0 f2', 't0 f2', 'n0', 'f0 t2', 't0 t2', 'f0 f2', 'n0',
  // 피날레 (34)
  'N0',
];

const PROG_A = 'C Am F G C Am F G';
const PROG_B = 'F G Em Am F G C C';

function band(b: ChartBuilder, bar: number, prog: string, soft: boolean) {
  const n = prog.split(' ').length;
  b.bassline(b.bar(bar), 4, prog, 'R..R..R.', 'bassSoft', { vel: soft ? 0.5 : 0.6 });
  b.chords(b.bar(bar), 4, prog, 'strings', { center: 62, vel: soft ? 0.45 : 0.55 });
  for (let i = 0; i < n; i++) b.drums(b.bar(bar + i), 0.5, { k: 'x...x...', h: soft ? '..x...x.' : 'x.x.x.x.', tk: i % 2 ? '' : 'x.......' }, { vel: 0.65 });
}

function music(b: ChartBuilder) {
  band(b, 0, 'C C', true);
  b.countIn(4, 4);
  band(b, 2, PROG_A, true);
  band(b, 10, PROG_B, false);
  b.chords(b.bar(10), 4, PROG_B, 'pluck', { rhythm: '..x...x.', center: 67, vel: 0.35 });
  b.note(b.bar(18), 'crash', 0, 1, 0.7);
  band(b, 18, PROG_A, false);
  b.chords(b.bar(18), 4, PROG_A, 'choir', { center: 60, vel: 0.55 });
  b.note(b.bar(26), 'crash', 0, 1, 0.7);
  band(b, 26, PROG_B, false);
  b.chords(b.bar(26), 4, PROG_B, 'pluck', { rhythm: '..x...x.', center: 67, vel: 0.35 });
  // 피날레
  band(b, 34, 'C', false);
  b.note(b.bar(35), 'crash', 0, 1, 1);
  b.chords(b.bar(35), 4, 'C', 'strings', { center: 64, vel: 0.9 });
  b.chords(b.bar(35), 4, 'C', 'choir', { center: 64, vel: 0.8 });
  b.note(b.bar(35), 'bassSoft', 36, 3, 0.8);
  b.sfx(b.bar(35) + 1, 'cheer', 1);
}

function build(b: ChartBuilder) {
  music(b);
  CHART.forEach((p, i) => place(b, b.bar(2 + i), p));
  b.endBeat = b.bar(35) + 3;
}

// ------------------------------------------------------------------ 그림

const COLORS = ['#ff6b8b', '#ffe14d', '#6bc6ff', '#6be3a0', '#c77dff', '#ff9a5a', '#ffffff'];

function drawBurst(g: G, x: number, y: number, dt: number, seed: number, big: boolean, weak = false) {
  if (dt < 0 || dt > 1.8) return;
  const n = big ? 36 : weak ? 10 : 24;
  const R = (big ? 150 : weak ? 40 : 95) * (1 - Math.exp(-dt * 4));
  const a = clamp01(1 - dt / 1.8);
  const c1 = COLORS[Math.floor(hash01(seed) * COLORS.length)];
  const c2 = COLORS[Math.floor(hash01(seed * 7 + 3) * COLORS.length)];
  // 섬광
  if (dt < 0.15) {
    g.fillStyle = rgrad(g, x, y, 2, 60 * (big ? 2 : 1), [
      [0, `rgba(255,255,230,${0.9 * (1 - dt / 0.15)})`],
      [1, 'rgba(255,255,230,0)'],
    ]);
    g.beginPath();
    g.arc(x, y, 60 * (big ? 2 : 1), 0, TAU);
    g.fill();
  }
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + hash01(seed + i) * 0.1;
    const px = x + Math.cos(ang) * R;
    const py = y + Math.sin(ang) * R + dt * dt * 60;
    const col = i % 2 ? c1 : c2;
    g.globalAlpha = a;
    // 꼬리
    const tx = x + Math.cos(ang) * R * 0.75;
    const ty = y + Math.sin(ang) * R * 0.75 + dt * dt * 50;
    line(g, tx, ty, px, py, col, 2.5 * a + 0.5);
    circle(g, px, py, (big ? 4 : 3) * (0.5 + a * 0.5), col);
    if (big && i % 3 === 0 && dt > 0.4) sparkle(g, px + Math.sin(dt * 20 + i) * 6, py + 10, 4, '#fff');
  }
  g.globalAlpha = 1;
}

function drawLauncherCat(g: G, x: number, y: number, press: number, face: 'normal' | 'happy' | 'sweat', t: number) {
  // 발사 버튼 상자
  rrect(g, x - 34, y - 20, 68, 44, 8, '#e05a4a', OUT, 3);
  text(g, '발사', x, y + 3, 14, '#fff', { weight: 900 });
  const hy = y - 40 + press * 16;
  line(g, x, y - 20, x, hy, '#8a92a6', 6);
  rrect(g, x - 26, hy - 8, 52, 12, 6, '#ffd23e', OUT, 2.5);
  // 고양이
  const cx = x - 62;
  const cy = y - 30;
  ellipse(g, cx, cy + 34, 26, 30, 0, '#6a7ad8', OUT, 3);
  circle(g, cx, cy - 6, 26, '#f4c28a', OUT, 3);
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + side * 8, cy - 26);
    g.lineTo(cx + side * 22, cy - 42);
    g.lineTo(cx + side * 24, cy - 18);
    g.closePath();
    g.fillStyle = '#f4c28a';
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 3;
    g.stroke();
  }
  // 머리띠
  rrect(g, cx - 26, cy - 22, 52, 7, 3, '#ff4d5e', OUT, 2);
  if (face === 'happy') {
    happyEye(g, cx - 9, cy - 6, 5);
    happyEye(g, cx + 9, cy - 6, 5);
  } else {
    ellipse(g, cx - 9, cy - 6, 3.5, 5, 0, OUT);
    ellipse(g, cx + 9, cy - 6, 3.5, 5, 0, OUT);
  }
  line(g, cx - 4, cy + 6, cx + 4, cy + 6, OUT, 2.5);
  if (face === 'sweat') sweat(g, cx + 26, cy - 20, 7);
  // 팔 (버튼 누르기)
  line(g, cx + 20, cy + 26, x - 18, hy, OUT, 12);
  line(g, cx + 20, cy + 26, x - 18, hy, '#6a7ad8', 7);
  void t;
}

function createScene(sc: SceneCtx): Scene {
  const spb = sc.spb;
  let W = 393;
  let H = 852;
  let lastPress = -99;
  let lastGood = -99;
  let lastBad = -99;
  const boomed = new Set<number>();

  const lay = () => ({ lx: W * 0.64, ly: H * 0.78, skyY: H * 0.25, k: 1.45 });

  /** 성공한 불꽃의 폭발 위치 */
  function burstPos(c: Cue): [number, number] {
    const L = lay();
    const bx = W * (0.2 + hash01(c.id * 3 + 1) * 0.6);
    const by = L.skyY + hash01(c.id * 5 + 2) * H * 0.18 + (c.data.big ? -20 : 0);
    return [bx, by];
  }

  return {
    onInput(ev, cue) {
      if (ev.kind !== 'tap') return;
      lastPress = ev.time;
      if (!cue) {
        sc.sfx('whiff', 0, 0.5);
        return;
      }
      if (cue.grade === 'just') {
        lastGood = ev.time;
        sc.sfx('launch', 0, 1);
      } else {
        lastBad = ev.time;
        sc.sfx('launch', 0, 0.4);
        sc.sfx('fizzle', 0, 0.6);
      }
    },
    onMiss(c: Cue) {
      lastBad = c.t + 0.1;
      sc.sfx('fizzle', 0, 0.8);
    },
    draw(g: G, f: Frame) {
      W = f.W;
      H = f.H;
      const t = f.t;
      const L = lay();
      // 밤하늘 + 호수
      g.fillStyle = vgrad(g, 0, H, [
        [0, '#070a24'],
        [0.55, '#1a2050'],
        [0.62, '#101838'],
        [1, '#0a1028'],
      ]);
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 50; i++) circle(g, hash01(i * 3) * W, hash01(i * 7) * H * 0.5, 1 + hash01(i) * 0.8, 'rgba(255,255,255,0.7)');
      // 도시 실루엣
      const cityY = H * 0.6;
      g.fillStyle = '#141a3a';
      for (let i = 0; i < 12; i++) {
        const bw = 26 + hash01(i * 11) * 30;
        const bh = 40 + hash01(i * 13) * 90;
        const bx = (i / 12) * W - 6;
        g.fillRect(bx, cityY - bh, bw, bh + 4);
        for (let wy = cityY - bh + 8; wy < cityY - 8; wy += 14) {
          if (hash01(i * 97 + wy) > 0.55) {
            g.fillStyle = 'rgba(255,220,120,0.7)';
            g.fillRect(bx + 6, wy, 5, 6);
            g.fillStyle = '#141a3a';
          }
        }
      }
      // 다리
      line(g, 0, cityY + 4, W, cityY + 4, '#2a3060', 6);
      // 불꽃 (성공한 발사)
      for (const c of sc.cues) {
        if (c.grade !== 'just' && c.grade !== 'barely') continue;
        const at = c.at ?? c.t;
        const rise = spb * 1;
        const [bx, by] = burstPos(c);
        const dt = t - at;
        if (dt < 0 || dt > rise + 1.9) continue;
        if (dt < rise) {
          // 올라가는 불씨
          const u = dt / rise;
          const x = lerp(L.lx, bx, u);
          const y = lerp(L.ly - 70 * L.k, by, 1 - (1 - u) * (1 - u));
          for (let k = 0; k < 6; k++) circle(g, x - (bx - L.lx) * 0.02 * k, y + k * 8, 3 - k * 0.4, `rgba(255,220,150,${1 - k / 6})`);
        } else {
          if (!boomed.has(c.id) && sc.mode !== 'preview') {
            boomed.add(c.id);
            sc.sfx('boom', 0, c.grade === 'just' ? (c.data.big ? 1.2 : 0.9) : 0.4);
          }
          drawBurst(g, bx, by, dt - rise, c.id, !!c.data.big, c.grade === 'barely');
          // 호수에 비친 빛
          const ref = clamp01(1 - (dt - rise) / 1.2);
          if (ref > 0) {
            g.globalAlpha = ref * 0.4;
            ellipse(g, bx, H * 0.62 + (H * 0.62 - by) * 0.15, 40, 6, 0, COLORS[Math.floor(hash01(c.id) * COLORS.length)]);
            g.globalAlpha = 1;
          }
        }
      }
      // 물가 / 발사대 (확대해서 그림)
      g.fillStyle = '#2a3a2a';
      g.fillRect(0, L.ly + 24 * L.k, W, H - L.ly);
      line(g, 0, L.ly + 24 * L.k, W, L.ly + 24 * L.k, OUT, 3);
      g.save();
      g.translate(L.lx, L.ly);
      g.scale(L.k, L.k);
      rrect(g, -16, -70, 32, 70, 6, '#6a6a8a', OUT, 3);
      // 카운트다운 전구
      let lights = 0;
      let curN = 3;
      for (const c of sc.cues) {
        const ct = c.data.callBeat * spb;
        if (ct > t + 0.02) break;
        if (t > c.t + 0.1) continue;
        curN = c.data.n;
        lights = Math.min(c.data.n, Math.floor((t - ct) / (c.data.iv * spb) + 1e-6) + 1);
      }
      for (let i = 0; i < curN; i++) {
        const on = i < lights;
        const bx2 = (i - (curN - 1) / 2) * 30;
        if (on) circle(g, bx2, -100, 16, 'rgba(255,240,180,0.25)');
        circle(g, bx2, -100, 11, on ? ['#ff6b8b', '#ffe14d', '#6be3a0'][curN === 2 ? i * 2 : i] : '#3a3a5a', OUT, 2.5);
      }
      // 고양이 기술자
      const pd = t - lastPress;
      const press = pd >= 0 && pd < 0.25 ? (pd < 0.05 ? pd / 0.05 : 1 - (pd - 0.05) / 0.2) : 0;
      let face: 'normal' | 'happy' | 'sweat' = 'normal';
      if (t - lastBad < 0.6 && t >= lastBad) face = 'sweat';
      else if (t - lastGood < 0.6 && t >= lastGood) face = 'happy';
      drawLauncherCat(g, -70, 10 - bounce(f.beat) * 2, press, face, f.real);
      g.restore();
      void frac;
      void star;
    },
  };
}

function drawIcon(g: G, cx: number, cy: number, s: number, t: number) {
  const k = s / 130;
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  circle(g, 0, 0, 60, '#101838');
  drawBurst(g, -16, -10, frac(t * 0.7) * 1.4 + 0.05, 3, false);
  drawBurst(g, 24, 10, frac(t * 0.7 + 0.5) * 1.4 + 0.05, 8, false);
  g.restore();
}

function drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number) {
  epilogueFrame(g, x, y, w, h, '#101838', () => {
    const n = rank === 'hi' ? 6 : rank === 'ok' ? 3 : 0;
    for (let i = 0; i < n; i++) drawBurst(g, x + w * (0.15 + (i / Math.max(1, n - 1)) * 0.7), y + h * (0.3 + (i % 2) * 0.15), 0.3 + frac(t * 0.5 + i * 0.3) * 1.2, i * 13 + 5, i === 0 && rank === 'hi');
    if (rank === 'try') {
      for (let i = 0; i < 4; i++) circle(g, x + w * 0.5 + Math.sin(i * 2) * 20, y + h * 0.6 - i * 16, 8 + i * 4, `rgba(160,160,180,${0.5 - i * 0.1})`);
      text(g, '피식...', x + w * 0.5, y + h * 0.3, 20, '#fff');
    }
    g.fillStyle = '#2a3a2a';
    g.fillRect(x, y + h * 0.82, w, h * 0.2);
  });
}

export const fireworks: GameDef = {
  id: ID,
  title: '불꽃놀이',
  sub: 'Fireworks Festival',
  desc: '올라가는 소리와 같은 간격으로 발사!',
  howto: '"도, 미, 솔" 올라가는 소리가 난 뒤 같은 간격으로 한 번 더, 그때 탭해서 발사!\n빨라지면 빠르게, 느려지면 느리게.\n마지막엔 커다란 불꽃이 기다려요!',
  color: '#3a4aa8',
  accent: '#e0e6ff',
  bpm: BPM,
  liveSfx: [
    ['launch', 0],
    ['boom', 0],
    ['fizzle', 0],
    ['whiff', 0],
  ],
  build,
  practice: [
    {
      text: '"도, 미, 솔" 다음\n같은 간격으로 탭해서 발사!',
      beats: 4,
      need: 3,
      build(b) {
        countdown(b, 0, 'n');
      },
    },
    {
      text: '빨라져도 간격은 똑같이!\n도미솔 → 발사!',
      beats: 4,
      need: 4,
      build(b) {
        countdown(b, 0, 'f');
        countdown(b, 2, 'f');
      },
    },
  ],
  practiceBacking(b, beats) {
    for (let i = 0; i < beats; i += 4) {
      b.drums(i, 0.5, { k: 'x...x...', h: '..x...x.' }, { vel: 0.6 });
      b.bassline(i, 4, 'C', 'R..R..R.', 'bassSoft', { vel: 0.5 });
    }
  },
  createScene,
  drawIcon,
  cats: { normal: '보통 카운트', fast: '빠른 카운트', slow: '느린 카운트' },
  comments: {
    good: { normal: '밤하늘을 꽃밭으로 만들었어요!', fast: '빠른 카운트다운도 문제없었어요!', slow: '느긋한 간격도 정확했어요!' },
    bad: { normal: '세 번째 소리 다음 간격에 발사!', fast: '빨라지면 간격도 짧아져요.', slow: '느린 두 음 뒤에는 한참 기다려요.' },
  },
  epilogue: {
    hi: '역대 최고의 불꽃 축제! 모두가 하늘을 올려다봤어요.',
    ok: '예쁜 불꽃이 몇 개 피었어요. 내년에 또 봐요!',
    try: '불꽃이 피식피식... 연기만 자욱했어요.',
  },
  drawEpilogue,
  remixPart(b, start, bars, v) {
    const pats = v % 2 ? ['f0 f2', 'n0', 't0 t2', 'n0'] : ['n0', 'f0 f2', 'n0', 'f0 f2'];
    for (let i = 0; i < bars; i++) place(b, start + i * b.beatsPerBar, pats[i % pats.length], REMIX_TONES);
  },
};
