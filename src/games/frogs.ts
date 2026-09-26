// 7. 개구리 합창단 — 대장이 부른 리듬을 다음 마디에 그대로 따라 부르기
import type { ChartBuilder, Cue } from '../core/chart';
import type { Frame, GameDef, Scene, SceneCtx } from '../core/game';
import { OUT, Particles, circle, ellipse, happyEye, line, noteGlyph, poly, rrect, sweat, text, vgrad, type G } from '../core/gfx';
import type { Rank } from '../core/judge';
import { bounce, clamp01, easeOutBack, frac, hash01 } from '../core/util';
import { epilogueFrame } from './common';

const ID = 'frogs';
const BPM = 112;
const LEAD_M = 45;
const MY_M = 50;

/** 부르기(call) 한 마디 + 따라하기(response) 한 마디 */
function callResponse(b: ChartBuilder, bar: number, pat: string, cat: string) {
  const s = b.bar(bar);
  const r = b.bar(bar + 1);
  const p = pat.replace(/\s/g, '');
  for (let i = 0; i < p.length; i++) {
    if (p[i] !== 'x') continue;
    b.sfx(s + i * 0.5, 'croak', 1, LEAD_M, -0.3);
    b.cue(r + i * 0.5, 'tap', cat, { callBeat: s + i * 0.5, slot: i, respBar: r }, { cat });
  }
  b.marker(s, 'call', { pat: p, respBeat: r });
}

const CHART: [string, string][] = [
  // A (2~9) 쉬운 리듬
  ['x.x.x.x.', 'simple'],
  ['x...x...', 'simple'],
  ['x.x.x...', 'simple'],
  ['x.x.x.x.', 'simple'],
  // B (10~17) 당김음
  ['x..x..x.', 'synco'],
  ['x.x.x...', 'simple'],
  ['x..x..x.', 'synco'],
  ['xx..x...', 'synco'],
  // C (18~25)
  ['x.x..x..', 'synco'],
  ['x.x.x.x.', 'simple'],
  ['.x.x.x.x', 'synco'],
  ['x..x.x..', 'synco'],
  // D (26~33)
  ['xx.x.x..', 'synco'],
  ['x.xx.x..', 'synco'],
  ['x..x..x.', 'synco'],
  ['x.x.xxx.', 'synco'],
];

const PROG = 'F Dm Bb C';

function band(b: ChartBuilder, bar: number, n: number, soft: boolean) {
  const prog = Array.from({ length: n }, (_, i) => PROG.split(' ')[i % 4]).join(' ');
  b.bassline(b.bar(bar), 4, prog, 'R.3.5.3.', 'bassSoft', { vel: soft ? 0.55 : 0.7 });
  b.chords(b.bar(bar), 4, prog, 'organ', { rhythm: '.x.x.x.x', center: 62, vel: soft ? 0.35 : 0.5 });
  for (let i = 0; i < n; i++) {
    const s = b.bar(bar + i);
    b.drums(s, 0.5, { k: 'x...x...', sn: '..x...x.', h: 'x.x.x.x.' }, { vel: soft ? 0.55 : 0.75 });
  }
}

function music(b: ChartBuilder) {
  // 인트로 (두왑 코러스)
  band(b, 0, 2, false);
  b.chords(0, 4, 'F Dm', 'choir', { center: 62, vel: 0.8 });
  b.seq(0, 0.5, 'C5 - A4 . F4 . A4 . | D5 - - . C5 . A4 .', 'flute', { vel: 0.7 });
  // 부르기/따라하기 구간: 반주는 부드럽게
  band(b, 2, 32, true);
  for (let sec = 0; sec < 4; sec++) {
    b.chords(b.bar(2 + sec * 8), 4, 'F Dm Bb C F Dm Bb C', 'choir', { center: 60, vel: 0.45 });
    if (sec > 0) b.note(b.bar(2 + sec * 8), 'crash', 0, 1, 0.5);
  }
  // 엔딩
  band(b, 34, 1, false);
  b.seq(b.bar(34), 0.5, 'A4 . C5 . F5 - - .', 'flute', { vel: 0.8 });
  b.chords(b.bar(35), 4, 'F', 'choir', { center: 62, vel: 0.9 });
  b.chords(b.bar(35), 4, 'F', 'organ', { center: 62, vel: 0.6, gate: 0.6 });
  b.note(b.bar(35), 'bassSoft', 41, 3, 0.8);
  b.note(b.bar(35), 'triangle', 0, 1, 0.7);
  // 개굴! 개굴! 마무리 합창
  b.sfx(b.bar(35), 'croak', 1, LEAD_M);
  b.sfx(b.bar(35), 'croak', 1, MY_M);
}

