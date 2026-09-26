// 게임 화면: 타이틀 카드 → (연습) → 본 게임 → 결과
import type { App, Screen } from '../app';
import { audio } from '../core/audio';
import type { Frame, GameDef } from '../core/game';
import { OUT, circle, rrect, star, text, wrapText, type G, type View } from '../core/gfx';
import type { RawInput } from '../core/input';
import { getSave, record, save } from '../core/save';
import { PlaySession, PracticeSession, freeSongSamples } from '../core/session';
import { clamp01, easeInCubic, easeOutBack, easeOutCubic } from '../core/util';
import { button, drawButton, drawPauseIcon, handleButtons, hit, type Button } from '../ui';
import { perfectBadge } from './badges';
import { ResultScreen } from './results';
import { MenuScreen } from './menu';

export interface PlayOpts {
  practice: boolean;
  perfect: boolean;
  autoplay?: boolean;
  rate?: number;
}

type Phase = 'card' | 'practice' | 'practiceEnd' | 'play' | 'ending' | 'perfectFail' | 'error';

export class PlayScreen implements Screen {
  readonly id = 'PlayScreen';
  private phase: Phase = 'card';
  private phaseT = 0;
  private realT = 0;
  private practice: PracticeSession | null = null;
  private session: PlaySession;
  private loaded = false;
  private loadErr = '';
  private paused = false;
  private pauseT = 0;
  private countdown = -1;
  private pauseButtons: Button[] = [];
  private failButtons: Button[] = [];
  private skipButton: Button | null = null;
  private pauseBtn = { x: 0, y: 0, w: 44, h: 44 };
  private wipe = 0;
  private stepBanner = { text: '', t: -10 };
  private view: View;
  private startedAt = 0;
  private stalled = 0;

  constructor(private app: App, private def: GameDef, private opts: PlayOpts) {
    const holding = () => app.input.holding;
    this.view = app.view;
    const auto = opts.autoplay ?? app.params.get('auto') === '1';
    const rate = opts.rate ?? (parseFloat(app.params.get('rate') ?? '1') || 1);
    if (opts.practice && def.practice.length) {
      this.practice = new PracticeSession(def, { holding, autoplay: auto, rate });
      this.practice.onDone = () => {
        record(def.id).practiced = true;
        save();
        this.setPhase('practiceEnd');
        audio.sfx('okJingle', 0, 0.8);
      };
      this.practice.onStepDone = (i) => {
        if (i + 1 < def.practice.length) {
          this.stepBanner = { text: '좋아요! 다음 단계!', t: this.realT };
          audio.sfx('okJingle', 0, 0.6);
        }
      };
    }
    this.session = new PlaySession(def, { holding, perfect: opts.perfect, autoplay: auto, rate });
    this.session.onEnd = (res) => {
      this.setPhase('ending');
      setTimeout(() => this.app.go(new ResultScreen(this.app, this.def, res, this.opts), '#000', 0.5), 1400);
    };
    this.session.onPerfectFail = () => {
      this.setPhase('perfectFail');
      audio.sfx('sadJingle', 0, 0.8);
    };
  }

  enter() {
    void this.load();
  }

  private async load() {
    try {
      freeSongSamples(this.def.id);
      if (this.practice) await this.practice.load();
      await this.session.load();
      // 렌더링이 끝난 악기 샘플은 메모리에서 해제 (효과음과 완성된 곡은 유지)
      freeSongSamples(this.def.id);
      this.loaded = true;
    } catch (e) {
      console.error(e);
      this.loadErr = String((e as Error).message ?? e);
      this.setPhase('error');
    }
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
  }

