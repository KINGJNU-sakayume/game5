// 게임 선택 화면 (세트 4개 + 리믹스 구성)
import type { App, Screen } from '../app';
import { audio } from '../core/audio';
import type { GameDef } from '../core/game';
import { OUT, rrect, text, vgrad, wrapText, type G, type View } from '../core/gfx';
import type { RawInput } from '../core/input';
import { RANK_LABEL } from '../core/judge';
import { getSave, record } from '../core/save';
import { clamp, clamp01, easeOutBack, easeOutCubic } from '../core/util';
import { GAMES, SETS, gameById, isUnlocked, medalCount } from '../games';
import { bgm } from '../bgm';
import { button, drawButton, drawGearIcon, handleButtons, hit, type Button } from '../ui';
import { checkBadge, lockIcon, medal, perfectBadge } from './badges';
import { nightSky } from './backdrop';
import { PlayScreen } from './play';
import { SettingsScreen } from './settings';

interface Tile {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  wide: boolean;
}

export class MenuScreen implements Screen {
  readonly id = 'MenuScreen';
  private t = 0;
  private scroll = 0;
  private vel = 0;
  private drag: { y0: number; s0: number; moved: boolean; lastY: number; lastT: number } | null = null;
  private tiles: Tile[] = [];
  private headers: { title: string; sub: string; y: number }[] = [];
  private contentH = 0;
  private sel: GameDef | null = null;
  private selT = 0;
  private panelButtons: Button[] = [];
  private topButtons: Button[] = [];
  private toast = { text: '', t: -10 };
  private shake = { id: '', t: -10 };
  private view: View = { W: 393, H: 852, safe: { t: 0, b: 0, l: 0, r: 0 } };
  private pressedTile: string | null = null;

  private autoOpen: string | null = null;

  constructor(private app: App, focus?: string, open = false) {
    const last = focus ?? getSave().lastGame;
    if (open && focus) this.autoOpen = focus;
    this.layout(app.view);
    if (last) {
      const tile = this.tiles.find((t) => t.id === last);
      if (tile) this.scroll = clamp(tile.y - app.view.H * 0.35, 0, this.maxScroll());
    }
  }

  enter() {
    if (!bgm.playing) {
      void bgm.ensure().then(() => bgm.play());
    }
  }

  visible() {
    void audio.resume();
  }

  private headerH(v: View) {
    return v.safe.t + 64;
  }

  private layout(v: View) {
    this.view = v;
    const { W } = v;
    const m = 16;
    const gap = 12;
    const tw = (W - m * 2 - gap) / 2;
    const th = 156;
    let y = this.headerH(v) + 10;
    this.tiles = [];
    this.headers = [];
    for (const set of SETS) {
      this.headers.push({ title: set.title, sub: set.sub, y });
      y += 40;
      const regular = set.games.filter((id) => !gameById(id)?.remix);
      regular.forEach((id, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        this.tiles.push({ id, x: m + col * (tw + gap), y: y + row * (th + gap), w: tw, h: th, wide: false });
      });
      y += Math.ceil(regular.length / 2) * (th + gap);
      for (const id of set.games.filter((id) => gameById(id)?.remix)) {
        this.tiles.push({ id, x: m, y, w: W - m * 2, h: 116, wide: true });
        y += 116 + gap;
      }
      y += 14;
    }
    this.contentH = y + v.safe.b + 20;
    this.topButtons = [
      button({
        x: W - v.safe.r - 58,
        y: v.safe.t + 10,
        w: 44,
        h: 44,
        label: '',
        color: 'rgba(0,0,0,0)',
        onTap: () => {
          bgm.stop(0.2);
          this.app.go(new SettingsScreen(this.app));
        },
      }),
    ];
  }

  private maxScroll() {
    return Math.max(0, this.contentH - this.view.H);
  }

  update(dt: number) {
    this.t += dt;
    if (this.view.W !== this.app.view.W || this.view.H !== this.app.view.H || this.view.safe.t !== this.app.view.safe.t) this.layout(this.app.view);
    if (!this.drag) {
      this.scroll += this.vel * dt;
      this.vel *= Math.exp(-4 * dt);
      const max = this.maxScroll();
      if (this.scroll < 0) {
        this.scroll += (0 - this.scroll) * Math.min(1, dt * 12);
        this.vel = 0;
      } else if (this.scroll > max) {
        this.scroll += (max - this.scroll) * Math.min(1, dt * 12);
        this.vel = 0;
      }
    }
    if (this.sel) this.selT += dt;
    if (this.autoOpen && this.t > 0.35 && !this.app.transitioning) {
      const d = gameById(this.autoOpen);
      this.autoOpen = null;
      if (d && isUnlocked(d.id)) this.openPanel(d);
    }
  }

