// 開場的素材預先下載（放在網站上時素材要時間下載）：
// 依優先順序分批下載，前一批下載完才開始下一批，頻寬先給畫面最先需要的東西。
//   1. 標題：目前語言的標誌、主背景（場景還沒準備好時，標題畫面先用它當背景）、游標
//   2. 場景：場景用到的所有貼圖（TextureBank 之後從快取拿，不會再下載）
//   3. 其餘：序章的 CG 與語音（還沒看過序章時；按開始就馬上播）、介面圖示、書本材質、音效
// 1～3 全部完成才能開始遊戲。剛開始用不到的立繪、CG，與邊下載邊播放的配樂、語音不擋開始，
// 開始之後在背景依序下載（目前服裝的立繪優先）。其他語言的標誌不下載。
import { signal } from '@preact/signals';
import { Assets } from 'pixi.js';
import { ART_URLS } from './manifest';
import { sceneTextureUrls } from '../render/textures';
import { audible } from '../audio/engine';
import { initSfx } from '../audio/sfx';
import { musicUrl, trackFor } from '../audio/music';
import { loadVoiceManifest, voiceUrls } from '../audio/voice';
import { currentLang } from '../i18n';
import { OUTFITS, type OutfitId } from '../game/config/mascot';

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

const OUTFITS_WITH_PORTRAITS = new Set<string>(Object.keys(OUTFITS).filter((o) => o !== 'default'));

/** 這張立繪是不是這套服裝的（預設服裝的立繪 ID 沒有服裝名稱：portrait_lumia_happy） */
function portraitOf(id: string, outfit: OutfitId): boolean {
  const head = id.slice('portrait_lumia_'.length).split('_')[0];
  return outfit === 'default' ? !OUTFITS_WITH_PORTRAITS.has(head) : head === outfit;
}

export interface PreloadOpts {
  /** 還沒看過序章（按開始就會播序章，它的 CG 與語音要先下載好） */
  opening: boolean;
  /** 露米婭目前的服裝（背景下載時這套的立繪排第一） */
  outfit: OutfitId;
}

export function startPreload({ opening, outfit }: PreloadOpts): Preload {
  const ids = Object.keys(ART_URLS);
  const url = (id: string) => ART_URLS[id];
  // 標誌只要目前語言的（換語言會重新載入）；沒有這個語言的標誌時用沒有文字的外框
  const logo = ART_URLS[`ui_logo_${currentLang()}`] ?? ART_URLS.ui_title_logo;
  const bg = ART_URLS.bg_dollhouse_main;
  const title = [logo, bg].filter(Boolean);
  const scene = sceneTextureUrls().filter((u) => u !== bg);
  const openingCg = opening && ART_URLS.cg_opening ? [ART_URLS.cg_opening] : [];
  // CG 與立繪（佔全部圖片的三分之二）剛開始用不到：開始遊戲後再在背景下載
  const later = (id: string) => id.startsWith('cg_') || id.startsWith('portrait_');
  const skip = (id: string) => id.startsWith('ui_logo_') || id === 'ui_title_logo';
  const early = new Set([...title, ...scene, ...openingCg]);
  const rest = [...new Set(ids.filter((id) => !later(id) && !skip(id)).map(url))].filter((u) => !early.has(u));
  const portraits = ids.filter((id) => id.startsWith('portrait_'));
  const myPortraits = portraits.filter((id) => portraitOf(id, outfit)).map(url);
  const laterArt = [
    ...ids.filter((id) => id.startsWith('cg_') && !id.startsWith('cg_evt_')),
    ...ids.filter((id) => id.startsWith('cg_evt_')),
    ...portraits.filter((id) => !portraitOf(id, outfit)),
  ].map(url).filter((u) => !early.has(u));

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
  // 背景（一次三個，不跟遊戲中臨時需要的東西搶頻寬）：目前服裝的立繪 → 配樂 → 劇情 CG → 事件 CG
  // → 其他服裝的立繪 → 其他語音。關掉的聲音不下載
  void all.then(async (fetched) => {
    const bgm = audible('music') ? musicUrl(trackFor('main')) : null;
    const voices = audible('voice') ? voiceUrls().filter((u) => !fetched.has(u)) : [];
    await run([
      ...myPortraits.map((u) => image(u)),
      ...(bgm ? [prefetch(bgm)] : []),
      ...laterArt.map((u) => image(u)),
      ...voices.map(prefetch),
    ], 3);
  });
  return { scene: sceneDone.then(() => undefined), all: all.then(() => undefined) };
}