  private layoutButtons(v: View) {
    const { W, H, safe } = v;
    this.pauseBtn = { x: safe.l + 12, y: safe.t + 8, w: 44, h: 44 };
    const bw = W - 96;
    const cy = H / 2 - 40;
    const inPractice = this.phase === 'practice';
    const list: Button[] = [
      button({ x: 48, y: cy - 20, w: bw, h: 58, label: '계속하기', color: '#6be3a0', onTap: () => this.resumeWithCount() }),
      button({
        x: 48,
        y: cy + 50,
        w: bw,
        h: 58,
        label: '처음부터',
        color: '#6bc6ff',
        onTap: () => this.restart(),
      }),
      button({ x: 48, y: cy + 120, w: bw, h: 58, label: '그만두기', color: '#ff6b8b', onTap: () => this.quit() }),
    ];
    // 처음 하는 연습은 원작처럼 건너뛸 수 없음
    if (inPractice && record(this.def.id).practiced) {
      list.splice(
        1,
        0,
        button({ x: 48, y: cy + 50, w: bw, h: 58, label: '연습 건너뛰기', color: '#ffb84d', onTap: () => this.skipPractice() }),
      );
      list[2].y = cy + 120;
      list[3].y = cy + 190;
    }
    this.pauseButtons = list;
    this.failButtons = [
      button({ x: 48, y: H / 2 + 60, w: bw, h: 58, label: '다시 도전', color: '#c77dff', onTap: () => this.app.go(new PlayScreen(this.app, this.def, { ...this.opts, practice: false })) }),
      button({ x: 48, y: H / 2 + 130, w: bw, h: 58, label: '메뉴로', color: '#6bc6ff', onTap: () => this.quit() }),
    ];
    if (this.practice && record(this.def.id).practiced) {
      this.skipButton = button({
        x: W - safe.r - 132,
        y: H - safe.b - 64,
        w: 118,
        h: 46,
        label: '건너뛰기 ▶',
        color: '#ffb84d',
        size: 16,
        onTap: () => this.skipPractice(),
      });
    } else this.skipButton = null;
  }

  private restart() {
    this.stopAll();
    this.app.go(new PlayScreen(this.app, this.def, { ...this.opts, practice: false }));
  }

  private quit() {
    this.stopAll();
    this.app.go(new MenuScreen(this.app, this.def.id));
  }

  private stopAll() {
    this.practice?.stop();
    this.session.stop();
    if (audio.ctx && audio.ctx.state !== 'running') void audio.resume();
  }

  private skipPractice() {
    if (!this.practice) return;
    this.paused = false;
    this.countdown = -1;
    this.practice.stop();
    void audio.resume();
    record(this.def.id).practiced = true;
    save();
    this.startPlay();
  }

  private startPlay() {
    this.setPhase('play');
    this.wipe = 1;
    this.session.start(0.15);
    this.startedAt = this.realT;
  }

  private pause() {
    if (this.paused) return;
    const s = this.activeSession();
    if (!s || s.state !== 'playing') return;
    this.paused = true;
    this.pauseT = 0;
    this.countdown = -1;
    s.pause();
    this.layoutButtons(this.view);
  }

  private resumeWithCount() {
    // 버튼 탭(사용자 제스처)에서 App이 오디오 컨텍스트를 깨움. 곡은 카운트다운 뒤에 다시 예약됨
    this.countdown = 1.5;
  }

  private activeSession() {
    if (this.phase === 'practice' || this.phase === 'practiceEnd') return this.practice;
    if (this.phase === 'play') return this.session;
    return null;
  }

  hidden() {
    this.pause();
  }

  update(dt: number, perf: number) {
    this.realT += dt;
    this.phaseT += dt;
    this.view = this.app.view;
    if (this.wipe > 0) this.wipe = Math.max(0, this.wipe - dt / 0.45);
    if (this.paused) {
      this.pauseT += dt;
      if (this.countdown >= 0) {
        this.countdown -= dt;
        if (this.countdown < 0) {
          this.paused = false;
          this.activeSession()?.resume();
        }
      }
      return;
    }
    if (this.phase === 'card' && this.loaded && this.phaseT > 1.7) {
      this.layoutButtons(this.view);
      if (this.practice) {
        this.setPhase('practice');
        this.wipe = 1;
        this.practice.start(0.15);
      } else this.startPlay();
    }
    // 오디오가 멈춰 있으면(전화/백그라운드 등) 자동 일시정지
    if ((this.phase === 'play' || this.phase === 'practice') && audio.ctx && audio.ctx.state !== 'running') {
      this.stalled += dt;
      if (this.stalled > 0.3) {
        this.stalled = 0;
        this.pause();
        return;
      }
    } else this.stalled = 0;
    if (this.phase === 'practice') this.practice?.update(perf);
    if (this.phase === 'practiceEnd') {
      if (this.phaseT > 2.2) this.startPlay();
    }
    if (this.phase === 'play') this.session.update(perf);
  }

