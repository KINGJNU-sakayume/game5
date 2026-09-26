// 오디오 엔진: 컨텍스트/잠금해제, 정밀 시계, 사운드 뱅크(오프라인 렌더), 곡 믹싱, 효과음 재생
import { INSTRUMENTS, instLength, makeNoise } from './synth';

export interface NoteEvent {
  t: number; // 초
  inst: string;
  midi: number;
  dur: number; // 초
  vel: number;
  pan: number;
  rev?: number;
}

export function soundKey(inst: string, midi: number, dur: number): string {
  const def = INSTRUMENTS[inst];
  if (!def) throw new Error('unknown instrument: ' + inst);
  return def.oneShot != null ? `${inst}|${midi}` : `${inst}|${midi}|${Math.round(dur * 100)}`;
}

function qdur(inst: string, dur: number): number {
  return INSTRUMENTS[inst].oneShot != null ? 0 : Math.round(dur * 100) / 100;
}

type OfflineCtor = typeof OfflineAudioContext;
function getOfflineCtor(): OfflineCtor {
  const w = globalThis as unknown as { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor };
  const C = w.OfflineAudioContext || w.webkitOfflineAudioContext;
  if (!C) throw new Error('OfflineAudioContext not supported');
  return C;
}

function renderOffline(oac: OfflineAudioContext): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    oac.oncomplete = (e) => resolve(e.renderedBuffer);
    try {
      const p = oac.startRendering() as unknown as Promise<AudioBuffer> | undefined;
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    } catch (err) {
      reject(err);
    }
  });
}

/** 악기 음 하나하나를 미리 렌더링해 두는 샘플 뱅크 */
export class SoundBank {
  readonly sr: number;
  private map = new Map<string, Float32Array>();
  constructor(sr: number) {
    this.sr = sr;
  }
  get(key: string): Float32Array | undefined {
    return this.map.get(key);
  }
  has(key: string) {
    return this.map.has(key);
  }
  get size() {
    return this.map.size;
  }
  retainOnly(keep: (key: string) => boolean) {
    for (const k of [...this.map.keys()]) if (!keep(k)) this.map.delete(k);
  }

  async render(specs: { inst: string; midi: number; dur: number }[]): Promise<void> {
    const todo = new Map<string, { inst: string; midi: number; dur: number; len: number }>();
    for (const s of specs) {
      const dur = qdur(s.inst, s.dur);
      const key = soundKey(s.inst, s.midi, dur);
      if (this.map.has(key) || todo.has(key)) continue;
      todo.set(key, { inst: s.inst, midi: s.midi, dur, len: instLength(s.inst, dur) });
    }
    if (!todo.size) return;
    // 소리마다 작은 오프라인 컨텍스트를 만들어 병렬 렌더 (큰 컨텍스트 하나보다 훨씬 빠름)
    const entries = [...todo.entries()];
    const C = getOfflineCtor();
    const one = async ([key, s]: (typeof entries)[number]) => {
      const n = Math.ceil(s.len * this.sr);
      const oac = new C(1, n, this.sr);
      const nz = noiseFor(oac);
      const g = oac.createGain();
      g.gain.setValueAtTime(1, 0);
      g.gain.setValueAtTime(1, Math.max(0, s.len - 0.006));
      g.gain.linearRampToValueAtTime(0, s.len);
      g.connect(oac.destination);
      INSTRUMENTS[s.inst].build(oac, g, 0.002, s.midi, s.dur, nz);
      const buf = await renderOffline(oac);
      this.map.set(key, buf.getChannelData(0).slice(0));
    };
    const LIMIT = 12;
    let idx = 0;
    const worker = async () => {
      while (idx < entries.length) {
        const e = entries[idx++];
        await one(e);
      }
    };
    await Promise.all(Array.from({ length: Math.min(LIMIT, entries.length) }, worker));
  }
}

