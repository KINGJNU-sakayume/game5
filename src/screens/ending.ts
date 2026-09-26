// 엔딩 (마지막 리믹스를 처음 클리어하면): 캐릭터 퍼레이드 + 스태프 롤
import type { App, Screen } from '../app';
import { audio } from '../core/audio';
import { OUT, rrect, star, text, type G, type View } from '../core/gfx';
import type { RawInput } from '../core/input';
import { clamp01, easeOutBack, hash01 } from '../core/util';
import { GAMES, medalCount } from '../games';
import { bgm } from '../bgm';
import { logo, mascot, nightSky } from './backdrop';
import { MenuScreen } from './menu';

const LINES: [string, number][] = [
  ['리듬 별나라', 34],
  ['', 16],
  ['끝까지 플레이해 줘서 고마워요!', 18],
  ['', 30],
  ['게임 12개 · 리믹스 3개', 17],
  ['', 12],
  ['그림 — 캔버스에 코드로 한 획씩', 15],
  ['음악·효과음 — Web Audio로 한 음씩', 15],
  ['리듬 판정 — 오디오 시계 기준 ±65ms', 15],
  ['', 30],
  ['출연', 20],
  ['촙촙 셰프 · 짹짹 트리오 · 풍선 공장 곰', 14],
  ['닌자 · 펭귄 행진단 · 달토끼', 14],
  ['개구리 합창단 · 꽃밭 요정', 14],
  ['반짝이 · 응원단 고양이 · 수염 무', 14],
  ['냠냠 곰돌이 · 불꽃 기술자', 14],
  ['', 30],
  ['그리고 주인공', 20],
  ['바로 당신!', 26],
  ['', 40],
  ['__MEDALS__', 17],
  ['하이레벨 메달과 퍼펙트를 모두 모아 보세요', 14],
  ['', 60],
  ['THE END', 36],
];

export class EndingScreen implements Screen {
  readonly id = 'EndingScreen';
  private t = 0;
  private done = false;

  constructor(private app: App) {}

  enter() {
    if (!bgm.playing) void bgm.ensure().then(() => bgm.play());
    audio.sfx('fanfare', 0, 0.8);
    audio.sfx('cheer', 0, 0.8);
  }

  update(dt: number) {
    this.t += dt;
  }

  draw(g: G, v: View) {
    const { W, H, safe } = v;
    const t = this.t;
    nightSky(g, W, H, t);
    // 떨어지는 별 가루
    for (let i = 0; i < 24; i++) {
      const x = hash01(i * 7) * W;
      const y = ((hash01(i * 3) * H + t * (30 + hash01(i) * 40)) % (H + 40)) - 20;
      star(g, x, y, 5, 2.2, 5, t + i, ['#ffe14d', '#ff9ad5', '#8fd0ff'][i % 3]);
    }
    // 크레딧 (위로 흐름)
    const speed = 42;
    let y = H + 40 - t * speed + safe.t;
    const mc = medalCount();
    let lastY = y;
    for (const [line, size] of LINES) {
      const s = line === '__MEDALS__' ? `메달 ${mc.medals} / ${mc.total} · 퍼펙트 ${mc.perfects}` : line;
      if (s && y > -60 && y < H + 60) {
        if (s === '리듬 별나라') logo(g, W / 2, y, 40, t);
        else text(g, s, W / 2, y, size, '#fff', { weight: size >= 20 ? 900 : 700, stroke: size >= 20 ? OUT : undefined, strokeW: 5 });
      }
      lastY = y;
      y += size * 1.9;
    }
    if (lastY < H * 0.45) this.done = true;
    // 퍼레이드 (아래쪽)
    const py = H - safe.b - 90;
    rrect(g, -20, py + 40, W + 40, 80, 0, 'rgba(20,10,40,0.6)');
    const n = GAMES.filter((g2) => !g2.remix).length;
    const spacing = 96;
    const total = n * spacing;
    GAMES.filter((g2) => !g2.remix).forEach((def, i) => {
      const x = W + 60 - ((t * 60 + i * spacing) % (total + W + 120)) + total - W;
      const hop = Math.abs(Math.sin(t * 5 + i)) * 10;
      if (x < -80 || x > W + 80) return;
      def.drawIcon(g, x, py - hop, 84, t + i * 0.2);
    });
    // 퍼레이드 맨 앞의 마스코트
    const k = easeOutBack(clamp01(t / 0.8));
    const lead = W + 60 - ((t * 60 + n * spacing) % (total + W + 120)) + total - W;
    if (lead > -80 && lead < W + 80) {
      g.save();
      g.translate(lead, py - 6 - Math.abs(Math.sin(t * 5)) * 12);
      g.scale(k, k);
      mascot(g, 0, 0, 34, t * 2, 'happy');
      g.restore();
    }
    if (this.done) {
      const a = 0.5 + 0.5 * Math.sin(t * 4);
      g.globalAlpha = a;
      text(g, '화면을 터치하면 메뉴로', W / 2, H * 0.62, 16, '#fff', { weight: 800 });
      g.globalAlpha = 1;
    }
  }

  input(e: RawInput) {
    if (e.kind === 'up' || (e.key && e.kind === 'down')) {
      if (this.done || this.t > 3) this.app.go(new MenuScreen(this.app));
    }
  }
}
