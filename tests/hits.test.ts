// 성공음 박자 동기 예약 테스트: 가짜 오디오 시계로 세션을 돌려 소리가 언제 예약되는지 확인
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { audio } from '../src/core/audio';
import type { Cue } from '../src/core/chart';
import type { HitSfx } from '../src/core/game';
import { getSave } from '../src/core/save';
import { PlaySession, PracticeSession } from '../src/core/session';
import { GAMES, gameById } from '../src/games';

interface Rec {
  name: string;
  when: number;
  calledAt: number;
  cancelled: boolean;
  stopped: boolean;
}

interface Part {
  spec: HitSfx;
  songT: number;
  at: number;
  h: { rec: Rec } | null;
}

const param = () => ({ value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} });
const fake = {
  currentTime: 0,
  state: 'running',
  createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
};
let calls: Rec[] = [];

beforeEach(() => {
  const A = audio as unknown as Record<string, unknown>;
  A.ctx = fake;
  A.musicBus = {};
  // 출력 지연 0: 들리는 시각 = 컨텍스트 시각
  A.heardTime = () => fake.currentTime;
  A.playBuffer = () => ({ stop() {} });
  A.sfx = (name: string, _m = 0, _v = 1, when = 0) => {
    const rec: Rec = { name, when: Math.max(when, fake.currentTime), calledAt: fake.currentTime, cancelled: false, stopped: false };
    calls.push(rec);
    return {
      rec,
      stop() {
        rec.stopped = true;
      },
      cancel() {
        rec.cancelled = true;
      },
    };
  };
  calls = [];
  fake.currentTime = 0;
  getSave().settings.hitTiming = 'beat';
});

afterEach(() => {
  getSave().settings.hitTiming = 'beat';
});

const FPS = 60;

function makeSession(id: string, autoplay: boolean): PlaySession {
  const s = new PlaySession(gameById(id)!, { autoplay, holding: () => false });
  (s as unknown as { buffer: object }).buffer = {};
  s.start(0.1);
  return s;
}

/** 곡 시각 until(초)까지 프레임 단위로 진행 */
function runUntil(s: PlaySession, until: number) {
  let t = fake.currentTime;
  while (s.state === 'playing' && s.songTime() < until) {
    t += 1 / FPS;
    fake.currentTime = t;
    s.update(t * 1000);
  }
}

const hitsOf = (s: PlaySession) => (s as unknown as { hits: Map<number, Part[] | null> }).hits;
const specsOf = (s: PlaySession, c: Cue): HitSfx[] => {
  const r = s.scene.hitSfx?.(c);
  return !r ? [] : Array.isArray(r) ? r : [r];
};

