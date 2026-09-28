import type { MaterialId } from './config/plants';
import type { PotionId } from './config/recipes';
import { INITIAL_OPEN_SLOTS } from './config/balance';
import { DECOR } from './config/gifts';
import { CRATE_FOR, CRATE_MATERIALS, FLOATING_POT } from './config/upgrades';
import { decorFx } from './stats';
import { skipTutorial } from './tutorial';
import {
  createCauldron, createInitialState, createSlot, SAVE_VERSION, type CrateSetting, type CustomerState, type GameSettings,
  type GameState, type SlotState,
} from './state';

const KEY = 'idle-potion-shop/save';

export interface SaveFile {
  version: number;
  savedAt: number;
  state: GameState;
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function toSaveFile(state: GameState, now = Date.now()): SaveFile {
  return { version: SAVE_VERSION, savedAt: now, state };
}

export function saveGame(state: GameState, now = Date.now()): boolean {
  try {
    storage()?.setItem(KEY, JSON.stringify(toSaveFile(state, now)));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): SaveFile | null {
  try {
    const raw = storage()?.getItem(KEY);
    return raw ? parseSave(raw) : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* 忽略 */
  }
}

export function parseSave(json: string): SaveFile | null {
  const raw = JSON.parse(json) as Partial<SaveFile>;
  if (!raw || typeof raw !== 'object' || !raw.state) return null;
  return migrate(raw);
}

/**
 * 舊版只有一個「商會收購箱」（收所有藥水與原料）：換成同等級的四個收購箱。
 * 舊版的浮空盆栽由開心度「奇蹟綠手指」開啟：已經開啟的格數換成浮空魔法盆栽的購買次數。
 */
function migrateUpgrades(old: Record<string, number>, slots?: Partial<SlotState>[]): Record<string, number> {
  const { crate, ...rest } = old;
  const out = { ...rest };
  if (crate) {
    for (const id of [...Object.values(CRATE_FOR), CRATE_MATERIALS]) out[id] = Math.max(out[id] ?? 0, crate);
  }
  const floatingOpen = (slots ?? []).filter((sl, i) => i >= INITIAL_OPEN_SLOTS && sl?.open).length;
  if (floatingOpen > (out[FLOATING_POT] ?? 0)) out[FLOATING_POT] = floatingOpen;
  return out;
}

/** 舊版的單項設定：保留量曾經是百分比（keepPct） */
type OldCrateSetting = { sell?: boolean; keepSec?: number; keepPct?: number };

/** 單項設定：開關照舊；保留量有秒數就用，舊的百分比設成 0（全部收購）的保留 0 秒，其他換成預設秒數 */
function migrateCrate(def: CrateSetting, old?: OldCrateSetting, keepOff = false): CrateSetting {
  const keepSec = old?.keepSec ?? (keepOff || old?.keepPct === 0 ? 0 : def.keepSec);
  return { sell: old?.sell ?? def.sell, keepSec };
}

/**
 * 收購箱設定的舊版格式：
 * - 藥水保留量原本是數字（共用的 reserve 或每種各自的 reserves），後來是「保留給客人」開關（keepForCustomers）：
 *   設成 0／關掉的換成保留 0（全部收購），其他用預設值。
 * - 原料收購原本只有一個總開關（sellMaterials）：套用到每一種原料。
 * - 保留量原本是百分比（藥水 100% = 店裡站滿、原料 100% = 大釜熬 1 輪），版本 4 改成「幾秒份」：
 *   百分比沒辦法換算（後期原料的 100% 只有千分之一秒），一律換成預設秒數；設成 0% 的維持全部收購。
 */
function migrateSettings(
  base: GameSettings,
  old?: {
    potions?: Partial<Record<PotionId, OldCrateSetting>>; materials?: Partial<Record<MaterialId, OldCrateSetting>>;
    reserve?: number; reserves?: Partial<Record<PotionId, number>>;
    keepForCustomers?: Partial<Record<PotionId, boolean>>; sellMaterials?: boolean;
  },
): GameSettings {
  const potions = { ...base.potions };
  for (const p of Object.keys(potions) as PotionId[]) {
    const n = old?.reserves?.[p] ?? old?.reserve;
    const keep = old?.keepForCustomers?.[p] ?? (n === undefined ? undefined : n > 0);
    potions[p] = migrateCrate(base.potions[p], old?.potions?.[p], keep === false);
  }
  const materials = { ...base.materials };
  for (const m of Object.keys(materials) as MaterialId[]) {
    const o = old?.materials?.[m];
    materials[m] = migrateCrate(base.materials[m], { ...o, sell: o?.sell ?? (old?.sellMaterials === false ? false : undefined) });
  }
  return { potions, materials };
}

/** 版本遷移，並補上舊存檔缺少的欄位 */
function migrate(raw: Partial<SaveFile>): SaveFile {
  const base = createInitialState();
  const st = raw.state as Partial<GameState>;
  const state: GameState = {
    ...base,
    ...st,
    version: SAVE_VERSION,
    materials: { ...base.materials, ...st.materials },
    potions: { ...base.potions, ...st.potions },
    upgrades: migrateUpgrades(st.upgrades ?? {}, st.slots),
    stats: { ...base.stats, ...st.stats },
    settings: migrateSettings(base.settings, st.settings),
    mascot: { ...base.mascot, ...st.mascot },
    redeemed: { ...st.redeemed },
    tutorial: { ...st.tutorial },
    achievements: { ...st.achievements },
    gifts: { ...st.gifts },
    decor: base.decor.map((d, i) => st.decor?.[i] ?? d),
    events: { ...base.events, ...st.events, codex: { ...st.events?.codex }, cooldowns: { ...st.events?.cooldowns } },
    materialRate: { ...base.materialRate, ...st.materialRate },
    harvestedThisTick: { ...base.harvestedThisTick, ...st.harvestedThisTick },
    slots: base.slots.map((d, i) => ({ ...createSlot(d.open), ...d, ...st.slots?.[i] })),
    cauldrons: (st.cauldrons ?? base.cauldrons).map((c) => ({ ...createCauldron(c.recipe), ...c })),
    // 舊版顧客只有單一藥水 { potion, qty }：轉成訂單格式
    customers: (st.customers ?? []).map((c) => {
      const old = c as Omit<CustomerState, 'status'> & { status: string; potion?: PotionId; qty?: number };
      // 舊版「結帳中」（大家同時倒數）→ 備好貨排隊等結帳
      const status: CustomerState['status'] = old.status === 'checkout' ? 'ready' : c.status;
      const extra = { status, arrive: old.arrive ?? 0, walk: old.walk ?? 0, express: old.express ?? false, payMult: old.payMult ?? 1 };
      if (old.lines) return { ...c, ...extra };
      return {
        ...c, ...extra, partial: false,
        lines: [{ potion: old.potion ?? 'glow', qty: old.qty ?? 1, delivered: status === 'waiting' ? 0 : old.qty ?? 1 }],
      };
    }),
  };
  // 舊版的每日送禮紀錄已經不用了
  delete (state as Partial<GameState> & { giftDay?: string }).giftDay;
  delete (state as Partial<GameState> & { giftsToday?: unknown }).giftsToday;
  // 版本 3：焦晶移除了（從來沒有取得途徑，丟掉欄位就好）
  delete (state as Partial<GameState> & { charCrystal?: number }).charCrystal;
  if ((st.version ?? 1) < 2) migrateHappiness(state);
  // 版本 5：加入序章（新遊戲一開始播放）。之前的存檔都已經開店了，當成看過（可以在深層羈絆回顧）
  if ((st.version ?? 1) < 5) state.redeemed.opening = 1;
  // 版本 6：加入新手教學。之前的存檔都已經在玩了，當成做過（第二口大釜的說明也不跳）
  if ((st.version ?? 1) < 6) {
    skipTutorial(state);
    state.tutorial.firstOrder = true;
  }
  // 舊版的心願沒有記錄時限有沒有算星燈：出題時就是照當時有沒有擺出星燈算的，當成現在的狀態
  if (state.wish && state.wish.lamp === undefined) state.wish.lamp = decorFx(state, 'wishTime');
  return { version: SAVE_VERSION, savedAt: raw.savedAt ?? Date.now(), state };
}

/** 版本 1 用開心度兌換的家具（當時的價格），改成禮物後退還開心度 */
const LEGACY_FURNITURE: [string, number][] = [['gramophone', 3], ['tea_set', 5], ['slime_doll', 1]];
const LEGACY_ATTUNEMENT = { max: 5, cost: 5 };

/**
 * 開心度系統重做（版本 2）：
 * - 用開心度兌換過的家具轉成已擁有的禮物，依序擺到擺設位上，並退還當初花的開心度。
 * - 魔力同調從 10 級（每級 5 點）改成 5 級：超過的等級退還開心度。
 */
function migrateHappiness(state: GameState): void {
  const r = state.redeemed;
  for (const [id, cost] of LEGACY_FURNITURE) {
    if (!r[id]) continue;
    delete r[id];
    state.gifts[id] = true;
    state.happiness += cost;
    const empty = state.decor.slice(0, DECOR.baseSlots).findIndex((x) => !x);
    if (empty >= 0) state.decor[empty] = id;
  }
  const att = r.attunement ?? 0;
  if (att > LEGACY_ATTUNEMENT.max) {
    state.happiness += (att - LEGACY_ATTUNEMENT.max) * LEGACY_ATTUNEMENT.cost;
    r.attunement = LEGACY_ATTUNEMENT.max;
  }
}

// ---------- 匯出 / 匯入（Base64，支援中文） ----------

export function exportSave(state: GameState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(toSaveFile(state)));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function importSave(text: string): SaveFile | null {
  try {
    const bin = atob(text.trim());
    const json = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
    return parseSave(json);
  } catch {
    return null;
  }
}
