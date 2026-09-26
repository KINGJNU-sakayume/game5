import { defineConfig, type Plugin } from 'vite';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

/** 빌드 결과물 목록으로 오프라인용 서비스 워커(sw.js)를 생성 */
function serviceWorker(): Plugin {
  return {
    name: 'rs-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = new Set<string>(['./', './index.html']);
      for (const name of Object.keys(bundle)) files.add('./' + name);
      const walk = (dir: string) => {
        for (const f of readdirSync(dir)) {
          const p = join(dir, f);
          if (statSync(p).isDirectory()) walk(p);
          else if (!f.startsWith('.')) files.add('./' + relative('public', p).split('\\').join('/'));
        }
      };
      walk('public');
      const list = [...files].sort();
      const hash = createHash('sha1');
      hash.update(list.join('\n'));
      for (const [name, chunk] of Object.entries(bundle)) {
        hash.update(name);
        hash.update(chunk.type === 'chunk' ? chunk.code : String(chunk.source.length));
      }
      const version = hash.digest('hex').slice(0, 10);
      const src = readFileSync('scripts/sw-template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__FILES__', JSON.stringify(list, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: true,
  },
});
