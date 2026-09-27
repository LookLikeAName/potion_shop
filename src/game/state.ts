import { CUSTOMER, INITIAL_OPEN_SLOTS, MARKET, SLOT_COUNT, UPGRADE_FX } from './config/balance';
import { DECOR } from './config/gifts';
import { MASCOT, type Assignment, type OutfitId, type WorkZone } from './config/mascot';
import { MATERIAL_IDS, type MaterialId } from './config/plants';
import { POTION_IDS, type PotionId } from './config/recipes';
import { EVENT, type EventId } from './config/events';
import { WISH, type WishKind } from './config/wishes';

/**
 * 2：開心度系統重做（家具改成禮物與擺設、魔力同調改成 5 級）；3：突發事件重做（移除焦晶）；
 * 4：收購箱保留量從百分比改成「幾秒份」
 */
export const SAVE_VERSION = 4;

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
  /**
   * waiting = 訂單還湊不齊；ready = 已備好貨，排隊等結帳；
   * serving = 排到了：先走到櫃台（walk 倒數，固定時間），到了再結帳（checkout 倒數，算盤松鼠負責）。
   * 結帳完就離開、不再佔位。
   */
  status: 'waiting' | 'ready' | 'serving';
  /** 剛進門：走到隊伍前面還要幾秒（排到時會加進走到櫃台的時間） */
  arrive: number;
  /** 走到櫃台還要幾秒（serving 時才有意義） */
  walk: number;
  /** 玩家點過：走到櫃台的同時就完成訂單，不用等結帳 */
  express: boolean;
  patience: number;
  patienceMax: number;
  /** 到店時庫存不足 → 急單 */
  rush: boolean;
  /** 時間到只湊到一部分 → 以折扣價買走現有的 */
  partial: boolean;
  /** 付款倍率：進門時女僕裝在櫃台，客人少買但照原本的數量付錢（1 = 一般） */
  payMult: number;
  checkout: number;
  /**
   * 事件「微服出巡的公主」：沒有訂單，排在隊伍裡等玩家認出她（點她），
   * 不會被結帳，事件結束時離開
   */
  princess?: boolean;
}

export interface GameStats {
  potionsSold: number;
  goldEarned: number;
  customersServed: number;
  rushServed: number;
  /** 湊不齊只買走部分的次數、一瓶都沒買到就離開的人數 */
  partialSales: number;
  customersLost: number;
  /** 收購箱收購的藥水數、原料數與金幣 */
  potionsWholesaled: number;
  materialsWholesaled: number;
  wholesaleGold: number;
  /** 完成／沒完成的小心願數 */
  wishesDone: number;
  wishesFailed: number;
  /** 完成的事件數、事件給的金幣 */
  eventsDone: number;
  eventGold: number;
  /**
   * 遊玩時間（秒）：遊戲開著的時間（其中分頁在前景的時間）、關掉或離開的時間（離線，不受離線收益上限影響）。
   * 舊存檔沒有紀錄，從載入這一版開始算
   */
  playOnline: number;
  playForeground: number;
  playAway: number;
}

export interface GameState {
  version: number;
  /** 累計模擬秒數 */
  time: number;
  gold: number;
  happiness: number;
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
  /** 平滑後的每秒收入 */
  incomeRate: number;
  /** 市場熱度：顧客訂單量的倍率，每隔一段時間隨機換目標、慢慢靠過去（value 目前、target 目標、timer 距離換目標的秒數） */
  market: { value: number; target: number; timer: number };
  /** 各藥水平滑後的每秒產量（顧客訂單量用），以及這個 tick 熬好的量 */
  potionRate: Record<PotionId, number>;
  brewedThisTick: Record<PotionId, number>;
  /** 各原料平滑後的每秒採收量（小心願出題用），以及這個 tick 採收的量 */
  materialRate: Record<MaterialId, number>;
  harvestedThisTick: Record<MaterialId, number>;
  /** 收購箱平滑後的每秒收入（小心願出題用） */
  crateRate: number;
  /** 已經送過的禮物（送過的會變成擺設） */
  gifts: Record<string, boolean>;
  /** 休息室擺設位：每格擺的禮物 ID（只有已開放的格數有效果） */
  decor: (string | null)[];
  /** 目前的小心願；沒有時 wishTimer = 距離下一個心願的秒數 */
  wish: WishState | null;
  wishTimer: number;
  /** 突發事件：檢定計時、進行中的事件、圖鑑、限時增益 */
  events: EventsState;
}

/** 事件給的限時增益種類 */
export type BuffKind =
  /** 所有盆栽生長、某一盆生長（target = 盆栽格）、所有大釜熬煮、某一口大釜熬煮（target = 配方） */
  | 'growth' | 'potGrowth' | 'brew' | 'cauldronBrew'
  /** 某一口大釜每輪都是雙倍（target = 配方）、收購箱照全價收購 */
  | 'double' | 'crateFull'
  /** 來客速度、售價、市場熱度（mult = 熱度目標） */
  | 'arrival' | 'price' | 'market';

