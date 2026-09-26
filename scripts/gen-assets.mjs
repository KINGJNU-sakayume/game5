// PWA 아이콘/시작 화면 이미지 생성 (게임의 그리기 코드를 그대로 사용)
// 사용법: npm run assets   (Playwright Chromium 필요)
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url + '?assets=1');
await page.waitForTimeout(300);

async function render(kind, w, h, scale) {
  const dataUrl = await page.evaluate(
    async ([kind, w, h, scale]) => {
      const B = await import('/src/screens/backdrop.ts');
      const G = await import('/src/core/gfx.ts');
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.scale(scale, scale);
      const W = w / scale;
      const H = h / scale;
      if (kind === 'icon' || kind === 'maskable') {
        const gr = g.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, '#2b1260');
        gr.addColorStop(1, '#ff7eb3');
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 18; i++) {
          const x = ((i * 97) % 100) / 100 * W;
          const y = ((i * 57) % 100) / 100 * H * 0.8;
          G.circle(g, x, y, W * 0.008 + (i % 3) * W * 0.004, 'rgba(255,255,255,0.8)');
        }
        const r = kind === 'maskable' ? W * 0.3 : W * 0.38;
        B.mascot(g, W / 2, H * 0.53, r, 0.5, 'happy');
        G.noteGlyph(g, W * 0.8, H * 0.28, W * 0.06, '#fff');
      } else {
        B.nightSky(g, W, H, 3);
        B.orbitStars(g, W / 2, H * 0.42, 150, 1);
        B.mascot(g, W / 2, H * 0.42, 92, 0.5, 'happy');
        B.logo(g, W / 2, H * 0.2 + 30, 50, 0);
      }
      return c.toDataURL('image/png');
    },
    [kind, w, h, scale],
  );
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

mkdirSync('public/icons', { recursive: true });
mkdirSync('public/splash', { recursive: true });
writeFileSync('public/icons/apple-touch-icon.png', await render('icon', 180, 180, 180 / 180));
writeFileSync('public/icons/icon-192.png', await render('icon', 192, 192, 1));
writeFileSync('public/icons/icon-512.png', await render('icon', 512, 512, 1));
writeFileSync('public/icons/icon-maskable-512.png', await render('maskable', 512, 512, 1));
// iPhone 15 Pro: 393x852pt @3x, Pro Max: 430x932pt @3x
writeFileSync('public/splash/splash-1179x2556.png', await render('splash', 1179, 2556, 3));
writeFileSync('public/splash/splash-1290x2796.png', await render('splash', 1290, 2796, 3));
console.log('assets generated');
await browser.close();
await server.close();