/** 컨텍스트마다 노이즈 버퍼를 새로 만들지 않도록 PCM을 공유 */
let noisePCM: Float32Array | null = null;
function noiseFor(ac: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ac.sampleRate * 2);
  if (!noisePCM || noisePCM.length !== len) {
    noisePCM = makeNoise(ac).getChannelData(0).slice(0);
  }
  const b = ac.createBuffer(1, len, ac.sampleRate);
  b.getChannelData(0).set(noisePCM);
  return b;
}

export interface MixResult {
  L: Float32Array;
  R: Float32Array;
  send: Float32Array;
  length: number;
}

/** 노트 목록을 샘플 뱅크로 믹싱 (순수 JS, 샘플 단위로 정확) */
export function mixNotes(notes: NoteEvent[], bank: SoundBank, lengthSec: number): MixResult {
  const sr = bank.sr;
  const length = Math.max(1, Math.ceil(lengthSec * sr));
  const L = new Float32Array(length);
  const R = new Float32Array(length);
  const S = new Float32Array(length);
  for (const n of notes) {
    const def = INSTRUMENTS[n.inst];
    const sample = bank.get(soundKey(n.inst, n.midi, qdur(n.inst, n.dur)));
    if (!sample) continue;
    const g = n.vel * def.gain;
    const p = Math.max(-1, Math.min(1, n.pan));
    const gl = g * Math.cos(((p + 1) * Math.PI) / 4) * Math.SQRT2;
    const gr = g * Math.sin(((p + 1) * Math.PI) / 4) * Math.SQRT2;
    const send = g * (n.rev ?? def.rev ?? 0);
    let s0 = Math.round(n.t * sr);
    let i0 = 0;
    if (s0 < 0) {
      i0 = -s0;
      s0 = 0;
    }
    const cnt = Math.min(sample.length - i0, length - s0);
    if (send > 0) {
      for (let i = 0; i < cnt; i++) {
        const v = sample[i0 + i];
        const j = s0 + i;
        L[j] += v * gl;
        R[j] += v * gr;
        S[j] += v * send;
      }
    } else {
      for (let i = 0; i < cnt; i++) {
        const v = sample[i0 + i];
        const j = s0 + i;
        L[j] += v * gl;
        R[j] += v * gr;
      }
    }
  }
  return { L, R, send: S, length };
}

/** 빠른 알고리즘 리버브 (피드백 딜레이 네트워크, 절반 샘플레이트로 처리) */
export function fdnReverb(send: Float32Array, sr: number, decaySec = 1.5): [Float32Array, Float32Array] | null {
  let peak = 0;
  for (let i = 0; i < send.length; i += 32) peak = Math.max(peak, Math.abs(send[i]));
  if (peak < 1e-5) return null;
  const half = Math.floor(send.length / 2);
  const hsr = sr / 2;
  // 다운샘플 + 저역 제거 (단순 1차 하이패스)
  const x = new Float32Array(half);
  let hpPrev = 0;
  let hpOut = 0;
  const hpA = Math.exp((-2 * Math.PI * 200) / hsr);
  for (let i = 0; i < half; i++) {
    const v = (send[2 * i] + send[2 * i + 1]) * 0.5;
    hpOut = hpA * (hpOut + v - hpPrev);
    hpPrev = v;
    x[i] = hpOut;
  }
  // 확산용 올패스 2개
  const ap = (buf: Float32Array, d: number, gcoef: number) => {
    const line = new Float32Array(d);
    let p = 0;
    for (let i = 0; i < buf.length; i++) {
      const dl = line[p];
      const inp = buf[i] + dl * gcoef;
      buf[i] = dl - inp * gcoef;
      line[p] = inp;
      p = p + 1 === d ? 0 : p + 1;
    }
  };
  ap(x, Math.round(hsr * 0.0051), 0.6);
  ap(x, Math.round(hsr * 0.0137), 0.6);
  const lens = [0.0297, 0.0371, 0.0411, 0.0437].map((s) => Math.round(s * hsr));
  const lines = lens.map((n) => new Float32Array(n));
  const pos = [0, 0, 0, 0];
  const fb = lens.map((n) => Math.pow(10, (-3 * n) / (decaySec * hsr)));
  const lp = [0, 0, 0, 0];
  const damp = 0.35;
  const outL = new Float32Array(half);
  const outR = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    const a = lines[0][pos[0]];
    const b = lines[1][pos[1]];
    const c = lines[2][pos[2]];
    const d = lines[3][pos[3]];
    // 하다마드 믹스
    const h0 = (a + b + c + d) * 0.5;
    const h1 = (a - b + c - d) * 0.5;
    const h2 = (a + b - c - d) * 0.5;
    const h3 = (a - b - c + d) * 0.5;
    const inp = x[i];
    lp[0] += (h0 - lp[0]) * (1 - damp);
    lp[1] += (h1 - lp[1]) * (1 - damp);
    lp[2] += (h2 - lp[2]) * (1 - damp);
    lp[3] += (h3 - lp[3]) * (1 - damp);
    lines[0][pos[0]] = inp + lp[0] * fb[0];
    lines[1][pos[1]] = inp + lp[1] * fb[1];
    lines[2][pos[2]] = inp + lp[2] * fb[2];
    lines[3][pos[3]] = inp + lp[3] * fb[3];
    for (let k = 0; k < 4; k++) pos[k] = pos[k] + 1 === lens[k] ? 0 : pos[k] + 1;
    outL[i] = (a + c) * 0.5;
    outR[i] = (b + d) * 0.5;
  }
  // 업샘플 (선형 보간)
  const L = new Float32Array(send.length);
  const R = new Float32Array(send.length);
  for (let i = 0; i < half - 1; i++) {
    L[2 * i] = outL[i];
    R[2 * i] = outR[i];
    L[2 * i + 1] = (outL[i] + outL[i + 1]) * 0.5;
    R[2 * i + 1] = (outR[i] + outR[i + 1]) * 0.5;
  }
  return [L, R];
}

