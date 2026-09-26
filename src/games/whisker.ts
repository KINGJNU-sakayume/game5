// 10. 쏙쏙 수염 뽑기 — 한 마디 동안 돋아난 수염을 다음 마디에 같은 리듬으로 뽑기 (짧은 수염=탭, 긴 수염=플릭)
import type { ChartBuilder, Cue } from '../core/chart';
import type { Frame, GameDef, Scene, SceneCtx } from '../core/game';
import { OUT, Particles, circle, ellipse, happyEye, line, limb, poly, rrect, star, text, type G } from '../core/gfx';
import type { Rank } from '../core/judge';
import { bounce, clamp01, easeInOutQuad, frac, lerp } from '../core/util';
import { epilogueFrame } from './common';

const ID = 'whisker';
const BPM = 116;

/** 한 라운드 = 돋아나기 한 마디 + 뽑기 한 마디 */
function round(b: ChartBuilder, bar: number, pat: string) {
  const A = b.bar(bar);
  const B = b.bar(bar + 1);
  const p = pat.replace(/\s/g, '');
  const n = [...p].filter((c) => c !== '.').length;
  let idx = 0;
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === '.') continue;
    const long = ch === 'l';
    b.sfx(A + i * 0.5, long ? 'sproutLong' : 'sprout', 1);
    b.cue(B + i * 0.5, long ? 'flick' : 'tap', long ? 'long' : 'short', { roundBeat: A, sproutBeat: A + i * 0.5, idx: idx++, n }, { cat: long ? 'long' : 'short' });
  }
  b.marker(A, 'round', { pat: p, roundBeat: A, n });
}

const CHART: string[] = [
  's.s.s.s.', 's...s...', 's.s.s...', 's...s.s.',
  'l...s...', 's.s.l...', 'l...l...', 's.s.s.s.',
  's..s..s.', 'l...s.s.', 's.s..l..', '.s.s.s.s',
  'ss..l...', 's.ss.l..', 'l..s..s.', 's.s.l.l.',
];

const PROG = 'F Dm Gm C';

function music(b: ChartBuilder) {
  const bars = 2 + CHART.length * 2;
  for (let bar = 0; bar < bars; bar++) {
    const s = b.bar(bar);
    const chord = PROG.split(' ')[bar % 4];
    const sproutBar = bar >= 2 && bar % 2 === 0;
    b.bassline(s, 4, chord, 'R.5.R.5.', 'bassSoft', { vel: 0.55 });
    b.chords(s, 4, chord, 'pluck', { rhythm: '.x.x.x.x', center: 65, vel: 0.35 });
    b.drums(s, 0.5, { k: 'x...x...', r: '..x...x.', sh: 'xoxoxoxo' }, { vel: 0.7 });
    // 뽑는 마디에는 가벼운 멜로디, 돋아나는 마디는 조용하게
    if (!sproutBar && bar >= 2) {
      const mel = ['C6 . A5 . F5 . A5 .', 'D6 . A5 . F5 . D5 .', 'D6 . Bb5 . G5 . Bb5 .', 'C6 . G5 . E5 . G5 .'][bar % 4];
      b.seq(s, 0.5, mel, 'marimba', { vel: 0.45 });
    }
  }
  b.countIn(4, 4);
  // 엔딩
  const end = b.bar(bars);
  b.chords(end, 4, 'F', 'pluck', { center: 65, vel: 0.7 });
  b.note(end, 'bassSoft', 41, 2, 0.7);
  b.note(end, 'marimba', 89, 1, 0.8);
  b.sfx(end, 'boing', 0.8);
}

function build(b: ChartBuilder) {
  music(b);
  CHART.forEach((p, i) => round(b, 2 + i * 2, p));
  b.endBeat = b.bar(2 + CHART.length * 2) + 2;
}

// ------------------------------------------------------------------ 그림

function whiskerAnchor(idx: number, n: number, s: number): [number, number, number] {
  // 아래쪽 얼굴 둘레를 따라 왼쪽 → 오른쪽
  const a0 = Math.PI * 0.95;
  const a1 = Math.PI * 0.05;
  const u = n <= 1 ? 0.5 : idx / (n - 1);
  const a = lerp(a0, a1, u);
  const x = Math.cos(a) * 66 * s;
  const y = 30 * s + Math.sin(a) * 44 * s;
  return [x, y, a];
}

