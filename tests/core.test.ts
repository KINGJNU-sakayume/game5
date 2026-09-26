import { describe, expect, it } from 'vitest';
import { ChartBuilder, nm, parseChord, voice } from '../src/core/chart';
import { Judge, WIN_BARELY, WIN_JUST, rankOf, scoreCues } from '../src/core/judge';

describe('음 이름/코드', () => {
  it('음 이름을 MIDI로', () => {
    expect(nm('C4')).toBe(60);
    expect(nm('A4')).toBe(69);
    expect(nm('Bb3')).toBe(58);
    expect(nm('F#5')).toBe(78);
  });
  it('코드 해석', () => {
    expect(parseChord('Am').ivs).toEqual([0, 3, 7]);
    expect(parseChord('G7').root).toBe(7);
    expect(parseChord('C/E').bass).toBe(4);
    const v = voice(parseChord('F'), 64);
    expect(v.length).toBe(3);
    expect(Math.max(...v) - Math.min(...v)).toBeLessThan(12);
  });
  it('멜로디 파싱: 늘임표와 쉼표', () => {
    const b = new ChartBuilder(120);
    b.seq(0, 0.5, 'C4 - . E4 | G4!', 'lead');
    expect(b.notes.map((n) => n.midi)).toEqual([60, 64, 67]);
    expect(b.notes[0].dur).toBeCloseTo(2 * 0.25 * 0.92);
    expect(b.notes[2].vel).toBeGreaterThan(b.notes[1].vel);
  });
});

describe('판정', () => {
  const mk = () => {
    const b = new ChartBuilder(120);
    b.cue(0, 'tap', 'a');
    b.cue(1, 'tap', 'a');
    b.cue(2, 'flick', 'b');
    return new Judge(b.build().cues);
  };
  const ev = (kind: 'tap' | 'flick' | 'release', jt: number) => ({ kind, jt, time: jt, x: 0, y: 0, dx: 0, dy: 0 });

  it('정확/아슬/범위 밖', () => {
    const j = mk();
    expect(j.match(ev('tap', 0.01))?.grade).toBe('just');
    expect(j.match(ev('tap', 0.5 + WIN_JUST + 0.01))?.grade).toBe('barely');
    expect(j.match(ev('flick', 1.0 + WIN_BARELY + 0.02))).toBeNull();
  });
  it('다른 입력 종류는 매칭하지 않음', () => {
    const j = mk();
    expect(j.match(ev('flick', 0))).toBeNull();
  });
  it('시간이 지나면 미스 처리', () => {
    const j = mk();
    const missed = j.expire(10);
    expect(missed.length).toBe(3);
    const r = j.result();
    expect(r.rank).toBe('try');
    expect(r.miss).toBe(3);
  });
  it('점수와 등급', () => {
    expect(rankOf(80)).toBe('hi');
    expect(rankOf(79.9)).toBe('ok');
    expect(rankOf(60)).toBe('ok');
    expect(rankOf(59)).toBe('try');
    const j = mk();
    j.match(ev('tap', 0));
    j.match(ev('tap', 0.5 + 0.1));
    j.expire(10);
    const r = scoreCues(j.cues);
    expect(r.just).toBe(1);
    expect(r.barely).toBe(1);
    expect(r.miss).toBe(1);
    expect(r.score).toBeCloseTo(50, 0);
  });
  it('가장 가까운 큐를 고름', () => {
    const b = new ChartBuilder(240);
    b.cue(0, 'tap', 'a');
    b.cue(1, 'tap', 'a');
    const j = new Judge(b.build().cues);
    const c = j.match(ev('tap', 0.2));
    expect(c?.beat).toBe(1);
  });
});
