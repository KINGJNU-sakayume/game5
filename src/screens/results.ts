// 결과 화면 (리듬 판정 → 코멘트 → 등급 도장 → 에필로그)
import type { App, Screen } from '../app';
import { audio } from '../core/audio';
import type { GameDef } from '../core/game';
import { OUT, rrect, text, wrapText, type G, type View } from '../core/gfx';
import type { RawInput } from '../core/input';
import { RANK_LABEL, type Rank, type ScoreResult } from '../core/judge';
import { record, save } from '../core/save';
import { clamp01, easeOutBack, easeOutCubic } from '../core/util';
import { ORDER, nextGame, isUnlocked } from '../games';
import { button, drawButton, handleButtons, type Button } from '../ui';
import { medal, perfectBadge } from './badges';
import { PlayScreen } from './play';
import { MenuScreen } from './menu';
import { EndingScreen } from './ending';

export function makeComments(def: GameDef, res: ScoreResult): string[] {
  const cats = Object.entries(res.cats)
    .filter(([, s]) => s.n > 0)
    .map(([k, s]) => ({ k, acc: s.weight ? s.credit / s.weight : 0, n: s.n }));
  const worst = cats.filter((c) => c.acc < 0.8 && def.comments.bad[c.k]).sort((a, b) => a.acc - b.acc || b.n - a.n)[0];
  const best = cats.filter((c) => c.acc >= 0.9 && def.comments.good[c.k]).sort((a, b) => b.n - a.n || b.acc - a.acc)[0];
  const lines: string[] = [];
  const timing = res.meanDt > 0.03 ? '전체적으로 조금 늦게 누르는 편이에요.' : res.meanDt < -0.03 ? '전체적으로 조금 서두르는 편이에요.' : '';
  if (res.rank === 'hi') {
    lines.push(best ? def.comments.good[best.k] : '리듬을 온몸으로 느끼고 있네요!');
    lines.push(res.perfect ? '실수가 하나도 없었어요! 완벽!' : worst ? `하지만 ${def.comments.bad[worst.k]}` : '정말 훌륭한 리듬감이에요!');
  } else if (res.rank === 'ok') {
    lines.push(best ? def.comments.good[best.k] : '나쁘지 않았어요.');
    lines.push(worst ? def.comments.bad[worst.k] : timing || '조금만 더 정확하면 하이레벨!');
  } else {
    lines.push(worst ? def.comments.bad[worst.k] : '박자를 잘 들어 보세요.');
    lines.push(timing || '연습 모드로 다시 익혀 볼까요?');
  }
  return lines;
}

const RANK_ORDER: Record<Rank, number> = { try: 0, ok: 1, hi: 2 };

export class ResultScreen implements Screen {
  readonly id = 'ResultScreen';
  private t = 0;
  private lines: string[];
  private buttons: Button[] = [];
  private newMedal = false;
  private newPerfect = false;
  private rank: Rank;
  private lineStart: number[] = [];
  private stampAt: number;
  private epiAt: number;
  private btnAt: number;
  private played = new Set<string>();
  private ticked = 0;
  private laidOut = false;
  private ending = false;

  constructor(private app: App, private def: GameDef, private res: ScoreResult, private opts: { perfect: boolean }) {
    this.rank = res.rank;
    this.lines = makeComments(def, res);
    const rec = record(def.id);
    const prevRank = rec.rank;
    this.ending = ORDER[ORDER.length - 1] === def.id && !rec.cleared && res.rank !== 'try';
    rec.plays++;
    rec.practiced = true;
    if (res.score > rec.best) rec.best = res.score;
    if (!prevRank || RANK_ORDER[res.rank] > RANK_ORDER[prevRank]) rec.rank = res.rank;
    if (res.rank !== 'try') rec.cleared = true;
    if (res.rank === 'hi' && prevRank !== 'hi') this.newMedal = true;
    if (res.perfect && !rec.perfect && (opts.perfect || res.rank === 'hi')) {
      rec.perfect = true;
      this.newPerfect = true;
    }
    save();
    let at = 1.0;
    for (const ln of this.lines) {
      this.lineStart.push(at);
      at += ln.length / 28 + 0.45;
    }
    this.stampAt = at + 0.4;
    this.epiAt = this.stampAt + 1.1;
    this.btnAt = this.epiAt + 0.5;
  }

