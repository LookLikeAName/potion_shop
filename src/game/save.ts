import {
  createCauldron, createInitialState, createSlot, SAVE_VERSION, type GameState,
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
    upgrades: { ...st.upgrades },
    stats: { ...base.stats, ...st.stats },
    slots: base.slots.map((d, i) => ({ ...createSlot(d.open), ...d, ...st.slots?.[i] })),
    cauldrons: (st.cauldrons ?? base.cauldrons).map((c) => ({ ...createCauldron(c.recipe), ...c })),
    customers: st.customers ?? [],
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
