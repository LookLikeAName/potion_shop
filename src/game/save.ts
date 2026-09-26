import type { MaterialId } from './config/plants';
import type { PotionId } from './config/recipes';
import { INITIAL_OPEN_SLOTS } from './config/balance';
import { CRATE_FOR, CRATE_MATERIALS, FLOATING_POT } from './config/upgrades';
import {
  createCauldron, createInitialState, createSlot, SAVE_VERSION, type CustomerState, type GameSettings,
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

/**
 * 收購箱設定的舊版格式：
 * - 藥水保留量原本是數字（共用的 reserve 或每種各自的 reserves），後來是「保留給客人」開關（keepForCustomers）：
 *   設成 0／關掉的換成保留 0%（全部收購），其他換成預設的保留 100%。
 * - 原料收購原本只有一個總開關（sellMaterials）：套用到每一種原料。
 */
function migrateSettings(
  base: GameSettings,
  old?: Partial<GameSettings> & {
    reserve?: number; reserves?: Partial<Record<PotionId, number>>;
    keepForCustomers?: Partial<Record<PotionId, boolean>>; sellMaterials?: boolean;
  },
): GameSettings {
  const potions = { ...base.potions };
  for (const p of Object.keys(potions) as PotionId[]) {
    const n = old?.reserves?.[p] ?? old?.reserve;
    const keep = old?.keepForCustomers?.[p] ?? (n === undefined ? undefined : n > 0);
    potions[p] = { ...potions[p], ...(keep === false && { keepPct: 0 }), ...old?.potions?.[p] };
  }
  const materials = { ...base.materials };
  for (const m of Object.keys(materials) as MaterialId[]) {
    materials[m] = { ...materials[m], ...(old?.sellMaterials === false && { sell: false }), ...old?.materials?.[m] };
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
    achievements: { ...st.achievements },
    giftsToday: { ...st.giftsToday },
    slots: base.slots.map((d, i) => ({ ...createSlot(d.open), ...d, ...st.slots?.[i] })),
    cauldrons: (st.cauldrons ?? base.cauldrons).map((c) => ({ ...createCauldron(c.recipe), ...c })),
    // 舊版顧客只有單一藥水 { potion, qty }：轉成訂單格式
    customers: (st.customers ?? []).map((c) => {
      const old = c as Omit<CustomerState, 'status'> & { status: string; potion?: PotionId; qty?: number };
      // 舊版「結帳中」（大家同時倒數）→ 備好貨排隊等結帳
      const status: CustomerState['status'] = old.status === 'checkout' ? 'ready' : c.status;
      const extra = { status, arrive: old.arrive ?? 0, walk: old.walk ?? 0, express: old.express ?? false };
      if (old.lines) return { ...c, ...extra };
      return {
        ...c, ...extra, partial: false,
        lines: [{ potion: old.potion ?? 'glow', qty: old.qty ?? 1, delivered: status === 'waiting' ? 0 : old.qty ?? 1 }],
      };
    }),
  };
  return { version: SAVE_VERSION, savedAt: raw.savedAt ?? Date.now(), state };
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
