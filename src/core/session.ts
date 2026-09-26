// 플레이/연습 세션: 곡 재생, 시계, 입력 → 판정, 자동 플레이
import { audio, renderSong } from './audio';
import { ChartBuilder, type Chart, type Cue, type InputKind, type Marker } from './chart';
import { Judge, type ScoreResult } from './judge';
import type { Frame, GameDef, GameInput, Scene, SceneCtx, SceneMode } from './game';
import type { RawInput } from './input';
import { getSave } from './save';

/** 마지막으로 렌더링한 곡 (다시 하기용) */
let songCache: { id: string; sr: number; buffer: AudioBuffer } | null = null;

/** 새 게임을 불러오기 전에 이전 곡의 음 샘플을 비움 (효과음은 유지) */
export function freeSongSamples(keepGame?: string) {
  audio.bank?.retainOnly((k) => k.split('|').length === 2);
  if (songCache && songCache.id !== keepGame) songCache = null;
}

export function buildChart(def: GameDef): Chart {
  const b = new ChartBuilder(def.bpm, def.beatsPerBar ?? 4);
  b.game = def.id;
  def.build(b);
  return b.build();
}

export function buildPracticeLoop(def: GameDef, stepIdx: number): Chart {
  const step = def.practice[stepIdx];
  const b = new ChartBuilder(def.bpm, def.beatsPerBar ?? 4);
  b.game = def.id;
  def.practiceBacking(b, step.beats);
  step.build(b);
  b.endBeat = step.beats;
  return b.build(1.5);
}

function kindOfRaw(raw: RawInput): InputKind | null {
  switch (raw.kind) {
    case 'down':
      return 'tap';
    case 'up':
    case 'cancel':
      return 'release';
    case 'flick':
      return 'flick';
    default:
      return null;
  }
}

interface AutoEv {
  time: number;
  raw: 'down' | 'up' | 'flick';
}

/** 자동 플레이: 지금까지 도달한 큐에 대해 완벽한 입력을 생성 */
class AutoPlayer {
  private pressed = new Set<number>();
  private done = new Set<number>();
  hold = false;
  constructor(private spb: number) {}
  events(cues: Cue[], now: number): AutoEv[] {
    const out: AutoEv[] = [];
    for (const c of cues) {
      if (c.t > now + 2) break;
      if (c.input === 'release' && !this.pressed.has(c.id)) {
        const pt = typeof c.data.pressT === 'number' ? c.data.pressT : c.t - this.spb * 0.75;
        if (pt <= now) {
          this.pressed.add(c.id);
          out.push({ time: pt, raw: 'down' });
        }
      }
      if (c.grade || this.done.has(c.id) || c.t > now) continue;
      this.done.add(c.id);
      if (c.input === 'tap') {
        out.push({ time: c.t, raw: 'down' });
        out.push({ time: c.t + 0.001, raw: 'up' });
      } else if (c.input === 'flick') out.push({ time: c.t, raw: 'flick' });
      else out.push({ time: c.t, raw: 'up' });
    }
    out.sort((a, b) => a.time - b.time);
    return out;
  }
}

function usedKinds(cues: Cue[]): Set<InputKind> {
  const s = new Set<InputKind>();
  for (const c of cues) s.add(c.input);
  return s;
}

abstract class BaseSession {
  def: GameDef;
  judge: Judge;
  scene!: Scene;
  sc!: SceneCtx;
  startCtx = 0;
  state: 'loading' | 'ready' | 'playing' | 'paused' | 'ended' = 'loading';
  protected pausedSong = 0;
  autoplay = false;
  rate = 1;
  protected auto: AutoPlayer;
  protected kinds = new Set<InputKind>();
  protected holdingFn: () => boolean;
  protected songGain: GainNode | null = null;
  lastInputTime = -99;
  lastJudged: Cue | null = null;
  spb: number;

  constructor(def: GameDef, holding: () => boolean) {
    this.def = def;
    this.spb = 60 / def.bpm;
    this.judge = new Judge([]);
    this.holdingFn = holding;
    this.auto = new AutoPlayer(this.spb);
  }

