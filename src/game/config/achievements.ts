// 成就里程碑（企劃書 7.3）：一次性開心度獎勵
import { localized } from '../../i18n';
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

const RAW: Omit<AchievementDef, 'name'>[] = [
  { id: 'first_sale', reward: 0.3, check: (s) => s.stats.customersServed >= 1 },
  { id: 'first_rush', reward: 0.3, check: (s) => s.stats.rushServed >= 1 },
  { id: 'plant_moon', reward: 0.5, check: (s) => everPlanted(s, 'moonshroom') },
  { id: 'unlock_focus', reward: 1.0, check: (s) => hasRecipe(s, 'focus') },
  { id: 'unlock_elixir', reward: 1.5, check: (s) => hasRecipe(s, 'elixir') },
  { id: 'pot_25', reward: 0.5, check: (s) => maxPotLevel(s) >= 25 },
  { id: 'pot_50', reward: 1.0, check: (s) => maxPotLevel(s) >= 50 },
  { id: 'pot_100', reward: 2.0, check: (s) => maxPotLevel(s) >= 100 },
  { id: 'cauldron_25', reward: 0.5, check: (s) => maxCauldronLevel(s) >= 25 },
  { id: 'cauldron_50', reward: 1.0, check: (s) => maxCauldronLevel(s) >= 50 },
  { id: 'cauldron_100', reward: 2.0, check: (s) => maxCauldronLevel(s) >= 100 },
  { id: 'sold_1k', reward: 0.5, check: (s) => s.stats.potionsSold >= 1e3 },
  { id: 'sold_100k', reward: 1.5, check: (s) => s.stats.potionsSold >= 1e5 },
  { id: 'sold_10m', reward: 3.0, check: (s) => s.stats.potionsSold >= 1e7 },
];

/** 名稱在語言檔 achievement.<id>.name */
export const ACHIEVEMENTS: AchievementDef[] = RAW.map((a) => localized(a, `achievement.${a.id}`, ['name']));