  private layout(v: View) {
    const { W, H, safe } = v;
    const bw = (W - 48 - 12) / 2;
    const by = H - safe.b - 76;
    const nxt = nextGame(this.def.id);
    const retry = () => this.app.go(new PlayScreen(this.app, this.def, { practice: false, perfect: this.opts.perfect && !this.res.perfect }));
    this.buttons = [
      button({ x: 24, y: by, w: bw, h: 58, label: '다시 하기', color: '#6bc6ff', onTap: retry }),
      this.ending
        ? button({ x: 24 + bw + 12, y: by, w: bw, h: 58, label: '엔딩 보기 ▶', color: '#ffb84d', onTap: () => this.app.go(new EndingScreen(this.app), '#fff', 0.6) })
        : button({
        x: 24 + bw + 12,
        y: by,
        w: bw,
        h: 58,
        label: nxt && isUnlocked(nxt) && this.rank !== 'try' ? '다음 게임 ▶' : '메뉴로',
        color: '#ff6b8b',
        onTap: () => {
          const focus = nxt && isUnlocked(nxt) && this.rank !== 'try' ? nxt : this.def.id;
          this.app.go(new MenuScreen(this.app, focus, focus !== this.def.id));
        },
      }),
    ];
    this.laidOut = true;
  }

  update(dt: number) {
    const prev = this.t;
    this.t += dt;
    // 타자 소리
    this.lines.forEach((ln, i) => {
      const s = this.lineStart[i];
      const n = Math.floor(clamp01((this.t - s) / (ln.length / 28)) * ln.length);
      if (this.t >= s && n > this.ticked && Math.floor(this.t * 20) !== Math.floor(prev * 20) && n < ln.length) {
        audio.sfx('tick', 0, 0.5);
      }
    });
    if (this.t >= this.stampAt && !this.played.has('stamp')) {
      this.played.add('stamp');
      audio.sfx('stamp');
    }
    if (this.t >= this.stampAt + 0.3 && !this.played.has('jingle')) {
      this.played.add('jingle');
      audio.sfx(this.rank === 'hi' ? 'fanfare' : this.rank === 'ok' ? 'okJingle' : 'sadJingle');
      if (this.rank === 'hi') audio.sfx('cheer', 0, 0.8);
    }
  }

