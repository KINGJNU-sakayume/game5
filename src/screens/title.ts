// 타이틀 화면
import type { App, Screen } from '../app';
import { audio } from '../core/audio';
import { OUT, rrect, text, wrapText, type G, type View } from '../core/gfx';
import type { RawInput } from '../core/input';
import { bgm, COMMON_SFX } from '../bgm';
import { logo, mascot, nightSky, orbitStars } from './backdrop';
import { MenuScreen } from './menu';

function isIOSSafariBrowser(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  return ios && !standalone;
}

export class TitleScreen implements Screen {
  readonly id = 'TitleScreen';
  private t = 0;
  private loading = false;
  private err = '';
  private showHint = isIOSSafariBrowser();

  constructor(private app: App) {}

  update(dt: number) {
    this.t += dt;
  }

  draw(g: G, v: View) {
    const { W, H, safe } = v;
    const t = this.t;
    const beat = t * (112 / 60);
    nightSky(g, W, H, t);
    const my = H * 0.42;
    orbitStars(g, W / 2, my, 150, t);
    mascot(g, W / 2, my, 92, beat, this.loading ? 'happy' : 'normal');
    logo(g, W / 2, H * 0.2 + safe.t * 0.5, 50, t);
    const by = H * 0.68;
    if (this.err) {
      wrapText(g, this.err, W / 2, by - 20, W - 60, 15, '#fff', 1.4);
    } else if (this.loading) {
      const dots = '.'.repeat(1 + (Math.floor(t * 4) % 3));
      text(g, '준비 중' + dots, W / 2, by, 22, '#fff', { stroke: OUT, strokeW: 5 });
    } else {
      const a = 0.55 + 0.45 * Math.sin(t * 4);
      g.globalAlpha = a;
      rrect(g, W / 2 - 130, by - 28, 260, 56, 28, '#ffe14d', OUT, 4);
      g.globalAlpha = 1;
      text(g, '화면을 터치하세요', W / 2, by, 22, OUT, { weight: 900 });
    }
    if (this.showHint) {
      const hy = H - safe.b - 96;
      rrect(g, 20, hy, W - 40, 74, 16, 'rgba(255,255,255,0.92)', OUT, 3);
      text(g, '📲 전체 화면으로 즐기기', W / 2, hy + 22, 16, '#5a3aa0', { weight: 900 });
      text(g, 'Safari 공유 버튼 → "홈 화면에 추가"', W / 2, hy + 50, 14, OUT, { weight: 700 });
    } else {
      text(g, '© 리듬 별나라 · 모든 그림과 음악은 직접 만든 오리지널', W / 2, H - safe.b - 18, 11, 'rgba(255,255,255,0.7)', { weight: 600 });
    }
  }

  input(e: RawInput) {
    if (e.kind === 'up' || (e.key && e.kind === 'down')) void this.start();
  }

  visible() {
    void audio.resume();
  }

  private async start() {
    if (this.loading) return;
    this.loading = true;
    try {
      audio.unlock();
      if (!audio.ctx) throw new Error('이 브라우저는 Web Audio를 지원하지 않아요.');
      await audio.ensureSfx(COMMON_SFX);
      await bgm.ensure();
      bgm.play();
      audio.sfx('uiConfirm');
      this.app.go(new MenuScreen(this.app));
    } catch (e) {
      console.error(e);
      this.err = '오디오를 시작하지 못했어요. 다시 터치해 주세요.\n' + String((e as Error).message ?? e);
      this.loading = false;
    }
  }
}
