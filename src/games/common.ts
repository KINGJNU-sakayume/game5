// 미니게임 공용 헬퍼
import type { ChartBuilder, Cue } from '../core/chart';
import { OUT, circle, ellipse, rrect, text, type G } from '../core/gfx';
import type { Rank } from '../core/judge';
import { clamp01 } from '../core/util';

/** 시각 t에서 가장 최근 입력(판정된 큐) 찾기 */
export function lastJudged(cues: Cue[], t: number, pred?: (c: Cue) => boolean): Cue | null {
  let best: Cue | null = null;
  for (const c of cues) {
    if (!c.grade || c.at == null || c.at > t) continue;
    if (pred && !pred(c)) continue;
    if (!best || c.at > best.at!) best = c;
  }
  return best;
}

/** 패턴 문자열로 큐를 배치: 한 글자 = step 박, 반환값은 사용한 박 수 */
export function pattern(
  b: ChartBuilder,
  start: number,
  step: number,
  str: string,
  fn: (ch: string, beat: number) => void,
): number {
  const s = str.replace(/[|\s]/g, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '.' || ch === '-') continue;
    fn(ch, start + i * step);
  }
  return s.length * step;
}

/** 에필로그 액자 */
export function epilogueFrame(g: G, x: number, y: number, w: number, h: number, bg: string, draw: () => void) {
  g.save();
  rrect(g, x, y, w, h, 14, bg, OUT, 4);
  g.beginPath();
  g.rect(x + 2, y + 2, w - 4, h - 4);
  g.clip();
  draw();
  g.restore();
  rrect(g, x, y, w, h, 14, null, OUT, 4);
}

/** 에필로그 공통 판정 색 */
export function rankTint(rank: Rank): string {
  return rank === 'hi' ? '#ffd84a' : rank === 'ok' ? '#9fd6ff' : '#c8c0d0';
}

/** 말풍선 */
export function bubble(g: G, x: number, y: number, s: string, size = 18, tailX = 0, tailY = 18) {
  g.save();
  g.font = `800 ${size}px sans-serif`;
  const w = Math.max(44, s.length * size * 0.95 + 24);
  const h = size + 20;
  rrect(g, x - w / 2, y - h / 2, w, h, h / 2, '#fff', OUT, 3);
  g.beginPath();
  g.moveTo(x - 8, y + h / 2 - 2);
  g.lineTo(x + tailX, y + h / 2 + tailY);
  g.lineTo(x + 8, y + h / 2 - 2);
  g.fillStyle = '#fff';
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = '#fff';
  g.fillRect(x - 7, y + h / 2 - 5, 14, 4);
  g.restore();
  text(g, s, x, y + 1, size, OUT);
}

/** 이펙트 타이머: 0..1 진행도 (시작 전 -1) */
export function prog(t: number, t0: number, dur: number): number {
  if (t < t0) return -1;
  return clamp01((t - t0) / dur);
}

/** 그림자 */
export function shadow(g: G, x: number, y: number, rx: number, a = 0.2) {
  ellipse(g, x, y, rx, rx * 0.22, 0, `rgba(0,0,0,${a})`);
}

/** 반짝이는 별 배경 점 */
export function starfield(g: G, W: number, H: number, n: number, seed: number, t: number, color = '#fff') {
  for (let i = 0; i < n; i++) {
    const hx = Math.sin(i * 127.1 + seed) * 43758.5453;
    const hy = Math.sin(i * 311.7 + seed) * 12543.123;
    const x = (hx - Math.floor(hx)) * W;
    const y = (hy - Math.floor(hy)) * H;
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + (i % 5) * 0.4) + i);
    circle(g, x, y, 0.8 + tw * 1.3, color);
  }
}
