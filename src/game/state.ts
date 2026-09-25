import { CUSTOMER, INITIAL_OPEN_SLOTS, SLOT_COUNT } from './config/balance';
import { MATERIAL_IDS, type MaterialId } from './config/plants';
import { POTION_IDS, type PotionId } from './config/recipes';

export const SAVE_VERSION = 1;

/** 盆栽對某種植物的培育紀錄（改種後再種回來會恢復） */
export interface PlotMemory {
  level: number;
  rain: number;
  fairy: boolean;
}

export interface SlotState {
  open: boolean;
  plant: MaterialId | null;
  /** 以下三項是目前這種植物的等級與升級 */
  level: number;
  rain: number;
  fairy: boolean;
  /** 已生長秒數（0 ~ growTime） */
  progress: number;
  /** 已成熟、等待手動採收 */
  ready: boolean;
  /** 這個盆栽種過的其他植物的紀錄 */
  memory: Partial<Record<MaterialId, PlotMemory>>;
}

export interface CauldronState {
  recipe: PotionId;
  level: number;
  /** 已熬煮秒數 */
  progress: number;
  /** 本輪批量，0 = 閒置 */
  batch: number;
  salamander: number;
}

export interface CustomerState {
  id: number;
  potion: PotionId;
  qty: number;
  status: 'waiting' | 'checkout';
  patience: number;
  patienceMax: number;
  /** 到店時庫存不足 → 急單 */
  rush: boolean;
  checkout: number;
}

export interface GameStats {
  potionsSold: number;
  goldEarned: number;
  customersServed: number;
  rushServed: number;
}

export interface GameState {
  version: number;
  /** 累計模擬秒數 */
  time: number;
  gold: number;
  happiness: number;
  charCrystal: number;
  materials: Record<MaterialId, number>;
  potions: Record<PotionId, number>;
  slots: SlotState[];
  /** 由左到右的順序 = 原料分配優先順序 */
  cauldrons: CauldronState[];
  customers: CustomerState[];
  nextCustomerId: number;
  customerTimer: number;
  /** 全域升級等級 */
  upgrades: Record<string, number>;
  stats: GameStats;
}

export function createSlot(open: boolean): SlotState {
  return { open, plant: null, level: 1, rain: 0, fairy: false, progress: 0, ready: false, memory: {} };
}

export function createCauldron(recipe: PotionId): CauldronState {
  return { recipe, level: 1, progress: 0, batch: 0, salamander: 0 };
}

const zeroRecord = <K extends string>(keys: K[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

export function createInitialState(): GameState {
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => createSlot(i < INITIAL_OPEN_SLOTS));
  slots[0].plant = 'redheart';
  return {
    version: SAVE_VERSION,
    time: 0,
    gold: 0,
    happiness: 0,
    charCrystal: 0,
    materials: zeroRecord(MATERIAL_IDS),
    potions: zeroRecord(POTION_IDS),
    slots,
    cauldrons: [createCauldron('glow')],
    customers: [],
    nextCustomerId: 1,
    customerTimer: CUSTOMER.interval - CUSTOMER.firstDelay,
    upgrades: {},
    stats: { potionsSold: 0, goldEarned: 0, customersServed: 0, rushServed: 0 },
  };
}
