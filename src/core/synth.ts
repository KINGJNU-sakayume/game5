// 모든 소리는 Web Audio 노드로 합성합니다 (저작권 음원 없음).
// 각 악기/효과음은 OfflineAudioContext에서 한 번씩만 렌더링되어 샘플처럼 재사용됩니다.

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export type Ctx = BaseAudioContext;

export interface InstDef {
  /** 믹스 게인 */
  gain: number;
  /** 리버브 센드 기본값 (0..1) */
  rev?: number;
  /** 고정 길이 원샷(드럼/효과음) — 초 */
  oneShot?: number;
  /** 음 길이 뒤 여운 (초) */
  release?: number;
  build(ac: Ctx, out: AudioNode, t: number, midi: number, dur: number, nz: AudioBuffer): void;
}

// ---------------------------------------------------------------- 헬퍼

export function makeNoise(ac: Ctx, seconds = 2): AudioBuffer {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < len; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x3fffffff) - 1;
  }
  return buf;
}

function osc(ac: Ctx, type: OscillatorType, f: number, t: number, end: number, detune = 0): OscillatorNode {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  o.start(t);
  o.stop(end);
  return o;
}

function noise(ac: Ctx, nz: AudioBuffer, t: number, end: number, offset = 0): AudioBufferSourceNode {
  const s = ac.createBufferSource();
  s.buffer = nz;
  s.loop = true;
  s.start(t, offset % (nz.duration - 0.01));
  s.stop(end);
  return s;
}

function gain(ac: Ctx, v = 1): GainNode {
  const g = ac.createGain();
  g.gain.value = v;
  return g;
}

function filt(ac: Ctx, type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
  const b = ac.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

/** 퍼커시브 엔벨로프: 즉시 peak → 지수 감쇠 */
function perc(p: AudioParam, t: number, peak: number, decay: number, attack = 0.002) {
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setTargetAtTime(0.0001, t + attack, decay / 4);
}

/** ADSR (지속음) */
function adsr(p: AudioParam, t: number, dur: number, a: number, d: number, s: number, r: number, peak = 1) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setTargetAtTime(peak * s, t + a, Math.max(0.001, d / 3));
  const end = t + Math.max(dur, a);
  p.setTargetAtTime(0, end, Math.max(0.001, r / 4));
}

function chain(...nodes: AudioNode[]): AudioNode {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

const pulseCache = new WeakMap<Ctx, Map<number, PeriodicWave>>();
function pulseWave(ac: Ctx, duty: number): PeriodicWave {
  let m = pulseCache.get(ac);
  if (!m) {
    m = new Map();
    pulseCache.set(ac, m);
  }
  const key = Math.round(duty * 1000);
  let w = m.get(key);
  if (!w) {
    const n = 48;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      re[k] = 0;
    }
    w = ac.createPeriodicWave(re, im, { disableNormalization: false });
    m.set(key, w);
  }
  return w;
}

/** 모음 포먼트 (F1, F2, F3) */
const VOWELS: Record<string, [number, number, number]> = {
  a: [800, 1200, 2800],
  e: [480, 1850, 2600],
  i: [300, 2300, 3000],
  o: [480, 820, 2700],
  u: [340, 720, 2400],
  eo: [600, 1000, 2600],
};

/** 간단한 포먼트 음성 (귀여운 추임새용) */
function vox(
  ac: Ctx,
  out: AudioNode,
  t: number,
  f0: number,
  f1: number,
  vowels: string[],
  dur: number,
  opts: { vol?: number } = {},
) {
  const end = t + dur + 0.08;
  const src = ac.createOscillator();
  src.type = 'sawtooth';
  src.frequency.setValueAtTime(f0, t);
  src.frequency.exponentialRampToValueAtTime(f1, t + dur);
  src.start(t);
  src.stop(end);
  const amp = gain(ac, 0);
  const vol = opts.vol ?? 1;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(vol, t + 0.02);
  amp.gain.setValueAtTime(vol, t + dur * 0.7);
  amp.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(amp);
  const mix = gain(ac, 1);
  const seg = dur / vowels.length;
  const gains = [1, 0.55, 0.25];
  for (let fi = 0; fi < 3; fi++) {
    const bp = filt(ac, 'bandpass', VOWELS[vowels[0]][fi], 9 - fi * 2);
    vowels.forEach((v, vi) => {
      const ft = t + vi * seg;
      if (vi === 0) bp.frequency.setValueAtTime(VOWELS[v][fi], ft);
      else {
        bp.frequency.setValueAtTime(VOWELS[vowels[vi - 1]][fi], ft);
        bp.frequency.linearRampToValueAtTime(VOWELS[v][fi], ft + seg * 0.4);
      }
    });
    const g = gain(ac, gains[fi] * 3);
    amp.connect(bp);
    bp.connect(g);
    g.connect(mix);
  }
  mix.connect(out);
}

function voxNoise(ac: Ctx, out: AudioNode, nz: AudioBuffer, t: number, f: number, len: number, vol: number) {
  const n = noise(ac, nz, t, t + len + 0.02, t * 7.3);
  const bp = filt(ac, 'bandpass', f, 1.2);
  const g = gain(ac, 0);
  perc(g.gain, t, vol, len);
  chain(n, bp, g, out);
}

// ---------------------------------------------------------------- 톤 악기

