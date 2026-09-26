// 공용 수학/보간 유틸리티

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (a: number, b: number, c: number, d: number, v: number) => lerp(c, d, invLerp(a, b, v));
export const frac = (v: number) => v - Math.floor(v);

export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
export const easeInQuad = (t: number) => t * t;
export const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack = (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeOutElastic = (t: number) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

/** 박자에 맞춰 톡톡 튀는 움직임 (박 시작에서 최대, 곧 원위치) */
export function beatPulse(beat: number, sharp = 6): number {
  const f = frac(beat);
  return Math.exp(-f * sharp);
}

/** 박에 맞춰 살짝 눌렸다가 올라오는 바운스 (0..1) */
export function bounce(beat: number): number {
  const f = frac(beat);
  return f < 0.15 ? f / 0.15 : 1 - easeOutQuad((f - 0.15) / 0.85);
}

/** 포물선 궤적: p0 -> p1, 최고 높이 h(위쪽이 음수 y) */
export function arc(x0: number, y0: number, x1: number, y1: number, h: number, t: number): [number, number] {
  const x = lerp(x0, x1, t);
  const y = lerp(y0, y1, t) - h * 4 * t * (1 - t);
  return [x, y];
}

/** 결정적 의사난수 (시드 기반) */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** 정수 해시 → 0..1 */
export function hash01(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function approach(cur: number, target: number, rate: number, dt: number): number {
  return target + (cur - target) * Math.exp(-rate * dt);
}

export function sum(arr: number[]): number {
  let s = 0;
  for (const v of arr) s += v;
  return s;
}