function build(b: ChartBuilder) {
  music(b);
  CHART.forEach(([p, cat], i) => callResponse(b, 2 + i * 2, p, cat));
  b.endBeat = b.bar(35) + 3;
}

// ------------------------------------------------------------------ 그림

interface FrogOpts {
  croak: number; // 경과(초)
  size: number;
  tie: string;
  face: 'normal' | 'happy' | 'sweat' | 'glare' | 'sad';
  look: number;
  t: number;
  bad?: boolean;
}

function drawFrog(g: G, x: number, y: number, o: FrogOpts) {
  const cr = o.croak >= 0 && o.croak < 0.22 ? Math.sin((o.croak / 0.22) * Math.PI) : 0;
  g.save();
  g.translate(x, y);
  g.scale(o.size, o.size);
  // 연잎
  ellipse(g, 0, 40, 70, 18, 0, '#3aa860', OUT, 3);
  poly(g, [0, 40, 40, 30, 46, 38], '#2a8a4a');
  const lift = cr * 6;
  g.translate(0, -lift);
  // 뒷다리
  ellipse(g, -36, 28, 22, 14, -0.3, '#5ccf6a', OUT, 3);
  ellipse(g, 36, 28, 22, 14, 0.3, '#5ccf6a', OUT, 3);
  // 몸
  ellipse(g, 0, 8, 44, 36, 0, '#6ade7a', OUT, 3.5);
  // 울음주머니
  const sac = 10 + cr * 22;
  ellipse(g, 0, 24, sac, sac * 0.8, 0, o.bad ? '#e0d8a0' : '#fff3b0', OUT, 2.5);
  // 배
  ellipse(g, 0, 26, 26, 14, 0, 'rgba(255,255,255,0.3)');
  // 앞다리
  ellipse(g, -22, 38, 8, 10, 0, '#5ccf6a', OUT, 2.5);
  ellipse(g, 22, 38, 8, 10, 0, '#5ccf6a', OUT, 2.5);
  // 눈
  for (const side of [-1, 1]) {
    const ex = side * 20;
    const ey = -24;
    circle(g, ex, ey, 15, '#6ade7a', OUT, 3);
    if (o.face === 'happy') happyEye(g, ex, ey + 1, 7);
    else if (o.face === 'sad') {
      circle(g, ex, ey, 10, '#fff');
      circle(g, ex, ey + 4, 4.5, OUT);
      line(g, ex - 8, ey - 9 + side * 2, ex + 8, ey - 9 - side * 2, OUT, 2.5);
    } else {
      circle(g, ex, ey, 10, '#fff');
      circle(g, ex + o.look * 4, ey + 1, 5, OUT);
      circle(g, ex + o.look * 4 + 2, ey - 1, 1.6, '#fff');
      if (o.face === 'glare') line(g, ex - 9, ey - 12 - side * 2, ex + 9, ey - 12 + side * 2, OUT, 3);
    }
  }
  // 입
  g.beginPath();
  if (cr > 0.1) g.ellipse(0, 4, 14, 4 + cr * 6, 0, 0, Math.PI * 2);
  else {
    g.moveTo(-22, 2);
    g.quadraticCurveTo(0, 12, 22, 2);
  }
  g.strokeStyle = OUT;
  g.lineWidth = 3;
  if (cr > 0.1) {
    g.fillStyle = '#c2344d';
    g.fill();
  }
  g.stroke();
  circle(g, -30, 2, 5, 'rgba(255,140,160,0.45)');
  circle(g, 30, 2, 5, 'rgba(255,140,160,0.45)');
  // 나비넥타이
  poly(g, [-14, 34, -2, 38, -14, 44], o.tie, OUT, 2);
  poly(g, [14, 34, 2, 38, 14, 44], o.tie, OUT, 2);
  circle(g, 0, 38, 3.5, o.tie, OUT, 2);
  if (o.face === 'sweat') sweat(g, 40, -30, 8);
  g.restore();
  if (cr > 0.5) {
    const k = o.croak / 0.22;
    g.globalAlpha = 1 - k;
    noteGlyph(g, x + 30 * o.size, y - 60 * o.size - k * 30, 11 * o.size, o.bad ? '#aaa' : '#fff27a');
    g.globalAlpha = 1;
  }
}

