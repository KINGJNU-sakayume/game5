// 캔버스 그리기 헬퍼 (굵은 외곽선 + 단색 카툰 스타일)
import { TAU } from './util';

export type G = CanvasRenderingContext2D;

export const OUT = '#2a2130';
export const FONT_FAMILY = '"Apple SD Gothic Neo","AppleSDGothicNeo-Heavy","Noto Sans KR","Noto Sans CJK KR","Malgun Gothic","WenQuanYi Zen Hei",system-ui,sans-serif';

export function font(size: number, weight = 800): string {
  return `${weight} ${Math.round(size * 10) / 10}px ${FONT_FAMILY}`;
}

export interface Insets {
  t: number;
  b: number;
  l: number;
  r: number;
}

export function fs(g: G, fill?: string | CanvasGradient | CanvasPattern | null, stroke?: string | null, lw = 3) {
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();
  }
}

export function circle(g: G, x: number, y: number, r: number, fill?: string | CanvasGradient | null, stroke?: string | null, lw = 3) {
  g.beginPath();
  g.arc(x, y, Math.max(0.01, r), 0, TAU);
  fs(g, fill, stroke, lw);
}

export function ellipse(g: G, x: number, y: number, rx: number, ry: number, rot = 0, fill?: string | CanvasGradient | null, stroke?: string | null, lw = 3) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.01, Math.abs(rx)), Math.max(0.01, Math.abs(ry)), rot, 0, TAU);
  fs(g, fill, stroke, lw);
}

export function rrectPath(g: G, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.arcTo(x + w, y, x + w, y + rr, rr);
  g.lineTo(x + w, y + h - rr);
  g.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  g.lineTo(x + rr, y + h);
  g.arcTo(x, y + h, x, y + h - rr, rr);
  g.lineTo(x, y + rr);
  g.arcTo(x, y, x + rr, y, rr);
  g.closePath();
}

export function rrect(g: G, x: number, y: number, w: number, h: number, r: number, fill?: string | CanvasGradient | null, stroke?: string | null, lw = 3) {
  rrectPath(g, x, y, w, h, r);
  fs(g, fill, stroke, lw);
}

export function poly(g: G, pts: number[], fill?: string | null, stroke?: string | null, lw = 3, close = true) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  if (close) g.closePath();
  fs(g, fill, stroke, lw);
}

export function line(g: G, x0: number, y0: number, x1: number, y1: number, color = OUT, lw = 3) {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.stroke();
}

export function curve(g: G, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, color = OUT, lw = 3) {
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo(cx, cy, x1, y1);
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.stroke();
}

/** 팔다리처럼 굵은 선 + 외곽선 */
export function limb(g: G, pts: number[], w: number, fill: string, stroke = OUT, lw = 3) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.strokeStyle = stroke;
  g.lineWidth = w + lw * 2;
  g.stroke();
  g.strokeStyle = fill;
  g.lineWidth = w;
  g.stroke();
}

export function star(g: G, x: number, y: number, r1: number, r2: number, n = 5, rot = -Math.PI / 2, fill?: string | null, stroke?: string | null, lw = 3) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = rot + (i * Math.PI) / n;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  fs(g, fill, stroke, lw);
}

export interface TextOpts {
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  weight?: number;
  stroke?: string;
  strokeW?: number;
  maxW?: number;
  alpha?: number;
  shadow?: string;
}

export function text(g: G, s: string, x: number, y: number, size: number, color: string, o: TextOpts = {}) {
  g.save();
  g.font = font(size, o.weight ?? 800);
  g.textAlign = o.align ?? 'center';
  g.textBaseline = o.baseline ?? 'middle';
  if (o.alpha != null) g.globalAlpha *= o.alpha;
  if (o.shadow) {
    g.fillStyle = o.shadow;
    g.fillText(s, x + size * 0.06, y + size * 0.08, o.maxW);
  }
  if (o.stroke) {
    g.strokeStyle = o.stroke;
    g.lineWidth = o.strokeW ?? size * 0.18;
    g.lineJoin = 'round';
    g.strokeText(s, x, y, o.maxW);
  }
  g.fillStyle = color;
  g.fillText(s, x, y, o.maxW);
  g.restore();
}

