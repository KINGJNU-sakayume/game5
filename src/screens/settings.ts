// 설정 화면 + 타이밍 보정
import type { App, Screen } from '../app';
import { audio, renderSong } from '../core/audio';
import { ChartBuilder } from '../core/chart';
import { OUT, circle, rrect, text, wrapText, type G, type View } from '../core/gfx';
import type { RawInput } from '../core/input';
import { getSave, resetSave, save } from '../core/save';
import { clamp, clamp01, easeOutBack, frac } from '../core/util';
import { button, drawBackIcon, drawButton, handleButtons, hit, type Button } from '../ui';
import { nightSky } from './backdrop';
import { MenuScreen } from './menu';

function toMenu(app: App) {
  app.go(new MenuScreen(app));
}

export class SettingsScreen implements Screen {
  readonly id = 'SettingsScreen';
  private t = 0;
  private buttons: Button[] = [];
  private back = { x: 0, y: 0, w: 44, h: 44 };
  private confirmReset = -10;
  private layoutFor = '';

  constructor(private app: App) {}

  private layout(v: View) {
    const { W, safe } = v;
    const s = getSave().settings;
    this.back = { x: safe.l + 14, y: safe.t + 10, w: 44, h: 44 };
    const y0 = safe.t + 84;
    const rowH = 76;
    const bx = W - 24 - 120;
    const small = (x: number, y: number, label: string, onTap: () => void, color = '#6bc6ff') =>
      button({ x, y, w: 52, h: 44, label, color, size: 22, onTap });
    const step = (key: 'music' | 'sfx', d: number) => () => {
      s[key] = clamp(Math.round((s[key] + d) * 10) / 10, 0, 1);
      audio.musicVolume = s.music;
      audio.sfxVolume = s.sfx;
      audio.applyVolumes();
      save();
      if (key === 'sfx') audio.sfx('chop');
    };
    this.buttons = [
      button({ x: bx, y: y0 + 14, w: 120, h: 46, label: '조정하기', color: '#ffb84d', size: 17, onTap: () => this.app.go(new CalibrationScreen(this.app)) }),
      small(bx, y0 + rowH + 14, '−', step('music', -0.1)),
      small(bx + 68, y0 + rowH + 14, '+', step('music', 0.1)),
      small(bx, y0 + rowH * 2 + 14, '−', step('sfx', -0.1)),
      small(bx + 68, y0 + rowH * 2 + 14, '+', step('sfx', 0.1)),
      button({
        x: bx,
        y: y0 + rowH * 3 + 14,
        w: 120,
        h: 46,
        label: s.showTiming ? '켜짐' : '꺼짐',
        color: s.showTiming ? '#6be3a0' : '#9a8aa8',
        size: 17,
        onTap: () => {
          s.showTiming = !s.showTiming;
          save();
          this.layoutFor = '';
        },
      }),
      button({
        x: bx,
        y: y0 + rowH * 4 + 14,
        w: 120,
        h: 46,
        label: s.unlockAll ? '켜짐' : '꺼짐',
        color: s.unlockAll ? '#6be3a0' : '#9a8aa8',
        size: 17,
        onTap: () => {
          s.unlockAll = !s.unlockAll;
          save();
          this.layoutFor = '';
        },
      }),
      button({
        x: bx,
        y: y0 + rowH * 5 + 14,
        w: 120,
        h: 46,
        label: this.t - this.confirmReset < 3 ? '정말요?' : '초기화',
        color: '#ff6b8b',
        size: 17,
        onTap: () => {
          if (this.t - this.confirmReset < 3) {
            resetSave();
            this.confirmReset = -10;
            audio.sfx('uiBack');
          } else this.confirmReset = this.t;
          this.layoutFor = '';
        },
      }),
    ];
  }

  update(dt: number) {
    this.t += dt;
    const key = `${this.app.view.W}x${this.app.view.H}:${this.app.view.safe.t}:${this.t - this.confirmReset < 3}`;
    if (key !== this.layoutFor) {
      this.layoutFor = key;
      this.layout(this.app.view);
    }
  }