function drawPond(g: G, W: number, H: number, real: number, beat: number) {
  g.fillStyle = vgrad(g, 0, H, [
    [0, '#0f1f3a'],
    [0.45, '#23406a'],
    [0.46, '#1b4a5a'],
    [1, '#0f2f3a'],
  ]);
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) circle(g, hash01(i * 3) * W, hash01(i * 9) * H * 0.4, 1.1, 'rgba(255,255,255,0.8)');
  // 달과 반영
  circle(g, W * 0.72, H * 0.16, 36, '#fff6cf');
  for (let i = 0; i < 6; i++) {
    const yy = H * 0.5 + i * 16;
    const w = 40 - i * 5 + Math.sin(real * 2 + i) * 6;
    rrect(g, W * 0.72 - w / 2, yy, w, 4, 2, 'rgba(255,246,207,0.35)');
  }
  // 수평선의 갈대
  for (let i = 0; i < 9; i++) {
    const x = i * (W / 8) + (i % 2) * 12;
    const hh = 60 + hash01(i) * 50;
    const sw = Math.sin(real + i) * 4 + bounce(beat) * 2;
    line(g, x, H * 0.46, x + sw, H * 0.46 - hh, '#2a5a3a', 4);
    ellipse(g, x + sw, H * 0.46 - hh, 5, 14, 0, '#8a5a3a', OUT, 2);
  }
  // 반딧불
  for (let i = 0; i < 12; i++) {
    const x = (hash01(i * 5) * W + Math.sin(real * 0.7 + i) * 30 + W) % W;
    const y = H * (0.25 + hash01(i * 7) * 0.5) + Math.cos(real * 0.9 + i) * 20;
    const a = 0.4 + 0.6 * Math.abs(Math.sin(real * 2 + i));
    circle(g, x, y, 6, `rgba(255,250,150,${a * 0.25})`);
    circle(g, x, y, 2.2, `rgba(255,250,170,${a})`);
  }
}

