// 成就里程碑（企劃書 7.3）：一次性開心度獎勵
import type { GameState } from '../state';

export interface AchievementDef {
  id: string;
  name: string;
  reward: number;
  check: (s: GameState) => boolean;
}

/** 目前或曾經在任一盆栽達到的最高等級 */
const maxPotLevel = (s: GameState) =>
  Math.max(...s.slots.flatMap((sl) => [sl.level * (sl.plant ? 1 : 0), ...Object.values(sl.memory).map((m) => m?.level ?? 0)]));

const maxCauldronLevel = (s: GameState) => Math.max(0, ...s.cauldrons.map((c) => c.level));
const everPlanted = (s: GameState, m: string) => s.slots.some((sl) => sl.plant === m || m in sl.memory);
const hasRecipe = (s: GameState, p: string) => s.cauldrons.some((c) => c.recipe === p);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_sale', name: '第一次賣出藥水', reward: 0.3, check: (s) => s.stats.customersServed >= 1 },
  { id: 'first_rush', name: '第一次完成急單', reward: 0.3, check: (s) => s.stats.rushServed >= 1 },
  { id: 'plant_moon', name: '種下月光菇', reward: 0.5, check: (s) => everPlanted(s, 'moonshroom') },
  { id: 'unlock_focus', name: '解鎖專注糖漿', reward: 1.0, check: (s) => hasRecipe(s, 'focus') },
  { id: 'unlock_elixir', name: '解鎖精靈羽化靈藥', reward: 1.5, check: (s) => hasRecipe(s, 'elixir') },
  { id: 'pot_25', name: '盆栽達到 Lv 25', reward: 0.5, check: (s) => maxPotLevel(s) >= 25 },
  { id: 'pot_50', name: '盆栽達到 Lv 50', reward: 1.0, check: (s) => maxPotLevel(s) >= 50 },
  { id: 'pot_100', name: '盆栽達到 Lv 100', reward: 2.0, check: (s) => maxPotLevel(s) >= 100 },
  { id: 'cauldron_25', name: '大釜達到 Lv 25', reward: 0.5, check: (s) => maxCauldronLevel(s) >= 25 },
  { id: 'cauldron_50', name: '大釜達到 Lv 50', reward: 1.0, check: (s) => maxCauldronLevel(s) >= 50 },
  { id: 'cauldron_100', name: '大釜達到 Lv 100', reward: 2.0, check: (s) => maxCauldronLevel(s) >= 100 },
  { id: 'sold_1k', name: '累計賣出 1,000 瓶藥水', reward: 0.5, check: (s) => s.stats.potionsSold >= 1e3 },
  { id: 'sold_100k', name: '累計賣出 10 萬瓶藥水', reward: 1.5, check: (s) => s.stats.potionsSold >= 1e5 },
  { id: 'sold_10m', name: '累計賣出 1,000 萬瓶藥水', reward: 3.0, check: (s) => s.stats.potionsSold >= 1e7 },
];