  draw(g: G, v: View) {
    const { W, H, safe } = v;
    const t = this.t;
    nightSky(g, W, H, t);
    g.save();
    g.translate(0, -this.scroll);
    for (const h of this.headers) {
      rrect(g, 16, h.y, 150, 30, 15, '#ffe14d', OUT, 3);
      text(g, `${h.title} · ${h.sub}`, 91, h.y + 15.5, 15, OUT, { weight: 900 });
    }
    for (const tile of this.tiles) {
      if (tile.y - this.scroll > H + 20 || tile.y + tile.h - this.scroll < -20) continue;
      this.drawTile(g, tile, t);
    }
    g.restore();
    // 헤더 바
    const hh = this.headerH(v);
    g.fillStyle = vgrad(g, 0, hh + 16, [
      [0, 'rgba(27,15,61,1)'],
      [0.8, 'rgba(27,15,61,0.95)'],
      [1, 'rgba(27,15,61,0)'],
    ]);
    g.fillRect(0, 0, W, hh + 16);
    text(g, '리듬 별나라', 20 + safe.l, safe.t + 32, 24, '#ffe14d', { align: 'left', weight: 900, stroke: OUT, strokeW: 5 });
    const mc = medalCount();
    medal(g, 172 + safe.l, safe.t + 28, 11, t);
    text(g, `${mc.medals}/${mc.total}`, 188 + safe.l, safe.t + 32, 16, '#fff', { align: 'left', weight: 800 });
    if (mc.perfects > 0) {
      perfectBadge(g, 246 + safe.l, safe.t + 31, 12, 0);
      text(g, `${mc.perfects}`, 262 + safe.l, safe.t + 32, 16, '#fff', { align: 'left', weight: 800 });
    }
    const gb = this.topButtons[0];
    drawGearIcon(g, gb.x + gb.w / 2, gb.y + gb.h / 2 + (gb.down ? 2 : 0), 40);
    // 토스트
    const ta = 1 - clamp01((t - this.toast.t - 1.6) / 0.4);
    if (t - this.toast.t < 2) {
      g.globalAlpha = ta;
      rrect(g, 24, H - safe.b - 90, W - 48, 56, 16, 'rgba(20,10,40,0.92)', '#fff', 2.5);
      wrapText(g, this.toast.text, W / 2, H - safe.b - 80, W - 80, 15, '#fff', 1.3, { weight: 700 });
      g.globalAlpha = 1;
    }
    if (this.sel) this.drawPanel(g, v);
  }

  private drawTile(g: G, tile: Tile, t: number) {
    const def = gameById(tile.id)!;
    const unlocked = isUnlocked(tile.id);
    const rec = record(tile.id);
    const sh = this.shake.id === tile.id ? Math.sin((t - this.shake.t) * 50) * 6 * Math.max(0, 1 - (t - this.shake.t) * 3) : 0;
    const press = this.pressedTile === tile.id ? 3 : 0;
    const x = tile.x + sh;
    const y = tile.y + press;
    rrect(g, x, y + 6 - press, tile.w, tile.h, 22, 'rgba(0,0,0,0.3)');
    if (!unlocked) {
      rrect(g, x, y, tile.w, tile.h, 22, '#3a2d5c', OUT, 3.5);
      lockIcon(g, x + tile.w / 2, y + tile.h / 2 - 12, 40);
      text(g, '???', x + tile.w / 2, y + tile.h - 26, 16, '#b9aee0', { weight: 900 });
      return;
    }
    const bg = def.remix
      ? (() => {
          const gr = g.createLinearGradient(x, y, x + tile.w, y + tile.h);
          gr.addColorStop(0, '#ff6b8b');
          gr.addColorStop(0.33, '#ffb84d');
          gr.addColorStop(0.66, '#6be3a0');
          gr.addColorStop(1, '#6bc6ff');
          return gr;
        })()
      : def.color;
    rrect(g, x, y, tile.w, tile.h, 22, bg, OUT, 3.5);
    rrect(g, x + 8, y + 8, tile.w - 16, tile.h * 0.4, 16, 'rgba(255,255,255,0.22)');
    g.save();
    g.beginPath();
    g.rect(x + 4, y + 4, tile.w - 8, tile.h - 50);
    g.clip();
    const iconS = tile.wide ? 84 : 92;
    def.drawIcon(g, x + tile.w / 2, y + (tile.h - 44) / 2 + 4, iconS, t);
    g.restore();
    rrect(g, x + 8, y + tile.h - 42, tile.w - 16, 34, 12, 'rgba(255,255,255,0.93)', OUT, 2.5);
    text(g, def.title, x + tile.w / 2, y + tile.h - 24.5, 16, OUT, { weight: 900, maxW: tile.w - 28 });
    // 배지
    const bx = x + tile.w - 22;
    const by = y + 22;
    if (rec.perfect) perfectBadge(g, bx, by, 15, Math.sin(t * 2) * 0.2);
    else if (rec.rank === 'hi') medal(g, bx, by - 4, 13, t);
    else if (rec.cleared) checkBadge(g, bx, by, 13);
    else if (rec.plays === 0) {
      rrect(g, x + tile.w - 58, y + 10, 48, 22, 11, '#ff4d6d', OUT, 2.5);
      text(g, 'NEW', x + tile.w - 34, y + 21.5, 12, '#fff', { weight: 900 });
    }
  }

