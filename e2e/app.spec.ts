import { expect, test, type Page } from '@playwright/test';

type RS = {
  games: string[];
  start(id: string, o: object): Promise<void>;
  preview(id: string, t: number, grade?: string): void;
  menu(): void;
  state(): Record<string, unknown>;
};
declare global {
  interface Window {
    __rs: RS;
  }
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function state(page: Page) {
  return page.evaluate(() => window.__rs.state());
}

test('캔버스가 화면을 꽉 채움 (레티나 해상도)', async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.goto('/');
  const canvas = page.locator('#game');
  await expect(canvas).toBeVisible();
  const vp = page.viewportSize()!;
  const box = (await canvas.boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.y).toBe(0);
  expect(Math.round(box.width)).toBe(vp.width);
  expect(Math.round(box.height)).toBe(vp.height);
  const px = await canvas.evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height, dpr: devicePixelRatio }));
  expect(px.dpr).toBe(3);
  expect(px.w).toBe(vp.width * 3);
  expect(px.h).toBe(vp.height * 3);
  if (vp.height === 852) {
    // iPhone 15 Pro 전체 화면 해상도: 1179 x 2556
    expect(px.w).toBe(1179);
    expect(px.h).toBe(2556);
  }
  // 스크롤/여백 없음
  const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }));
  expect(scroll.sw).toBeLessThanOrEqual(vp.width);
  expect(scroll.sh).toBeLessThanOrEqual(vp.height);
  await page.screenshot({ path: info.outputPath('title.png') });
  expect(errors).toEqual([]);
});

test('PWA 메타 정보 (홈 화면 전체 화면 실행)', async ({ page, request }) => {
  await page.goto('/');
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toContain('viewport-fit=cover');
  expect(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content')).toBe('yes');
  expect(await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content')).toBe('black-translucent');
  const splash = await page.locator('link[rel="apple-touch-startup-image"]').first().getAttribute('media');
  expect(splash).toContain('device-width: 393px');
  expect(splash).toContain('device-height: 852px');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.orientation).toBe('portrait');
  for (const icon of manifest.icons) expect((await request.get('/' + icon.src)).ok()).toBe(true);
  expect((await request.get('/sw.js')).ok()).toBe(true);
  expect((await request.get('/splash/splash-1179x2556.png')).ok()).toBe(true);
});

test('타이틀 → 메뉴 → 게임 정보 창', async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.waitForTimeout(400);
  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width / 2, vp.height * 0.68);
  await expect.poll(async () => (await state(page)).screen, { timeout: 15_000 }).toBe('MenuScreen');
  await page.waitForTimeout(600);
  await page.screenshot({ path: info.outputPath('menu.png') });
  // 첫 번째 게임 타일 탭 → 정보 창
  await page.mouse.click(100, 200);
  await page.waitForTimeout(600);
  await page.screenshot({ path: info.outputPath('menu-panel.png') });
  expect(errors).toEqual([]);
});

test('모든 게임 장면이 오류 없이 그려짐', async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.goto('/');
  const games = await page.evaluate(() => window.__rs.games);
  expect(games.length).toBe(10);
  for (const id of games) {
    for (const t of [3, 12, 30]) {
      await page.evaluate(([g, tt]) => window.__rs.preview(g as string, tt as number), [id, t]);
      await page.waitForTimeout(60);
    }
    await page.screenshot({ path: info.outputPath(`scene-${id}.png`) });
  }
  expect(errors).toEqual([]);
});

test('자동 플레이로 끝까지 → 결과 하이레벨', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone15pro-fullscreen', '한 번만 실행');
  const errors = watchErrors(page);
  await page.goto('/');
  await page.waitForTimeout(300);
  await page.mouse.click(196, 580);
  await expect.poll(async () => (await state(page)).screen, { timeout: 15_000 }).toBe('MenuScreen');
  await page.evaluate(() => window.__rs.start('trio', { autoplay: true, rate: 4 }));
  await expect.poll(async () => (await state(page)).phase, { timeout: 20_000 }).toBe('play');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: info.outputPath('playing.png') });
  await expect.poll(async () => (await state(page)).screen, { timeout: 90_000, intervals: [1000] }).toBe('ResultScreen');
  const st = await state(page);
  expect(st.rank).toBe('hi');
  expect(st.score).toBe(100);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: info.outputPath('result.png') });
  expect(errors).toEqual([]);
});