describe('성공음은 음악과 같은 오디오 시계로 박자에 맞춰 미리 예약된다', () => {
  for (const def of GAMES) {
    it(`${def.id}: 자동 플레이 — 모든 성공음이 큐 시각(+지연)에 정확히, 미리 예약됨`, () => {
      const s = makeSession(def.id, true);
      runUntil(s, s.endTime + 5);
      expect(s.result?.score).toBe(100);
      const hits = hitsOf(s);
      for (const c of s.judge.cues) {
        expect(c.grade).toBe('just');
        const specs = specsOf(s, c);
        expect(specs.length, `${def.id} 큐 ${c.id}에 성공음이 없음`).toBeGreaterThan(0);
        for (const sp of specs) expect(def.liveSfx.some(([n]) => n === sp.name), `${sp.name}이 liveSfx에 없음`).toBe(true);
        const parts = hits.get(c.id);
        expect(parts, `${def.id} 큐 ${c.id} 예약 없음`).toBeTruthy();
        expect(parts!.length).toBe(specs.length);
        for (const p of parts!) {
          expect(p.songT).toBeCloseTo(c.t + (p.spec.delay ?? 0), 9);
          // 음악 버퍼에서 그 순간이 재생되는 시각과 정확히 같음
          expect(p.at).toBeCloseTo(s.ctxAt(p.songT), 9);
          expect(p.h!.rec.when).toBeCloseTo(p.at, 9);
          // 박자보다 먼저(미리) 예약됨
          expect(p.h!.rec.calledAt).toBeLessThan(p.at);
          expect(p.h!.rec.cancelled || p.h!.rec.stopped).toBe(false);
        }
      }
    });
  }

  it('아무것도 누르지 않으면: 처음 몇 개만 미리 울리고, 곧 멈추며, 울린 소리는 모두 끊김', () => {
    const s = makeSession('chef', false);
    runUntil(s, s.endTime + 5);
    const names = new Set(['chop', 'chopBig']);
    const hitCalls = calls.filter((r) => names.has(r.name));
    expect(hitCalls.length).toBeGreaterThan(0);
    expect(hitCalls.length).toBeLessThanOrEqual(4);
    for (const r of hitCalls) expect(r.cancelled || r.stopped).toBe(true);
    expect(s.judge.cues.every((c) => c.grade === 'miss')).toBe(true);
  });

  it('박자보다 일찍 누른 아슬아슬: 아직 울리기 전인 성공음은 취소됨', () => {
    const s = makeSession('chef', false);
    const c = s.judge.cues[0];
    // 판정 시각 = 곡 시각 - 보정. 큐보다 0.1초 이른 입력이 되도록 시계를 맞춤
    runUntil(s, c.t - 0.1 + s.calib - 1 / FPS);
    fake.currentTime = s.ctxAt(c.t - 0.1 + s.calib);
    const part = hitsOf(s).get(c.id)![0];
    expect(part.at).toBeGreaterThan(fake.currentTime);
    const rec = part.h!.rec;
    s.handleRaw({ kind: 'down', id: 1, x: 200, y: 400, perf: fake.currentTime * 1000, dx: 0, dy: 0 });
    expect(c.grade).toBe('barely');
    expect(rec.cancelled).toBe(true);
    expect(calls.some((r) => r.name === 'thud')).toBe(true);
  });

  it('박자보다 늦게 누른 아슬아슬: 이미 울리고 있는 성공음은 짧게 끊김', () => {
    const s = makeSession('chef', false);
    const c = s.judge.cues[0];
    runUntil(s, c.t + 0.1 + s.calib - 1 / FPS);
    fake.currentTime = s.ctxAt(c.t + 0.1 + s.calib);
    const rec = hitsOf(s).get(c.id)![0].h!.rec;
    s.handleRaw({ kind: 'down', id: 1, x: 200, y: 400, perf: fake.currentTime * 1000, dx: 0, dy: 0 });
    expect(c.grade).toBe('barely');
    expect(rec.cancelled).toBe(false);
    expect(rec.stopped).toBe(true);
  });

  it('일시정지 → 재개: 예약은 취소됐다가 새 시작 시각에 맞춰 다시 예약됨', () => {
    const s = makeSession('trio', true);
    const mid = s.judge.cues[Math.floor(s.judge.cues.length / 2)].t - 0.2;
    runUntil(s, mid);
    s.pause();
    const pending = calls.filter((r) => r.when > fake.currentTime + 0.003);
    for (const r of pending) expect(r.cancelled).toBe(true);
    fake.currentTime += 2.5;
    s.resume();
    runUntil(s, s.endTime + 5);
    expect(s.result?.score).toBe(100);
    for (const c of s.judge.cues) {
      if (c.t < mid + 0.1) continue;
      for (const p of hitsOf(s).get(c.id)!) expect(p.at).toBeCloseTo(s.ctxAt(p.songT), 9);
    }
  });

  it('"누른 순간" 설정: 미리 예약하지 않고 판정 순간에 바로 재생', () => {
    getSave().settings.hitTiming = 'tap';
    const s = makeSession('ninja', true);
    runUntil(s, s.endTime + 5);
    expect(s.result?.score).toBe(100);
    for (const c of s.judge.cues) {
      for (const p of hitsOf(s).get(c.id)!) {
        expect(p.h!.rec.when).toBe(p.h!.rec.calledAt);
        expect(p.h!.rec.when).toBeGreaterThanOrEqual(s.ctxAt(c.t) - 1e-9);
      }
    }
  });

  it('불꽃놀이: 터지는 소리는 큐보다 정확히 한 박 뒤에 예약됨', () => {
    const s = makeSession('fireworks', true);
    runUntil(s, s.endTime + 5);
    const spb = 60 / gameById('fireworks')!.bpm;
    for (const c of s.judge.cues) {
      const boom = hitsOf(s).get(c.id)!.find((p) => p.spec.name === 'boom')!;
      expect(boom.songT - c.t).toBeCloseTo(spb, 9);
    }
  });

  it('연습 모드: 모든 단계를 마치고, 성공음은 박자에 예약되며, 취소된 반복의 소리는 울리지 않음', () => {
    for (const def of GAMES.filter((g) => !g.remix)) {
      calls = [];
      fake.currentTime = 0;
      const s = new PracticeSession(def, { autoplay: true, holding: () => false });
      for (const l of s.loops) l.buffer = {} as AudioBuffer;
      s.start(0.1);
      let t = 0;
      while (s.phase !== 'done' && t < 400) {
        t += 1 / FPS;
        fake.currentTime = t;
        s.update(t * 1000);
      }
      expect(s.phase, def.id).toBe('done');
      const live = new Set<Rec>();
      const hits = (s as unknown as { hits: Map<number, Part[] | null> }).hits;
      for (const c of s.cues) {
        expect(c.grade, `${def.id} 연습 큐`).toBe('just');
        const parts = hits.get(c.id)!;
        expect(parts.length).toBeGreaterThan(0);
        for (const p of parts) {
          expect(p.at).toBeCloseTo(s.ctxAt(p.songT), 9);
          expect(p.h!.rec.calledAt).toBeLessThan(p.at);
          live.add(p.h!.rec);
        }
      }
      // 남은 큐의 소리가 아닌 성공음 예약은 모두 취소되어야 함 (단계가 끝나 사라진 반복)
      const hitNames = new Set(s.cues.flatMap((c) => {
        const r = s.scene.hitSfx?.(c);
        return (!r ? [] : Array.isArray(r) ? r : [r]).map((x) => x.name);
      }));
      for (const r of calls) if (hitNames.has(r.name) && !live.has(r)) expect(r.cancelled, `${def.id} ${r.name}`).toBe(true);
    }
  });
});
