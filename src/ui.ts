// 공용 UI 요소 (버튼, 패널)
import { OUT, rrect, text, type G } from './core/gfx';
import { audio } from './core/audio';
import type { RawInput } from './core/input';
import { clamp01, easeOutBack } from './core/util';

export interface Button {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
  textColor?: string;
  size?: number;
  onTap: () => void;
  enabled?: boolean;
  /** 내부 상태 */
  down?: boolean;
  appear?: number;
  sub?: string;
  icon?: (g: G, cx: number, cy: number, s: number) => void;
}

export function button(b: Omit<Button, 'down'>): Button {
  return { enabled: true, ...b };
}

export function hit(b: Button, x: number, y: number, pad = 6): boolean {
  return x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;
}

export function drawButton(g: G, b: Button, appearT = 1) {
  const en = b.enabled !== false;
  const k = easeOutBack(clamp01(appearT));
  const press = b.down ? 3 : 0;
  g.save();
  g.translate(b.x + b.w / 2, b.y + b.h / 2);
  g.scale(k, k);
  g.globalAlpha *= en ? 1 : 0.45;
  const x = -b.w / 2;
  const y = -b.h / 2;
  rrect(g, x, y + 5, b.w, b.h, Math.min(18, b.h / 2), 'rgba(0,0,0,0.28)');
  rrect(g, x, y + press, b.w, b.h, Math.min(18, b.h / 2), b.color, OUT, 3);
  rrect(g, x + 6, y + press + 4, b.w - 12, b.h * 0.34, Math.min(12, b.h / 4), 'rgba(255,255,255,0.28)');
  const size = b.size ?? Math.min(22, b.h * 0.42);
  if (b.icon) {
    b.icon(g, x + size * 1.1, press, size);
  }
  const ty = b.sub ? -size * 0.35 : 0;
  text(g, b.label, b.icon ? size * 0.6 : 0, ty + press, size, b.textColor ?? '#fff', {
    stroke: OUT,
    strokeW: 4,
    maxW: b.w - 16,
  });
  if (b.sub) text(g, b.sub, 0, size * 0.6 + press, size * 0.55, b.textColor ?? '#fff', { weight: 700, alpha: 0.9, maxW: b.w - 16 });
  g.restore();
}

/** 버튼 목록 입력 처리: 눌렀다 떼면 실행 */
export function handleButtons(buttons: Button[], e: RawInput): boolean {
  if (e.key) {
    return false;
  }
  if (e.kind === 'down') {
    for (const b of buttons) {
      if (b.enabled !== false && hit(b, e.x, e.y)) {
        b.down = true;
        return true;
      }
    }
  } else if (e.kind === 'up' || e.kind === 'cancel') {
    let handled = false;
    for (const b of buttons) {
      if (b.down) {
        b.down = false;
        if (e.kind === 'up' && hit(b, e.x, e.y, 14)) {
          audio.sfx('uiConfirm', 0, 0.8);
          b.onTap();
          handled = true;
        }
      }
    }
    return handled;
  } else if (e.kind === 'move') {
    for (const b of buttons) if (b.down && !hit(b, e.x, e.y, 30)) b.down = false;
  }
  return false;
}

/** 일시정지 버튼 아이콘 */
export function drawPauseIcon(g: G, x: number, y: number, s: number) {
  rrect(g, x - s / 2, y - s / 2, s, s, s * 0.3, 'rgba(0,0,0,0.3)', 'rgba(255,255,255,0.8)', 2.5);
  rrect(g, x - s * 0.2, y - s * 0.22, s * 0.13, s * 0.44, 2, '#fff');
  rrect(g, x + s * 0.07, y - s * 0.22, s * 0.13, s * 0.44, 2, '#fff');
}

export function drawBackIcon(g: G, x: number, y: number, s: number) {
  rrect(g, x - s / 2, y - s / 2, s, s, s * 0.3, 'rgba(0,0,0,0.3)', 'rgba(255,255,255,0.85)', 2.5);
  g.beginPath();
  g.moveTo(x + s * 0.12, y - s * 0.22);
  g.lineTo(x - s * 0.14, y);
  g.lineTo(x + s * 0.12, y + s * 0.22);
  g.strokeStyle = '#fff';
  g.lineWidth = 3.5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke();
}

export function drawGearIcon(g: G, x: number, y: number, s: number) {
  rrect(g, x - s / 2, y - s / 2, s, s, s * 0.3, 'rgba(0,0,0,0.3)', 'rgba(255,255,255,0.85)', 2.5);
  g.save();
  g.translate(x, y);
  g.fillStyle = '#fff';
  for (let i = 0; i < 8; i++) {
    g.rotate(Math.PI / 4);
    g.fillRect(-s * 0.06, -s * 0.3, s * 0.12, s * 0.14);
  }
  g.beginPath();
  g.arc(0, 0, s * 0.2, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(0, 0, s * 0.08, 0, Math.PI * 2);
  g.fillStyle = '#6a4aa0';
  g.fill();
  g.restore();
}