  private frameBase(v: View, dt: number): Omit<Frame, 't' | 'beat'> {
    return { W: v.W, H: v.H, safe: v.safe, dt: this.paused ? 0 : dt, real: this.realT };
  }

  draw(g: G, v: View, perf: number, dt: number) {
    const { W, H, safe } = v;
    const def = this.def;
    if (this.phase === 'card' || this.phase === 'error') {
      this.drawCard(g, v);
      return;
    }
    const s = this.phase === 'play' || this.phase === 'ending' || this.phase === 'perfectFail' ? this.session : this.practice!;
    const f = s.frame(this.frameBase(v, dt), perf);
    s.scene.draw(g, f);
    if (this.wipe > 0) {
      // 카드가 위로 걷히는 전환
      g.save();
      g.translate(0, -H * easeInCubic(1 - this.wipe));
      this.drawCard(g, v);
      g.restore();
    }
    // HUD (카드가 걷힌 뒤)
    if (this.wipe > 0.2) return;
    if (this.phase === 'practice' || this.phase === 'practiceEnd') this.drawPracticeUI(g, v);
    if (this.phase === 'play' && this.session.perfectMode) {
      perfectBadge(g, W - safe.r - 34, safe.t + 30, 20, Math.sin(this.realT * 3) * 0.15);
    }
    if (this.phase === 'play' && getSave().settings.showTiming) this.drawTiming(g, v);
    if (this.phase === 'practice' || this.phase === 'play') {
      drawPauseIcon(g, this.pauseBtn.x + this.pauseBtn.w / 2, this.pauseBtn.y + this.pauseBtn.h / 2, 40);
    }
    if (this.phase === 'perfectFail') this.drawPerfectFail(g, v);
    if (this.paused) this.drawPause(g, v);
    void def;
  }

  private drawCard(g: G, v: View) {
    const { W, H } = v;
    const def = this.def;
    g.fillStyle = def.remix ? '#2b1a55' : def.color;
    g.fillRect(0, 0, W, H);
    // 줄무늬
    g.save();
    g.globalAlpha = 0.12;
    g.fillStyle = '#fff';
    const off = (this.realT * 40) % 60;
    for (let x = -H; x < W + H; x += 60) {
      g.beginPath();
      g.moveTo(x + off, 0);
      g.lineTo(x + off + 30, 0);
      g.lineTo(x + off + 30 - H, H);
      g.lineTo(x + off - H, H);
      g.fill();
    }
    g.restore();
    const k = easeOutBack(clamp01(this.phaseT / 0.5));
    g.save();
    g.translate(W / 2, H * 0.38);
    g.scale(k, k);
    circle(g, 0, 0, 110, 'rgba(255,255,255,0.25)');
    def.drawIcon(g, 0, 0, 200, this.realT);
    g.restore();
    const k2 = easeOutCubic(clamp01((this.phaseT - 0.2) / 0.4));
    g.globalAlpha = k2;
    text(g, def.title, W / 2, H * 0.58 + (1 - k2) * 20, 40, '#fff', { weight: 900, stroke: OUT, strokeW: 9 });
    text(g, def.sub, W / 2, H * 0.58 + 44, 16, '#fff', { weight: 800, stroke: OUT, strokeW: 5 });
    g.globalAlpha = 1;
    if (this.phase === 'error') {
      rrect(g, 24, H * 0.7, W - 48, 120, 16, '#fff', OUT, 3);
      wrapText(g, '음악을 준비하지 못했어요.\n' + this.loadErr, W / 2, H * 0.7 + 16, W - 80, 15, OUT, 1.4);
    } else if (!this.loaded && this.phaseT > 0.8) {
      const dots = '●'.repeat(1 + (Math.floor(this.realT * 4) % 3));
      text(g, dots, W / 2, H * 0.76, 16, 'rgba(255,255,255,0.85)');
    } else if (this.phase !== 'card' || this.practice) {
      const lbl = this.phase === 'card' ? '연습부터!' : '실전!';
      rrect(g, W / 2 - 60, H * 0.74, 120, 36, 18, this.phase === 'card' ? '#fff' : '#ffe14d', OUT, 3);
      text(g, lbl, W / 2, H * 0.74 + 18.5, 16, OUT, { weight: 900 });
    }
  }