  protected makeScene(cues: Cue[], markers: Marker[], segments: Chart['segments'], mode: SceneMode) {
    this.sc = {
      game: this.def.id,
      bpm: this.def.bpm,
      spb: this.spb,
      beatsPerBar: this.def.beatsPerBar ?? 4,
      cues,
      markers,
      segments,
      mode,
      sfx: (name, midi = 0, vel = 1, pan = 0) => audio.sfx(name, midi, vel, 0, pan),
      holding: () => this.holdingFn() || this.auto.hold,
    };
    this.scene = this.def.createScene(this.sc);
  }

  songTime(perf = performance.now()): number {
    if (this.state === 'paused' || this.state === 'ended') return this.pausedSong;
    if (this.state !== 'playing') return -1;
    return (audio.heardTime(perf) - this.startCtx) * this.rate;
  }

  get calib(): number {
    return getSave().settings.calib;
  }

  frame(f: Omit<Frame, 't' | 'beat'>, perf: number): Frame {
    const t = this.songTime(perf);
    return { ...f, t, beat: t / this.spb };
  }

  handleRaw(raw: RawInput) {
    if (this.state !== 'playing') return;
    const kind = kindOfRaw(raw);
    if (!kind) return;
    const time = this.songTime(raw.perf);
    const ev: GameInput = { kind, time, jt: time - this.calib, x: raw.x, y: raw.y, dx: raw.dx, dy: raw.dy, id: raw.id };
    this.process(ev, raw.kind === 'down' ? 'down' : raw.kind === 'flick' ? 'flick' : 'up');
  }

  protected process(ev: GameInput, raw: 'down' | 'up' | 'flick') {
    if (raw === 'down') this.scene.onDown?.(ev);
    if (raw === 'up') this.scene.onUp?.(ev);
    let cue = this.scene.judge?.(ev, this.judge);
    if (cue === undefined) cue = this.kinds.has(ev.kind) ? this.judge.match(ev) : null;
    if (this.kinds.has(ev.kind)) {
      this.lastInputTime = ev.time;
      this.scene.onInput?.(ev, cue ?? null);
    }
    if (cue) this.onJudged(cue);
  }

  protected onJudged(_c: Cue) {
    this.lastJudged = _c;
  }

  protected runAuto(now: number, cues: Cue[]) {
    if (!this.autoplay) return;
    for (const e of this.auto.events(cues, now)) {
      if (e.raw === 'down') this.auto.hold = true;
      if (e.raw === 'up') this.auto.hold = false;
      const kind: InputKind = e.raw === 'down' ? 'tap' : e.raw === 'up' ? 'release' : 'flick';
      const ev: GameInput = { kind, time: e.time, jt: e.time, x: -1, y: -1, dx: 0.8, dy: -0.6, id: -9 };
      this.process(ev, e.raw);
    }
  }

  protected fadeOut(sec = 0.4) {
    const ctx = audio.ctx;
    if (!ctx || !this.songGain) return;
    const g = this.songGain.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(0, ctx.currentTime + sec);
  }

  /** 일시정지: 오디오 컨텍스트는 그대로 두고 곡 소스만 멈춤 (재개 시 같은 위치부터 다시 예약) */
  pause() {
    if (this.state !== 'playing') return;
    this.pausedSong = this.songTime();
    this.state = 'paused';
    const ctx = audio.ctx;
    if (ctx && this.songGain) {
      const g = this.songGain.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(g.value, ctx.currentTime);
      g.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
    }
    this.stopSources((ctx?.currentTime ?? 0) + 0.04);
  }

  resume() {
    if (this.state !== 'paused' || !audio.ctx) return;
    const T0 = audio.ctx.currentTime + 0.08;
    // 멈춘 위치(pausedSong)가 T0에 다시 재생되도록 시작 시각을 옮김
    this.startCtx = T0 - this.pausedSong / this.rate;
    this.songGain = audio.ctx.createGain();
    this.songGain.connect(audio.musicBus);
    this.state = 'playing';
    this.restartSources(T0);
  }

  protected abstract stopSources(when: number): void;
  protected abstract restartSources(T0: number): void;

  abstract stop(): void;
}

/** 본 게임 세션 */
export class PlaySession extends BaseSession {
  chart: Chart;
  buffer: AudioBuffer | null = null;
  private src: AudioBufferSourceNode | null = null;
  perfectMode: boolean;
  perfectFailed = false;
  result: ScoreResult | null = null;
  onEnd: ((r: ScoreResult) => void) | null = null;
  onPerfectFail: (() => void) | null = null;