function drawWhisker(g: G, x: number, y: number, ang: number, long: boolean, grow: number, s: number) {
  if (grow <= 0) return;
  const len = (long ? 64 : 30) * s * grow;
  g.beginPath();
  g.moveTo(x, y);
  const steps = long ? 8 : 4;
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    const px = x + Math.cos(ang) * len * u + Math.sin(u * Math.PI * (long ? 3 : 1.5)) * 5 * s * -Math.sin(ang);
    const py = y + Math.sin(ang) * len * u + Math.sin(u * Math.PI * (long ? 3 : 1.5)) * 5 * s * Math.cos(ang);
    g.lineTo(px, py);
  }
  g.strokeStyle = OUT;
  g.lineWidth = (long ? 4.5 : 4) * s;
  g.lineCap = 'round';
  g.stroke();
}

function drawRadish(g: G, x: number, y: number, s: number, face: 'normal' | 'wince' | 'happy' | 'tongue', beat: number) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  // 잎
  const sw = Math.sin(beat * Math.PI) * 0.08;
  for (const [a, l] of [
    [-0.5, 70],
    [0, 86],
    [0.5, 70],
  ] as const) {
    g.save();
    g.translate(0, -84);
    g.rotate(a + sw);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-22, -l * 0.5, 0, -l);
    g.quadraticCurveTo(22, -l * 0.5, 0, 0);
    g.fillStyle = '#5ccf6a';
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 3;
    g.stroke();
    line(g, 0, -6, 0, -l * 0.8, '#3a9a4a', 2);
    g.restore();
  }
  // 몸
  g.beginPath();
  g.moveTo(-78, -40);
  g.bezierCurveTo(-90, -110, 90, -110, 78, -40);
  g.bezierCurveTo(70, 60, 20, 120, 0, 150);
  g.bezierCurveTo(-20, 120, -70, 60, -78, -40);
  g.closePath();
  g.fillStyle = '#fbf7ee';
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 3.5;
  g.stroke();
  g.beginPath();
  g.moveTo(-60, -80);
  g.bezierCurveTo(-40, -100, 40, -100, 60, -80);
  g.strokeStyle = 'rgba(160,220,140,0.9)';
  g.lineWidth = 10;
  g.stroke();
  // 얼굴
  const ey = -18;
  if (face === 'wince') {
    line(g, -34, ey - 6, -20, ey, OUT, 4);
    line(g, -34, ey + 6, -20, ey, OUT, 4);
    line(g, 34, ey - 6, 20, ey, OUT, 4);
    line(g, 34, ey + 6, 20, ey, OUT, 4);
  } else if (face === 'happy') {
    happyEye(g, -27, ey, 8);
    happyEye(g, 27, ey, 8);
  } else {
    ellipse(g, -27, ey, 6, 8, 0, OUT);
    ellipse(g, 27, ey, 6, 8, 0, OUT);
    circle(g, -25, ey - 3, 2.2, '#fff');
    circle(g, 29, ey - 3, 2.2, '#fff');
  }
  circle(g, -46, ey + 16, 9, 'rgba(255,140,160,0.45)');
  circle(g, 46, ey + 16, 9, 'rgba(255,140,160,0.45)');
  if (face === 'tongue') {
    g.beginPath();
    g.arc(0, ey + 18, 10, 0, Math.PI);
    g.fillStyle = OUT;
    g.fill();
    ellipse(g, 4, ey + 30, 7, 9, 0.3, '#ff7a9a', OUT, 2);
  } else if (face === 'wince') {
    ellipse(g, 0, ey + 22, 9, 6, 0, '#c2344d', OUT, 2);
  } else {
    g.beginPath();
    g.arc(0, ey + 14, 9, 0.2, Math.PI - 0.2);
    g.strokeStyle = OUT;
    g.lineWidth = 3;
    g.stroke();
  }
  g.restore();
}

