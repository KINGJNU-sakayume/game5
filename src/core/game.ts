// 미니게임 정의 인터페이스
import type { G, Insets } from './gfx';
import type { ChartBuilder, Cue, Marker, Segment } from './chart';
import type { Judge, JudgeInput, Rank } from './judge';

export interface Frame {
  /** 곡 시각(초) — 플레이어가 지금 듣고 있는 위치 */
  t: number;
  /** 곡 박 (t / spb) */
  beat: number;
  W: number;
  H: number;
  safe: Insets;
  /** 실제 프레임 간격(초) */
  dt: number;
  /** 실제 경과 시간(초) */
  real: number;
}

export type SceneMode = 'play' | 'practice' | 'preview';

export interface SceneCtx {
  game: string;
  bpm: number;
  spb: number;
  beatsPerBar: number;
  /** 이 장면이 담당하는 큐 (연습 중에는 계속 추가됨) */
  cues: Cue[];
  markers: Marker[];
  segments: Segment[];
  mode: SceneMode;
  /** 효과음을 지금 바로 재생 */
  sfx(name: string, midi?: number, vel?: number, pan?: number): { stop(fade?: number): void } | null;
  /** 효과음을 곡 시각 t(초)에 맞춰 재생 (이미 지났으면 바로) */
  sfxAt(t: number, name: string, midi?: number, vel?: number, pan?: number): { stop(fade?: number): void } | null;
  holding(): boolean;
}

/** 큐를 정확히 맞혔을 때 나는 소리 */
export interface HitSfx {
  name: string;
  midi?: number;
  vel?: number;
  pan?: number;
  /** 큐 시각보다 몇 초 뒤에 울릴지 (예: 불꽃이 터지는 소리) */
  delay?: number;
}

export interface GameInput extends JudgeInput {
  id: number;
}

export interface Scene {
  draw(g: G, f: Frame): void;
  /** 직접 판정할 때 구현 (undefined 반환 시 기본 판정) */
  judge?(ev: GameInput, j: Judge): Cue | null | undefined;
  /** 판정 직후 (cue=null이면 헛손질) */
  onInput?(ev: GameInput, cue: Cue | null): void;
  onMiss?(cue: Cue): void;
  /**
   * 이 큐를 정확히(Just) 맞혔을 때 나는 소리.
   * 세션이 음악과 같은 오디오 시계로 큐 시각에 미리 예약하므로, 출력 지연이 있어도 박자에 딱 맞게 들린다.
   * (아슬아슬/미스 소리는 onInput/onMiss에서 직접 재생)
   */
  hitSfx?(cue: Cue): HitSfx | HitSfx[] | null;
  /** 손가락을 누를 때/뗄 때 (판정과 별개) */
  onDown?(ev: GameInput): void;
  onUp?(ev: GameInput): void;
}

export interface PracticeStep {
  /** 안내 문구 */
  text: string;
  /** 루프 길이(박) */
  beats: number;
  /** 성공해야 하는 횟수 */
  need: number;
  /** 한 루프 분량의 큐와 큐 사운드 (0박부터) */
  build(b: ChartBuilder): void;
}

export interface GameDef {
  id: string;
  title: string;
  sub: string;
  desc: string;
  howto: string;
  color: string;
  accent: string;
  bpm: number;
  beatsPerBar?: number;
  remix?: boolean;
  /** 실시간으로 재생하는 효과음 목록 [이름, midi] */
  liveSfx: [string, number][];
  build(b: ChartBuilder): void;
  practice: PracticeStep[];
  practiceBacking(b: ChartBuilder, beats: number): void;
  createScene(sc: SceneCtx): Scene;
  drawIcon(g: G, cx: number, cy: number, s: number, t: number): void;
  /** 평가 분류 이름 */
  cats: Record<string, string>;
  comments: { good: Record<string, string>; bad: Record<string, string> };
  epilogue: Record<Rank, string>;
  drawEpilogue(g: G, x: number, y: number, w: number, h: number, rank: Rank, t: number): void;
  /** 리믹스용: start 박부터 bars 마디 동안의 큐를 추가 */
  remixPart?(b: ChartBuilder, start: number, bars: number, variant: number): void;
}