  constructor(def: GameDef, opts: { perfect?: boolean; autoplay?: boolean; holding: () => boolean; rate?: number }) {
    super(def, opts.holding);
    this.chart = buildChart(def);
    this.judge = new Judge(this.chart.cues);
    this.kinds = usedKinds(this.chart.cues);
    this.perfectMode = !!opts.perfect;
    this.autoplay = !!opts.autoplay;
    this.rate = opts.rate ?? 1;
    this.makeScene(this.judge.cues, this.chart.markers, this.chart.segments, 'play');
  }

  async load(): Promise<void> {
    await audio.ensureSfx(this.def.liveSfx);
    // 같은 곡을 다시 하면 렌더링한 음원을 재사용
    if (songCache && songCache.id === this.def.id && songCache.sr === audio.sampleRate) {
      this.buffer = songCache.buffer;
    } else {
      songCache = null;
      const r = await renderSong(this.chart.notes, audio.bank!, this.chart.lengthSec);
      this.buffer = audio.toBuffer(r);
      songCache = { id: this.def.id, sr: audio.sampleRate, buffer: this.buffer };
    }
    this.state = 'ready';
  }

  start(delay = 0.12) {
    if (!this.buffer || !audio.ctx) return;
    this.startCtx = audio.now() + delay;
    this.songGain = audio.ctx.createGain();
    this.songGain.connect(audio.musicBus);
    this.src = audio.playBuffer(this.buffer, this.startCtx, this.songGain, false, this.rate);
    this.state = 'playing';
  }

  get endTime(): number {
    return this.chart.endBeat * this.chart.spb;
  }

  protected stopSources(when: number) {
    try {
      this.src?.stop(when);
    } catch {
      /* ignore */
    }
    this.src = null;
  }

  protected restartSources(T0: number) {
    if (!this.buffer || !this.songGain) return;
    const P = this.pausedSong;
    if (P >= 0) this.src = audio.playBuffer(this.buffer, T0, this.songGain, false, this.rate, P);
    else this.src = audio.playBuffer(this.buffer, this.startCtx, this.songGain, false, this.rate, 0);
  }

  update(perf: number) {
    if (this.state !== 'playing') return;
    const now = this.songTime(perf);
    this.runAuto(now, this.judge.cues);
    const missed = this.judge.expire(now - this.calib);
    for (const c of missed) {
      this.scene.onMiss?.(c);
      this.onJudged(c);
      if (this.state !== 'playing') return;
    }
    if (now >= this.endTime && !this.judge.pendingBefore(Infinity)) this.finish(now);
  }

  protected onJudged(c: Cue) {
    super.onJudged(c);
    if (this.perfectMode && c.grade !== 'just' && !this.perfectFailed) {
      this.perfectFailed = true;
      this.pausedSong = this.songTime();
      this.state = 'ended';
      this.fadeOut(0.25);
      this.src?.stop((audio.ctx?.currentTime ?? 0) + 0.3);
      this.onPerfectFail?.();
    }
  }

  private finish(now: number) {
    this.pausedSong = now;
    this.state = 'ended';
    this.fadeOut(1.2);
    this.src?.stop((audio.ctx?.currentTime ?? 0) + 1.3);
    this.result = this.judge.result();
    this.onEnd?.(this.result);
  }

  stop() {
    if (this.state === 'playing' || this.state === 'paused') this.pausedSong = this.songTime();
    this.state = 'ended';
    try {
      this.fadeOut(0.15);
      this.src?.stop((audio.ctx?.currentTime ?? 0) + 0.2);
    } catch {
      /* ignore */
    }
    if (audio.ctx && audio.ctx.state !== 'running') void audio.resume();
  }
}

interface LoopInfo {
  chart: Chart;
  buffer: AudioBuffer | null;
  len: number; // 초
}

interface Iter {
  k: number;
  start: number; // 곡 시각
  src: AudioBufferSourceNode | null;
  cues: Cue[];
  markers: Marker[];
}

