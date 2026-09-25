import { CUSTOMER, INITIAL_OPEN_SLOTS, SLOT_COUNT, UPGRADE_FX } from './config/balance';
import { MASCOT, type Assignment, type OutfitId, type WorkZone } from './config/mascot';
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
  /** 龍息風箱：目前連擊數、上次點擊的模擬時間 */
  combo: number;
  comboAt: number;
  /** 極速沸騰剩餘秒數 */
  boil: number;
  /** 風箱冷卻剩餘秒數（含沸騰中） */
  boilCooldown: number;
}

/** 訂單中的一項：某種藥水要幾瓶、實際拿到幾瓶 */
export interface OrderLine {
  potion: PotionId;
  qty: number;
  delivered: number;
}

export interface CustomerState {
  id: number;
  /** 一張訂單可以有多種藥水（每種不重複） */
  lines: OrderLine[];
  status: 'waiting' | 'checkout';
  patience: number;
  patienceMax: number;
  /** 到店時庫存不足 → 急單 */
  rush: boolean;
  /** 時間到只湊到一部分 → 以折扣價買走現有的 */
  partial: boolean;
  checkout: number;
}

export interface GameStats {
  potionsSold: number;
  goldEarned: number;
  customersServed: number;
  rushServed: number;
  /** 收購箱收購的藥水數、原料數與金幣 */
  potionsWholesaled: number;
  materialsWholesaled: number;
  wholesaleGold: number;
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
  /** 叫賣鈴鐺剩餘次數與回復計時 */
  bellCharges: number;
  bellTimer: number;
  /** 收購箱結算計時 */
  crateTimer: number;
  settings: GameSettings;
  stats: GameStats;
  mascot: MascotState;
  /** 開心度兌換項目的購買次數 */
  redeemed: Record<string, number>;
  /** 已達成的成就 */
  achievements: Record<string, boolean>;
  achievementTimer: number;
  /** 狂熱時刻剩餘秒數、上次使用的日期 */
  feverLeft: number;
  feverDay: string;
  /** 平滑後的每秒收入（禮物價格用） */
  incomeRate: number;
  /** 今天已經送過的禮物 */
  giftDay: string;
  giftsToday: Record<string, boolean>;
}

export interface MascotState {
  assignment: Assignment;
  /** 體力耗盡後自動去休息（回滿後回到原本的指派） */
  autoRest: boolean;
  stamina: number;
  /** 互動能量 */
  energy: number;
  outfit: OutfitId;
  /** 上次領取每日互動獎勵的日期 */
  dailyKey: string;
  /** 自由活動時目前工作的區域，以及還要待多久 */
  patrolZone: WorkZone | null;
  patrolTimer: number;
}

export interface GameSettings {
  /** 收購箱：每種藥水保留給顧客的庫存量 */
  reserve: number;
  /** 收購箱：是否也收購多餘的原料 */
  sellMaterials: boolean;
}

export function createSlot(open: boolean): SlotState {
  return { open, plant: null, level: 1, rain: 0, fairy: false, progress: 0, ready: false, memory: {} };
}

export function createCauldron(recipe: PotionId): CauldronState {
  return {
    recipe, level: 1, progress: 0, batch: 0, salamander: 0,
    combo: 0, comboAt: -1e9, boil: 0, boilCooldown: 0,
  };
}

export function createMascot(): MascotState {
  return {
    assignment: 'patrol', autoRest: false,
    stamina: MASCOT.staminaMax, energy: MASCOT.energyMax,
    outfit: 'default', dailyKey: '',
    patrolZone: null, patrolTimer: 0,
  };
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
    bellCharges: 0,
    bellTimer: 0,
    crateTimer: 0,
    settings: { reserve: UPGRADE_FX.reserveDefault, sellMaterials: true },
    mascot: createMascot(),
    redeemed: {},
    achievements: {},
    achievementTimer: 0,
    feverLeft: 0,
    feverDay: '',
    incomeRate: 0,
    giftDay: '',
    giftsToday: {},
    stats: {
      potionsSold: 0, goldEarned: 0, customersServed: 0, rushServed: 0,
      potionsWholesaled: 0, materialsWholesaled: 0, wholesaleGold: 0,
    },
  };
}