/** 마스터 레벨 (곡과 실시간 효과음 모두 동일하게 적용) */
export const MASTER = 0.5;
/** 곡 음량 목표: 150Hz 이상 대역의 RMS */
const TARGET_MID_RMS = 0.085;
/** 전체 대역 RMS 상한 (과한 증폭으로 찌그러지지 않게) */
const MAX_FULL_RMS = 0.16;

/** 2차 하이패스 (제자리) */
export function highpass(x: Float32Array, sr: number, f: number) {
  const w = (2 * Math.PI * f) / sr;
  const cw = Math.cos(w);
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha;
  const b0 = (1 + cw) / 2 / a0;
  const b1 = -(1 + cw) / a0;
  const b2 = b0;
  const a1 = (-2 * cw) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    x[i] = y0;
  }
}

/** 저역을 뺀 체감 음량 (150Hz 1차 하이패스 후 RMS) */
function weightedRms(L: Float32Array, R: Float32Array, sr: number): number {
  const a = Math.exp((-2 * Math.PI * 150) / sr);
  let pl = 0;
  let ol = 0;
  let pr = 0;
  let or = 0;
  let sum = 0;
  for (let i = 0; i < L.length; i++) {
    ol = a * (ol + L[i] - pl);
    pl = L[i];
    or = a * (or + R[i] - pr);
    pr = R[i];
    sum += ol * ol + or * or;
  }
  return Math.sqrt(sum / (2 * L.length));
}

function softClip(x: number): number {
  const a = x < 0 ? -x : x;
  if (a < 0.72) return x;
  const y = 0.72 + 0.27 * Math.tanh((a - 0.72) / 0.27);
  return x < 0 ? -y : y;
}

export interface RenderedSong {
  L: Float32Array;
  R: Float32Array;
  length: number;
  sr: number;
}