/** 연습 세션: 단계별로 짧은 루프를 반복, 성공 횟수를 채우면 다음 단계 */
export class PracticeSession extends BaseSession {
  loops: LoopInfo[] = [];
  step = 0;
  successes = 0;
  private iters: Iter[] = [];
  private stepStart = 0;
  private stepComplete = false;
  /** 단계 완료 후, 진행 중인 반복이 끝나는 시각 */
  private stepEndAt: number | null = null;
  private nextId = 100000;
  phase: 'intro' | 'loop' | 'between' | 'done' = 'intro';
  phaseStart = 0;
  feedback: { text: string; color: string; time: number } | null = null;
  onStepDone: ((step: number) => void) | null = null;
  onDone: (() => void) | null = null;
  readonly cues: Cue[];
  readonly markers: Marker[] = [];

  constructor(def: GameDef, opts: { autoplay?: boolean; holding: () => boolean; rate?: number }) {
    super(def, opts.holding);
    this.autoplay = !!opts.autoplay;
    this.rate = opts.rate ?? 1;
    this.cues = this.judge.cues;
    for (let i = 0; i < def.practice.length; i++) {
      const chart = buildPracticeLoop(def, i);
      for (const c of chart.cues) this.kinds.add(c.input);
      this.loops.push({ chart, buffer: null, len: def.practice[i].beats * this.spb });
    }
    this.makeScene(this.cues, this.markers, [], 'practice');
    this.judge.onJudge = (c) => this.countJudge(c);
  }

  async load(): Promise<void> {
    await audio.ensureSfx(this.def.liveSfx);
    for (const l of this.loops) {
      const r = await renderSong(l.chart.notes, audio.bank!, l.chart.lengthSec);
      l.buffer = audio.toBuffer(r);
    }
    this.state = 'ready';
  }

  get barSec(): number {
    return this.spb * (this.def.beatsPerBar ?? 4);
  }

  protected stopSources(when: number) {
    for (const it of this.iters) {
      try {
        it.src?.stop(when);
      } catch {
        /* ignore */
      }
      it.src = null;
    }
  }

  protected restartSources(T0: number) {
    const loop = this.loops[this.step];
    if (!loop?.buffer || !this.songGain) return;
    const P = this.pausedSong;
    for (const it of this.iters) {
      if (it.start + loop.buffer.duration <= P) continue;
      if (it.start <= P) it.src = audio.playBuffer(loop.buffer, T0, this.songGain, false, this.rate, P - it.start);
      else it.src = audio.playBuffer(loop.buffer, this.startCtx + it.start / this.rate, this.songGain, false, this.rate, 0);
    }
  }

  start(delay = 0.12) {
    if (!audio.ctx) return;
    this.startCtx = audio.now() + delay;
    this.songGain = audio.ctx.createGain();
    this.songGain.connect(audio.musicBus);
    this.state = 'playing';
    this.phase = 'intro';
    this.phaseStart = 0;
    // 첫 루프는 1.5마디 뒤(마디 경계)에 시작
    this.beginStep(0, this.alignBar(Math.max(1.6, this.barSec * 1.5)));
  }

  private alignBar(t: number): number {
    return Math.ceil(t / this.barSec - 1e-6) * this.barSec;
  }

  private beginStep(i: number, at: number) {
    this.step = i;
    this.successes = 0;
    this.stepComplete = false;
    this.stepEndAt = null;
    this.stepStart = at;
    this.iters = [];
  }

  private schedule(k: number) {
    const loop = this.loops[this.step];
    const start = this.stepStart + k * loop.len;
    let src: AudioBufferSourceNode | null = null;
    if (loop.buffer && this.songGain && audio.ctx) src = audio.playBuffer(loop.buffer, this.startCtx + start / this.rate, this.songGain, false, this.rate);
    const off = start;
    const shiftData = (data: Record<string, unknown> | undefined) => {
      if (!data) return data;
      const d: Record<string, unknown> = { ...data };
      for (const key of Object.keys(d)) {
        const v = d[key];
        if (typeof v !== 'number') continue;
        if (key.endsWith('Beat')) d[key] = v + off / this.spb;
        else if (key.endsWith('T')) d[key] = v + off;
      }
      return d;
    };
    const cues: Cue[] = loop.chart.cues.map((c) => ({
      ...c,
      id: this.nextId++,
      t: c.t + off,
      beat: c.beat + off / this.spb,
      data: { ...shiftData(c.data), iter: k, step: this.step },
      grade: undefined,
      dt: undefined,
      at: undefined,
      ix: undefined,
    }));
    const markers: Marker[] = loop.chart.markers.map((m) => ({ ...m, t: m.t + off, beat: m.beat + off / this.spb, data: shiftData(m.data) }));
    this.judge.add(cues);
    this.markers.push(...markers);
    this.markers.sort((a, b) => a.t - b.t);
    this.iters.push({ k, start, src, cues, markers });
  }

