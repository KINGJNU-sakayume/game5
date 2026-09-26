// 디버그/테스트용: 특정 곡 시각의 장면을 결정적으로 그리기
import type { Screen } from '../app';
import type { Frame, GameDef, Scene } from '../core/game';
import type { G, View } from '../core/gfx';
import { simulate, type SimGrade } from '../core/simulate';

export type PreviewGrade = SimGrade;

export class PreviewScreen implements Screen {
  readonly id = 'PreviewScreen';
  private scene: Scene;
  private spb: number;
  private real = 0;

  constructor(def: GameDef, private t: number, grade: PreviewGrade = 'just') {
    const sim = simulate(def, t, grade);
    this.scene = sim.scene;
    this.spb = sim.chart.spb;
  }

  draw(g: G, v: View, _perf: number, dt: number) {
    this.real += dt;
    const f: Frame = { t: this.t, beat: this.t / this.spb, W: v.W, H: v.H, safe: v.safe, dt: 0, real: this.real };
    this.scene.draw(g, f);
  }
}