/** 곡 전체를 스테레오 PCM으로 렌더 */
export async function renderSong(notes: NoteEvent[], bank: SoundBank, lengthSec: number, wet = 0.45): Promise<RenderedSong> {
  await bank.render(notes.map((n) => ({ inst: n.inst, midi: n.midi, dur: n.dur })));
  const mix = mixNotes(notes, bank, lengthSec);
  const rv = fdnReverb(mix.send, bank.sr);
  const { L, R } = mix;
  if (rv) {
    const [rl, rr] = rv;
    for (let i = 0; i < mix.length; i++) {
      L[i] += rl[i] * wet;
      R[i] += rr[i] * wet;
    }
  }
  // 초저역 럼블 제거 (40Hz 하이패스, 2차)
  highpass(L, bank.sr, 40);
  highpass(R, bank.sr, 40);
  // 곡마다 체감 음량을 비슷하게: 휴대폰 스피커처럼 저역을 뺀(150Hz 하이패스) 음량을 기준으로 맞춤
  const mid = (L.length > 0 ? weightedRms(L, R, bank.sr) : 0) * MASTER;
  let full = 0;
  let n = 0;
  for (let i = 0; i < mix.length; i += 4) {
    full += L[i] * L[i] + R[i] * R[i];
    n += 2;
  }
  const fullRms = Math.sqrt(full / Math.max(1, n)) * MASTER;
  let norm = mid > 1e-4 ? TARGET_MID_RMS / mid : 1;
  norm = Math.max(0.6, Math.min(2.0, norm));
  if (fullRms * norm > MAX_FULL_RMS) norm = MAX_FULL_RMS / fullRms;
  const k = MASTER * norm;
  for (let i = 0; i < mix.length; i++) {
    L[i] = softClip(L[i] * k);
    R[i] = softClip(R[i] * k);
  }
  return { L, R, length: mix.length, sr: bank.sr };
}

// ---------------------------------------------------------------- 실시간 엔진

