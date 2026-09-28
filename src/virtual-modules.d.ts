// vite.config.ts 的外掛提供的虛擬模組

/** public/BGM 裡的音樂檔名（排序過） */
declare module 'virtual:bgm' {
  const files: string[];
  export default files;
}