function drawTweezers(g: G, x: number, y: number, close: number) {
  // 장갑 낀 손 + 핀셋
  g.save();
  g.translate(x, y);
  limb(g, [70, -90, 26, -34], 26, '#8fd0ff', OUT, 3);
  circle(g, 22, -30, 16, '#ffffff', OUT, 3);
  const spread = (1 - close) * 8;
  poly(g, [16, -26, -2 - spread, 8, 2 - spread, 10, 22, -22], '#c9d2e6', OUT, 2.5);
  poly(g, [24, -22, 4 + spread, 10, 8 + spread, 8, 28, -18], '#e0e6f0', OUT, 2.5);
  g.restore();
}

function createScene(sc: SceneCtx): Scene {
  const fx = new Particles();
  const spb = sc.spb;
  let lastAct = -99;
  let lastGood = -99;
  let lastMiss = -99;
  let W = 393;
  let H = 852;

  const lay = () => ({ cx: W / 2, cy: H * 0.5, s: 1.35 });

  function rounds(): { start: number; end: number; beat: number }[] {
    const out: { start: number; end: number; beat: number }[] = [];
    for (const m of sc.markers) {
      if (m.type !== 'round') continue;
      out.push({ start: m.t, end: m.t + 8 * spb, beat: m.data.roundBeat });
    }
    return out;
  }

  function radishX(r: { start: number; end: number }, t: number): number | null {
    const L = lay();
    const inDur = spb * 0.6;
    const outDur = spb * 0.5;
    if (t < r.start - inDur || t > r.end + outDur) return null;
    if (t < r.start) return lerp(W + 150, L.cx, easeInOutQuad((t - (r.start - inDur)) / inDur));
    if (t > r.end) return lerp(L.cx, -150, easeInOutQuad((t - r.end) / outDur));
    return L.cx;
  }

  function flickSoon(t: number): boolean {
    for (const c of sc.cues) if (c.input === 'flick' && !c.grade && Math.abs(c.t - t) < 0.3) return true;
    return false;
  }

  return {
    onInput(ev, cue) {
      if (ev.kind !== 'tap' && ev.kind !== 'flick') return;
      if (!cue) {
        if (ev.kind === 'tap' && flickSoon(ev.time)) return;
        lastAct = ev.time;
        sc.sfx('whiff', 0, 0.5);
        return;
      }
      lastAct = ev.time;
      if (cue.grade === 'just') {
        lastGood = ev.time;
        sc.sfx(cue.input === 'flick' ? 'pluckL' : 'pluckS', 0, 1);
      } else {
        sc.sfx(cue.input === 'flick' ? 'pluckL' : 'pluckS', 0, 0.5);
        sc.sfx('boing', 0, 0.4);
      }
    },
    onMiss(c: Cue) {
      lastMiss = c.t + 0.1;
      sc.sfx('boing', 0, 0.7);
    },
    draw(g: G, f: Frame) {
      W = f.W;
      H = f.H;
      const t = f.t;
      fx.update(f.dt);
      const L = lay();
      // 배경: 식탁보 체크무늬
      g.fillStyle = '#e8f8d8';
      g.fillRect(0, 0, W, H);
      const cs = 44;
      for (let yy = 0; yy < H; yy += cs) {
        for (let xx = 0; xx < W; xx += cs) {
          if ((xx / cs + yy / cs) % 2 === 0) {
            g.fillStyle = 'rgba(120,200,120,0.22)';
            g.fillRect(xx, yy, cs, cs);
          }
        }
      }
      // 도마
      rrect(g, W * 0.08, H * 0.62, W * 0.84, H * 0.2, 30, '#e8c18a', OUT, 4);
      rrect(g, W * 0.12, H * 0.64, W * 0.76, H * 0.16, 24, '#f2d4a4');
      // 뽑은 수염 바구니
      rrect(g, W - 110, H * 0.84, 90, 50, 14, '#c98a55', OUT, 3);
      let plucked = 0;
      for (const c of sc.cues) if ((c.grade === 'just' || c.grade === 'barely') && (c.at ?? 0) < t) plucked++;
      text(g, `${plucked}`, W - 65, H * 0.84 + 26, 20, '#fff', { weight: 900, stroke: OUT, strokeW: 4 });
      // 무들
      for (const r of rounds()) {
        const x = radishX(r, t);
        if (x === null) continue;
        const cues = sc.cues.filter((c) => Math.abs(c.data.roundBeat * spb - r.start) < 1e-3);
        const recentGood = cues.some((c) => c.grade === 'just' && t - (c.at ?? 0) < 0.25 && t >= (c.at ?? 0));
        const recentMiss = cues.some((c) => c.grade === 'miss' && t - c.t < 0.8 && t >= c.t + 0.1);
        const allDone = cues.length > 0 && cues.every((c) => c.grade);
        const allGood = allDone && cues.every((c) => c.grade === 'just');
        const face = recentGood ? 'wince' : recentMiss ? 'tongue' : allGood && t > r.end - spb ? 'happy' : 'normal';
        const y = L.cy + bounce(f.beat) * 3;
        drawRadish(g, x, y, L.s, face, f.beat);
        // 수염
        for (const c of cues) {
          const [ax, ay, ang] = whiskerAnchor(c.data.idx, c.data.n, L.s);
          const st = c.data.sproutBeat * spb;
          if (t < st) continue;
          const grow = clamp01((t - st) / 0.08);
          const long = c.input === 'flick';
          if (c.grade === 'just' || c.grade === 'barely') {
            const at = c.at ?? c.t;
            if (t < at) {
              drawWhisker(g, x + ax, y + ay, ang, long, grow, L.s);
              continue;
            }
            const d = t - at;
            if (d > 0.6) continue;
            g.save();
            g.globalAlpha = 1 - d / 0.6;
            g.translate(x + ax + d * 160, y + ay - d * 260);
            g.rotate(d * 10);
            drawWhisker(g, 0, 0, ang, long, 1, L.s);
            g.restore();
            continue;
          }
          drawWhisker(g, x + ax, y + ay, ang, long, grow, L.s);
        }
      }
      // 핀셋: 가장 최근 동작 위치로
      const act = t - lastAct;
      let tx = W * 0.78;
      let ty = H * 0.38;
      let close = 0;
      if (act >= 0 && act < 0.3) {
        // 현재 무의 다음 수염 쪽으로 쏙
        const r = rounds().find((q) => t >= q.start - spb && t <= q.end + spb);
        if (r) {
          const cues = sc.cues.filter((c) => Math.abs(c.data.roundBeat * spb - r.start) < 1e-3);
          const target = cues.find((c) => c.at != null && Math.abs((c.at ?? 0) - lastAct) < 0.01) ?? cues.find((c) => !c.grade);
          if (target) {
            const [ax, ay] = whiskerAnchor(target.data.idx, target.data.n, L.s);
            const k = act < 0.06 ? act / 0.06 : 1 - (act - 0.06) / 0.24;
            tx = lerp(tx, L.cx + ax + 6, k);
            ty = lerp(ty, L.cy + ay - 6, k);
            close = act < 0.15 ? 1 : 0;
          }
        }
      }
      drawTweezers(g, tx, ty, close);
      if (t - lastGood < 0.05 && t >= lastGood && fx.list.length < 30) fx.burst(tx, ty, 6, { kind: 'spark', r: 6, speed: 160, colors: ['#fff27a', '#ffffff'], max: 0.4 });
      fx.draw(g);
      // 안내 (돋아나는 마디 / 뽑는 마디)
      for (const r of rounds()) {
        if (t < r.start || t > r.end) continue;
        const pulling = t >= r.start + 4 * spb;
        rrect(g, W / 2 - 64, H * 0.2, 128, 34, 17, pulling ? '#ff6b8b' : '#fff', OUT, 3);
        text(g, pulling ? '쏙쏙!' : '잘 봐요', W / 2, H * 0.2 + 17.5, 16, pulling ? '#fff' : OUT, { weight: 900 });
      }
      void lastMiss;
      void star;
      void frac;
    },
  };
}

