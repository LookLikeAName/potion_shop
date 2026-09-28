// 配樂：曲子放在 public/BGM（檔名就是曲目 ID，例如 星屑のメロディ.mp3 → 星屑のメロディ）。
// 資料夾裡有哪些曲子由 vite.config.ts 的外掛列出（virtual:bgm），換曲只要替換檔案。
// playMusic(ID) 循環播放；換曲時舊的淡出、新的淡入。
import BGM_FILES from 'virtual:bgm';
import { audioContext, busNode } from './engine';

const idOf = (file: string) => file.replace(/\.\w+$/, '');

/** 目前有的曲子 */
export const MUSIC_IDS: string[] = BGM_FILES.map(idOf);

/**
 * 什麼時候播哪首（之後有更多曲子時在這裡分配）。
 * 指定的曲子不在資料夾裡（改名、還沒放）時，用資料夾裡的第一首
 */
export const MUSIC_FOR = {
  main: '星屑のメロディ',
};

export function trackFor(slot: keyof typeof MUSIC_FOR): string | null {
  const want = MUSIC_FOR[slot];
  return MUSIC_IDS.includes(want) ? want : MUSIC_IDS[0] ?? null;
}

const urlOf = (id: string) => {
  const file = BGM_FILES.find((f) => idOf(f) === id);
  return file ? `${import.meta.env.BASE_URL}BGM/${encodeURIComponent(file)}` : null;
};

let current: { id: string; el: HTMLAudioElement; gain: GainNode } | null = null;
const FADE = 1.2;

/** 播放（循環）某首曲子；null = 淡出停止 */
export function playMusic(id: string | null): void {
  if (current?.id === id) {
    // 同一首：之前因為還沒解鎖聲音而沒播成功的話，再試一次
    if (current.el.paused) void current.el.play().catch(() => {});
    return;
  }
  const ctx = audioContext();
  const bus = busNode('music');
  if (!ctx || !bus) return;
  // 舊的淡出
  if (current) {
    const old = current;
    old.gain.gain.setTargetAtTime(0, ctx.currentTime, FADE / 3);
    setTimeout(() => {
      old.el.pause();
      old.gain.disconnect();
    }, FADE * 1000 + 200);
    current = null;
  }
  const url = id ? urlOf(id) : null;
  if (!id || !url) return;
  const el = new Audio(url);
  el.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  ctx.createMediaElementSource(el).connect(gain).connect(bus);
  gain.gain.setTargetAtTime(1, ctx.currentTime, FADE / 3);
  current = { id, el, gain };
  void el.play().catch(() => {
    // 還沒解鎖聲音：使用者操作後再呼叫一次 playMusic 就會播
  });
}