  draw(g: G, v: View) {
    const { W, H, safe } = v;
    nightSky(g, W, H, this.t);
    drawBackIcon(g, this.back.x + 22, this.back.y + 22, 40);
    text(g, '설정', W / 2, safe.t + 32, 26, '#fff', { weight: 900, stroke: OUT, strokeW: 6 });
    const s = getSave().settings;
    const y0 = safe.t + 84;
    const rowH = 76;
    const rows: [string, string][] = [
      ['타이밍 보정', `${s.calib >= 0 ? '+' : ''}${Math.round(s.calib * 1000)}ms`],
      ['음악 볼륨', `${Math.round(s.music * 100)}%`],
      ['효과음 볼륨', `${Math.round(s.sfx * 100)}%`],
      ['빠름/늦음 표시', '본 게임 중 표시'],
      ['모든 게임 열기', '잠금 해제'],
      ['기록 초기화', '메달/기록 삭제'],
    ];
    rows.forEach(([label, val], i) => {
      const y = y0 + i * rowH;
      rrect(g, 14, y, W - 28, rowH - 8, 18, 'rgba(255,255,255,0.94)', OUT, 3);
      text(g, label, 30, y + 24, 17, OUT, { align: 'left', weight: 900 });
      text(g, val, 30, y + 48, 13, '#7a6a8a', { align: 'left', weight: 700 });
    });
    for (const b of this.buttons) drawButton(g, b);
    const iy = y0 + rows.length * rowH + 8;
    if (iy < H - safe.b - 60) {
      wrapText(
        g,
        '아이폰에서는 Safari 공유 버튼 → "홈 화면에 추가"로 설치하면 화면 전체를 채워서 플레이할 수 있어요.\n소리가 박자보다 늦게 들리면(블루투스 이어폰 등) 타이밍 보정을 해 주세요.',
        W / 2,
        iy,
        W - 50,
        13,
        'rgba(255,255,255,0.9)',
        1.45,
        { weight: 700 },
      );
    }
  }

  input(e: RawInput) {
    if (handleButtons(this.buttons, e)) return;
    if ((e.kind === 'up' && !e.key && hit({ ...this.back, label: '', color: '', onTap: () => undefined }, e.x, e.y)) || (e.key && e.kind === 'cancel')) {
      audio.sfx('uiBack');
      toMenu(this.app);
    }
  }
}

const CAL_BPM = 100;
const CAL_TAPS = 16;

export class CalibrationScreen implements Screen {
  readonly id = 'CalibrationScreen';
  private t = 0;
  private buffer: AudioBuffer | null = null;
  private src: AudioBufferSourceNode | null = null;
  private startCtx = 0;
  private devs: number[] = [];
  private result: number | null = null;
  private buttons: Button[] = [];
  private back = { x: 0, y: 0, w: 44, h: 44 };
  private lastTap = -10;
  private spb = 60 / CAL_BPM;

  constructor(private app: App) {}

  enter() {
    void this.load();
  }

  private async load() {
    if (!audio.ctx || !audio.bank) return;
    const b = new ChartBuilder(CAL_BPM);
    for (let i = 0; i < 4; i++) b.note(i, i === 0 ? 'countHi' : 'count', 0, 0.2, 0.9);
    for (let i = 0; i < 4; i++) b.note(i, 'kick', 0, 0.2, 0.5);
    const chart = b.build(0);
    const len = 4 * this.spb;
    const r = await renderSong(chart.notes, audio.bank, len + 1);
    const n = Math.round(len * r.sr);
    for (let i = n; i < r.length; i++) {
      r.L[i - n] += r.L[i];
      r.R[i - n] += r.R[i];
    }
    this.buffer = audio.toBuffer({ L: r.L.subarray(0, n), R: r.R.subarray(0, n), length: n, sr: r.sr });
    this.startCtx = audio.now() + 0.2;
    this.src = audio.playBuffer(this.buffer, this.startCtx, audio.musicBus, true);
  }

  exit() {
    try {
      this.src?.stop();
    } catch {
      /* ignore */
    }
  }

  private songT(perf = performance.now()) {
    return audio.heardTime(perf) - this.startCtx;
  }

