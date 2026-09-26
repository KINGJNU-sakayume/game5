// 타이틀/메뉴 공용 배경과 마스코트
import { OUT, circle, ellipse, happyEye, rrect, star, text, vgrad, type G } from '../core/gfx';
import { TAU, bounce, frac } from '../core/util';
import { starfield } from '../games/common';

export function nightSky(g: G, W: number, H: number, t: number) {
  g.fillStyle = vgrad(g, 0, H, [
    [0, '#1b0f3d'],
    [0.55, '#4a2a8a'],
    [1, '#ff8fb6'],
  ]);
  g.fillRect(0, 0, W, H);
  starfield(g, W, H * 0.8, 70, 3.1, t * 2);
  // 먼 행성
  circle(g, W * 0.85, H * 0.16, 34, '#ffb26b');
  ellipse(g, W * 0.85, H * 0.16, 56, 11, -0.3, null, 'rgba(255,230,200,0.8)', 4);
  circle(g, W * 0.12, H * 0.34, 14, '#8fe3ff');
  // 언덕
  g.fillStyle = '#2d1b5c';
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(0, H * 0.86);
  g.quadraticCurveTo(W * 0.3, H * 0.8, W * 0.55, H * 0.87);
  g.quadraticCurveTo(W * 0.8, H * 0.93, W, H * 0.84);
  g.lineTo(W, H);
  g.fill();
}

/** 마스코트 별 '반짝이' */
export function mascot(g: G, x: number, y: number, r: number, beat: number, mood: 'happy' | 'normal' = 'normal') {
  const b = bounce(beat);
  const sq = 1 - b * 0.08;
  g.save();
  g.translate(x, y + b * r * 0.12);
  g.scale(1 / sq, sq);
  g.rotate(Math.sin(beat * Math.PI) * 0.06);
  star(g, 0, 0, r, r * 0.55, 5, -Math.PI / 2, '#ffe14d', OUT, Math.max(3, r * 0.06));
  star(g, -r * 0.08, -r * 0.1, r * 0.55, r * 0.3, 5, -Math.PI / 2, 'rgba(255,255,255,0.35)');
  const ey = -r * 0.05;
  if (mood === 'happy' || frac(beat / 8) > 0.9) {
    happyEye(g, -r * 0.2, ey, r * 0.09);
    happyEye(g, r * 0.2, ey, r * 0.09);
  } else {
    ellipse(g, -r * 0.2, ey, r * 0.06, r * 0.1, 0, OUT);
    ellipse(g, r * 0.2, ey, r * 0.06, r * 0.1, 0, OUT);
    circle(g, -r * 0.18, ey - r * 0.04, r * 0.025, '#fff');
    circle(g, r * 0.22, ey - r * 0.04, r * 0.025, '#fff');
  }
  g.beginPath();
  g.arc(0, r * 0.1, r * 0.1, 0, Math.PI);
  g.fillStyle = '#c2344d';
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = Math.max(2, r * 0.035);
  g.stroke();
  ellipse(g, -r * 0.33, r * 0.08, r * 0.08, r * 0.05, 0, 'rgba(255,120,120,0.6)');
  ellipse(g, r * 0.33, r * 0.08, r * 0.08, r * 0.05, 0, 'rgba(255,120,120,0.6)');
  g.restore();
}

/** 로고 */
export function logo(g: G, x: number, y: number, s: number, t: number) {
  const chars = ['리', '듬', ' ', '별', '나', '라'];
  const colors = ['#ff6b8b', '#ffb84d', '', '#ffe14d', '#6be3a0', '#6bc6ff'];
  const cw = s * 0.92;
  const total = cw * (chars.length - 0.6);
  let cx = x - total / 2 + cw / 2;
  chars.forEach((ch, i) => {
    if (ch === ' ') {
      cx += cw * 0.4;
      return;
    }
    const wob = Math.sin(t * 4 + i * 0.9) * s * 0.05;
    g.save();
    g.translate(cx, y + wob);
    g.rotate(Math.sin(t * 2 + i) * 0.05);
    text(g, ch, 0, s * 0.06, s, 'rgba(0,0,0,0.35)', { weight: 900 });
    text(g, ch, 0, 0, s, colors[i], { weight: 900, stroke: OUT, strokeW: s * 0.2 });
    g.restore();
    cx += cw;
  });
  const bw = s * 3.6;
  rrect(g, x - bw / 2, y + s * 0.62, bw, s * 0.42, s * 0.21, '#fff', OUT, 3);
  text(g, 'RHYTHM STARLAND', x, y + s * 0.83, s * 0.24, '#5a3aa0', { weight: 900 });
}

export function orbitStars(g: G, x: number, y: number, r: number, t: number, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = t * 0.8 + (i / n) * TAU;
    star(g, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.35, 6, 2.6, 4, a, i % 2 ? '#ffe14d' : '#fff');
  }
}
