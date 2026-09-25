import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: './',
  plugins: [preact()],
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
