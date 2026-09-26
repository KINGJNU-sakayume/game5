// 터치/마우스/키보드 입력 → 탭(누름) / 뗌 / 플릭 이벤트 (정밀 타임스탬프 포함)

export type RawKind = 'down' | 'up' | 'flick' | 'move' | 'cancel';

export interface RawInput {
  kind: RawKind;
  id: number;
  /** 디자인 좌표 */
  x: number;
  y: number;
  /** performance.now() 기준 ms */
  perf: number;
  /** 플릭 방향 (정규화) */
  dx: number;
  dy: number;
  /** 키보드 입력 여부 */
  key?: boolean;
}

interface PState {
  x0: number;
  y0: number;
  t0: number;
  x: number;
  y: number;
  flicked: boolean;
  hist: { x: number; y: number; t: number }[];
}

/** 플릭 판정: 최근 70ms 동안의 이동 거리 (CSS px) */
const FLICK_DIST = 16;
const FLICK_WINDOW = 70;

export class InputManager {
  private pointers = new Map<number, PState>();
  private keysDown = new Set<string>();
  private toDesign: (cx: number, cy: number) => { x: number; y: number };
  handler: (e: RawInput) => void;

  constructor(el: HTMLElement, toDesign: (cx: number, cy: number) => { x: number; y: number }, handler: (e: RawInput) => void) {
    this.toDesign = toDesign;
    this.handler = handler;
    const opts = { passive: false } as AddEventListenerOptions;
    el.addEventListener('pointerdown', (e) => this.onDown(e), opts);
    window.addEventListener('pointermove', (e) => this.onMove(e), opts);
    window.addEventListener('pointerup', (e) => this.onUp(e, 'up'), opts);
    window.addEventListener('pointercancel', (e) => this.onUp(e, 'cancel'), opts);
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    // iOS 제스처(확대/스크롤/길게누르기) 방지
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener('touchstart', prevent, opts);
    el.addEventListener('touchmove', prevent, opts);
    el.addEventListener('touchend', prevent, opts);
    document.addEventListener('gesturestart', prevent, opts);
    document.addEventListener('dblclick', prevent, opts);
    el.addEventListener('contextmenu', prevent, opts);
  }

  get holding(): boolean {
    return this.pointers.size > 0 || this.keysDown.has('tap');
  }

  private stamp(e: Event): number {
    const now = performance.now();
    const ts = e.timeStamp;
    // timeStamp가 performance 시계와 같은 기준인지 확인 (아니면 현재 시각 사용)
    if (typeof ts === 'number' && ts > 0 && ts <= now + 5 && now - ts < 250) return ts;
    return now;
  }

  private onDown(e: PointerEvent) {
    e.preventDefault();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const t = this.stamp(e);
    const p = this.toDesign(e.clientX, e.clientY);
    this.pointers.set(e.pointerId, {
      x0: e.clientX,
      y0: e.clientY,
      t0: t,
      x: e.clientX,
      y: e.clientY,
      flicked: false,
      hist: [{ x: e.clientX, y: e.clientY, t }],
    });
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    this.handler({ kind: 'down', id: e.pointerId, x: p.x, y: p.y, perf: t, dx: 0, dy: 0 });
  }

  private onMove(e: PointerEvent) {
    const st = this.pointers.get(e.pointerId);
    if (!st) return;
    e.preventDefault();
    const t = this.stamp(e);
    st.x = e.clientX;
    st.y = e.clientY;
    st.hist.push({ x: e.clientX, y: e.clientY, t });
    while (st.hist.length > 2 && t - st.hist[0].t > FLICK_WINDOW) st.hist.shift();
    const h0 = st.hist[0];
    const dx = e.clientX - h0.x;
    const dy = e.clientY - h0.y;
    const dist = Math.hypot(dx, dy);
    const p = this.toDesign(e.clientX, e.clientY);
    if (!st.flicked && dist >= FLICK_DIST) {
      st.flicked = true;
      this.handler({ kind: 'flick', id: e.pointerId, x: p.x, y: p.y, perf: t, dx: dx / dist, dy: dy / dist });
    } else if (st.flicked && dist < 3 && st.hist.length > 3) {
      // 손가락을 멈추면 다시 플릭 가능
      st.flicked = false;
    }
    this.handler({ kind: 'move', id: e.pointerId, x: p.x, y: p.y, perf: t, dx: 0, dy: 0 });
  }

  private onUp(e: PointerEvent, kind: 'up' | 'cancel') {
    const st = this.pointers.get(e.pointerId);
    if (!st) return;
    e.preventDefault();
    const t = this.stamp(e);
    const p = this.toDesign(e.clientX, e.clientY);
    if (!st.flicked) {
      // 이동 이벤트 없이 빠르게 튕긴 경우
      const dx = e.clientX - st.x0;
      const dy = e.clientY - st.y0;
      const dist = Math.hypot(dx, dy);
      if (dist >= FLICK_DIST && t - st.t0 < 220) {
        this.handler({ kind: 'flick', id: e.pointerId, x: p.x, y: p.y, perf: t, dx: dx / dist, dy: dy / dist });
      }
    }
    this.pointers.delete(e.pointerId);
    this.handler({ kind, id: e.pointerId, x: p.x, y: p.y, perf: t, dx: 0, dy: 0 });
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const tapKeys = ['Space', 'Enter', 'KeyJ', 'KeyF', 'KeyZ'];
    // 좌/우 구분 게임용: F = 왼쪽, J = 오른쪽 (디자인 좌표)
    const keyX = e.code === 'KeyF' ? 60 : e.code === 'KeyJ' ? 333 : -1;
    const flickKeys = ['KeyK', 'KeyD', 'KeyX', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'ArrowDown'];
    const t = this.stamp(e);
    if (tapKeys.includes(e.code)) {
      e.preventDefault();
      if (down) {
        if (e.repeat || this.keysDown.has('tap')) return;
        this.keysDown.add('tap');
        this.handler({ kind: 'down', id: -1, x: keyX, y: -1, perf: t, dx: 0, dy: 0, key: true });
      } else {
        if (!this.keysDown.has('tap')) return;
        this.keysDown.delete('tap');
        this.handler({ kind: 'up', id: -1, x: keyX, y: -1, perf: t, dx: 0, dy: 0, key: true });
      }
    } else if (flickKeys.includes(e.code)) {
      e.preventDefault();
      if (down && !e.repeat) {
        const dir: Record<string, [number, number]> = {
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
        };
        const [dx, dy] = dir[e.code] ?? [0.7, -0.7];
        this.handler({ kind: 'flick', id: -2, x: -1, y: -1, perf: t, dx, dy, key: true });
      }
    } else if (e.code === 'Escape' && down) {
      this.handler({ kind: 'cancel', id: -3, x: -1, y: -1, perf: t, dx: 0, dy: 0, key: true });
    }
  }

  reset() {
    this.pointers.clear();
    this.keysDown.clear();
  }
}