  openPanel(def: GameDef) {
    this.sel = def;
    this.selT = 0;
    audio.sfx('uiSelect');
    const { W, H, safe } = this.view;
    const rec = record(def.id);
    const bw = (W - 64 - 12) / 2;
    const by = H - safe.b - 88;
    const launch = (practice: boolean, perfect = false) => {
      getSave().lastGame = def.id;
      bgm.stop(0.3);
      this.app.go(new PlayScreen(this.app, def, { practice, perfect }));
    };
    this.panelButtons = [
      button({ x: 32, y: by, w: bw, h: 62, label: '연습', sub: '방법 익히기', color: '#6bc6ff', onTap: () => launch(true) }),
      button({
        x: 32 + bw + 12,
        y: by,
        w: bw,
        h: 62,
        label: '시작!',
        sub: rec.practiced || def.practice.length === 0 ? '바로 플레이' : '연습부터',
        color: '#ff6b8b',
        onTap: () => launch(!rec.practiced && def.practice.length > 0),
      }),
    ];
    if (rec.rank === 'hi' && !rec.perfect) {
      this.panelButtons.push(
        button({ x: 32, y: by - 70, w: W - 64, h: 56, label: '퍼펙트 도전', sub: '한 번도 틀리지 않기!', color: '#c77dff', onTap: () => launch(false, true) }),
      );
    }
  }

  private closePanel() {
    this.sel = null;
    audio.sfx('uiBack', 0, 0.7);
  }

