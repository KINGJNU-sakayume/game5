// 리믹스: 여러 게임이 한 곡 안에서 번갈아 등장
import type { ChartBuilder, Segment } from '../core/chart';
import type { Frame, GameDef, GameInput, Scene, SceneCtx } from '../core/game';
import { OUT, rrect, star, text, type G } from '../core/gfx';
import type { Judge, Rank } from '../core/judge';
import { clamp01, easeInOutQuad, hash01 } from '../core/util';
import { epilogueFrame } from './common';

export interface RemixPlanItem {
  game: string;
  bars: number;
  variant: number;
}

export interface RemixOpts {
  id: string;
  title: string;
  sub: string;
  desc: string;
  howto: string;
  color: string;
  accent: string;
  bpm: number;
  games: GameDef[];
  plan: RemixPlanItem[];
  music(b: ChartBuilder, introBars: number, bodyBars: number): void;
  epilogue: Record<Rank, string>;
}

const INTRO = 2;

function createRemixScene(sc: SceneCtx, games: GameDef[]): Scene {
  const subs = new Map<string, { scene: Scene; sc: SceneCtx }>();
  for (const g of games) {
    const subSc: SceneCtx = {
      ...sc,
      game: g.id,
      cues: sc.cues.filter((c) => c.game === g.id),
      markers: sc.markers.filter((m) => m.game === g.id),
      segments: [],
    };
    subs.set(g.id, { scene: g.createScene(subSc), sc: subSc });
  }
  const segs: Segment[] = sc.segments;
  const spb = sc.spb;

  function segAt(beat: number): { cur: Segment; idx: number } {
    let idx = 0;
    for (let i = 0; i < segs.length; i++) if (beat >= segs[i].start - 1e-6) idx = i;
    return { cur: segs[idx], idx };
  }

  function active(t: number) {
    return subs.get(segAt(t / spb).cur.game)!;
  }

  const WIPE = 0.3; // 박

  return {
    judge(ev: GameInput, j: Judge) {
      const a = active(ev.time);
      return a.scene.judge ? a.scene.judge(ev, j) : undefined;
    },
    onDown(ev) {
      active(ev.time).scene.onDown?.(ev);
    },
    onUp(ev) {
      active(ev.time).scene.onUp?.(ev);
    },
    onInput(ev, cue) {
      const target = cue ? subs.get(cue.game) : active(ev.time);
      target?.scene.onInput?.(ev, cue);
    },
    onMiss(cue) {
      subs.get(cue.game)?.scene.onMiss?.(cue);
    },
    hitSfx(cue) {
      return subs.get(cue.game)?.scene.hitSfx?.(cue) ?? null;
    },
    draw(g: G, f: Frame) {
      const beat = f.beat;
      const { cur, idx } = segAt(beat);
      const next = segs[idx + 1];
      const drawSeg = (s: Segment) => {
        g.save();
        subs.get(s.game)!.scene.draw(g, f);
        g.restore();
      };
      // 다음 구간으로 넘어가기 직전: 줄무늬 커튼이 오른쪽에서 덮어옴
      if (next && beat > next.start - WIPE) {
        drawSeg(cur);
        const k = easeInOutQuad(clamp01((beat - (next.start - WIPE)) / WIPE));
        curtain(g, f, k, 1);
      } else if (idx > 0 && beat < cur.start + WIPE) {
        drawSeg(cur);
        const k = easeInOutQuad(clamp01((beat - cur.start) / WIPE));
        curtain(g, f, 1 - k, -1);
      } else drawSeg(cur);
    },
  };
}

/** 줄무늬 커튼 (k=1이면 화면 전체를 덮음) */
function curtain(g: G, f: Frame, k: number, dir: number) {
  if (k <= 0) return;
  const { W, H } = f;
  const cols = ['#ff6b8b', '#ffb84d', '#ffe14d', '#6be3a0', '#6bc6ff', '#c77dff'];
  const n = cols.length;
  const bw = W / n;
  for (let i = 0; i < n; i++) {
    const delay = (dir > 0 ? i : n - 1 - i) / n / 2;
    const kk = clamp01((k - delay) / 0.5);
    if (kk <= 0) continue;
    const h = H * kk;
    g.fillStyle = cols[i];
    if (dir > 0) g.fillRect(i * bw - 0.5, 0, bw + 1, h);
    else g.fillRect(i * bw - 0.5, H - h, bw + 1, h);
  }
  if (k > 0.85) {
    g.globalAlpha = (k - 0.85) / 0.15;
    star(g, W / 2, H / 2, 40, 18, 5, -Math.PI / 2, '#fff', OUT, 4);
    g.globalAlpha = 1;
  }
}

