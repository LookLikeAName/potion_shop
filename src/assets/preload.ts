// 開場的素材預先下載（放在網站上時素材要時間下載）：
// 依優先順序分批下載，前一批下載完才開始下一批，頻寬先給畫面最先需要的東西。
//   1. 標題：目前語言的標誌、主背景（場景還沒準備好時，標題畫面先用它當背景）、游標
//   2. 場景：場景用到的所有貼圖（TextureBank 之後從快取拿，不會再下載）
//   3. 其餘：序章的 CG 與語音（還沒看過序章時；按開始就馬上播）、介面圖示、立繪、其他 CG、書本材質、音效
// 1～3 全部完成才能開始遊戲。配樂與其他語音是邊下載邊播放的，不擋開始，之後在背景慢慢預先下載。
import { signal } from '@preact/signals';
import { Assets } from 'pixi.js';
import { ART_URLS } from './manifest';
import { sceneTextureUrls } from '../render/textures';
import { audible } from '../audio/engine';
import { initSfx } from '../audio/sfx';
import { musicUrl, trackFor } from '../audio/music';
import { loadVoiceManifest, voiceUrls } from '../audio/voice';
import { currentLang } from '../i18n';

/** 必要素材（1～3 批）的下載進度 */
export const loadProgress = signal({ done: 0, total: 1 });
/** 必要素材都下載完了（可以開始遊戲） */
export const assetsReady = signal(false);
/** 場景畫好了（標題畫面改用實際的遊戲畫面當背景） */
export const sceneReady = signal(false);

const CURSORS = Object.values(import.meta.glob('./art/cursors/*.png', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>);

type Task = () => Promise<unknown>;

/** 網頁圖片（<img>、CSS 背景用）：下載進瀏覽器快取就好，失敗也算完成（顯示時再試一次） */
function image(url: string, high = false): Task {
  return () => new Promise<void>((resolve) => {
    const img = new Image();
    if (high) img.fetchPriority = 'high';
    img.onload = img.onerror = () => resolve();
    img.src = url;
  });
}

/** 場景貼圖：失敗的話 TextureBank 會自己換成佔位圖 */
const texture = (url: string): Task => () => Assets.load(url).catch(() => undefined);

/** 只下載到瀏覽器快取（配樂、語音） */
const prefetch = (url: string): Task => () => fetch(url).then((r) => r.blob()).catch(() => undefined);

/** 同時最多下載 limit 個；每完成一個呼叫 onDone */
async function run(tasks: Task[], limit: number, onDone: () => void = () => {}): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const task = tasks[next++];
      try {
        await task();
      } catch {
        // 單一素材失敗不擋整體（顯示時會退回佔位圖或重新下載）
      }
      onDone();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

export interface Preload {
  /** 1、2 批完成：可以建立場景 */
  scene: Promise<void>;
  /** 1～3 批完成：可以開始遊戲 */
  all: Promise<void>;
}

/** opening：還沒看過序章（按開始就會播序章，它的 CG 與語音要先下載好） */
export function startPreload(opening: boolean): Preload {
  const logo = ART_URLS[`ui_logo_${currentLang()}`] ?? ART_URLS.ui_title_logo;
  const bg = ART_URLS.bg_dollhouse_main;
  const title = [logo, bg].filter(Boolean);
  const scene = sceneTextureUrls().filter((u) => u !== bg);
  const openingCg = opening && ART_URLS.cg_opening ? [ART_URLS.cg_opening] : [];
  const early = new Set([...title, ...scene, ...openingCg]);
  const rest = [...new Set(Object.values(ART_URLS))].filter((u) => !early.has(u));

  let done = 0;
  let total = 1;
  const tick = () => { loadProgress.value = { done: ++done, total }; };
  // 語音清單很小：先讀完，才知道序章有哪些語音、總共要下載幾個
  const sceneDone = loadVoiceManifest().then(async () => {
    const openingVoices = opening && audible('voice') ? voiceUrls('opening') : [];
    const batches: Task[][] = [
      [...title.map((u) => image(u, true)), ...CURSORS.map((u) => image(u))],
      // 主背景在第 1 批以網頁圖片下載過了，這裡轉成貼圖時從瀏覽器快取拿
      [...(bg ? [texture(bg)] : []), ...scene.map(texture)],
      [...openingCg.map((u) => image(u)), ...openingVoices.map(prefetch), ...rest.map((u) => image(u)), () => initSfx()],
    ];
    total = batches.reduce((n, b) => n + b.length, 0);
    loadProgress.value = { done, total };
    await run(batches[0], 6, tick);
    await run(batches[1], 8, tick);
    return { last: batches[2], early: new Set(openingVoices) };
  });
  const all = sceneDone.then(async ({ last, early: fetched }) => {
    await run(last, 6, tick);
    assetsReady.value = true;
    return fetched;
  });
  // 背景：配樂、其他語音（一次兩個，不跟遊戲中需要的東西搶頻寬；關掉聲音的就不下載）
  void all.then(async (fetched) => {
    const bgm = audible('music') ? musicUrl(trackFor('main')) : null;
    const voices = audible('voice') ? voiceUrls().filter((u) => !fetched.has(u)) : [];
    await run([...(bgm ? [bgm] : []), ...voices].map(prefetch), 2);
  });
  return { scene: sceneDone.then(() => undefined), all: all.then(() => undefined) };
}