function createScene(sc: SceneCtx): Scene {
  const fx = new Particles();
  const spb = sc.spb;
  let myCroak = -99;
  let myGrade: 'just' | 'barely' | 'whiff' = 'just';
  let lastMiss = -99;
  let lastGood = -99;

  function leaderLast(t: number): number {
    let best = -99;
    for (const c of sc.cues) {
      const ct = c.data.callBeat * spb;
      if (ct <= t && ct > best) best = ct;
      if (ct > t) break;
    }
    return best;
  }

  return {
    onInput(ev, cue) {
      if (ev.kind !== 'tap') return;
      myCroak = ev.time;
      if (!cue) {
        myGrade = 'whiff';
        sc.sfx('burp', 0, 0.6);
        return;
      }
      if (cue.grade === 'just') {
        myGrade = 'just';
        lastGood = ev.time;
        sc.sfx('croak', MY_M, 1, 0.3);
      } else {
        myGrade = 'barely';
        sc.sfx('croak', MY_M, 0.6, 0.3);
        sc.sfx('burp', 0, 0.4);
      }
    },
    onMiss(c: Cue) {
      lastMiss = c.t + 0.1;
      sc.sfx('splash', 0, 0.4);
    },
    draw(g: G, f: Frame) {
      const { W, H, t } = f;
      fx.update(f.dt);
      drawPond(g, W, H, f.real, f.beat);
      const y = H * 0.68;
      const lx = W * 0.25;
      const px = W * 0.75;
      // 현재 부르기/따라하기 상태
      let phase: 'call' | 'resp' | null = null;
      let mk: { pat: string; start: number; resp: number } | null = null;
      for (const m of sc.markers) {
        if (m.type !== 'call') continue;
        const st = m.t;
        const rt = m.data.respBeat * spb;
        const end = rt + 4 * spb;
        if (t >= st - 0.05 && t < end + 0.3) {
          phase = t < rt - 0.05 ? 'call' : 'resp';
          mk = { pat: m.data.pat, start: st, resp: rt };
        }
      }
      const glare = t - lastMiss < 0.8 && t >= lastMiss;
      drawFrog(g, lx, y, { croak: t - leaderLast(t), size: 1.5, tie: '#2d2a44', face: glare ? 'glare' : 'normal', look: glare ? 1 : 0.3, t: f.real });
      // 대장 지휘봉
      const bt = frac(f.beat);
      line(g, lx + 56, y - 10, lx + 70 + Math.sin(bt * Math.PI * 2) * 10, y - 80, '#fff', 4);
      const since = t - myCroak;
      let face: FrogOpts['face'] = 'normal';
      if (glare) face = 'sad';
      else if (myGrade === 'barely' && since < 0.4) face = 'sweat';
      else if (t - lastGood < 0.3 && t >= lastGood) face = 'happy';
      drawFrog(g, px, y, { croak: since, size: 1.35, tie: '#ff4d5e', face, look: -0.3, t: f.real, bad: myGrade !== 'just' });
      rrect(g, px - 18, y + 82, 36, 22, 11, '#ff4d5e', OUT, 2.5);
      text(g, '나', px, y + 93.5, 13, '#fff', { weight: 900 });
      // 리듬 표시판
      if (mk) {
        const bw = W - 60;
        const by = H * 0.36;
        const k = easeOutBack(clamp01((t - mk.start + 0.05) / 0.25));
        g.save();
        g.translate(W / 2, by);
        g.scale(k, k);
        rrect(g, -bw / 2, -30, bw, 60, 18, 'rgba(255,255,255,0.92)', OUT, 3);
        text(g, phase === 'call' ? '잘 들어요!' : '따라 해요!', 0, -46, 16, phase === 'call' ? '#fff27a' : '#8affb0', { weight: 900, stroke: OUT, strokeW: 4 });
        const cellW = (bw - 30) / 8;
        for (let i = 0; i < 8; i++) {
          const cx = -bw / 2 + 15 + cellW * (i + 0.5);
          const isBeat = i % 2 === 0;
          line(g, cx, -14, cx, 14, isBeat ? 'rgba(42,33,48,0.25)' : 'rgba(42,33,48,0.1)', 2);
          if (mk.pat[i] !== 'x') continue;
          const callT = mk.start + i * 0.5 * spb;
          const heard = t >= callT - 0.02;
          if (!heard) continue;
          // 응답 결과
          const c = sc.cues.find((q) => Math.abs(q.data.callBeat * spb - callT) < 0.001);
          let col = '#b9f0c5';
          if (c?.grade === 'just') col = '#ffd23e';
          else if (c?.grade === 'barely') col = '#9ad0ff';
          else if (c?.grade === 'miss') col = '#ff9a9a';
          circle(g, cx, 0, 11, col, OUT, 2.5);
        }
        // 진행 막대
        const ph = phase === 'call' ? (t - mk.start) / (4 * spb) : (t - mk.resp) / (4 * spb);
        const px2 = -bw / 2 + 15 + (bw - 30) * clamp01(ph);
        line(g, px2, -24, px2, 24, phase === 'call' ? '#ffb13b' : '#ff4d5e', 3);
        g.restore();
      }
      fx.draw(g);
    },
  };
}