  private drawPracticeUI(g: G, v: View) {
    const p = this.practice!;
    const { W, H, safe } = v;
    const step = p.currentStep;
    const y = safe.t + 58;
    const bh = 104;
    rrect(g, 14, y, W - 28, bh, 18, 'rgba(255,255,255,0.93)', OUT, 3);
    rrect(g, 26, y - 12, 92, 26, 13, '#ff6b8b', OUT, 2.5);
    text(g, `연습 ${p.step + 1}/${this.def.practice.length}`, 72, y + 1.5, 13, '#fff', { weight: 900 });
    wrapText(g, step.text, W / 2, y + 18, W - 60, 17, OUT, 1.35, { weight: 800 });
    // 진행도
    const n = step.need;
    const done = Math.min(n, p.successes);
    for (let i = 0; i < n; i++) {
      const cx = W / 2 + (i - (n - 1) / 2) * 26;
      const on = i < done;
      star(g, cx, y + bh - 16, on ? 10 : 8, on ? 4.5 : 3.6, 5, -Math.PI / 2, on ? '#ffd23e' : '#e0dbe8', OUT, 2);
    }
    // 피드백
    const fb = p.feedback;
    const now = p.songTime();
    if (fb && now - fb.time < 0.7 && now >= fb.time - 0.05) {
      const k = easeOutBack(clamp01((now - fb.time) / 0.2));
      const a = 1 - clamp01((now - fb.time - 0.45) / 0.25);
      g.globalAlpha = a;
      g.save();
      g.translate(W / 2, y + bh + 40);
      g.scale(k, k);
      text(g, fb.text, 0, 0, 26, fb.color, { weight: 900, stroke: OUT, strokeW: 6 });
      g.restore();
      g.globalAlpha = 1;
    }
    if (this.realT - this.stepBanner.t < 1.4) {
      const k = easeOutBack(clamp01((this.realT - this.stepBanner.t) / 0.25));
      g.save();
      g.translate(W / 2, H * 0.45);
      g.scale(k, k);
      rrect(g, -140, -34, 280, 68, 22, '#ffe14d', OUT, 4);
      text(g, this.stepBanner.text, 0, 1, 24, OUT, { weight: 900 });
      g.restore();
    }
    if (this.phase === 'practiceEnd') {
      const k = easeOutBack(clamp01(this.phaseT / 0.3));
      g.fillStyle = `rgba(0,0,0,${0.35 * clamp01(this.phaseT / 0.3)})`;
      g.fillRect(0, 0, W, H);
      g.save();
      g.translate(W / 2, H * 0.45);
      g.scale(k, k);
      rrect(g, -160, -60, 320, 120, 26, '#fff', OUT, 4);
      text(g, '잘했어요!', 0, -18, 30, '#ff6b8b', { weight: 900, stroke: OUT, strokeW: 6 });
      text(g, '이제 실전이에요!', 0, 26, 22, OUT, { weight: 900 });
      g.restore();
    }
    if (this.skipButton && this.phase === 'practice') drawButton(g, this.skipButton);
  }

  private drawTiming(g: G, v: View) {
    const c = this.session.lastJudged;
    if (!c || c.grade !== 'barely' || c.at == null) return;
    const now = this.session.songTime();
    if (now - c.at > 0.45) return;
    const late = (c.dt ?? 0) > 0;
    text(g, late ? '늦음' : '빠름', v.W / 2, v.safe.t + 30, 18, late ? '#ff9a9a' : '#9fd6ff', { weight: 900, stroke: OUT, strokeW: 5 });
  }

