import { signal } from '@preact/signals';
import type { BuyMode } from '../game/costs';
import type { Game } from '../game/game';
import type { OfflineReport } from '../game/offline';

export type DrawerTab = 'greenhouse' | 'cauldron' | 'counter' | 'settings';

/** 遊戲狀態變更計數，UI 讀取它來訂閱更新 */
export const uiTick = signal(0);
export const drawerOpen = signal(false);
export const drawerTab = signal<DrawerTab>('greenhouse');
/** 開啟魔導書時要捲動到的卡片 ID */
export const drawerFocus = signal<string | null>(null);
export const buyMode = signal<BuyMode>(1);
export const offlineReport = signal<OfflineReport | null>(null);
export const lockState = signal<'ok' | 'blocked' | 'lost'>('ok');
export const toast = signal<{ id: number; text: string } | null>(null);

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
  drawerOpen.value = true;
}

let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(text: string): void {
  const id = ++toastId;
  toast.value = { id, text };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (toast.value?.id === id) toast.value = null;
  }, 2200);
}