const TONAL: Record<string, InstDef> = {
  // 통통 튀는 플럭 베이스
  bass: {
    gain: 0.55,
    release: 0.08,
    rev: 0.02,
    build(ac, out, t, m, dur) {
      const f = mtof(m);
      const end = t + dur + 0.12;
      const o1 = osc(ac, 'sawtooth', f, t, end);
      const o2 = osc(ac, 'square', f / 2, t, end);
      const g2 = gain(ac, 0.35);
      o2.connect(g2);
      const lp = filt(ac, 'lowpass', 1800, 3.5);
      lp.frequency.setValueAtTime(2400, t);
      lp.frequency.setTargetAtTime(320, t, 0.06);
      const a = gain(ac, 0);
      adsr(a.gain, t, dur, 0.004, 0.25, 0.65, 0.07, 0.9);
      o1.connect(lp);
      g2.connect(lp);
      chain(lp, a, out);
    },
  },
  // 둥근 베이스 (부드러운 곡)
  bassSoft: {
    gain: 0.7,
    release: 0.1,
    build(ac, out, t, m, dur) {
      const f = mtof(m);
      const end = t + dur + 0.15;
      const o1 = osc(ac, 'triangle', f, t, end);
      const o2 = osc(ac, 'sine', f, t, end);
      const lp = filt(ac, 'lowpass', 900, 0.8);
      const a = gain(ac, 0);
      adsr(a.gain, t, dur, 0.01, 0.3, 0.75, 0.09, 0.8);
      o1.connect(lp);
      o2.connect(lp);
      chain(lp, a, out);
    },
  },
  // 칩튠 느낌 리드 (25% 펄스 + 비브라토)
  lead: {
    gain: 0.2,
    release: 0.1,
    rev: 0.22,
    build(ac, out, t, m, dur) {
      const f = mtof(m);
      const end = t + dur + 0.15;
      const o = ac.createOscillator();
      o.setPeriodicWave(pulseWave(ac, 0.25));
      o.frequency.setValueAtTime(f, t);
      o.start(t);
      o.stop(end);
      const lfo = osc(ac, 'sine', 5.6, t, end);
      const lg = gain(ac, 0);
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.35, dur));
      chain(lfo, lg);
      lg.connect(o.frequency);
      const lp = filt(ac, 'lowpass', 4200, 0.7);
      const a = gain(ac, 0);
      adsr(a.gain, t, dur, 0.008, 0.2, 0.75, 0.09, 1);
      chain(o, lp, a, out);
    },
  },
  // 네모파 칩 (아르페지오)
  chip: {
    gain: 0.12,
    release: 0.04,
    rev: 0.15,
    build(ac, out, t, m, dur) {
      const f = mtof(m);
      const end = t + dur + 0.06;
      const o = ac.createOscillator();
      o.setPeriodicWave(pulseWave(ac, 0.125));
      o.frequency.setValueAtTime(f, t);
      o.start(t);
      o.stop(end);
      const a = gain(ac, 0);
      adsr(a.gain, t, dur, 0.003, 0.08, 0.6, 0.03, 1);
      chain(o, a, out);
    },
  },
  // 휘파람/플루트
  flute: {
    gain: 0.34,
    release: 0.12,
    rev: 0.3,
    build(ac, out, t, m, dur, nz) {
      const f = mtof(m);
      const end = t + dur + 0.2;
      const o = osc(ac, 'sine', f, t, end);
      const o2 = osc(ac, 'triangle', f * 2, t, end);
      const g2 = gain(ac, 0.08);
      o2.connect(g2);
      const lfo = osc(ac, 'sine', 5.2, t, end);
      const lg = gain(ac, 0);
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.008, t + Math.min(0.4, dur));
      chain(lfo, lg);
      lg.connect(o.frequency);
      const n = noise(ac, nz, t, end, m * 0.37);
      const bp = filt(ac, 'bandpass', f * 2, 2);
      const ng = gain(ac, 0.05);
      chain(n, bp, ng);
      const a = gain(ac, 0);
      adsr(a.gain, t, dur, 0.04, 0.2, 0.85, 0.12, 1);
      o.connect(a);
      g2.connect(a);
      ng.connect(a);
      a.connect(out);
    },
  },
  // FM 일렉트릭 피아노
  ep: {
    gain: 0.3,
    release: 0.5,
    rev: 0.2,
    build(ac, out, t, m, dur) {
      const f = mtof(m);
      const end = t + dur + 0.6;
      const car = osc(ac, 'sine', f, t, end);
      const mod = osc(ac, 'sine', f, t, end);
      const idx = gain(ac, 0);
      idx.gain.setValueAtTime(f * 2.2, t);
      idx.gain.setTargetAtTime(f * 0.4, t, 0.15);
      chain(mod, idx);
      idx.connect(car.frequency);
      const tine = osc(ac, 'sine', f * 4, t, end);
      const tg = gain(ac, 0);
      perc(tg.gain, t, 0.12, 0.25);
      tine.connect(tg);
      const a = gain(ac, 0);
      a.gain.setValueAtTime(0, t);
      a.gain.linearRampToValueAtTime(0.9, t + 0.004);
      a.gain.setTargetAtTime(0.35, t + 0.004, 0.4);
      a.gain.setTargetAtTime(0, t + dur, 0.12);
      car.connect(a);
      tg.connect(a);
      a.connect(out);
    },
  },
  // 벨/글로켄 (오르골)
  bell: {
    gain: 0.22,
    release: 1.2,
    rev: 0.35,
    build(ac, out, t, m, dur) {
      const f = mtof(m);
      const end = t + dur + 1.4;
      const car = osc(ac, 'sine', f, t, end);
      const mod = osc(ac, 'sine', f * 3.5, t, end);
      const idx = gain(ac, 0);
      idx.gain.setValueAtTime(f * 1.6, t);
      idx.gain.setTargetAtTime(0, t, 0.25);
      chain(mod, idx);
      idx.connect(car.frequency);
      const a = gain(ac, 0);
      perc(a.gain, t, 0.9, 1.3, 0.002);
      car.connect(a);
      a.connect(out);
    },
  },
  // 마림바
  marimba: {
    gain: 0.42,
    release: 0.35,
    rev: 0.18,
    build(ac, out, t, m) {
      const f = mtof(m);
      const end = t + 0.6;
      const o = osc(ac, 'sine', f, t, end);
      const o2 = osc(ac, 'sine', f * 4, t, end);
      const a = gain(ac, 0);
      perc(a.gain, t, 0.9, 0.45);
      const a2 = gain(ac, 0);
      perc(a2.gain, t, 0.25, 0.06);
      o.connect(a);
      o2.connect(a2);
      a.connect(out);
      a2.connect(out);
    },
  },
  // 패드 (디튠 톱니파)
  pad: {
    gain: 0.075,
    release: 0.45,
    rev: 0.45,
    build(ac, out, t, m, dur) {
      const f = mtof(m);
      const end = t + dur + 0.6;
      const lp = filt(ac, 'lowpass', 1500, 0.4);
      for (const d of [-9, 0, 9]) {
        const o = osc(ac, 'sawtooth', f, t, end, d);
        o.connect(lp);
      }
      const a = gain(ac, 0);
      adsr(a.gain, t, dur, 0.18, 0.4, 0.8, 0.45, 1);
      chain(lp, a, out);
    },
  },
  // 현악기 느낌
  strings: {
    gain: 0.07,
    release: 0.35,
    rev: 0.5,
    build(ac, out, t, m, dur) {
      const f = mtof(m);
      const end = t + dur + 0.5;
      const lp = filt(ac, 'lowpass', 2600, 0.5);
      const lfo = osc(ac, 'sine', 5.5, t, end);
      const lg = gain(ac, f * 0.004);
      lfo.connect(lg);
      for (const d of [-7, 3, 11]) {
        const o = osc(ac, 'sawtooth', f, t, end, d);
        lg.connect(o.frequency);
        o.connect(lp);
      }
      const a = gain(ac, 0);
      adsr(a.gain, t, dur, 0.1, 0.3, 0.85, 0.3, 1);
      chain(lp, a, out);
    },
  },
  // 브라스 스탭
  brass: {
    gain: 0.16,
    release: 0.12,
    rev: 0.2,
    build(ac, out, t, m, dur) {
      const f = mtof(m);
      const end = t + dur + 0.2;
      const lp = filt(ac, 'lowpass', 500, 1.2);
      lp.frequency.setValueAtTime(500, t);
      lp.frequency.linearRampToValueAtTime(3200, t + 0.05);
      lp.frequency.setTargetAtTime(1600, t + 0.05, 0.15);
      for (const d of [-6, 6]) {
        const o = osc(ac, 'sawtooth', f, t, end, d);
        o.connect(lp);
      }
      const a = gain(ac, 0);
      adsr(a.gain, t, dur, 0.025, 0.2, 0.75, 0.1, 1);
      chain(lp, a, out);
    },
  },
  // 오르간
  organ: {
    gain: 0.1,
    release: 0.06,
    rev: 0.25,
    build(ac, out, t, m, dur) {
      const f = mtof(m);
      const end = t + dur + 0.1;
      const a = gain(ac, 0);
      adsr(a.gain, t, dur, 0.01, 0.05, 1, 0.05, 1);
      const lfo = osc(ac, 'sine', 6.3, t, end);
      const lg = gain(ac, f * 0.003);
      lfo.connect(lg);
      [1, 2, 3, 4, 6].forEach((h, i) => {
        const o = osc(ac, 'sine', f * h, t, end);
        lg.connect(o.frequency);
        const g = gain(ac, [0.8, 0.6, 0.35, 0.25, 0.12][i]);
        chain(o, g, a);
      });
      a.connect(out);
    },
  },
  // 뜯는 현 (샤미센/거문고 느낌)
  pluck: {
    gain: 0.3,
    release: 0.4,
    rev: 0.25,
    build(ac, out, t, m, dur) {
      const f = mtof(m);
      const end = t + Math.max(dur, 0.2) + 0.5;
      const o = osc(ac, 'sawtooth', f * 1.02, t, end);
      o.frequency.setTargetAtTime(f, t, 0.01);
      const o2 = osc(ac, 'square', f, t, end);
      const g2 = gain(ac, 0.3);
      o2.connect(g2);
      const lp = filt(ac, 'lowpass', 5000, 2);
      lp.frequency.setValueAtTime(6000, t);
      lp.frequency.setTargetAtTime(700, t, 0.07);
      const a = gain(ac, 0);
      perc(a.gain, t, 0.9, 0.55);
      o.connect(lp);
      g2.connect(lp);
      chain(lp, a, out);
    },
  },
  // 서브/808
  sub: {
    gain: 0.6,
    release: 0.12,
    build(ac, out, t, m, dur) {
      const f = mtof(m);
      const end = t + dur + 0.2;
      const o = osc(ac, 'sine', f * 1.5, t, end);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      const a = gain(ac, 0);
      adsr(a.gain, t, dur, 0.004, 0.4, 0.7, 0.1, 1);
      chain(o, a, out);
    },
  },
  // 아- 코러스
  choir: {
    gain: 0.09,
    release: 0.35,
    rev: 0.5,
    build(ac, out, t, m, dur) {
      const f = mtof(m);
      const end = t + dur + 0.5;
      const src = gain(ac, 1);
      for (const d of [-8, 0, 8]) {
        const o = osc(ac, 'sawtooth', f, t, end, d);
        o.connect(src);
      }
      const a = gain(ac, 0);
      adsr(a.gain, t, dur, 0.12, 0.3, 0.85, 0.3, 1);
      const [f1, f2, f3] = VOWELS.a;
      [f1, f2, f3].forEach((ff, i) => {
        const bp = filt(ac, 'bandpass', ff, 6);
        const g = gain(ac, [2.2, 1.2, 0.5][i]);
        chain(src, bp, g, a);
      });
      a.connect(out);
    },
  },
};

