// 입력 시뮬레이션 (미리보기/테스트용): 곡 시각 upTo까지 완벽/아슬/미스 입력을 흘려 넣음
import type { Chart } from './chart';
import type { GameDef, GameInput, Scene, SceneCtx } from './game';
import { Judge, WIN_BARELY } from './judge';
import { buildChart } from './session';

export type SimGrade = 'just' | 'barely' | 'miss' | 'mixed';

export interface SimResult {
  chart: Chart;
  judge: Judge;
  scene: Scene;
  sc: SceneCtx;
}

export function simulate(def: GameDef, upTo: number, grade: SimGrade = 'just', chart: Chart = buildChart(def)): SimResult {
  const judge = new Judge(chart.cues);
  let hold = false;
  const sc: SceneCtx = {
    game: def.id,
    bpm: def.bpm,
    spb: chart.spb,
    beatsPerBar: def.beatsPerBar ?? 4,
    cues: judge.cues,
    markers: chart.markers,
    segments: chart.segments,
    mode: 'preview',
    sfx: () => null,
    sfxAt: () => null,
    holding: () => hold,
  };
  const scene = def.createScene(sc);
  const kinds = new Set(chart.cues.map((c) => c.input));
  type Ev = { time: number; raw: 'down' | 'up' | 'flick'; miss?: number };
  const evs: Ev[] = [];
  chart.cues.forEach((c, i) => {
    const g = grade === 'mixed' ? (['just', 'barely', 'miss', 'just'] as const)[i % 4] : grade;
    if (g === 'miss') {
      evs.push({ time: c.t + WIN_BARELY + 0.001, raw: 'up', miss: c.id });
      return;
    }
    const off = g === 'barely' ? 0.09 : 0;
    if (c.input === 'release') {
      const pt = typeof c.data.pressT === 'number' ? c.data.pressT : c.t - chart.spb * 0.75;
      evs.push({ time: pt, raw: 'down' });
      evs.push({ time: c.t + off, raw: 'up' });
    } else if (c.input === 'tap') {
      evs.push({ time: c.t + off, raw: 'down' });
      evs.push({ time: c.t + off + 0.001, raw: 'up' });
    } else evs.push({ time: c.t + off, raw: 'flick' });
  });
  evs.sort((a, b) => a.time - b.time);
  for (const e of evs) {
    if (e.time > upTo) break;
    judge.expire(e.time - WIN_BARELY - 0.002).forEach((c) => scene.onMiss?.(c));
    if (e.miss != null) {
      const c = judge.cues.find((x) => x.id === e.miss)!;
      if (!c.grade) {
        judge.forceMiss(c);
        scene.onMiss?.(c);
      }
      continue;
    }
    const kind = e.raw === 'down' ? 'tap' : e.raw === 'up' ? 'release' : 'flick';
    const ev: GameInput = { kind, time: e.time, jt: e.time, x: -1, y: -1, dx: 0.8, dy: -0.6, id: -9 };
    if (e.raw === 'down') {
      hold = true;
      scene.onDown?.(ev);
    }
    if (e.raw === 'up') {
      hold = false;
      scene.onUp?.(ev);
    }
    let cue = scene.judge?.(ev, judge);
    if (cue === undefined) cue = kinds.has(kind) ? judge.match(ev) : null;
    if (kinds.has(kind)) scene.onInput?.(ev, cue ?? null);
  }
  judge.expire(upTo).forEach((c) => scene.onMiss?.(c));
  return { chart, judge, scene, sc };
}
