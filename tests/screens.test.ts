import { describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import type { View } from '../src/core/gfx';
import { EndingScreen } from '../src/screens/ending';
import { mockCtx } from './mockCanvas';

describe('엔딩 스태프 롤', () => {
  const views: View[] = [
    { W: 393, H: 852, safe: { t: 59, b: 34, l: 0, r: 0 } }, // 홈 화면 앱(전체 화면)
    { W: 393, H: 659, safe: { t: 0, b: 0, l: 0, r: 0 } }, // Safari 주소창이 있는 화면
  ];
  for (const view of views) {
    it(`크레딧이 끝까지 올라가 멈추고 메뉴로 돌아갈 수 있음 (H=${view.H})`, () => {
      const g = mockCtx();
      const sc = new EndingScreen({} as App);
      const done = () => (sc as unknown as { done: boolean }).done;
      let doneAt = -1;
      for (let t = 0; t < 60; t += 0.25) {
        sc.update(0.25);
        sc.draw(g, view);
        if (doneAt < 0 && done()) doneAt = t;
      }
      expect(doneAt).toBeGreaterThan(15);
      expect(doneAt).toBeLessThan(45);
    });
  }
});