function drawIcon(g: G, cx: number, cy: number, s: number, t: number) {
  const k = s / 140;
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  drawRadish(g, -8, 10, 0.55, frac(t) < 0.3 ? 'wince' : 'normal', t * 2);
  for (let i = 0; i < 3; i++) {
    const [ax, ay, ang] = whiskerAnchor(i, 3, 0.55);
    drawWhisker(g, -8 + ax, 10 + ay, ang, i === 1, 1, 0.55);
  }
  drawTweezers(g, 40, -10, frac(t) < 0.3 ? 1 : 0);
  g.restore();
}

function drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number) {
  epilogueFrame(g, x, y, w, h, '#e8f8d8', () => {
    const n = rank === 'hi' ? 3 : rank === 'ok' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const rx = x + w * ((i + 0.5) / n);
      drawRadish(g, rx, y + h * 0.5, 0.45, rank === 'try' ? 'tongue' : 'happy', t * 2 + i);
      if (rank === 'try') {
        for (let k = 0; k < 5; k++) {
          const [ax, ay, ang] = whiskerAnchor(k, 5, 0.45);
          drawWhisker(g, rx + ax, y + h * 0.5 + ay, ang, k % 2 === 0, 1, 0.45);
        }
      }
    }
    if (rank === 'hi') for (let i = 0; i < 5; i++) star(g, x + 30 + i * (w - 60) / 4, y + 24 + Math.sin(t * 3 + i) * 5, 8, 3.5, 5, t, '#fff27a', OUT, 1.5);
  });
}

