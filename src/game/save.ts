import type { MaterialId } from './config/plants';
import type { PotionId } from './config/recipes';
import { CRATE_FOR, CRATE_MATERIALS } from './config/upgrades';
import {
  createCauldron, createInitialState, createSlot, SAVE_VERSION, type CustomerState, type GameSettings,
  type GameState,
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

/** 舊版只有一個「商會收購箱」（收所有藥水與原料）：換成同等級的四個收購箱 */
function migrateUpgrades(old: Record<string, number>): Record<string, number> {
  const { crate, ...rest } = old;
  if (!crate) return { ...rest };
  const out = { ...rest };
  for (const id of [...Object.values(CRATE_FOR), CRATE_MATERIALS]) out[id] = Math.max(out[id] ?? 0, crate);
  return out;
}

/**
 * 舊版只有一個共用的保留量：套用到每一種藥水。
 * 舊版原料收購只有一個總開關（sellMaterials）：套用到每一種原料。
 */
function migrateSettings(
  base: GameSettings, old?: Partial<GameSettings> & { reserve?: number; sellMaterials?: boolean },
): GameSettings {
  const shared = old?.reserve;
  const reserves = { ...base.reserves };
  if (shared !== undefined) for (const p of Object.keys(reserves) as PotionId[]) reserves[p] = shared;
  const materials = { ...base.materials };
  for (const m of Object.keys(materials) as MaterialId[]) {
    materials[m] = { ...materials[m], ...(old?.sellMaterials === false && { sell: false }), ...old?.materials?.[m] };
  }
  return { ...base, reserves: { ...reserves, ...old?.reserves }, materials };
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
    upgrades: migrateUpgrades(st.upgrades ?? {}),
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
      const old = c as Partial<CustomerState> & { potion?: PotionId; qty?: number };
      if (old.lines) return c;
      return { ...c, partial: false, lines: [{ potion: old.potion ?? 'glow', qty: old.qty ?? 1, delivered: 0 }] };
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