/** 여러 줄 텍스트 (자동 줄바꿈) — 그린 높이 반환 */
export function wrapText(g: G, s: string, x: number, y: number, maxW: number, size: number, color: string, lineH = 1.35, o: TextOpts = {}): number {
  g.save();
  g.font = font(size, o.weight ?? 700);
  const lines: string[] = [];
  for (const para of s.split('\n')) {
    let cur = '';
    for (const ch of para.split(/(\s+)/)) {
      const test = cur + ch;
      if (g.measureText(test).width > maxW && cur.trim()) {
        lines.push(cur.trim());
        cur = ch.trimStart();
        // 한 단어가 너무 길면 글자 단위로 자르기
        while (g.measureText(cur).width > maxW) {
          let k = cur.length - 1;
          while (k > 1 && g.measureText(cur.slice(0, k)).width > maxW) k--;
          lines.push(cur.slice(0, k));
          cur = cur.slice(k);
        }
      } else cur = test;
    }
    lines.push(cur.trim());
  }
  g.restore();
  lines.forEach((ln, i) => text(g, ln, x, y + i * size * lineH, size, color, { baseline: 'top', ...o }));
  return lines.length * size * lineH;
}

/** 동그란 눈 (하이라이트 포함) */
export function eye(g: G, x: number, y: number, r: number, opts: { blink?: number; lx?: number; ly?: number; color?: string; shine?: boolean } = {}) {
  const blink = opts.blink ?? 0;
  if (blink > 0.7) {
    line(g, x - r, y, x + r, y, opts.color ?? OUT, Math.max(2, r * 0.45));
    return;
  }
  const sy = 1 - blink;
  ellipse(g, x + (opts.lx ?? 0) * r * 0.3, y + (opts.ly ?? 0) * r * 0.3, r * 0.8, r * sy, 0, opts.color ?? OUT);
  if (opts.shine !== false) circle(g, x + (opts.lx ?? 0) * r * 0.3 + r * 0.28, y + (opts.ly ?? 0) * r * 0.3 - r * 0.35 * sy, r * 0.28, '#fff');
}

/** 행복한 ^ 모양 눈 */
export function happyEye(g: G, x: number, y: number, r: number, color = OUT) {
  g.beginPath();
  g.moveTo(x - r, y + r * 0.35);
  g.quadraticCurveTo(x, y - r * 0.9, x + r, y + r * 0.35);
  g.strokeStyle = color;
  g.lineWidth = Math.max(2, r * 0.5);
  g.lineCap = 'round';
  g.stroke();
}

/** 어지러운 @ 눈 */
export function dizzyEye(g: G, x: number, y: number, r: number, t: number) {
  g.save();
  g.translate(x, y);
  g.rotate(t * 8);
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * TAU * 1.6;
    const rr = (r * i) / 24;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.strokeStyle = OUT;
  g.lineWidth = Math.max(1.5, r * 0.3);
  g.stroke();
  g.restore();
}

export function blush(g: G, x: number, y: number, r: number, color = 'rgba(255,120,140,0.45)') {
  ellipse(g, x, y, r, r * 0.6, 0, color);
}

export function vgrad(g: G, y0: number, y1: number, stops: [number, string][]): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