export interface Buff {
  kind: BuffKind;
  mult: number;
  /** 剩餘秒數、總秒數 */
  time: number;
  max: number;
  target?: number | string;
  /** 哪個事件給的（顯示用） */
  source: EventId;
}

export interface ActiveEvent {
  id: EventId;
  /** 剩餘秒數（只在前景時減少）、總時限 */
  time: number;
  timeMax: number;
  /** 點中的次數、時機題已經用掉的機會 */
  hits: number;
  tries: number;
  /** 目標：盆栽格、大釜配方、客人 */
  slot?: number;
  recipe?: PotionId;
  customer?: number;
  /** 三選一的選項（流浪行商的商品、占卜婆婆的牌） */
  options?: string[];
  /** 師父的來信：第幾封 */
  letter?: number;
  /** 螢光蝴蝶：每一隻停在哪一盆 */
  landed?: number[];
}

export interface CodexEntry {
  seen: number;
  done: number;
}

export interface EventsState {
  /** 距離下一次檢定的秒數（前景時間） */
  timer: number;
  active: ActiveEvent | null;
  last: EventId | null;
  /** 各事件的個別冷卻（秒） */
  cooldowns: Partial<Record<EventId, number>>;
  codex: Partial<Record<EventId, CodexEntry>>;
  /** 已經收到幾封師父的來信 */
  letters: number;
  buffs: Buff[];
}

export function createEventsState(): EventsState {
  return {
    timer: EVENT.checkMin + EVENT.checkRand / 2,
    active: null, last: null, cooldowns: {}, codex: {}, letters: 0, buffs: [],
  };
}

export interface WishState {
  kind: WishKind;
  /** 收成／熬煮題：哪一種原料或藥水 */
  item: MaterialId | PotionId | null;
  goal: number;
  progress: number;
  /** 剩餘秒數、總時限 */
  time: number;
  timeMax: number;
  /** 總時限目前有沒有算進許願星燈的加成（星燈中途擺上或收起來時，總時限與剩餘時間跟著變） */
  lamp?: boolean;
  /** 稀有度（WISH.rarities 的索引） */
  rarity: number;
  /** 完成時的開心度（出題時就算好） */
  reward: number;
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
  /** 藥水收購箱：每種藥水要不要賣、保留多少（顧客幾秒的需求量） */
  potions: Record<PotionId, CrateSetting>;
  /** 原料收購箱：每種原料要不要賣、保留多少（所有大釜全速熬煮幾秒的用量） */
  materials: Record<MaterialId, CrateSetting>;
}

/** 收購箱對某種藥水／原料的設定：要不要賣、保留幾秒份 */
export interface CrateSetting {
  sell: boolean;
  keepSec: number;
}

export const defaultMaterialSettings = (): Record<MaterialId, CrateSetting> =>
  Object.fromEntries(MATERIAL_IDS.map((m) => [m, { sell: true, keepSec: UPGRADE_FX.materialKeepSec }])) as
    Record<MaterialId, CrateSetting>;

export const defaultPotionSettings = (): Record<PotionId, CrateSetting> =>
  Object.fromEntries(POTION_IDS.map((p) => [p, { sell: true, keepSec: UPGRADE_FX.potionKeepSec }])) as
    Record<PotionId, CrateSetting>;

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
    settings: {
      potions: defaultPotionSettings(),
      materials: defaultMaterialSettings(),
    },
    mascot: createMascot(),
    redeemed: {},
    achievements: {},
    achievementTimer: 0,
    feverLeft: 0,
    feverDay: '',
    incomeRate: 0,
    market: { value: 1, target: 1, timer: MARKET.holdMin },
    potionRate: zeroRecord(POTION_IDS),
    brewedThisTick: zeroRecord(POTION_IDS),
    materialRate: zeroRecord(MATERIAL_IDS),
    harvestedThisTick: zeroRecord(MATERIAL_IDS),
    crateRate: 0,
    gifts: {},
    decor: Array.from({ length: DECOR.maxSlots }, () => null),
    wish: null,
    wishTimer: WISH.firstDelay,
    events: createEventsState(),
    stats: {
      potionsSold: 0, goldEarned: 0, customersServed: 0, rushServed: 0, partialSales: 0, customersLost: 0,
      potionsWholesaled: 0, materialsWholesaled: 0, wholesaleGold: 0, wishesDone: 0, wishesFailed: 0,
      eventsDone: 0, eventGold: 0,
      playOnline: 0, playForeground: 0, playAway: 0,
    },
  };
}