export function makeRemix(o: RemixOpts): GameDef {
  const byId = new Map(o.games.map((g) => [g.id, g] as const));
  const liveSfx = new Map<string, [string, number]>();
  for (const g of o.games) for (const s of g.liveSfx) liveSfx.set(s.join('|'), s);
  const bodyBars = o.plan.reduce((a, p) => a + p.bars, 0);

  return {
    id: o.id,
    title: o.title,
    sub: o.sub,
    desc: o.desc,
    howto: o.howto,
    color: o.color,
    accent: o.accent,
    bpm: o.bpm,
    remix: true,
    liveSfx: [...liveSfx.values()],
    build(b: ChartBuilder) {
      o.music(b, INTRO, bodyBars);
      let bar = INTRO;
      for (const p of o.plan) {
        const g = byId.get(p.game)!;
        const start = b.bar(bar);
        const n0 = b.cues.length;
        b.game = g.id;
        g.remixPart!(b, start, p.bars, p.variant);
        // 분류를 게임 단위로
        for (let i = n0; i < b.cues.length; i++) b.cues[i].cat = g.id;
        b.segments.push({ game: g.id, start, end: start + p.bars * b.beatsPerBar });
        bar += p.bars;
      }
      b.game = o.id;
      b.endBeat = b.bar(INTRO + bodyBars + 1) + 2;
    },
    practice: [],
    practiceBacking() {
      /* 리믹스는 연습 없음 */
    },
    createScene(sc: SceneCtx) {
      return createRemixScene(sc, o.games);
    },
    drawIcon(g: G, cx: number, cy: number, s: number, t: number) {
      const k = s / 120;
      g.save();
      g.translate(cx, cy);
      g.scale(k, k);
      o.games.slice(0, 4).forEach((gd, i) => {
        const x = (i % 2 ? 1 : -1) * 34;
        const y = (i < 2 ? -1 : 1) * 26 - 4;
        g.save();
        g.beginPath();
        g.arc(x, y, 30, 0, Math.PI * 2);
        g.fillStyle = gd.color;
        g.fill();
        g.strokeStyle = OUT;
        g.lineWidth = 3;
        g.stroke();
        g.clip();
        gd.drawIcon(g, x, y, 56, t + i * 0.25);
        g.restore();
      });
      rrect(g, -40, 44, 80, 24, 12, '#fff', OUT, 3);
      text(g, 'REMIX', 0, 56.5, 14, '#ff4d6d', { weight: 900 });
      g.restore();
    },
    cats: Object.fromEntries(o.games.map((g) => [g.id, g.title])),
    comments: {
      good: Object.fromEntries(o.games.map((g) => [g.id, `${g.title} 구간이 완벽했어요!`])),
      bad: Object.fromEntries(o.games.map((g) => [g.id, `${g.title} 구간에서 흔들렸어요.`])),
    },
    epilogue: o.epilogue,
    drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number) {
      epilogueFrame(g, x, y, w, h, rank === 'try' ? '#3a3050' : '#2b1a55', () => {
        const n = rank === 'hi' ? 30 : rank === 'ok' ? 12 : 4;
        for (let i = 0; i < n; i++) {
          const sx = x + hash01(i * 5) * w;
          const sy = y + hash01(i * 7) * h;
          star(g, sx, sy, 5 + hash01(i) * 5, 2.2, 5, t + i, ['#ffe14d', '#ff9ad5', '#8fd0ff', '#fff'][i % 4]);
        }
        o.games.slice(0, 4).forEach((gd, i) => {
          const gx = x + w * (0.14 + i * 0.24);
          const gy = y + h * 0.55 + Math.sin(t * 3 + i) * (rank === 'hi' ? 8 : 2);
          gd.drawIcon(g, gx, gy, 70, t + i * 0.3);
        });
      });
    },
  };
}

export const REMIX_INTRO_BARS = INTRO;
void (null as unknown as SceneCtx);
