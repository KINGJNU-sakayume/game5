// 채보(큐) + 음악 노트를 함께 작성하는 빌더
import type { NoteEvent } from './audio';

export type InputKind = 'tap' | 'release' | 'flick';
export type Grade = 'just' | 'barely' | 'miss';

export interface Cue {
  id: number;
  /** 입력해야 하는 시각(초) */
  t: number;
  beat: number;
  input: InputKind;
  /** 게임 고유의 종류 (예: 'tomato') */
  kind: string;
  /** 평가 코멘트용 분류 */
  cat: string;
  weight: number;
  game: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  grade?: Grade;
  /** 입력 시각 - 목표 시각 (초, 보정 후) */
  dt?: number;
  /** 판정된 입력의 원시 시각 (미스는 t) */
  at?: number;
  /** 입력 정보 (플릭 방향 등) */
  ix?: { x: number; y: number; dx: number; dy: number };
}

export interface Marker {
  beat: number;
  t: number;
  type: string;
  game: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export interface Segment {
  game: string;
  start: number; // beat
  end: number; // beat
}

export interface Chart {
  bpm: number;
  spb: number;
  beatsPerBar: number;
  notes: NoteEvent[];
  cues: Cue[];
  markers: Marker[];
  segments: Segment[];
  endBeat: number;
  lengthSec: number;
}

const NOTE_BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C4" → 60, "F#3" → 54, "Bb5" → 82 */
export function nm(s: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error('bad note: ' + s);
  const base = NOTE_BASE[m[1].toUpperCase()];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (parseInt(m[3], 10) + 1) + base + acc;
}

const QUAL: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  M7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  add9: [0, 4, 7, 14],
  '9': [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  '7sus4': [0, 5, 7, 10],
  m7b5: [0, 3, 6, 10],
};

export interface ChordInfo {
  root: number; // pitch class
  ivs: number[];
  bass: number; // pitch class
}

export function parseChord(sym: string): ChordInfo {
  const [main, slash] = sym.split('/');
  const m = /^([A-G])([#b]?)(.*)$/.exec(main);
  if (!m) throw new Error('bad chord: ' + sym);
  const root = (NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const ivs = QUAL[m[3]];
  if (!ivs) throw new Error('bad chord quality: ' + sym);
  let bass = root;
  if (slash) {
    const s = /^([A-G])([#b]?)$/.exec(slash);
    if (!s) throw new Error('bad slash chord: ' + sym);
    bass = (NOTE_BASE[s[1]] + (s[2] === '#' ? 1 : s[2] === 'b' ? -1 : 0) + 12) % 12;
  }
  return { root, ivs, bass };
}

/** 코드 구성음을 center 근처에 배치 */
export function voice(ch: ChordInfo, center = 64): number[] {
  const out: number[] = [];
  for (const iv of ch.ivs) {
    const pc = (ch.root + iv) % 12;
    let best = 0;
    let bd = 1e9;
    for (let o = 2; o < 8; o++) {
      const n = o * 12 + pc;
      const d = Math.abs(n - center);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    out.push(best);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export function bassNote(ch: ChordInfo, low = 36): number {
  let n = low - (low % 12) + ch.bass;
  if (n < low) n += 12;
  return n;
}

const DRUM_LANES: Record<string, string> = {
  k: 'kick',
  s: 'snare',
  c: 'clap',
  h: 'hat',
  o: 'ohat',
  x: 'crash',
  sh: 'shaker',
  t: 'tamb',
  tl: 'tomL',
  th: 'tomH',
  r: 'rim',
  b: 'block',
  cb: 'cowbell',
  sn: 'snap',
  tk: 'taiko',
  tri: 'triangle',
};

export interface SeqOpts {
  vel?: number;
  pan?: number;
  rev?: number;
  transpose?: number;
  /** 음 길이 비율 (0..1, 1=레가토) */
  gate?: number;
  swing?: number;
}

/** 스윙: 8분 뒷박을 뒤로 민다 (amount 1 = 셋잇단 느낌) */
export function swingBeat(beat: number, amount: number): number {
  if (!amount) return beat;
  const f = beat - Math.floor(beat);
  if (Math.abs(f - 0.5) < 1e-6) return beat + amount / 6;
  return beat;
}

export class ChartBuilder {
  readonly bpm: number;
  readonly spb: number;
  beatsPerBar: number;
  notes: NoteEvent[] = [];
  cues: Cue[] = [];
  markers: Marker[] = [];
  segments: Segment[] = [];
  game = '';
  endBeat = 0;
  /** 채보 전체에 적용되는 박 오프셋 (연습 루프 등) */
  offset = 0;
  private nextId = 1;
  /** true면 음악 노트를 무시 (리믹스에서 원곡 반주 제외용) */
  muteMusic = false;

  constructor(bpm: number, beatsPerBar = 4) {
    this.bpm = bpm;
    this.spb = 60 / bpm;
    this.beatsPerBar = beatsPerBar;
  }

  t(beat: number): number {
    return (beat + this.offset) * this.spb;
  }

  bar(n: number): number {
    return n * this.beatsPerBar;
  }

  note(beat: number, inst: string, midi: number, durBeats: number, vel = 0.8, pan = 0, rev?: number) {
    if (this.muteMusic) return;
    this.pushNote(beat, inst, midi, durBeats, vel, pan, rev);
  }

  private pushNote(beat: number, inst: string, midi: number, durBeats: number, vel: number, pan: number, rev?: number) {
    this.notes.push({ t: this.t(beat), inst, midi, dur: Math.max(0.02, durBeats * this.spb), vel, pan, rev });
  }

  /** 게임 큐 사운드 (리믹스에서도 항상 포함) */
  sfx(beat: number, inst: string, vel = 1, midi = 0, pan = 0) {
    this.pushNote(beat, inst, midi, 0.1, vel, pan);
  }

  cue(beat: number, input: InputKind, kind: string, data: object = {}, opts: { cat?: string; weight?: number } = {}): Cue {
    const c: Cue = {
      id: this.nextId++,
      t: this.t(beat),
      beat: beat + this.offset,
      input,
      kind,
      cat: opts.cat ?? kind,
      weight: opts.weight ?? 1,
      game: this.game,
      data: { ...data },
    };
    this.cues.push(c);
    return c;
  }

  marker(beat: number, type: string, data?: object) {
    this.markers.push({ beat: beat + this.offset, t: this.t(beat), type, game: this.game, data });
  }

  /** 드럼 패턴: lanes = { k: 'x...x...', s: '....x...' } (한 글자 = 한 스텝) */
  drums(start: number, step: number, lanes: Record<string, string>, opts: { vel?: number; swing?: number; pan?: Record<string, number> } = {}) {
    for (const [lane, pat] of Object.entries(lanes)) {
      const inst = DRUM_LANES[lane] ?? lane;
      const clean = pat.replace(/[|\s]/g, '');
      for (let i = 0; i < clean.length; i++) {
        const ch = clean[i];
        if (ch === '.' || ch === '-') continue;
        const vel = (ch === 'X' ? 1.15 : ch === 'o' ? 0.55 : ch === 'g' ? 0.3 : 0.9) * (opts.vel ?? 1);
        const b = swingBeat(start + i * step, opts.swing ?? 0);
        this.note(b, inst, 0, step, vel, opts.pan?.[lane] ?? 0);
      }
    }
  }

  /** 멜로디/베이스: "C5 . E5 - G5 | A5 - - ." (토큰 하나 = 한 스텝, '-'=늘임, '.'=쉼) */
  seq(start: number, step: number, str: string, inst: string, opts: SeqOpts = {}) {
    const toks = str.split(/\s+/).filter((x) => x && x !== '|');
    let i = 0;
    while (i < toks.length) {
      const tk = toks[i];
      if (tk === '.' || tk === 'r' || tk === '-') {
        i++;
        continue;
      }
      let len = 1;
      while (i + len < toks.length && toks[i + len] === '-') len++;
      let vel = opts.vel ?? 0.8;
      let name = tk;
      if (name.endsWith('!')) {
        vel = Math.min(1.2, vel * 1.25);
        name = name.slice(0, -1);
      } else if (name.endsWith('?')) {
        vel *= 0.55;
        name = name.slice(0, -1);
      }
      const midi = nm(name) + (opts.transpose ?? 0);
      const b = swingBeat(start + i * step, opts.swing ?? 0);
      this.note(b, inst, midi, len * step * (opts.gate ?? 0.92), vel, opts.pan ?? 0, opts.rev);
      i += len;
    }
  }

  /** 코드 진행: "C Am F G" 각 코드 per 박 동안. rhythm이 있으면 그 리듬으로 연주 */
  chords(
    start: number,
    per: number,
    prog: string,
    inst: string,
    opts: { center?: number; rhythm?: string; step?: number; vel?: number; gate?: number; pan?: number; swing?: number; top?: boolean } = {},
  ): ChordInfo[] {
    const syms = prog.split(/\s+/).filter((x) => x && x !== '|');
    const infos: ChordInfo[] = [];
    syms.forEach((sym, ci) => {
      const cs = start + ci * per;
      if (sym === '.' || sym === '-') {
        infos.push(infos[infos.length - 1]);
        return;
      }
      const ch = parseChord(sym);
      infos.push(ch);
      const notes = voice(ch, opts.center ?? 64);
      if (opts.rhythm) {
        const step = opts.step ?? 0.5;
        const pat = opts.rhythm.replace(/[|\s]/g, '');
        const steps = Math.round(per / step);
        for (let i = 0; i < steps; i++) {
          const c = pat[i % pat.length];
          if (c === '.' || c === '-') continue;
          let len = 1;
          while (i + len < steps && pat[(i + len) % pat.length] === '-') len++;
          const b = swingBeat(cs + i * step, opts.swing ?? 0);
          const vel = (c === 'X' ? 1.1 : c === 'o' ? 0.6 : 0.85) * (opts.vel ?? 0.8);
          for (const n of notes) this.note(b, inst, n, len * step * (opts.gate ?? 0.8), vel, opts.pan ?? 0);
        }
      } else {
        for (const n of notes) this.note(cs, inst, n, per * (opts.gate ?? 0.98), opts.vel ?? 0.8, opts.pan ?? 0);
      }
    });
    return infos;
  }

  /** 코드 루트 기반 베이스 라인. pattern: 'R' 루트, '5' 5도, '8' 옥타브, '3' 3도, '.' 쉼, '-' 늘임 */
  bassline(start: number, per: number, prog: string, pattern: string, inst = 'bass', opts: { step?: number; low?: number; vel?: number; swing?: number } = {}) {
    const syms = prog.split(/\s+/).filter((x) => x && x !== '|');
    const step = opts.step ?? 0.5;
    const pat = pattern.replace(/[|\s]/g, '');
    let last: ChordInfo | null = null;
    syms.forEach((sym, ci) => {
      const ch = sym === '.' || sym === '-' ? last! : parseChord(sym);
      last = ch;
      const root = bassNote(ch, opts.low ?? 36);
      const third = root + (ch.ivs.includes(3) ? 3 : 4);
      const fifth = root + (ch.ivs.includes(6) ? 6 : ch.ivs.includes(8) ? 8 : 7);
      const steps = Math.round(per / step);
      for (let i = 0; i < steps; i++) {
        const c = pat[i % pat.length];
        if (c === '.' || c === '-') continue;
        let len = 1;
        while (i + len < steps && pat[(i + len) % pat.length] === '-') len++;
        const midi = c === '5' ? fifth : c === '8' ? root + 12 : c === '3' ? third : c === '7' ? root + 10 : c === 'b' ? root - 1 : root;
        const b = swingBeat(start + ci * per + i * step, opts.swing ?? 0);
        this.note(b, inst, midi, len * step * 0.9, opts.vel ?? 0.85);
      }
    });
  }

  /** 아르페지오 */
  arp(start: number, per: number, prog: string, inst: string, opts: { step?: number; center?: number; order?: number[]; vel?: number; gate?: number; octaves?: number } = {}) {
    const syms = prog.split(/\s+/).filter((x) => x && x !== '|');
    const step = opts.step ?? 0.25;
    syms.forEach((sym, ci) => {
      const ch = parseChord(sym);
      const base = voice(ch, opts.center ?? 72);
      const pool: number[] = [];
      for (let o = 0; o < (opts.octaves ?? 1); o++) for (const n of base) pool.push(n + 12 * o);
      const order = opts.order ?? pool.map((_, i) => i);
      const steps = Math.round(per / step);
      for (let i = 0; i < steps; i++) {
        const idx = order[i % order.length] % pool.length;
        this.note(start + ci * per + i * step, inst, pool[idx], step * (opts.gate ?? 0.9), opts.vel ?? 0.6);
      }
    });
  }

  /** 카운트인 (나무토막) */
  countIn(start: number, n = 4, step = 1, inst = 'count') {
    for (let i = 0; i < n; i++) this.sfx(start + i * step, i === 0 ? 'countHi' : inst, 0.9);
  }

  build(extraTail = 2.5): Chart {
    this.cues.sort((a, b) => a.t - b.t || a.id - b.id);
    this.markers.sort((a, b) => a.t - b.t);
    this.notes.sort((a, b) => a.t - b.t);
    let last = this.endBeat * this.spb;
    for (const n of this.notes) last = Math.max(last, n.t + n.dur);
    return {
      bpm: this.bpm,
      spb: this.spb,
      beatsPerBar: this.beatsPerBar,
      notes: this.notes,
      cues: this.cues,
      markers: this.markers,
      segments: this.segments,
      endBeat: this.endBeat,
      lengthSec: last + extraTail,
    };
  }
}