export function rgrad(g: G, x: number, y: number, r0: number, r1: number, stops: [number, string][]): CanvasGradient {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

export function withT(g: G, x: number, y: number, rot: number, sx: number, sy: number, fn: () => void) {
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  if (sx !== 1 || sy !== 1) g.scale(sx, sy);
  fn();
  g.restore();
}

export function alpha(g: G, a: number, fn: () => void) {
  if (a <= 0) return;
  g.save();
  g.globalAlpha *= Math.min(1, a);
  fn();
  g.restore();
}

/** 만화풍 충격 효과 (별 모양 팡!) */
export function pow(g: G, x: number, y: number, r: number, fill = '#fff36b', rot = 0) {
  star(g, x, y, r, r * 0.55, 8, rot, fill, OUT, 3);
}

/** 반짝이 십자 */
export function sparkle(g: G, x: number, y: number, r: number, color = '#fff') {
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fillStyle = color;
  g.fill();
}

/** 음표 */
export function noteGlyph(g: G, x: number, y: number, s: number, color = OUT) {
  ellipse(g, x, y, s * 0.55, s * 0.4, -0.4, color);
  line(g, x + s * 0.45, y - s * 0.1, x + s * 0.45, y - s * 1.6, color, Math.max(1.5, s * 0.18));
  curve(g, x + s * 0.45, y - s * 1.6, x + s * 1.1, y - s * 1.2, x + s * 0.9, y - s * 0.7, color, Math.max(1.5, s * 0.18));
}

/** 땀방울 */
export function sweat(g: G, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y - s);
  g.quadraticCurveTo(x + s * 0.8, y + s * 0.2, x, y + s * 0.6);
  g.quadraticCurveTo(x - s * 0.8, y + s * 0.2, x, y - s);
  fs(g, '#8fd3ff', OUT, 2);
}

/** 화면 크기 정보 */
export interface View {
  W: number;
  H: number;
  safe: Insets;
}

/** 간단한 파티클 (연출용, 실시간) */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
  kind: 'dot' | 'star' | 'spark' | 'note' | 'petal' | 'rect';
  rot: number;
  vr: number;
  g: number;
}

export class Particles {
  list: Particle[] = [];
  spawn(p: Partial<Particle> & { x: number; y: number }) {
    this.list.push({
      vx: 0,
      vy: 0,
      life: 0,
      max: 0.8,
      r: 4,
      color: '#fff',
      kind: 'dot',
      rot: 0,
      vr: 0,
      g: 0,
      ...p,
    });
  }
  burst(x: number, y: number, n: number, opts: Partial<Particle> & { speed?: number; colors?: string[] } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = (opts.speed ?? 200) * (0.5 + Math.random() * 0.8);
      this.spawn({
        ...opts,
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color: opts.colors ? opts.colors[i % opts.colors.length] : opts.color ?? '#fff',
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 10,
        max: (opts.max ?? 0.7) * (0.7 + Math.random() * 0.6),
      });
    }
  }
  update(dt: number) {
    for (const p of this.list) {
      p.life += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-2 * dt);
      p.vy *= p.g ? 1 : Math.exp(-2 * dt);
      p.rot += p.vr * dt;
    }
    this.list = this.list.filter((p) => p.life < p.max);
  }
  draw(g: G) {
    for (const p of this.list) {
      const k = 1 - p.life / p.max;
      g.save();
      g.globalAlpha *= Math.min(1, k * 1.5);
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      const r = p.r * (0.4 + 0.6 * k);
      switch (p.kind) {
        case 'star':
          star(g, 0, 0, r, r * 0.45, 5, -Math.PI / 2, p.color, OUT, 1.5);
          break;
        case 'spark':
          sparkle(g, 0, 0, r * 1.4, p.color);
          break;
        case 'note':
          noteGlyph(g, 0, 0, r, p.color);
          break;
        case 'petal':
          ellipse(g, 0, 0, r, r * 0.55, 0, p.color, OUT, 1.5);
          break;
        case 'rect':
          g.fillStyle = p.color;
          g.fillRect(-r, -r * 0.6, r * 2, r * 1.2);
          break;
        default:
          circle(g, 0, 0, r, p.color);
      }
      g.restore();
    }
  }
  clear() {
    this.list.length = 0;
  }
}
