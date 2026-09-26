import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/games';
import { buildChart, buildPracticeLoop } from '../src/core/session';
import { simulate } from '../src/core/simulate';
import { INSTRUMENTS } from '../src/core/synth';
import { WIN_BARELY } from '../src/core/judge';
import type { Frame } from '../src/core/game';
import { mockCtx } from './mockCanvas';

function frame(t: number, spb: number, H = 852): Frame {
  return { t, beat: t / spb, W: 393, H, safe: { t: 59, b: 34, l: 0, r: 0 }, dt: 1 / 60, real: t };
}

describe.each(GAMES.map((g) => [g.id, g] as const))('%s', (_id, def) => {
  const chart = buildChart(def);

  it('리믹스 구간이 겹치지 않음', () => {
    if (!def.remix) return;
    expect(chart.segments.length).toBeGreaterThan(4);
    for (let i = 1; i < chart.segments.length; i++) expect(chart.segments[i].start).toBeGreaterThanOrEqual(chart.segments[i - 1].end);
    for (const c of chart.cues) {
      const seg = chart.segments.find((s) => c.beat >= s.start - 1e-6 && c.beat < s.end - 1e-6);
      expect(seg, `cue ${c.game}@${c.beat} outside segments`).toBeTruthy();
      expect(seg!.game).toBe(c.game);
    }
  });

  it('채보가 올바르게 구성됨', () => {
    expect(chart.cues.length).toBeGreaterThan(20);
    for (let i = 1; i < chart.cues.length; i++) expect(chart.cues[i].t).toBeGreaterThanOrEqual(chart.cues[i - 1].t);
    const last = chart.cues[chart.cues.length - 1];
    expect(chart.endBeat * chart.spb).toBeGreaterThanOrEqual(last.t);
    expect(chart.lengthSec).toBeGreaterThan(last.t);
    // 곡 길이 60~150초
    expect(chart.lengthSec).toBeGreaterThan(55);
    expect(chart.lengthSec).toBeLessThan(160);
    for (const n of chart.notes) {
      expect(INSTRUMENTS[n.inst], `unknown instrument ${n.inst}`).toBeTruthy();
      expect(Number.isFinite(n.t) && n.t >= 0).toBe(true);
    }
  });

  it('같은 입력 종류의 큐가 너무 붙어 있지 않음', () => {
    // 같은 입력 + 같은 위치(좌/우)끼리만 비교 (양쪽 동시 탭은 허용)
    const byKind = new Map<string, number>();
    for (const c of chart.cues) {
      const key = c.input + ':' + (c.data.side ?? '');
      const prev = byKind.get(key);
      if (prev != null) expect(c.t - prev, `${c.kind} @ beat ${c.beat}`).toBeGreaterThanOrEqual(WIN_BARELY * 1.6);
      byKind.set(key, c.t);
    }
  });

  it('자동 플레이는 하이레벨 100점', () => {
    const sim = simulate(def, 1e9, 'just');
    const r = sim.judge.result();
    expect(r.miss).toBe(0);
    expect(r.score).toBe(100);
    expect(r.rank).toBe('hi');
  });

  it('입력이 없으면 다시 한 번', () => {
    const sim = simulate(def, 1e9, 'miss');
    const r = sim.judge.result();
    expect(r.score).toBe(0);
    expect(r.rank).toBe('try');
  });

  it('모든 장면이 오류 없이 그려짐', () => {
    for (const grade of ['just', 'barely', 'miss', 'mixed'] as const) {
      const end = chart.endBeat * chart.spb + 1;
      const times: number[] = [];
      for (let t = -0.5; t < end; t += 0.37) times.push(t);
      // 큐 전후 시각도 촘촘히
      for (const c of chart.cues) times.push(c.t - 0.2, c.t, c.t + 0.05, c.t + 0.14, c.t + 0.5);
      times.sort((a, b) => a - b);
      const g = mockCtx();
      let sim = simulate(def, -1, grade);
      let lastT = -1;
      for (const t of times) {
        if (t < lastT) continue;
        // 시각이 앞으로만 가도록 누적 시뮬레이션은 비용이 커서 몇 구간마다 새로
        if (t - lastT > 8) sim = simulate(def, t, grade);
        lastT = t;
        for (const H of [852, 659]) sim.scene.draw(g, frame(t, chart.spb, H));
      }
    }
  });

  it('아이콘과 에필로그가 그려짐', () => {
    const g = mockCtx();
    def.drawIcon(g, 50, 50, 90, 1.2);
    for (const r of ['hi', 'ok', 'try'] as const) def.drawEpilogue(g, 20, 300, 350, 220, r, 1.5);
    expect(def.epilogue.hi.length).toBeGreaterThan(5);
  });

  it('연습 단계가 올바름', () => {
    if (def.remix) {
      expect(def.practice.length).toBe(0);
      return;
    }
    expect(def.practice.length).toBeGreaterThan(0);
    def.practice.forEach((step, i) => {
      const loop = buildPracticeLoop(def, i);
      expect(loop.cues.length).toBeGreaterThan(0);
      for (const c of loop.cues) {
        expect(c.t).toBeGreaterThanOrEqual(0);
        expect(c.t).toBeLessThan(step.beats * loop.spb);
      }
      expect(step.need).toBeLessThanOrEqual(loop.cues.length * 3);
      expect(step.text.length).toBeGreaterThan(4);
    });
  });

  it('평가 문구가 모든 분류에 있음', () => {
    const cats = new Set(chart.cues.map((c) => c.cat));
    for (const c of cats) {
      expect(def.comments.good[c], `good comment for ${c}`).toBeTruthy();
      expect(def.comments.bad[c], `bad comment for ${c}`).toBeTruthy();
    }
  });
});
