import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import preact from '@preact/preset-vite';

/**
 * 配樂的曲目清單：public/BGM 裡的音樂檔（public 的檔案不能用 import 列出來，所以由這裡讀資料夾）。
 * 程式裡 import BGM_FILES from 'virtual:bgm' 拿到檔名陣列；開發中新增、刪除曲子時自動重新載入。
 */
function bgmList(): Plugin {
  const ID = 'virtual:bgm';
  const RESOLVED = '\0' + ID;
  const dir = resolve(__dirname, 'public/BGM');
  const files = () => (existsSync(dir) ? readdirSync(dir).filter((f) => /\.(mp3|ogg|m4a|wav)$/i.test(f)).sort() : []);
  return {
    name: 'bgm-list',
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load: (id) => (id === RESOLVED ? `export default ${JSON.stringify(files())};` : undefined),
    configureServer(server) {
      server.watcher.add(dir);
      const refresh = (file: string) => {
        if (!resolve(file).startsWith(dir)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [preact(), bgmList()],
  server: {
    host: true,
    port: 5173,
    // 專案放在 Windows 磁碟 (/mnt/h)，WSL 收不到檔案變更通知，改用輪詢
    watch: { usePolling: true, interval: 300 },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