// ---------------------------------------------------------------- 드럼 (midi 값은 무시)

const DRUMS: Record<string, InstDef> = {
  kick: {
    gain: 0.95,
    oneShot: 0.45,
    build(ac, out, t, _m, _d, nz) {
      const o = osc(ac, 'sine', 150, t, t + 0.45);
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
      const a = gain(ac, 0);
      perc(a.gain, t, 1, 0.38, 0.001);
      chain(o, a, out);
      const n = noise(ac, nz, t, t + 0.02);
      const hp = filt(ac, 'highpass', 2500);
      const ng = gain(ac, 0);
      perc(ng.gain, t, 0.35, 0.012);
      chain(n, hp, ng, out);
    },
  },
  snare: {
    gain: 0.5,
    oneShot: 0.3,
    rev: 0.12,
    build(ac, out, t, _m, _d, nz) {
      const n = noise(ac, nz, t, t + 0.3, 0.3);
      const bp = filt(ac, 'bandpass', 1900, 0.6);
      const ng = gain(ac, 0);
      perc(ng.gain, t, 0.9, 0.17);
      chain(n, bp, ng, out);
      const o = osc(ac, 'triangle', 200, t, t + 0.2);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      const og = gain(ac, 0);
      perc(og.gain, t, 0.6, 0.09);
      chain(o, og, out);
    },
  },
  clap: {
    gain: 0.45,
    oneShot: 0.35,
    rev: 0.2,
    build(ac, out, t, _m, _d, nz) {
      const n = noise(ac, nz, t, t + 0.35, 0.7);
      const bp = filt(ac, 'bandpass', 1150, 1.1);
      const g = gain(ac, 0);
      const p = g.gain;
      p.setValueAtTime(0, t);
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.011;
        p.setValueAtTime(0.9, tt);
        p.setTargetAtTime(0.05, tt, 0.004);
      }
      p.setValueAtTime(0.8, t + 0.034);
      p.setTargetAtTime(0.0001, t + 0.034, 0.05);
      chain(n, bp, g, out);
    },
  },
  hat: {
    gain: 0.22,
    oneShot: 0.08,
    build(ac, out, t, _m, _d, nz) {
      const n = noise(ac, nz, t, t + 0.08, 1.1);
      const hp = filt(ac, 'highpass', 7500);
      const g = gain(ac, 0);
      perc(g.gain, t, 0.8, 0.035);
      chain(n, hp, g, out);
    },
  },
  ohat: {
    gain: 0.2,
    oneShot: 0.4,
    build(ac, out, t, _m, _d, nz) {
      const n = noise(ac, nz, t, t + 0.4, 1.5);
      const hp = filt(ac, 'highpass', 6500);
      const g = gain(ac, 0);
      perc(g.gain, t, 0.7, 0.28);
      chain(n, hp, g, out);
    },
  },
  crash: {
    gain: 0.24,
    oneShot: 1.6,
    rev: 0.2,
    build(ac, out, t, _m, _d, nz) {
      const n = noise(ac, nz, t, t + 1.6, 0.2);
      const hp = filt(ac, 'highpass', 4200);
      const g = gain(ac, 0);
      perc(g.gain, t, 0.9, 1.3);
      chain(n, hp, g, out);
    },
  },
  shaker: {
    gain: 0.16,
    oneShot: 0.1,
    build(ac, out, t, _m, _d, nz) {
      const n = noise(ac, nz, t, t + 0.1, 0.9);
      const bp = filt(ac, 'bandpass', 6500, 1.5);
      const g = gain(ac, 0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.9, t + 0.015);
      g.gain.setTargetAtTime(0.0001, t + 0.015, 0.02);
      chain(n, bp, g, out);
    },
  },
  tamb: {
    gain: 0.2,
    oneShot: 0.3,
    build(ac, out, t, _m, _d, nz) {
      const n = noise(ac, nz, t, t + 0.3, 1.9);
      const hp = filt(ac, 'bandpass', 8000, 2);
      const g = gain(ac, 0);
      perc(g.gain, t, 0.9, 0.2);
      chain(n, hp, g, out);
      for (const f of [5200, 6700, 8100]) {
        const o = osc(ac, 'sine', f, t, t + 0.3);
        const og = gain(ac, 0);
        perc(og.gain, t, 0.08, 0.15);
        chain(o, og, out);
      }
    },
  },
  tomL: {
    gain: 0.6,
    oneShot: 0.4,
    rev: 0.1,
    build(ac, out, t) {
      const o = osc(ac, 'sine', 140, t, t + 0.4);
      o.frequency.exponentialRampToValueAtTime(85, t + 0.3);
      const a = gain(ac, 0);
      perc(a.gain, t, 1, 0.32);
      chain(o, a, out);
    },
  },
  tomH: {
    gain: 0.55,
    oneShot: 0.35,
    rev: 0.1,
    build(ac, out, t) {
      const o = osc(ac, 'sine', 210, t, t + 0.35);
      o.frequency.exponentialRampToValueAtTime(140, t + 0.25);
      const a = gain(ac, 0);
      perc(a.gain, t, 1, 0.26);
      chain(o, a, out);
    },
  },
  rim: {
    gain: 0.35,
    oneShot: 0.1,
    build(ac, out, t, _m, _d, nz) {
      const o = osc(ac, 'triangle', 1700, t, t + 0.1);
      const a = gain(ac, 0);
      perc(a.gain, t, 0.8, 0.03);
      chain(o, a, out);
      const n = noise(ac, nz, t, t + 0.05, 0.4);
      const bp = filt(ac, 'bandpass', 3500, 2);
      const ng = gain(ac, 0);
      perc(ng.gain, t, 0.5, 0.02);
      chain(n, bp, ng, out);
    },
  },
  block: {
    gain: 0.42,
    oneShot: 0.15,
    rev: 0.1,
    build(ac, out, t, m) {
      const f = m > 0 ? mtof(m) : 1050;
      const o = osc(ac, 'sine', f, t, t + 0.15);
      const o2 = osc(ac, 'sine', f * 2.7, t, t + 0.15);
      const a = gain(ac, 0);
      perc(a.gain, t, 1, 0.07);
      const a2 = gain(ac, 0);
      perc(a2.gain, t, 0.3, 0.02);
      chain(o, a, out);
      chain(o2, a2, out);
    },
  },
  cowbell: {
    gain: 0.2,
    oneShot: 0.3,
    rev: 0.1,
    build(ac, out, t) {
      const bp = filt(ac, 'bandpass', 800, 1.5);
      for (const f of [587, 845]) {
        const o = osc(ac, 'square', f, t, t + 0.3);
        o.connect(bp);
      }
      const a = gain(ac, 0);
      perc(a.gain, t, 0.9, 0.22);
      chain(bp, a, out);
    },
  },
  snap: {
    gain: 0.35,
    oneShot: 0.12,
    rev: 0.25,
    build(ac, out, t, _m, _d, nz) {
      const n = noise(ac, nz, t, t + 0.12, 0.55);
      const bp = filt(ac, 'bandpass', 2600, 3);
      const g = gain(ac, 0);
      perc(g.gain, t, 1, 0.04);
      chain(n, bp, g, out);
    },
  },
  taiko: {
    gain: 0.8,
    oneShot: 0.7,
    rev: 0.2,
    build(ac, out, t, _m, _d, nz) {
      const o = osc(ac, 'sine', 110, t, t + 0.7);
      o.frequency.exponentialRampToValueAtTime(62, t + 0.25);
      const a = gain(ac, 0);
      perc(a.gain, t, 1, 0.55);
      chain(o, a, out);
      const n = noise(ac, nz, t, t + 0.12, 0.8);
      const lp = filt(ac, 'lowpass', 900);
      const ng = gain(ac, 0);
      perc(ng.gain, t, 0.5, 0.06);
      chain(n, lp, ng, out);
    },
  },
  triangle: {
    gain: 0.12,
    oneShot: 1.2,
    rev: 0.3,
    build(ac, out, t) {
      const o = osc(ac, 'sine', 4200, t, t + 1.2);
      const o2 = osc(ac, 'sine', 6300, t, t + 1.2);
      const a = gain(ac, 0);
      perc(a.gain, t, 0.8, 1.0);
      o.connect(a);
      const g2 = gain(ac, 0.4);
      chain(o2, g2, a);
      a.connect(out);
    },
  },
};

