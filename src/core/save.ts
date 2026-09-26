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
    settings: { calib: 0, music: 0.8, sfx: 0.9, showTiming: false, unlockAll: false },
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
