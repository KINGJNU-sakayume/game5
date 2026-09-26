import { defineConfig, devices } from '@playwright/test';

const iphone = devices['iPhone 15 Pro'];

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
    browserName: 'chromium',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      // 홈 화면에 추가한 PWA(전체 화면): 393 x 852 @3x
      name: 'iphone15pro-fullscreen',
      use: { ...iphone, browserName: 'chromium', viewport: { width: 393, height: 852 } },
    },
    {
      // Safari 주소창/툴바가 보이는 상태
      name: 'iphone15pro-safari',
      use: { ...iphone, browserName: 'chromium' },
    },
  ],
});
