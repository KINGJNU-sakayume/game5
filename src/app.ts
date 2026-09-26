// 앱 셸: 전체 화면 캔버스, 해상도/세이프 에어리어, 화면 전환, 메인 루프
import { audio } from './core/audio';
import { InputManager, type RawInput } from './core/input';
import { OUT, font, text, type G, type View } from './core/gfx';

export interface Screen {
  /** 화면 이름 (빌드 시 클래스 이름이 줄어들어도 유지) */
  readonly id?: string;
  enter?(): void;
  exit?(): void;
  update?(dt: number, perf: number): void;
  draw(g: G, v: View, perf: number, dt: number): void;
  input?(e: RawInput): void;
  hidden?(): void;
  visible?(): void;
}

/** 기준 해상도: iPhone 15 Pro 논리 해상도 393 x 852 pt */
export const DESIGN_W = 393;
export const DESIGN_H = 852;

export class App {
  canvas: HTMLCanvasElement;
  g: G;
  view: View = { W: DESIGN_W, H: DESIGN_H, safe: { t: 0, b: 0, l: 0, r: 0 } };
  scale = 1;
  dpr = 1;
  left = 0;
  cssW = DESIGN_W;
  cssH = DESIGN_H;
  screen: Screen | null = null;
  private next: Screen | null = null;
  private fade = 0;
  private fadeDir = 0;
  private fadeSpeed = 1 / 0.22;
  fadeColor = '#000';
  input: InputManager;
  private lastPerf = performance.now();
  real = 0;
  params: URLSearchParams;
  frames = 0;
  rotateHint = false;
  private safeProbe: HTMLElement;
  private sizeKey = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const g = canvas.getContext('2d', { alpha: false });
    if (!g) throw new Error('Canvas 2D not supported');
    this.g = g;
    this.params = new URLSearchParams(location.search);
    this.safeProbe = document.getElementById('safe') ?? document.body;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    this.input = new InputManager(canvas, (cx, cy) => this.toDesign(cx, cy), (e) => this.onInput(e));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.screen?.hidden?.();
        void audio.suspend();
      } else {
        this.screen?.visible?.();
      }
    });
    audio.onStateChange = (s) => {
      if (s !== 'running') this.screen?.hidden?.();
    };
    requestAnimationFrame(() => this.loop());
  }

  toDesign(cx: number, cy: number) {
    return { x: (cx - this.left) / this.scale, y: cy / this.scale };
  }

  /** 홈 화면(PWA) 실행 직후 iOS가 화면 크기/세이프 에어리어를 늦게 알려 주는 경우를 대비해 주기적으로 확인 */
  private viewportKey() {
    const cs = getComputedStyle(this.safeProbe);
    return [window.innerWidth, window.innerHeight, window.devicePixelRatio, cs.paddingTop, cs.paddingBottom, cs.paddingLeft, cs.paddingRight].join();
  }

  resize() {
    this.sizeKey = this.viewportKey();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // 세로가 긴 폰 화면은 꽉 채우고, 가로로 넓은 화면(태블릿/PC)은 폰 비율로 가운데 표시
    let w = vw;
    const h = vh;
    const letterbox = w / h > 0.62;
    if (letterbox) w = Math.round(h * 0.5);
    this.left = Math.round((vw - w) / 2);
    this.cssW = w;
    this.cssH = h;
    const c = this.canvas;
    c.style.left = this.left + 'px';
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    const bw = Math.round(w * this.dpr);
    const bh = Math.round(h * this.dpr);
    if (c.width !== bw) c.width = bw;
    if (c.height !== bh) c.height = bh;
    this.scale = w / DESIGN_W;
    this.view.W = DESIGN_W;
    this.view.H = h / this.scale;
    // 세이프 에어리어 (노치/다이나믹 아일랜드/홈 인디케이터)
    const cs = getComputedStyle(this.safeProbe);
    const px = (v: string) => parseFloat(v) || 0;
    this.view.safe = {
      t: px(cs.paddingTop) / this.scale,
      b: px(cs.paddingBottom) / this.scale,
      l: letterbox ? 0 : px(cs.paddingLeft) / this.scale,
      r: letterbox ? 0 : px(cs.paddingRight) / this.scale,
    };
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    this.rotateHint = !!coarse && vw > vh * 1.1;
  }

  go(s: Screen, color = '#000', speed = 0.22) {
    this.next = s;
    this.fadeDir = 1;
    this.fadeColor = color;
    this.fadeSpeed = 1 / speed;
    if (!this.screen) {
      this.fade = 1;
    }
  }

  /** 페이드 없이 즉시 전환 */
  swap(s: Screen) {
    this.screen?.exit?.();
    this.screen = s;
    s.enter?.();
  }

  get transitioning() {
    return this.fadeDir !== 0;
  }

  private onInput(e: RawInput) {
    if (e.kind === 'down' || e.kind === 'up') audio.unlock();
    if (this.fadeDir === 1) return;
    this.screen?.input?.(e);
  }

  private loop() {
    requestAnimationFrame(() => this.loop());
    const perf = performance.now();
    let dt = (perf - this.lastPerf) / 1000;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    this.lastPerf = perf;
    this.real += dt;
    this.frames++;
    if (this.frames % 30 === 0 && this.viewportKey() !== this.sizeKey) this.resize();
    audio.sampleClock(perf);
    if (this.fadeDir !== 0) {
      this.fade += this.fadeDir * dt * this.fadeSpeed;
      if (this.fadeDir === 1 && this.fade >= 1) {
        this.fade = 1;
        this.fadeDir = -1;
        if (this.next) {
          this.screen?.exit?.();
          this.screen = this.next;
          this.next = null;
          this.screen.enter?.();
        }
      } else if (this.fadeDir === -1 && this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    }
    try {
      this.screen?.update?.(dt, perf);
    } catch (err) {
      console.error(err);
    }
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const k = this.dpr * this.scale;
    g.setTransform(k, 0, 0, k, 0, 0);
    try {
      this.screen?.draw(g, this.view, perf, dt);
    } catch (err) {
      console.error(err);
    }
    g.setTransform(k, 0, 0, k, 0, 0);
    if (this.fade > 0) {
      g.globalAlpha = Math.min(1, this.fade);
      g.fillStyle = this.fadeColor;
      g.fillRect(0, 0, this.view.W, this.view.H);
      g.globalAlpha = 1;
    }
    if (this.rotateHint) {
      const { W, H } = this.view;
      g.fillStyle = 'rgba(20,10,40,0.92)';
      g.fillRect(0, 0, W, H);
      text(g, '📱', W / 2, H / 2 - 40, 48, '#fff');
      text(g, '세로 화면으로 돌려 주세요', W / 2, H / 2 + 20, 20, '#fff', { stroke: OUT });
    }
    void font;
  }
}