  private drawPanel(g: G, v: View) {
    const def = this.sel!;
    const { W, H, safe } = v;
    const k = easeOutCubic(clamp01(this.selT / 0.25));
    g.fillStyle = `rgba(10,5,25,${0.6 * k})`;
    g.fillRect(0, 0, W, H);
    const rec = record(def.id);
    const top = Math.max(safe.t + 70, H * 0.22);
    const py = top + (1 - k) * (H - top);
    const pw = W - 24;
    rrect(g, 12, py, pw, H - py + 30, 28, '#fffaf0', OUT, 4);
    // 헤더
    rrect(g, 24, py + 12, pw - 24, 150, 22, def.remix ? '#ff9ad5' : def.color, OUT, 3);
    g.save();
    g.beginPath();
    g.rect(28, py + 16, pw - 32, 142);
    g.clip();
    def.drawIcon(g, 110, py + 88, 120, this.t);
    g.restore();
    text(g, def.title, 190, py + 64, 26, '#fff', { align: 'left', weight: 900, stroke: OUT, strokeW: 6, maxW: W - 220 });
    text(g, def.sub, 192, py + 98, 14, '#fff', { align: 'left', weight: 800, stroke: OUT, strokeW: 4, maxW: W - 220 });
    if (rec.rank) {
      const lbl = RANK_LABEL[rec.rank] + (rec.perfect ? ' · 퍼펙트' : '');
      rrect(g, 190, py + 116, Math.min(W - 214, 160), 30, 15, '#fff', OUT, 2.5);
      text(g, lbl, 190 + Math.min(W - 214, 160) / 2, py + 131.5, 13, OUT, { weight: 900 });
      if (rec.rank === 'hi') medal(g, W - 54, py + 40, 16, this.t);
    }
    // 닫기
    const cx = W - 44;
    const cy = py + 12 + 0;
    rrect(g, cx - 18, cy - 18, 36, 36, 18, '#fff', OUT, 3);
    text(g, '✕', cx, cy + 1, 18, OUT, { weight: 900 });
    let ty = py + 180;
    ty += wrapText(g, def.desc, W / 2, ty, W - 64, 18, OUT, 1.35, { weight: 900 });
    ty += 8;
    const btnTop = this.panelButtons.length ? Math.min(...this.panelButtons.map((b) => b.y)) : H;
    const maxLines = Math.max(1, Math.floor((btnTop - ty - 16) / (15 * 1.45)));
    const how = def.howto.split('\n').slice(0, maxLines).join('\n');
    wrapText(g, how, W / 2, ty, W - 64, 15, '#5a4a6a', 1.45, { weight: 700 });
    if (rec.best > 0) text(g, `최고 기록 ${Math.round(rec.best)}점 · ${rec.plays}회 플레이`, W / 2, btnTop - 18, 13, '#8a7a9a', { weight: 700 });
    for (const b of this.panelButtons) {
      const orig = b.y;
      b.y = orig + (1 - k) * (H - top);
      drawButton(g, b, easeOutBack(clamp01((this.selT - 0.1) / 0.3)));
      b.y = orig;
    }
  }

  input(e: RawInput) {
    const { W, H } = this.view;
    if (this.sel) {
      if (handleButtons(this.panelButtons, e)) return;
      if (e.kind === 'up' && !e.key) {
        const top = Math.max(this.view.safe.t + 70, H * 0.22);
        const onClose = Math.hypot(e.x - (W - 44), e.y - (top + 12)) < 28;
        if (onClose || e.y < top) this.closePanel();
      } else if (e.key && e.kind === 'down') {
        this.panelButtons[1]?.onTap();
      } else if (e.kind === 'cancel' && e.key) this.closePanel();
      return;
    }
    if (handleButtons(this.topButtons, e)) return;
    if (e.key) {
      if (e.kind === 'down') {
        const first = GAMES.find((g) => isUnlocked(g.id) && !record(g.id).cleared) ?? GAMES[0];
        this.openPanel(first);
      }
      return;
    }
    const sy = e.y + this.scroll;
    if (e.kind === 'down') {
      this.drag = { y0: e.y, s0: this.scroll, moved: false, lastY: e.y, lastT: e.perf };
      this.vel = 0;
      const tile = this.tiles.find((t) => hit({ ...t, label: '', color: '', onTap: () => undefined }, e.x, sy, 0));
      this.pressedTile = tile ? tile.id : null;
    } else if (e.kind === 'move' && this.drag) {
      const dy = e.y - this.drag.y0;
      if (Math.abs(dy) > 8) {
        this.drag.moved = true;
        this.pressedTile = null;
      }
      if (this.drag.moved) {
        let s = this.drag.s0 - dy;
        const max = this.maxScroll();
        if (s < 0) s *= 0.4;
        if (s > max) s = max + (s - max) * 0.4;
        this.scroll = s;
        const dtm = Math.max(1, e.perf - this.drag.lastT);
        this.vel = (-(e.y - this.drag.lastY) / dtm) * 1000;
        this.drag.lastY = e.y;
        this.drag.lastT = e.perf;
      }
    } else if ((e.kind === 'up' || e.kind === 'cancel') && this.drag) {
      const moved = this.drag.moved;
      this.drag = null;
      this.pressedTile = null;
      if (!moved && e.kind === 'up') {
        const tile = this.tiles.find((t) => hit({ ...t, label: '', color: '', onTap: () => undefined }, e.x, sy, 0));
        if (tile) {
          if (isUnlocked(tile.id)) this.openPanel(gameById(tile.id)!);
          else {
            this.shake = { id: tile.id, t: this.t };
            this.toast = { text: '바로 앞 게임을 "평범" 이상으로 클리어하면 열려요!', t: this.t };
            audio.sfx('uiBack', 0, 0.6);
          }
        }
      }
    }
  }
}