export const whisker: GameDef = {
  id: ID,
  title: '쏙쏙 수염 뽑기',
  sub: 'Radish Whiskers',
  desc: '돋아난 수염을 같은 리듬으로 쏙쏙 뽑아요!',
  howto: '한 마디 동안 무에 수염이 "뿅" 하고 돋아나요.\n다음 마디에 돋아난 리듬 그대로 뽑아요.\n짧은 수염은 탭, "뿌요옹~" 긴 수염은 쓱 플릭!',
  color: '#8fdc7a',
  accent: '#e8f8d8',
  bpm: BPM,
  liveSfx: [
    ['pluckS', 0],
    ['pluckL', 0],
    ['boing', 0],
    ['whiff', 0],
  ],
  build,
  practice: [
    {
      text: '수염이 돋아난 리듬 그대로\n다음 마디에 탭해서 쏙쏙!',
      beats: 8,
      need: 6,
      build(b) {
        round(b, 0, 's.s.s.s.');
      },
    },
    {
      text: '"뿌요옹~" 긴 수염은\n쓱 플릭해서 쑤욱!',
      beats: 8,
      need: 4,
      build(b) {
        round(b, 0, 'l...s.s.');
      },
    },
  ],
  practiceBacking(b, beats) {
    for (let i = 0; i < beats; i += 4) {
      b.drums(i, 0.5, { k: 'x...x...', r: '..x...x.', sh: 'xoxoxoxo' }, { vel: 0.6 });
      b.bassline(i, 4, 'F', 'R.5.R.5.', 'bassSoft', { vel: 0.5 });
    }
  },
  createScene,
  drawIcon,
  cats: { short: '짧은 수염', long: '긴 수염' },
  comments: {
    good: { short: '짧은 수염을 쏙쏙 잘 뽑았어요!', long: '긴 수염도 한 번에 쑤욱!' },
    bad: { short: '돋아난 리듬을 잘 기억해요.', long: '긴 수염은 플릭으로 뽑아요.' },
  },
  epilogue: {
    hi: '매끈매끈한 무가 품평회에서 1등을 했어요!',
    ok: '그럭저럭 깔끔해졌어요. 오늘 저녁은 무국!',
    try: '수염이 덥수룩한 무가 메롱 하고 도망갔어요...',
  },
  drawEpilogue,
  remixPart(b, start, bars, v) {
    const pats = v % 2 ? ['s.s.l...', 's..s..s.'] : ['s.s.s.s.', 'l...s.s.'];
    const bar0 = start / b.beatsPerBar;
    for (let i = 0; i + 1 < bars; i += 2) round(b, bar0 + i, pats[(i / 2) % pats.length]);
  },
};
