// 진행 상황/설정 저장 (localStorage, 실패해도 게임은 정상 동작)
import type { Rank } from './judge';

export interface GameRecord {
  best: number;
  rank: Rank | null;
  perfect: boolean;
  plays: number;
  practiced: boolean;
  cleared: boolean;
}

export interface Settings {
  /** 입력 타이밍 보정 (초, +면 늦게 누르는 편) */
  calib: number;
  /** 사용자가 직접 보정했는지 (아니면 기기별 기본값 사용) */
  calibUser: boolean;
  music: number;
  sfx: number;
  showTiming: boolean;
  unlockAll: boolean;
}

export interface SaveData {
  v: 1;
  games: Record<string, GameRecord>;
  settings: Settings;
  lastGame: string | null;
}

const KEY = 'rhythm-starland-save-v1';

export function defaultSave(): SaveData {
  return {
    v: 1,
    games: {},
    settings: { calib: 0, calibUser: false, music: 0.8, sfx: 0.9, showTiming: false, unlockAll: false },
    lastGame: null,
  };
}

let data: SaveData = defaultSave();

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const d = defaultSave();
      data = {
        ...d,
        ...parsed,
        v: 1,
        games: { ...(parsed.games ?? {}) },
        settings: { ...d.settings, ...(parsed.settings ?? {}) },
      };
      return data;
    }
  } catch {
    /* 저장소 사용 불가 */
  }
  data = defaultSave();
  return data;
}

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getSave(): SaveData {
  return data;
}

export function record(id: string): GameRecord {
  return (data.games[id] ??= { best: 0, rank: null, perfect: false, plays: 0, practiced: false, cleared: false });
}

export function resetSave(): void {
  const settings = data.settings;
  data = defaultSave();
  data.settings = settings;
  save();
}

/**
 * 기기별 기본 보정값.
 * iOS Safari는 출력 지연(outputLatency)을 알려주지 않는 경우가 많아서, 터치 + 스피커 지연을 감안함.
 */
export function defaultCalib(reportsOutputLatency = false): number {
  if (typeof navigator === 'undefined') return 0;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return reportsOutputLatency ? 0.02 : 0.04;
  return 0.01;
}

/** 실제로 판정에 쓰는 보정값 */
export function effectiveCalib(reportsOutputLatency = false): number {
  const s = data.settings;
  return s.calibUser ? s.calib : defaultCalib(reportsOutputLatency);
}