  draw(g: G, v: View) {
    const { W, H, safe } = v;
    if (!this.laidOut) this.layout(v);
    const t = this.t;
    // 배경: 종이 + 사선 무늬
    g.fillStyle = '#fbf3e4';
    g.fillRect(0, 0, W, H);
    g.save();
    g.globalAlpha = 0.5;
    g.strokeStyle = '#efe2c8';
    g.lineWidth = 10;
    for (let x = -H; x < W; x += 36) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + H, H);
      g.stroke();
    }
    g.restore();
    const top = safe.t + 16;
    const k0 = easeOutCubic(clamp01(t / 0.4));
    rrect(g, W / 2 - 70, top + (1 - k0) * -30, 140, 32, 16, '#5a3aa0', OUT, 3);
    text(g, '리듬 판정', W / 2, top + 16.5 + (1 - k0) * -30, 16, '#fff', { weight: 900 });
    const k1 = easeOutCubic(clamp01((t - 0.35) / 0.4));
    g.globalAlpha = k1;
    text(g, this.def.title, W / 2, top + 64, 30, OUT, { weight: 900 });
    g.globalAlpha = 1;
    // 코멘트
    const boxY = top + 92;
    const boxH = 132;
    rrect(g, 20, boxY, W - 40, boxH, 18, '#fff', OUT, 3);
    let ly = boxY + 20;
    this.lines.forEach((ln, i) => {
      const s = this.lineStart[i];
      if (t < s) return;
      const n = Math.floor(clamp01((t - s) / (ln.length / 28)) * ln.length);
      this.ticked = n;
      const h = wrapText(g, ln.slice(0, n), W / 2, ly, W - 70, 17, OUT, 1.35, { weight: 800 });
      ly += Math.max(h, 23) + 10;
    });
    // 도장
    const sy = boxY + boxH + 62;
    if (t >= this.stampAt) {
      const k = clamp01((t - this.stampAt) / 0.22);
      const sc = 2.2 - 1.2 * easeOutCubic(k);
      g.save();
      g.globalAlpha = k;
      g.translate(W / 2, sy);
      g.rotate(-0.08);
      g.scale(sc, sc);
      const col = this.rank === 'hi' ? '#ff4d3d' : this.rank === 'ok' ? '#3a7bff' : '#8a8494';
      const label = RANK_LABEL[this.rank];
      const w = label.length * 34 + 60;
      rrect(g, -w / 2, -40, w, 80, 16, 'rgba(255,255,255,0.6)', col, 6);
      rrect(g, -w / 2 + 7, -33, w - 14, 66, 11, null, col, 2.5);
      text(g, label, 0, 2, 38, col, { weight: 900 });
      g.restore();
      if (this.rank === 'hi' && t > this.stampAt + 0.3) medal(g, W / 2 + 120, sy - 30, 20, t);
      if (this.res.perfect && t > this.stampAt + 0.3) perfectBadge(g, W / 2 - 124, sy - 30, 22, Math.sin(t * 2) * 0.2);
      const badge = this.newPerfect ? '퍼펙트 달성!' : this.newMedal ? '메달 획득!' : '';
      if (badge && t > this.stampAt + 0.5) {
        const kb = easeOutBack(clamp01((t - this.stampAt - 0.5) / 0.3));
        g.save();
        g.translate(W / 2, sy + 56);
        g.scale(kb, kb);
        rrect(g, -70, -16, 140, 32, 16, '#ffe14d', OUT, 3);
        text(g, badge, 0, 1, 16, OUT, { weight: 900 });
        g.restore();
      }
      text(g, `점수 ${Math.round(this.res.score)}`, W - 24, sy + 50, 13, '#9a8aa8', { align: 'right', weight: 700 });
    }
    // 에필로그
    const ey = sy + 84;
    const btnY = H - safe.b - 76;
    const eh = Math.max(120, Math.min(250, btnY - ey - 70));
    if (t >= this.epiAt) {
      const k = easeOutCubic(clamp01((t - this.epiAt) / 0.5));
      g.globalAlpha = k;
      this.def.drawEpilogue(g, 24, ey + (1 - k) * 20, W - 48, eh, this.rank, t);
      wrapText(g, this.def.epilogue[this.rank], W / 2, ey + eh + 14, W - 60, 15, '#5a4a6a', 1.35, { weight: 800 });
      g.globalAlpha = 1;
    }
    if (t >= this.btnAt) for (const b of this.buttons) drawButton(g, b, clamp01((t - this.btnAt) / 0.25));
  }

  debugState() {
    return { rank: this.rank, score: this.res.score, lines: this.lines, game: this.def.id };
  }

  input(e: RawInput) {
    if (this.t < this.btnAt) {
      if (e.kind === 'up' || (e.key && e.kind === 'down')) {
        // 연출 건너뛰기
        this.t = Math.max(this.t, this.btnAt);
        this.played.add('stamp');
        if (!this.played.has('jingle')) {
          this.played.add('jingle');
          audio.sfx(this.rank === 'hi' ? 'fanfare' : this.rank === 'ok' ? 'okJingle' : 'sadJingle');
        }
      }
      return;
    }
    if (e.key && e.kind === 'down') {
      this.buttons[1]?.onTap();
      return;
    }
    handleButtons(this.buttons, e);
  }
}
