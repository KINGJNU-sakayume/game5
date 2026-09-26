import { defineConfig, devices } from '@playwright/test';

const iphone = devices['iPhone 15 Pro'];
const chromeArgs = ['--autoplay-policy=no-user-gesture-required'];

export default defineConfig({
  testDir: 'e2e',
  timeout: 150_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: process.env.PW_WEBKIT
    ? [
        {
          // 실제 Safari 엔진(WebKit)으로 아이폰 15 Pro 전체 화면 검사
          name: 'iphone15pro-webkit',
          use: { ...iphone, browserName: 'webkit', viewport: { width: 393, height: 852 } },
        },
      ]
    : [
        {
          // 홈 화면에 추가한 PWA(전체 화면): 393 x 852 @3x
          name: 'iphone15pro-fullscreen',
          use: { ...iphone, browserName: 'chromium', viewport: { width: 393, height: 852 }, launchOptions: { args: chromeArgs } },
        },
        {
          // Safari 주소창/툴바가 보이는 상태
          name: 'iphone15pro-safari',
          use: { ...iphone, browserName: 'chromium', launchOptions: { args: chromeArgs } },
        },
      ],
});
