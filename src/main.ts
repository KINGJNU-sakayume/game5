// 진입점
import { App } from './app';
import { audio } from './core/audio';
import { getSave, loadSave } from './core/save';
import { GAMES, gameById } from './games';
import { TitleScreen } from './screens/title';
import { PlayScreen } from './screens/play';
import { MenuScreen } from './screens/menu';
import { PreviewScreen, type PreviewGrade } from './screens/preview';
import { ResultScreen } from './screens/results';
import { simulate } from './core/simulate';
import { bgm, COMMON_SFX } from './bgm';

loadSave();
const s = getSave().settings;
audio.musicVolume = s.music;
audio.sfxVolume = s.sfx;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const app = new App(canvas);
app.go(new TitleScreen(app));

// 디버그/테스트용 훅: ?game=chef&auto=1 로 바로 시작
const w = window as unknown as Record<string, unknown>;
w.__rs = {
  app,
  games: GAMES.map((g) => g.id),
  audio,
  async start(id: string, opts: { practice?: boolean; perfect?: boolean; autoplay?: boolean; rate?: number } = {}) {
    audio.unlock();
    await audio.ensureSfx(COMMON_SFX);
    const def = gameById(id);
    if (!def) throw new Error('no game ' + id);
    bgm.stop(0.05);
    app.go(new PlayScreen(app, def, { practice: !!opts.practice, perfect: !!opts.perfect, autoplay: opts.autoplay, rate: opts.rate }), '#000', 0.05);
  },
  preview(id: string, t: number, grade: PreviewGrade = 'just') {
    const def = gameById(id);
    if (!def) throw new Error('no game ' + id);
    app.swap(new PreviewScreen(def, t, grade));
  },
  menu() {
    app.go(new MenuScreen(app), '#000', 0.05);
  },
  /** 결과 화면 미리보기: grade = just | barely | miss | mixed */
  result(id: string, grade: PreviewGrade = 'mixed') {
    const def = gameById(id);
    if (!def) throw new Error('no game ' + id);
    const sim = simulate(def, 1e9, grade);
    app.go(new ResultScreen(app, def, sim.judge.result(), { perfect: false }), '#000', 0.05);
  },
  state() {
    const sc = app.screen as unknown as { id?: string; debugState?: () => unknown };
    return { screen: sc?.id, ...(sc?.debugState ? (sc.debugState() as object) : {}) };
  },
};

// 서비스 워커 (오프라인 플레이/홈 화면 설치)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