const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export class AudioEngine {
  ctx: AudioContext | null = null;
  bank: SoundBank | null = null;
  private master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  private sfxBuffers = new Map<string, AudioBuffer>();
  private samples: { p: number; d: number }[] = [];
  private delta = 0;
  private haveDelta = false;
  private htmlAudio: HTMLAudioElement | null = null;
  onStateChange: ((state: string) => void) | null = null;
  musicVolume = 0.8;
  sfxVolume = 0.9;

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  get sampleRate() {
    return this.ctx ? this.ctx.sampleRate : 48000;
  }

  /** 반드시 사용자 제스처 핸들러 안에서 호출 */
  unlock(): void {
    // iOS: 무음 스위치가 켜져 있어도 소리가 나도록 재생 세션으로 전환
    const nav = navigator as unknown as { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* ignore */
    }
    if (!this.ctx) {
      const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const C = W.AudioContext || W.webkitAudioContext;
      if (!C) return;
      this.ctx = new C({ latencyHint: 'interactive' });
      this.bank = new SoundBank(this.ctx.sampleRate);
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.applyVolumes();
      this.ctx.onstatechange = () => {
        this.samples.length = 0;
        this.haveDelta = false;
        this.onStateChange?.(this.ctx!.state);
      };
      if (!nav.audioSession) {
        // 구형 iOS용: <audio> 재생으로 오디오 세션을 playback으로 전환
        try {
          const a = new Audio(SILENT_WAV);
          a.loop = true;
          a.setAttribute('playsinline', '');
          a.volume = 0.01;
          void a.play().catch(() => undefined);
          this.htmlAudio = a;
        } catch {
          /* ignore */
        }
      }
    }
    const ctx = this.ctx;
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    // 빈 버퍼를 재생해 iOS 오디오를 깨움
    try {
      const b = ctx.createBuffer(1, 1, ctx.sampleRate);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch {
      /* ignore */
    }
    if (this.htmlAudio && this.htmlAudio.paused) void this.htmlAudio.play().catch(() => undefined);
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.musicBus.gain.value = this.musicVolume;
    this.sfxBus.gain.value = this.sfxVolume;
  }

  suspend(): Promise<void> {
    this.samples.length = 0;
    this.haveDelta = false;
    return this.ctx ? this.ctx.suspend().catch(() => undefined) : Promise.resolve();
  }

  resume(): Promise<void> {
    this.samples.length = 0;
    this.haveDelta = false;
    return this.ctx ? this.ctx.resume().catch(() => undefined) : Promise.resolve();
  }

  // ------------------------------------------------ 시계
  /** 매 프레임 호출: 오디오 시계와 performance 시계의 관계를 추정 */
  sampleClock(perfMs = performance.now()) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const d = ctx.currentTime - perfMs / 1000;
    const s = this.samples;
    // 급격한 변화(재개/중단)는 초기화
    if (this.haveDelta && Math.abs(d - this.delta) > 0.25) s.length = 0;
    s.push({ p: perfMs, d });
    while (s.length && perfMs - s[0].p > 1000) s.shift();
    // currentTime은 버퍼 단위로 계단식으로 증가 → 최근 창의 최댓값이 연속 시간에 가장 가까움
    let m = -Infinity;
    for (const x of s) if (x.d > m) m = x.d;
    this.delta = m;
    this.haveDelta = true;
  }

  /** performance 시각(ms) → 오디오 컨텍스트 시각(초) */
  ctxTimeAt(perfMs: number): number {
    if (!this.ctx) return perfMs / 1000;
    if (!this.haveDelta) this.sampleClock(perfMs);
    if (!this.haveDelta) return this.ctx.currentTime;
    return perfMs / 1000 + this.delta;
  }

  /** 출력 지연 (스피커로 실제 들리기까지) */
  latency(): number {
    const c = this.ctx as (AudioContext & { outputLatency?: number }) | null;
    if (!c) return 0;
    const v = (typeof c.outputLatency === 'number' && c.outputLatency > 0 ? c.outputLatency : c.baseLatency) || 0;
    return Math.max(0, Math.min(0.25, v));
  }

  /** 해당 순간에 '들리고 있는' 컨텍스트 시각 */
  heardTime(perfMs: number): number {
    return this.ctxTimeAt(perfMs) - this.latency();
  }

  now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ------------------------------------------------ 버퍼/효과음
  toBuffer(r: RenderedSong): AudioBuffer {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(2, r.length, r.sr);
    b.getChannelData(0).set(r.L);
    b.getChannelData(1).set(r.R);
    return b;
  }

  playBuffer(buf: AudioBuffer, when: number, bus: AudioNode = this.musicBus, loop = false, rate = 1, offset = 0): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = loop;
    s.playbackRate.value = rate;
    s.connect(bus);
    s.start(Math.max(when, ctx.currentTime), Math.max(0, Math.min(offset, buf.duration)));
    return s;
  }

  /** 실시간 효과음 준비 */
  async ensureSfx(list: [string, number][]): Promise<void> {
    if (!this.ctx || !this.bank) return;
    const need = list.filter(([n, m]) => !this.sfxBuffers.has(soundKey(n, m, 0)));
    if (!need.length) return;
    await this.bank.render(need.map(([inst, midi]) => ({ inst, midi, dur: 0.2 })));
    for (const [n, m] of need) {
      const key = soundKey(n, m, INSTRUMENTS[n].oneShot != null ? 0 : 0.2);
      const data = this.bank.get(key);
      if (!data) continue;
      const def = INSTRUMENTS[n];
      const b = this.ctx.createBuffer(1, data.length, this.bank.sr);
      const ch = b.getChannelData(0);
      for (let i = 0; i < data.length; i++) ch[i] = data[i] * def.gain * MASTER;
      this.sfxBuffers.set(soundKey(n, m, 0), b);
    }
  }

  sfx(name: string, midi = 0, vel = 1, when = 0, pan = 0): SfxHandle | null {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return null;
    const b = this.sfxBuffers.get(soundKey(name, midi, 0));
    if (!b) return null;
    const s = ctx.createBufferSource();
    s.buffer = b;
    const g = ctx.createGain();
    g.gain.value = vel;
    s.connect(g);
    let node: AudioNode = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node.connect(p);
      node = p;
    }
    node.connect(this.sfxBus);
    s.start(Math.max(when, ctx.currentTime));
    return {
      stop(fade = 0.03) {
        try {
          const now = ctx.currentTime;
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(g.gain.value, now);
          g.gain.linearRampToValueAtTime(0, now + fade);
          s.stop(now + fade + 0.01);
        } catch {
          /* ignore */
        }
      },
    };
  }
}

export interface SfxHandle {
  stop(fade?: number): void;
}

export const audio = new AudioEngine();