  private drawPause(g: G, v: View) {
    const { W, H } = v;
    g.fillStyle = 'rgba(15,8,35,0.72)';
    g.fillRect(0, 0, W, H);
    if (this.countdown >= 0) {
      const n = Math.ceil(this.countdown / 0.5);
      const fr = (this.countdown % 0.5) / 0.5;
      g.save();
      g.translate(W / 2, H / 2);
      g.scale(1 + fr * 0.3, 1 + fr * 0.3);
      text(g, String(Math.max(1, n)), 0, 0, 90, '#ffe14d', { weight: 900, stroke: OUT, strokeW: 12 });
      g.restore();
      return;
    }
    const k = easeOutBack(clamp01(this.pauseT / 0.25));
    const cy = H / 2 - 40;
    g.save();
    g.translate(W / 2, cy - 90);
    g.scale(k, k);
    text(g, '일시정지', 0, 0, 34, '#fff', { weight: 900, stroke: OUT, strokeW: 8 });
    g.restore();
    text(g, this.def.title, W / 2, cy - 50, 16, 'rgba(255,255,255,0.8)', { weight: 800 });
    for (const b of this.pauseButtons) drawButton(g, b, clamp01(this.pauseT / 0.2));
  }

  private drawPerfectFail(g: G, v: View) {
    const { W, H } = v;
    const k = clamp01(this.phaseT / 0.4);
    g.fillStyle = `rgba(20,10,40,${0.75 * k})`;
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate(W / 2, H / 2 - 70);
    const crack = clamp01(this.phaseT / 0.6);
    for (const side of [-1, 1]) {
      g.save();
      g.translate(side * crack * 20, crack * crack * 40);
      g.rotate(side * crack * 0.3);
      g.beginPath();
      if (side < 0) g.rect(-80, -80, 80, 160);
      else g.rect(0, -80, 80, 160);
      g.clip();
      perfectBadge(g, 0, 0, 56, 0);
      g.restore();
    }
    g.restore();
    text(g, '퍼펙트 실패...', W / 2, H / 2 + 10, 30, '#fff', { weight: 900, stroke: OUT, strokeW: 7, alpha: k });
    if (this.phaseT > 1.2) {
      this.layoutButtons(v);
      for (const b of this.failButtons) drawButton(g, b, clamp01((this.phaseT - 1.2) / 0.25));
    }
  }

  input(e: RawInput) {
    if (this.paused) {
      if (this.countdown < 0) {
        if (handleButtons(this.pauseButtons, e)) return;
        if (e.key && e.kind === 'cancel') this.resumeWithCount();
      }
      return;
    }
    if (this.phase === 'perfectFail') {
      if (this.phaseT > 1.2) handleButtons(this.failButtons, e);
      return;
    }
    if (this.phase === 'card') return;
    if (e.key && e.kind === 'cancel') {
      this.pause();
      return;
    }
    // 일시정지 버튼 (게임 입력으로 쓰지 않음)
    const pb = this.pauseBtn;
    if (!e.key && (e.kind === 'down' || e.kind === 'up') && hit({ ...pb, label: '', color: '', onTap: () => undefined }, e.x, e.y, 6)) {
      if (e.kind === 'up') this.pause();
      return;
    }
    if (this.phase === 'practice') {
      if (this.skipButton && !e.key && hit(this.skipButton, e.x, e.y, 4)) {
        handleButtons([this.skipButton], e);
        return;
      }
      this.practice?.handleRaw(e);
    } else if (this.phase === 'play') {
      this.session.handleRaw(e);
    }
  }

  /** 테스트/디버그용 상태 */
  debugState() {
    const s = this.activeSession();
    return {
      phase: this.phase,
      paused: this.paused,
      loaded: this.loaded,
      t: s ? s.songTime() : -1,
      result: this.session.result,
      startedAt: this.startedAt,
    };
  }
}