  private countJudge(c: Cue) {
    if (c.data.step !== this.step) return;
    if (c.grade === 'just') {
      this.successes++;
      this.feedback = { text: '좋아요!', color: '#ffd84a', time: c.at ?? c.t };
      if (this.successes >= this.def.practice[this.step].need) this.stepComplete = true;
    } else if (c.grade === 'barely') {
      const late = (c.dt ?? 0) > 0;
      this.feedback = { text: late ? '조금 늦어요' : '조금 빨라요', color: '#9fe0ff', time: c.at ?? c.t };
    } else {
      this.feedback = { text: '놓쳤어요', color: '#ff9a9a', time: c.t };
    }
  }

  get currentStep() {
    return this.def.practice[this.step];
  }

  update(perf: number) {
    if (this.state !== 'playing') return;
    const now = this.songTime(perf);
    if (this.phase === 'done') return;
    const loop = this.loops[this.step];
    // 곧 시작할 반복 예약
    if (now >= this.stepStart - 3.2) {
      if (this.phase === 'intro' || this.phase === 'between') {
        if (now >= this.stepStart) this.phase = 'loop';
      }
      const ahead = Math.max(1.0, Math.min(loop.len * 0.9, 3));
      const k = Math.max(0, Math.floor((now + ahead - this.stepStart) / loop.len));
      const lastK = this.iters.length ? this.iters[this.iters.length - 1].k : -1;
      if (!this.stepComplete && k > lastK) this.schedule(lastK + 1);
    }
    this.runAuto(now, this.cues);
    const missed = this.judge.expire(now - this.calib);
    for (const c of missed) this.scene.onMiss?.(c);
    if (this.stepComplete) {
      // 지금 진행 중인 반복이 끝나면 다음 단계로
      if (this.stepEndAt === null) {
        const curK = Math.max(0, Math.floor((now - this.stepStart) / loop.len));
        this.stepEndAt = this.stepStart + (curK + 1) * loop.len;
      }
      const endAt = this.stepEndAt;
      // 아직 시작하지 않은 반복은 취소
      for (const it of this.iters) {
        if (it.start >= endAt - 1e-6) {
          try {
            it.src?.stop();
          } catch {
            /* ignore */
          }
          const ids = new Set(it.cues.map((c) => c.id));
          if (ids.size) this.judge.remove((c) => ids.has(c.id));
          if (it.markers.length) {
            const ms = new Set(it.markers);
            const keep = this.markers.filter((m) => !ms.has(m));
            this.markers.length = 0;
            this.markers.push(...keep);
          }
          it.cues = [];
          it.markers = [];
          it.src = null;
        }
      }
      this.iters = this.iters.filter((it) => it.start < endAt - 1e-6);
      if (now >= endAt - 0.02 && !this.judge.pendingBefore(endAt)) {
        this.onStepDone?.(this.step);
        if (this.step + 1 < this.loops.length) {
          this.phase = 'between';
          this.phaseStart = now;
          this.beginStep(this.step + 1, this.alignBar(now + this.barSec * 1.2));
        } else {
          this.phase = 'done';
          this.phaseStart = now;
          this.fadeOut(0.6);
          this.onDone?.();
        }
      }
    }
  }

  skip() {
    this.stop();
  }

  stop() {
    if (this.state === 'playing' || this.state === 'paused') this.pausedSong = this.songTime();
    this.state = 'ended';
    for (const it of this.iters) {
      try {
        it.src?.stop();
      } catch {
        /* ignore */
      }
    }
    this.fadeOut(0.1);
    if (audio.ctx && audio.ctx.state !== 'running') void audio.resume();
  }
}
