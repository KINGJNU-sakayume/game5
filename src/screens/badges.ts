// 메달/자물쇠 등 배지 그림
import { OUT, circle, line, rrect, star, text, type G } from '../core/gfx';

export function medal(g: G, x: number, y: number, r: number, t = 0) {
  // 리본
  g.beginPath();
  g.moveTo(x - r * 0.5, y);
  g.lineTo(x - r * 0.75, y + r * 1.35);
  g.lineTo(x - r * 0.35, y + r * 1.15);
  g.lineTo(x - r * 0.1, y + r * 1.45);
  g.lineTo(x + r * 0.1, y);
  g.fillStyle = '#ff5a6e';
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 2;
  g.stroke();
  g.beginPath();
  g.moveTo(x + r * 0.5, y);
  g.lineTo(x + r * 0.75, y + r * 1.35);
  g.lineTo(x + r * 0.35, y + r * 1.15);
  g.lineTo(x + r * 0.1, y + r * 1.45);
  g.lineTo(x - r * 0.1, y);
  g.fillStyle = '#4aa8ff';
  g.fill();
  g.stroke();
  circle(g, x, y, r, '#ffcf3a', OUT, 2.5);
  circle(g, x, y, r * 0.72, '#ffe07a');
  star(g, x, y, r * 0.55, r * 0.24, 5, -Math.PI / 2 + Math.sin(t * 2) * 0.1, '#ffb400', OUT, 1.5);
}

export function perfectBadge(g: G, x: number, y: number, r: number, t = 0) {
  star(g, x, y, r, r * 0.5, 5, -Math.PI / 2 + t, '#ff7ad9', OUT, 2.5);
  text(g, 'P', x, y + 1, r * 0.8, '#fff', { weight: 900, stroke: OUT, strokeW: 3 });
}

export function checkBadge(g: G, x: number, y: number, r: number) {
  circle(g, x, y, r, '#6be3a0', OUT, 2.5);
  g.beginPath();
  g.moveTo(x - r * 0.45, y);
  g.lineTo(x - r * 0.1, y + r * 0.38);
  g.lineTo(x + r * 0.5, y - r * 0.35);
  g.strokeStyle = '#fff';
  g.lineWidth = r * 0.28;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke();
}

export function lockIcon(g: G, x: number, y: number, s: number) {
  g.beginPath();
  g.arc(x, y - s * 0.2, s * 0.32, Math.PI, 0);
  g.strokeStyle = OUT;
  g.lineWidth = s * 0.2;
  g.stroke();
  g.strokeStyle = '#d7d2e6';
  g.lineWidth = s * 0.1;
  g.stroke();
  rrect(g, x - s * 0.48, y - s * 0.2, s * 0.96, s * 0.72, s * 0.14, '#ffcf3a', OUT, 3);
  circle(g, x, y + s * 0.1, s * 0.1, OUT);
  line(g, x, y + s * 0.1, x, y + s * 0.3, OUT, s * 0.08);
}