  private finish() {
    const d = [...this.devs].sort((a, b) => a - b);
    const trimmed = d.slice(2, d.length - 2);
    const med = trimmed.length ? trimmed[Math.floor(trimmed.length / 2)] : 0;
    this.result = clamp(med, -0.25, 0.3);
    const { W, H, safe } = this.app.view;
    const bw = (W - 60) / 2;
    this.buttons = [
      button({
        x: 24,
        y: H - safe.b - 80,
        w: bw,
        h: 58,
        label: '적용',
        color: '#6be3a0',
        onTap: () => {
          getSave().settings.calib = this.result ?? 0;
          save();
          this.leave();
        },
      }),
      button({
        x: 36 + bw,
        y: H - safe.b - 80,
        w: bw,
        h: 58,
        label: '다시',
        color: '#6bc6ff',
        onTap: () => {
          this.devs = [];
          this.result = null;
          this.buttons = [];
        },
      }),
    ];
  }

  private leave() {
    this.app.go(new SettingsScreen(this.app));
  }

  update(dt: number) {
    this.t += dt;
    const { safe } = this.app.view;
    this.back = { x: safe.l + 14, y: safe.t + 10, w: 44, h: 44 };
  }

  draw(g: G, v: View) {
    const { W, H, safe } = v;
    nightSky(g, W, H, this.t);
    drawBackIcon(g, this.back.x + 22, this.back.y + 22, 40);
    text(g, '타이밍 보정', W / 2, safe.t + 32, 24, '#fff', { weight: 900, stroke: OUT, strokeW: 6 });
    const st = this.buffer ? this.songT() : -1;
    const beat = st / this.spb;
    const cy = H * 0.42;
    const pulse = st >= 0 ? Math.exp(-frac(beat) * 5) : 0;
    circle(g, W / 2, cy, 70 + pulse * 22, frac(beat / 4) < 0.25 ? '#ffe14d' : '#ff9ad5', OUT, 5);
    const tapK = clamp01(1 - (this.t - this.lastTap) / 0.25);
    if (tapK > 0) circle(g, W / 2, cy, 110 + (1 - tapK) * 30, null, `rgba(255,255,255,${tapK})`, 6);
    if (this.result === null) {
      wrapText(g, '"딱" 소리에 맞춰\n화면 아무 곳이나 탭하세요!', W / 2, safe.t + 90, W - 60, 19, '#fff', 1.4, { weight: 900 });
      text(g, `${Math.min(this.devs.length, CAL_TAPS)} / ${CAL_TAPS}`, W / 2, cy + 130, 22, '#fff', { weight: 900, stroke: OUT, strokeW: 5 });
      if (this.devs.length) {
        const last = this.devs[this.devs.length - 1];
        text(g, `${last >= 0 ? '+' : ''}${Math.round(last * 1000)}ms`, W / 2, cy + 164, 16, 'rgba(255,255,255,0.8)', { weight: 700 });
      }
    } else {
      const ms = Math.round(this.result * 1000);
      const k = easeOutBack(clamp01(this.t * 2));
      rrect(g, 30, cy + 110, W - 60, 110, 20, '#fff', OUT, 3);
      text(g, `측정 결과: ${ms >= 0 ? '+' : ''}${ms}ms`, W / 2, cy + 142, 22 * Math.min(1, k + 0.5), OUT, { weight: 900 });
      text(g, ms > 15 ? '조금 늦게 누르는 편이에요' : ms < -15 ? '조금 빨리 누르는 편이에요' : '딱 좋아요!', W / 2, cy + 178, 15, '#7a6a8a', { weight: 700 });
      for (const b of this.buttons) drawButton(g, b);
    }
  }

  input(e: RawInput) {
    if (this.result !== null) {
      if (handleButtons(this.buttons, e)) return;
    }
    if ((e.kind === 'up' && !e.key && hit({ ...this.back, label: '', color: '', onTap: () => undefined }, e.x, e.y)) || (e.key && e.kind === 'cancel')) {
      audio.sfx('uiBack');
      this.leave();
      return;
    }
    if (this.result !== null || !this.buffer) return;
    if (e.kind === 'down' && !hit({ ...this.back, label: '', color: '', onTap: () => undefined }, e.x, e.y)) {
      const st = this.songT(e.perf);
      if (st < 0) return;
      const ph = st / this.spb;
      const dev = (ph - Math.round(ph)) * this.spb;
      this.devs.push(dev);
      this.lastTap = this.t;
      audio.sfx('block', 0, 0.6);
      if (this.devs.length >= CAL_TAPS) this.finish();
    }
  }
}
