import { signal } from '@preact/signals';
import { playSfx, type SfxId } from '../audio/sfx';
import type { EventId } from '../game/config/events';
import type { BuyMode } from '../game/costs';
import type { ItemId } from '../game/flow';
import type { Game } from '../game/game';
import type { OfflineReport } from '../game/offline';

export type DrawerTab = 'greenhouse' | 'cauldron' | 'counter' | 'flow' | 'lumia' | 'decor' | 'events' | 'settings';

/** 遊戲狀態變更計數，UI 讀取它來訂閱更新 */
export const uiTick = signal(0);
export const drawerOpen = signal(false);
export const drawerTab = signal<DrawerTab>('greenhouse');
/** 開啟魔導書時要捲動到的卡片 ID */
export const drawerFocus = signal<string | null>(null);
export const buyMode = signal<BuyMode>(1);
export const offlineReport = signal<OfflineReport | null>(null);
export const lockState = signal<'ok' | 'blocked' | 'lost'>('ok');
/** 提示訊息；icon = 前面的小圖示（資源 ID），glyph = 沒有素材時顯示的文字符號 */
export const toast = signal<{ id: number; text: string; icon?: string; glyph?: string } | null>(null);
/** 露米婭互動視窗 */
export const lumiaOpen = signal(false);
/** 產銷分頁正在看哪一項的詳細圖表（null = 總覽） */
export const flowDetail = signal<ItemId | 'income' | null>(null);
/** 拖曳中的擺設：跟著指標的圖（#ui 內的座標） */
export const dragGhost = signal<{ icon: string; x: number; y: number } | null>(null);
/** 標題畫面：第一次進入遊戲（沒有存檔、或重新開始）時顯示；之後可以從設定回到標題 */
export const titleOpen = signal(false);

const TITLE_KEY = 'idle-potion-shop/title';
/** 在標題畫面換語言時頁面會重新載入：記下來，載入後回到標題畫面 */
export function rememberTitle(): void {
  try {
    sessionStorage.setItem(TITLE_KEY, '1');
  } catch {
    // 存不了就算了（重新載入後直接進遊戲）
  }
}
/** 載入時要不要回到標題畫面（讀一次就清掉） */
export function takeRememberedTitle(): boolean {
  try {
    const v = sessionStorage.getItem(TITLE_KEY) === '1';
    sessionStorage.removeItem(TITLE_KEY);
    return v;
  } catch {
    return false;
  }
}
/** 正在播放的劇情 ID */
export const storyId = signal<string | null>(null);
/** 正在讀的來信（第幾封） */
export const letterOpen = signal<number | null>(null);
/** 事件簿：正在看哪一個事件的詳細視窗 */
export const eventDetail = signal<EventId | null>(null);
/** 第一次完成、剛加進事件簿的那一頁（詳細視窗上顯示「新的一頁」） */
export const eventNewPage = signal<EventId | null>(null);

/** 第一次完成事件：等完成特效播一下，再自動打開事件簿的那一頁 */
export function showNewEventPage(id: EventId): void {
  setTimeout(() => {
    eventNewPage.value = id;
    eventDetail.value = id;
  }, 1000);
}

let game: Game | null = null;
let takeoverFn: (() => Promise<void>) | null = null;

export function bindGame(g: Game, takeover: () => Promise<void>): void {
  game = g;
  takeoverFn = takeover;
}

/** 在元件中取得遊戲物件，並訂閱狀態更新 */
export function useGame(): Game {
  void uiTick.value;
  return game!;
}

export function requestTakeover(): Promise<void> {
  return takeoverFn?.() ?? Promise.resolve();
}

export function openDrawer(tab: DrawerTab, focus: string | null = null): void {
  drawerTab.value = tab;
  drawerFocus.value = focus;
  // 從頂列點原料／藥水打開產銷時回到總覽
  if (tab === 'flow') flowDetail.value = null;
  drawerOpen.value = true;
}

let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
/** sound：這則提示的音效（預設一般通知；null = 不響，例如玩家自己按的操作回饋） */
export function showToast(text: string, ms = 2200, icon?: { id: string; glyph?: string }, sound: SfxId | null = 'notify'): void {
  if (sound) playSfx(sound);
  const id = ++toastId;
  toast.value = { id, text, icon: icon?.id, glyph: icon?.glyph };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (toast.value?.id === id) toast.value = null;
  }, ms);
}
