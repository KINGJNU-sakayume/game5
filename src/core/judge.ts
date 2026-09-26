// 판정: 입력과 큐를 매칭하고 점수를 계산
import type { Cue, Grade, InputKind } from './chart';

/** 정확(Just) 판정 범위 (초) */
export const WIN_JUST = 0.065;
/** 아슬아슬(Barely) 판정 범위 (초) */
export const WIN_BARELY = 0.125;

export type Rank = 'hi' | 'ok' | 'try';

export interface CatStat {
  n: number;
  weight: number;
  credit: number;
  just: number;
  barely: number;
  miss: number;
}

export interface ScoreResult {
  score: number;
  rank: Rank;
  just: number;
  barely: number;
  miss: number;
  total: number;
  perfect: boolean;
  cats: Record<string, CatStat>;
  /** 평균 타이밍 오차 (초, +는 늦음) */
  meanDt: number;
}

export const RANK_LABEL: Record<Rank, string> = {
  hi: '하이레벨',
  ok: '평범',
  try: '다시 한 번',
};

export function gradeOf(dt: number): Grade | null {
  const a = Math.abs(dt);
  if (a <= WIN_JUST) return 'just';
  if (a <= WIN_BARELY) return 'barely';
  return null;
}

export function rankOf(score: number): Rank {
  return score >= 80 ? 'hi' : score >= 60 ? 'ok' : 'try';
}

export interface JudgeInput {
  kind: InputKind;
  /** 보정 후 입력 시각 (초) */
  jt: number;
  /** 원시 입력 시각 (초) */
  time: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export class Judge {
  cues: Cue[];
  private lo = 0;
  onJudge: ((c: Cue) => void) | null = null;

  constructor(cues: Cue[] = []) {
    this.cues = cues;
    this.cues.sort((a, b) => a.t - b.t || a.id - b.id);
  }

  add(cues: Cue[]) {
    for (const c of cues) this.cues.push(c);
    this.cues.sort((a, b) => a.t - b.t || a.id - b.id);
    this.lo = 0;
  }

  /** 제자리에서 제거 (장면이 같은 배열을 참조하므로) */
  remove(pred: (c: Cue) => boolean) {
    let w = 0;
    for (const c of this.cues) if (!pred(c)) this.cues[w++] = c;
    this.cues.length = w;
    this.lo = 0;
  }

  /** 입력에 가장 가까운 미판정 큐를 찾아 판정 */
  match(ev: JudgeInput, filter?: (c: Cue) => boolean): Cue | null {
    let best: Cue | null = null;
    let bd = Infinity;
    const cues = this.cues;
    for (let i = this.lo; i < cues.length; i++) {
      const c = cues[i];
      if (c.t > ev.jt + WIN_BARELY) break;
      if (c.grade || c.input !== ev.kind) continue;
      if (filter && !filter(c)) continue;
      const d = Math.abs(ev.jt - c.t);
      if (d <= WIN_BARELY && d < bd) {
        bd = d;
        best = c;
      }
    }
    if (!best) return null;
    this.apply(best, ev);
    return best;
  }

  /** 특정 큐를 입력으로 판정 (창 밖이면 miss) */
  apply(c: Cue, ev: JudgeInput): Grade {
    const dt = ev.jt - c.t;
    const g = gradeOf(dt) ?? 'miss';
    c.grade = g;
    c.dt = dt;
    c.at = ev.time;
    c.ix = { x: ev.x, y: ev.y, dx: ev.dx, dy: ev.dy };
    this.onJudge?.(c);
    return g;
  }

  forceMiss(c: Cue, at?: number) {
    if (c.grade) return;
    c.grade = 'miss';
    c.at = at ?? c.t;
    this.onJudge?.(c);
  }

  /** now(보정 후 시각)를 지난 큐들을 미스로 처리해서 반환 */
  expire(now: number): Cue[] {
    const out: Cue[] = [];
    const cues = this.cues;
    let i = this.lo;
    for (; i < cues.length; i++) {
      const c = cues[i];
      if (c.t + WIN_BARELY >= now) break;
      if (!c.grade) {
        c.grade = 'miss';
        c.at = c.t;
        out.push(c);
        this.onJudge?.(c);
      }
    }
    // lo는 확실히 끝난 큐까지만 전진
    while (this.lo < cues.length && cues[this.lo].grade && cues[this.lo].t + WIN_BARELY < now) this.lo++;
    return out;
  }

  pendingBefore(t: number): boolean {
    for (let i = this.lo; i < this.cues.length; i++) {
      const c = this.cues[i];
      if (c.t > t) break;
      if (!c.grade) return true;
    }
    return false;
  }

  result(): ScoreResult {
    return scoreCues(this.cues);
  }
}

export function scoreCues(cues: Cue[]): ScoreResult {
  const cats: Record<string, CatStat> = {};
  let W = 0;
  let C = 0;
  let just = 0;
  let barely = 0;
  let miss = 0;
  let dtSum = 0;
  let dtN = 0;
  for (const c of cues) {
    const st = (cats[c.cat] ??= { n: 0, weight: 0, credit: 0, just: 0, barely: 0, miss: 0 });
    const credit = c.grade === 'just' ? 1 : c.grade === 'barely' ? 0.5 : 0;
    st.n++;
    st.weight += c.weight;
    st.credit += credit * c.weight;
    W += c.weight;
    C += credit * c.weight;
    if (c.grade === 'just') {
      just++;
      st.just++;
    } else if (c.grade === 'barely') {
      barely++;
      st.barely++;
    } else {
      miss++;
      st.miss++;
    }
    if (c.grade && c.grade !== 'miss' && typeof c.dt === 'number') {
      dtSum += c.dt;
      dtN++;
    }
  }
  const score = W > 0 ? Math.round((C / W) * 1000) / 10 : 0;
  return {
    score,
    rank: rankOf(score),
    just,
    barely,
    miss,
    total: cues.length,
    perfect: cues.length > 0 && barely === 0 && miss === 0,
    cats,
    meanDt: dtN ? dtSum / dtN : 0,
  };
}
