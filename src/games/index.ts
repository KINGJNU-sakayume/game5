// 게임 목록과 세트 구성
import type { GameDef } from '../core/game';
import { getSave, record } from '../core/save';
import { chef } from './chef';
import { trio } from './trio';
import { balloon } from './balloon';
import { ninja } from './ninja';
import { penguin } from './penguin';
import { badminton } from './badminton';
import { frogs } from './frogs';
import { waltzGame } from './waltz';
import { remix1, remix2 } from './remixes';

export interface GameSet {
  title: string;
  sub: string;
  games: string[];
}

export const GAMES: GameDef[] = [chef, trio, balloon, ninja, penguin, badminton, frogs, waltzGame, remix1, remix2];

export const SETS: GameSet[] = [
  { title: 'SET 1', sub: '첫걸음', games: ['chef', 'trio', 'balloon', 'ninja', 'remix1'] },
  { title: 'SET 2', sub: '두근두근', games: ['penguin', 'badminton', 'frogs', 'waltz', 'remix2'] },
];

export const ORDER: string[] = SETS.flatMap((s) => s.games);

export function gameById(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}

export function isUnlocked(id: string): boolean {
  if (getSave().settings.unlockAll) return true;
  const i = ORDER.indexOf(id);
  if (i <= 0) return true;
  return record(ORDER[i - 1]).cleared;
}

export function nextGame(id: string): string | null {
  const i = ORDER.indexOf(id);
  return i >= 0 && i + 1 < ORDER.length ? ORDER[i + 1] : null;
}

export function medalCount(): { medals: number; perfects: number; total: number } {
  let medals = 0;
  let perfects = 0;
  for (const id of ORDER) {
    const r = record(id);
    if (r.rank === 'hi') medals++;
    if (r.perfect) perfects++;
  }
  return { medals, perfects, total: ORDER.length };
}