// ---------------------------------------------------------------- 효과음

function sweep(ac: Ctx, out: AudioNode, type: OscillatorType, t: number, f0: number, f1: number, len: number, vol: number, curve: 'exp' | 'lin' = 'exp') {
  const o = osc(ac, type, f0, t, t + len + 0.05);
  if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + len);
  else o.frequency.linearRampToValueAtTime(f1, t + len);
  const a = gain(ac, 0);
  perc(a.gain, t, vol, len, 0.003);
  chain(o, a, out);
  return o;
}

function noiseHit(ac: Ctx, out: AudioNode, nz: AudioBuffer, t: number, type: BiquadFilterType, f: number, q: number, len: number, vol: number, off = 0) {
  const n = noise(ac, nz, t, t + len * 2 + 0.05, off);
  const b = filt(ac, type, f, q);
  const g = gain(ac, 0);
  perc(g.gain, t, vol, len);
  chain(n, b, g, out);
  return b;
}

const SFX: Record<string, InstDef> = {
  // ---- 공용 UI
  uiSelect: { gain: 0.3, oneShot: 0.12, build: (ac, o, t) => void sweep(ac, o, 'square', t, 880, 1320, 0.06, 0.5) },
  uiConfirm: {
    gain: 0.3,
    oneShot: 0.35,
    rev: 0.2,
    build(ac, o, t) {
      sweep(ac, o, 'square', t, 988, 988, 0.08, 0.5);
      sweep(ac, o, 'square', t + 0.08, 1319, 1319, 0.18, 0.5);
    },
  },
  uiBack: {
    gain: 0.28,
    oneShot: 0.3,
    build(ac, o, t) {
      sweep(ac, o, 'square', t, 784, 784, 0.07, 0.5);
      sweep(ac, o, 'square', t + 0.07, 523, 523, 0.12, 0.5);
    },
  },
  tick: { gain: 0.25, oneShot: 0.06, build: (ac, o, t) => void sweep(ac, o, 'square', t, 1600, 1500, 0.025, 0.4) },
  stamp: {
    gain: 0.9,
    oneShot: 0.5,
    rev: 0.15,
    build(ac, o, t, _m, _d, nz) {
      sweep(ac, o, 'sine', t, 140, 50, 0.3, 1);
      noiseHit(ac, o, nz, t, 'lowpass', 1400, 0.7, 0.08, 0.8);
    },
  },
  fanfare: {
    gain: 0.18,
    oneShot: 2.6,
    rev: 0.35,
    build(ac, out, t) {
      const notes = [
        [0, 72], [0.12, 76], [0.24, 79], [0.36, 84],
      ];
      for (const [dt, m] of notes) TONAL.brass.build(ac, out, t + dt, m, 0.1, null as unknown as AudioBuffer);
      for (const m of [72, 76, 79, 84, 88]) TONAL.brass.build(ac, out, t + 0.52, m, 1.1, null as unknown as AudioBuffer);
      for (const m of [84, 88, 91]) TONAL.bell.build(ac, out, t + 0.52, m + 12, 0.5, null as unknown as AudioBuffer);
    },
  },
  okJingle: {
    gain: 0.3,
    oneShot: 1.6,
    rev: 0.3,
    build(ac, out, t) {
      [72, 76, 79].forEach((m, i) => TONAL.marimba.build(ac, out, t + i * 0.13, m, 0.2, null as unknown as AudioBuffer));
      TONAL.marimba.build(ac, out, t + 0.45, 84, 0.4, null as unknown as AudioBuffer);
    },
  },
  sadJingle: {
    gain: 0.2,
    oneShot: 2.0,
    rev: 0.25,
    build(ac, out, t) {
      [[0, 67], [0.3, 66], [0.6, 65]].forEach(([dt, m]) => TONAL.brass.build(ac, out, t + dt, m, 0.22, null as unknown as AudioBuffer));
      const o = osc(ac, 'sawtooth', mtof(64), t + 0.9, t + 1.9);
      const lfo = osc(ac, 'sine', 6, t + 0.9, t + 1.9);
      const lg = gain(ac, 8);
      chain(lfo, lg);
      lg.connect(o.frequency);
      o.frequency.linearRampToValueAtTime(mtof(62), t + 1.7);
      const lp = filt(ac, 'lowpass', 1200);
      const a = gain(ac, 0);
      adsr(a.gain, t + 0.9, 0.8, 0.03, 0.2, 0.8, 0.2, 0.6);
      chain(o, lp, a, out);
    },
  },
  whoosh: {
    gain: 0.3,
    oneShot: 0.4,
    build(ac, o, t, _m, _d, nz) {
      const b = noiseHit(ac, o, nz, t, 'bandpass', 600, 1.5, 0.25, 0.9, 0.2);
      b.frequency.exponentialRampToValueAtTime(3000, t + 0.22);
    },
  },
  whiff: {
    gain: 0.6,
    oneShot: 0.25,
    build(ac, o, t, _m, _d, nz) {
      const b = noiseHit(ac, o, nz, t, 'bandpass', 900, 2, 0.1, 0.8, 0.4);
      b.frequency.exponentialRampToValueAtTime(2600, t + 0.12);
    },
  },
  bonk: {
    gain: 0.4,
    oneShot: 0.4,
    rev: 0.1,
    build(ac, o, t, _m, _d, nz) {
      sweep(ac, o, 'square', t, 420, 150, 0.18, 0.6);
      sweep(ac, o, 'sine', t, 900, 400, 0.12, 0.5);
      noiseHit(ac, o, nz, t, 'bandpass', 1200, 1, 0.04, 0.5);
    },
  },
  thud: {
    gain: 0.55,
    oneShot: 0.3,
    build(ac, o, t, _m, _d, nz) {
      sweep(ac, o, 'sine', t, 160, 70, 0.15, 1);
      noiseHit(ac, o, nz, t, 'lowpass', 500, 0.7, 0.07, 0.7);
    },
  },
  count: { gain: 0.5, oneShot: 0.15, rev: 0.1, build: (ac, o, t, m, d, nz) => DRUMS.block.build(ac, o, t, m || 84, d, nz) },
  countHi: { gain: 0.5, oneShot: 0.15, rev: 0.1, build: (ac, o, t, _m, d, nz) => DRUMS.block.build(ac, o, t, 91, d, nz) },

  // ---- 촙촙 셰프
  toss: {
    gain: 0.45,
    oneShot: 0.2,
    rev: 0.08,
    build(ac, o, t) {
      sweep(ac, o, 'sine', t, 320, 780, 0.07, 1);
      sweep(ac, o, 'triangle', t, 640, 1400, 0.05, 0.3);
    },
  },
  slideUp: {
    gain: 0.32,
    oneShot: 0.5,
    rev: 0.15,
    build(ac, out, t) {
      const o = osc(ac, 'sine', 700, t, t + 0.5);
      o.frequency.exponentialRampToValueAtTime(1800, t + 0.35);
      const lfo = osc(ac, 'sine', 11, t, t + 0.5);
      const lg = gain(ac, 35);
      chain(lfo, lg);
      lg.connect(o.frequency);
      const a = gain(ac, 0);
      adsr(a.gain, t, 0.33, 0.02, 0.1, 0.9, 0.08, 0.9);
      chain(o, a, out);
    },
  },
  heave: {
    gain: 0.5,
    oneShot: 0.6,
    rev: 0.12,
    build(ac, o, t, _m, _d, nz) {
      vox(ac, o, t, 190, 140, ['eo', 'o'], 0.16, { vol: 0.8 });
      vox(ac, o, t + 0.2, 230, 170, ['a'], 0.18, { vol: 0.9 });
      const b = noiseHit(ac, o, nz, t + 0.18, 'bandpass', 300, 1, 0.3, 0.6);
      b.frequency.exponentialRampToValueAtTime(1200, t + 0.45);
    },
  },
  chop: {
    gain: 0.6,
    oneShot: 0.45,
    rev: 0.1,
    build(ac, o, t, _m, _d, nz) {
      noiseHit(ac, o, nz, t, 'bandpass', 3200, 0.9, 0.05, 1);
      sweep(ac, o, 'sine', t, 180, 60, 0.12, 0.9);
      const car = osc(ac, 'sine', 2600, t, t + 0.4);
      const mod = osc(ac, 'sine', 2600 * 1.41, t, t + 0.4);
      const idx = gain(ac, 1800);
      chain(mod, idx);
      idx.connect(car.frequency);
      const a = gain(ac, 0);
      perc(a.gain, t, 0.22, 0.3);
      chain(car, a, o);
    },
  },
  chopBig: {
    gain: 0.7,
    oneShot: 0.8,
    rev: 0.2,
    build(ac, o, t, m, d, nz) {
      SFX.chop.build(ac, o, t, m, d, nz);
      sweep(ac, o, 'sine', t, 110, 40, 0.35, 1);
      noiseHit(ac, o, nz, t + 0.02, 'lowpass', 2000, 0.8, 0.25, 0.7);
    },
  },
  plop: {
    gain: 0.35,
    oneShot: 0.25,
    rev: 0.2,
    build(ac, o, t) {
      sweep(ac, o, 'sine', t, 300, 900, 0.06, 0.9);
      sweep(ac, o, 'sine', t + 0.05, 500, 1100, 0.05, 0.4);
    },
  },

  // ---- 짹짹 트리오
  chirp: {
    gain: 0.5,
    oneShot: 0.25,
    rev: 0.2,
    build(ac, out, t, m) {
      const f = mtof(m || 96);
      const o = osc(ac, 'sine', f * 0.85, t, t + 0.2);
      o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.035);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
      const am = osc(ac, 'sine', 55, t, t + 0.2);
      const ag = gain(ac, 0.35);
      chain(am, ag);
      const a = gain(ac, 0);
      perc(a.gain, t, 1, 0.1, 0.004);
      ag.connect(a.gain);
      chain(o, a, out);
    },
  },
  chirpBad: {
    gain: 0.45,
    oneShot: 0.3,
    build(ac, out, t) {
      const o = osc(ac, 'square', 700, t, t + 0.25);
      o.frequency.exponentialRampToValueAtTime(380, t + 0.2);
      const lp = filt(ac, 'lowpass', 1500);
      const a = gain(ac, 0);
      perc(a.gain, t, 0.7, 0.18);
      chain(o, lp, a, out);
    },
  },
  flap: {
    gain: 0.25,
    oneShot: 0.3,
    build(ac, o, t, _m, _d, nz) {
      for (let i = 0; i < 3; i++) noiseHit(ac, o, nz, t + i * 0.06, 'bandpass', 1500, 1, 0.03, 0.6, i);
    },
  },

  // ---- 풍선 공장
  hookS: { gain: 0.4, oneShot: 0.2, rev: 0.1, build: (ac, o, t) => void sweep(ac, o, 'sine', t, 1500, 1100, 0.08, 1) },
  hookM: { gain: 0.45, oneShot: 0.25, rev: 0.1, build: (ac, o, t) => void sweep(ac, o, 'sine', t, 820, 560, 0.12, 1) },
  hookL: {
    gain: 0.55,
    oneShot: 0.45,
    rev: 0.1,
    build(ac, out, t) {
      const o = osc(ac, 'sine', 330, t, t + 0.4);
      o.frequency.exponentialRampToValueAtTime(210, t + 0.3);
      const lfo = osc(ac, 'sine', 14, t, t + 0.4);
      const lg = gain(ac, 25);
      chain(lfo, lg);
      lg.connect(o.frequency);
      const a = gain(ac, 0);
      perc(a.gain, t, 1, 0.3);
      chain(o, a, out);
    },
  },
  inflate: {
    gain: 0.18,
    oneShot: 3.2,
    build(ac, out, t, _m, _d, nz) {
      const len = 3.1;
      const n = noise(ac, nz, t, t + len, 0.33);
      const bp = filt(ac, 'bandpass', 500, 2.5);
      bp.frequency.setValueAtTime(400, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + len);
      const o = osc(ac, 'sawtooth', 90, t, t + len);
      o.frequency.exponentialRampToValueAtTime(260, t + len);
      const lp = filt(ac, 'lowpass', 600);
      const og = gain(ac, 0.25);
      const a = gain(ac, 0);
      a.gain.setValueAtTime(0, t);
      a.gain.linearRampToValueAtTime(0.9, t + 0.05);
      a.gain.setValueAtTime(0.9, t + len - 0.05);
      a.gain.linearRampToValueAtTime(0, t + len);
      chain(n, bp, a);
      chain(o, lp, og, a);
      a.connect(out);
    },
  },
  tie: {
    gain: 0.55,
    oneShot: 0.25,
    rev: 0.15,
    build(ac, o, t) {
      sweep(ac, o, 'sine', t, 1700, 2700, 0.05, 0.9, 'lin');
      sweep(ac, o, 'triangle', t + 0.05, 2400, 3000, 0.06, 0.5, 'lin');
    },
  },
  pop: {
    gain: 0.7,
    oneShot: 0.5,
    rev: 0.2,
    build(ac, o, t, _m, _d, nz) {
      noiseHit(ac, o, nz, t, 'highpass', 400, 0.7, 0.07, 1);
      sweep(ac, o, 'sine', t, 220, 60, 0.15, 0.8);
    },
  },
  deflate: {
    gain: 0.35,
    oneShot: 0.7,
    build(ac, out, t, _m, _d, nz) {
      const o = osc(ac, 'sawtooth', 240, t, t + 0.65);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.6);
      const lfo = osc(ac, 'sine', 32, t, t + 0.65);
      const lg = gain(ac, 40);
      chain(lfo, lg);
      lg.connect(o.frequency);
      const lp = filt(ac, 'lowpass', 900);
      const a = gain(ac, 0);
      adsr(a.gain, t, 0.5, 0.01, 0.1, 0.8, 0.1, 0.8);
      chain(o, lp, a, out);
      noiseHit(ac, out, nz, t, 'bandpass', 1800, 1, 0.3, 0.3);
    },
  },

  // ---- 닌자 수련
  tock: {
    gain: 0.5,
    oneShot: 0.2,
    rev: 0.12,
    build(ac, o, t, m, d, nz) {
      DRUMS.block.build(ac, o, t, 81, d, nz);
      sweep(ac, o, 'sine', t + 0.01, 400, 800, 0.08, 0.35);
    },
  },
  dong: {
    gain: 0.45,
    oneShot: 1.6,
    rev: 0.35,
    build(ac, out, t) {
      const f = 220;
      const car = osc(ac, 'sine', f, t, t + 1.6);
      const mod = osc(ac, 'sine', f * 2.76, t, t + 1.6);
      const idx = gain(ac, 0);
      idx.gain.setValueAtTime(f * 2.2, t);
      idx.gain.setTargetAtTime(f * 0.3, t, 0.4);
      chain(mod, idx);
      idx.connect(car.frequency);
      const a = gain(ac, 0);
      perc(a.gain, t, 1, 1.4);
      chain(car, a, out);
    },
  },
  slash: {
    gain: 0.5,
    oneShot: 0.6,
    rev: 0.2,
    build(ac, o, t, _m, _d, nz) {
      const b = noiseHit(ac, o, nz, t, 'bandpass', 6000, 1.2, 0.09, 1, 0.8);
      b.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
      const car = osc(ac, 'sine', 3300, t, t + 0.55);
      const mod = osc(ac, 'sine', 3300 * 1.53, t, t + 0.55);
      const idx = gain(ac, 2400);
      chain(mod, idx);
      idx.connect(car.frequency);
      const a = gain(ac, 0);
      perc(a.gain, t + 0.02, 0.25, 0.45);
      chain(car, a, o);
      sweep(ac, o, 'sine', t, 200, 70, 0.08, 0.6);
    },
  },
  bellHit: {
    gain: 0.55,
    oneShot: 2.0,
    rev: 0.4,
    build(ac, out, t, m, d, nz) {
      SFX.slash.build(ac, out, t, m, d, nz);
      const f = 440;
      const car = osc(ac, 'sine', f, t, t + 2);
      const mod = osc(ac, 'sine', f * 2.76, t, t + 2);
      const idx = gain(ac, 0);
      idx.gain.setValueAtTime(f * 1.8, t);
      idx.gain.setTargetAtTime(f * 0.2, t, 0.5);
      chain(mod, idx);
      idx.connect(car.frequency);
      const a = gain(ac, 0);
      perc(a.gain, t, 0.8, 1.8);
      chain(car, a, out);
    },
  },
  clonk: {
    gain: 0.5,
    oneShot: 0.35,
    build(ac, o, t, _m, _d, nz) {
      DRUMS.block.build(ac, o, t, 69, 0, nz);
      sweep(ac, o, 'square', t, 300, 120, 0.12, 0.4);
    },
  },

  // ---- 펭귄 행진
  step: {
    gain: 0.5,
    oneShot: 0.2,
    build(ac, o, t, _m, _d, nz) {
      sweep(ac, o, 'sine', t, 210, 90, 0.07, 1);
      noiseHit(ac, o, nz, t, 'bandpass', 2400, 2, 0.02, 0.35, 0.6);
    },
  },
  stepBad: {
    gain: 0.45,
    oneShot: 0.3,
    build(ac, o, t, _m, _d, nz) {
      sweep(ac, o, 'square', t, 260, 120, 0.12, 0.5);
      noiseHit(ac, o, nz, t, 'lowpass', 800, 0.8, 0.1, 0.5);
    },
  },
  whistle: {
    gain: 0.25,
    oneShot: 0.3,
    rev: 0.15,
    build(ac, out, t, m, _d, nz) {
      const f = m ? mtof(m) : 2700;
      const o = osc(ac, 'sine', f, t, t + 0.3);
      const lfo = osc(ac, 'sine', 38, t, t + 0.3);
      const lg = gain(ac, f * 0.03);
      chain(lfo, lg);
      lg.connect(o.frequency);
      const a = gain(ac, 0);
      adsr(a.gain, t, 0.13, 0.008, 0.05, 0.9, 0.04, 1);
      chain(o, a, out);
      const n = noise(ac, nz, t, t + 0.2, 0.1);
      const bp = filt(ac, 'bandpass', f, 3);
      const ng = gain(ac, 0);
      adsr(ng.gain, t, 0.13, 0.01, 0.05, 0.9, 0.04, 0.25);
      chain(n, bp, ng, out);
    },
  },
  whistleLong: {
    gain: 0.25,
    oneShot: 0.55,
    rev: 0.15,
    build(ac, out, t, m, _d, nz) {
      const f = m ? mtof(m) : 2700;
      const o = osc(ac, 'sine', f, t, t + 0.55);
      const lfo = osc(ac, 'sine', 38, t, t + 0.55);
      const lg = gain(ac, f * 0.03);
      chain(lfo, lg);
      lg.connect(o.frequency);
      const a = gain(ac, 0);
      adsr(a.gain, t, 0.36, 0.008, 0.05, 0.9, 0.05, 1);
      chain(o, a, out);
      const n = noise(ac, nz, t, t + 0.45, 0.1);
      const bp = filt(ac, 'bandpass', f, 3);
      const ng = gain(ac, 0);
      adsr(ng.gain, t, 0.36, 0.01, 0.05, 0.9, 0.05, 0.25);
      chain(n, bp, ng, out);
    },
  },
  hey: {
    gain: 0.55,
    oneShot: 0.4,
    rev: 0.15,
    build(ac, o, t, m, _d, nz) {
      const f = m ? mtof(m) : 260;
      voxNoise(ac, o, nz, t, 1500, 0.05, 0.5);
      vox(ac, o, t + 0.03, f * 1.1, f * 0.9, ['e', 'i'], 0.22, { vol: 1 });
    },
  },
  hup: {
    gain: 0.55,
    oneShot: 0.3,
    rev: 0.15,
    build(ac, o, t, m, _d, nz) {
      const f = m ? mtof(m) : 280;
      voxNoise(ac, o, nz, t, 1200, 0.04, 0.5);
      vox(ac, o, t + 0.025, f * 1.15, f, ['u'], 0.11, { vol: 1 });
    },
  },
  ha: {
    gain: 0.55,
    oneShot: 0.35,
    rev: 0.15,
    build(ac, o, t, m, _d, nz) {
      const f = m ? mtof(m) : 250;
      voxNoise(ac, o, nz, t, 1400, 0.05, 0.5);
      vox(ac, o, t + 0.03, f * 1.1, f * 0.95, ['a'], 0.16, { vol: 1 });
    },
  },

  // ---- 달토끼 배드민턴
  racket: {
    gain: 0.65,
    oneShot: 0.25,
    rev: 0.12,
    build(ac, o, t, _m, _d, nz) {
      noiseHit(ac, o, nz, t, 'bandpass', 2200, 1.2, 0.035, 1, 0.25);
      sweep(ac, o, 'sine', t, 1100, 700, 0.05, 0.6);
      sweep(ac, o, 'triangle', t, 300, 150, 0.05, 0.4);
    },
  },
  racketFar: {
    gain: 0.3,
    oneShot: 0.25,
    rev: 0.3,
    build(ac, o, t, m, d, nz) {
      SFX.racket.build(ac, o, t, m, d, nz);
    },
  },
  lob: {
    gain: 0.4,
    oneShot: 0.45,
    rev: 0.25,
    build(ac, out, t, _m, _d, nz) {
      SFX.racket.build(ac, out, t, 0, 0, nz);
      const o = osc(ac, 'sine', 500, t, t + 0.45);
      o.frequency.exponentialRampToValueAtTime(1300, t + 0.18);
      o.frequency.exponentialRampToValueAtTime(700, t + 0.4);
      const a = gain(ac, 0);
      adsr(a.gain, t, 0.36, 0.02, 0.1, 0.8, 0.05, 0.6);
      chain(o, a, out);
    },
  },
  smash: {
    gain: 0.6,
    oneShot: 0.4,
    rev: 0.2,
    build(ac, o, t, _m, _d, nz) {
      noiseHit(ac, o, nz, t, 'highpass', 3000, 0.7, 0.08, 1, 0.9);
      sweep(ac, o, 'square', t, 1800, 900, 0.1, 0.35);
      sweep(ac, o, 'sine', t, 300, 90, 0.1, 0.8);
    },
  },

  // ---- 개구리 합창단
  croak: {
    gain: 0.8,
    oneShot: 0.35,
    rev: 0.15,
    build(ac, out, t, m) {
      const f = m ? mtof(m) : 150;
      for (let s = 0; s < 2; s++) {
        const st = t + s * 0.1;
        const o = ac.createOscillator();
        o.setPeriodicWave(pulseWave(ac, 0.18));
        o.frequency.setValueAtTime(f * (s === 0 ? 1.12 : 0.96), st);
        o.frequency.exponentialRampToValueAtTime(f * (s === 0 ? 1.0 : 0.86), st + 0.08);
        o.start(st);
        o.stop(st + 0.12);
        const am = osc(ac, 'square', 45, st, st + 0.12);
        const ag = gain(ac, 0.45);
        chain(am, ag);
        const a = gain(ac, 0);
        a.gain.setValueAtTime(0, st);
        a.gain.linearRampToValueAtTime(s === 0 ? 0.9 : 0.75, st + 0.01);
        a.gain.setTargetAtTime(0, st + 0.06, 0.015);
        ag.connect(a.gain);
        const bp1 = filt(ac, 'bandpass', s === 0 ? 700 : 450, 3);
        const bp2 = filt(ac, 'bandpass', s === 0 ? 1600 : 900, 4);
        const mix = gain(ac, 1.6);
        o.connect(bp1);
        o.connect(bp2);
        bp1.connect(mix);
        bp2.connect(mix);
        chain(mix, a, out);
      }
    },
  },
  burp: {
    gain: 0.4,
    oneShot: 0.4,
    build(ac, out, t) {
      const o = osc(ac, 'sawtooth', 90, t, t + 0.35);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.3);
      const lp = filt(ac, 'lowpass', 500, 4);
      const a = gain(ac, 0);
      adsr(a.gain, t, 0.22, 0.01, 0.1, 0.8, 0.06, 0.9);
      chain(o, lp, a, out);
    },
  },
  splash: {
    gain: 0.3,
    oneShot: 0.5,
    rev: 0.2,
    build(ac, o, t, _m, _d, nz) {
      const b = noiseHit(ac, o, nz, t, 'bandpass', 1200, 0.8, 0.25, 0.9, 0.5);
      b.frequency.exponentialRampToValueAtTime(400, t + 0.3);
      sweep(ac, o, 'sine', t, 900, 300, 0.1, 0.4);
    },
  },

  // ---- 요정 왈츠
  twinkle: {
    gain: 0.3,
    oneShot: 1.6,
    rev: 0.4,
    build(ac, out, t, m) {
      const base = m || 84;
      [0, 4, 7, 12].forEach((iv, i) => TONAL.bell.build(ac, out, t + i * 0.035, base + iv, 0.2, null as unknown as AudioBuffer));
    },
  },
  sparkle: {
    gain: 0.22,
    oneShot: 1.8,
    rev: 0.45,
    build(ac, out, t) {
      [96, 91, 88, 84, 91, 96, 100].forEach((mm, i) => TONAL.bell.build(ac, out, t + i * 0.05, mm, 0.1, null as unknown as AudioBuffer));
    },
  },
  fizzle: {
    gain: 0.3,
    oneShot: 0.5,
    build(ac, out, t, _m, _d, nz) {
      const b = noiseHit(ac, out, nz, t, 'bandpass', 3000, 2, 0.3, 0.6, 0.3);
      b.frequency.exponentialRampToValueAtTime(600, t + 0.35);
      sweep(ac, out, 'triangle', t, 900, 300, 0.3, 0.3);
    },
  },
  glissUp: {
    gain: 0.2,
    oneShot: 1.8,
    rev: 0.4,
    build(ac, out, t) {
      [79, 83, 86, 91, 95, 98].forEach((mm, i) => TONAL.bell.build(ac, out, t + i * 0.06, mm, 0.1, null as unknown as AudioBuffer));
    },
  },
  cheer: {
    gain: 0.25,
    oneShot: 2.0,
    rev: 0.3,
    build(ac, out, t, _m, _d, nz) {
      const n = noise(ac, nz, t, t + 2, 0.6);
      const bp = filt(ac, 'bandpass', 1200, 0.5);
      const a = gain(ac, 0);
      a.gain.setValueAtTime(0, t);
      a.gain.linearRampToValueAtTime(0.8, t + 0.15);
      a.gain.setTargetAtTime(0, t + 0.6, 0.35);
      const lfo = osc(ac, 'sine', 7, t, t + 2);
      const lg = gain(ac, 0.2);
      chain(lfo, lg);
      lg.connect(a.gain);
      chain(n, bp, a, out);
      for (let i = 0; i < 6; i++) {
        const st = t + 0.05 + i * 0.13;
        vox(ac, out, st, 300 + i * 37, 260 + i * 20, [i % 2 ? 'a' : 'e'], 0.25, { vol: 0.25 });
      }
    },
  },
};

export const INSTRUMENTS: Record<string, InstDef> = { ...TONAL, ...DRUMS, ...SFX };

export function instLength(name: string, dur: number): number {
  const d = INSTRUMENTS[name];
  if (!d) throw new Error('unknown instrument ' + name);
  return d.oneShot ?? dur + (d.release ?? 0.3) + 0.05;
}