function drawIcon(g: G, cx: number, cy: number, s: number, t: number) {
  const k = s / 130;
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  const ph = frac(t * 1.5);
  drawFrog(g, -30, 10, { croak: ph < 0.5 ? ph * 0.4 : 1, size: 0.62, tie: '#2d2a44', face: 'normal', look: 0.4, t });
  drawFrog(g, 32, 14, { croak: ph >= 0.5 ? (ph - 0.5) * 0.4 : 1, size: 0.55, tie: '#ff4d5e', face: 'happy', look: -0.4, t });
  noteGlyph(g, 0, -40, 9, '#fff');
  g.restore();
}

function drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number) {
  epilogueFrame(g, x, y, w, h, '#1b3a5a', () => {
    circle(g, x + w * 0.8, y + 36, 22, '#fff6cf');
    const n = rank === 'hi' ? 5 : rank === 'ok' ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const fx2 = x + w * ((i + 0.5) / n);
      const me = i === n - 1;
      drawFrog(g, fx2, y + h * 0.62, {
        croak: rank === 'hi' ? frac(t * 2 + i * 0.3) * 0.22 : 1,
        size: 0.55,
        tie: me ? '#ff4d5e' : '#2d2a44',
        face: rank === 'hi' ? 'happy' : rank === 'try' && me ? 'sad' : 'normal',
        look: 0,
        t,
      });
    }
    if (rank === 'hi') for (let i = 0; i < 4; i++) noteGlyph(g, x + 30 + i * 60, y + 30 + Math.sin(t * 3 + i) * 6, 8, '#fff27a');
  });
}

export const frogs: GameDef = {
  id: ID,
  title: '개구리 합창단',
  sub: 'Frog Choir',
  desc: '대장 개구리의 노래를 그대로 따라 불러요!',
  howto: '대장 개구리가 한 마디 동안 "개굴!" 리듬을 불러요.\n다음 마디에 똑같은 리듬으로 탭해서 따라 부르세요!',
  color: '#3aa860',
  accent: '#d8ffe0',
  bpm: BPM,
  liveSfx: [
    ['croak', MY_M],
    ['burp', 0],
    ['splash', 0],
  ],
  build,
  practice: [
    {
      text: '대장이 부른 리듬을\n다음 마디에 똑같이 따라 해요!',
      beats: 8,
      need: 6,
      build(b) {
        callResponse(b, 0, 'x.x.x.x.', 'simple');
      },
    },
    {
      text: '박자 사이에 끼는 리듬도 있어요.\n잘 듣고 따라 해요!',
      beats: 8,
      need: 5,
      build(b) {
        callResponse(b, 0, 'x..x..x.', 'synco');
      },
    },
  ],
  practiceBacking(b, beats) {
    for (let i = 0; i < beats; i += 4) {
      b.drums(i, 0.5, { k: 'x...x...', sn: '..x...x.', h: 'x.x.x.x.' }, { vel: 0.5 });
      b.bassline(i, 4, 'F', 'R.3.5.3.', 'bassSoft', { vel: 0.55 });
    }
  },
  createScene,
  drawIcon,
  cats: { simple: '쉬운 리듬', synco: '당김 리듬' },
  comments: {
    good: { simple: '또박또박 정확하게 따라 불렀어요!', synco: '까다로운 당김 리듬도 완벽해요!' },
    bad: { simple: '박자에 딱 맞춰 따라 해 봐요.', synco: '박자 사이 "개굴"을 잘 들어요.' },
  },
  epilogue: {
    hi: '연못 전체가 합창에 동참했어요! 앙코르!',
    ok: '대장 개구리가 "개굴(좋아)" 했어요.',
    try: '"개굴"이 아니라 "꺼억"만 나왔어요...',
  },
  drawEpilogue,
  remixPart(b, start, bars, v) {
    const pats = v % 2 ? ['x..x..x.', 'x.x.x.x.'] : ['x.x.x.x.', 'x.x.x...'];
    const bar0 = start / b.beatsPerBar;
    for (let i = 0; i + 1 < bars; i += 2) {
      const p = pats[(i / 2) % pats.length];
      callResponse(b, bar0 + i, p, [...p].some((ch, k) => ch === 'x' && k % 2 === 1) ? 'synco' : 'simple');
    }
  },
};
