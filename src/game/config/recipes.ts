import { localized } from '../../i18n';
import type { MaterialId } from './plants';

export type PotionId = 'glow' | 'focus' | 'elixir';

export interface RecipeDef {
  id: PotionId;
  name: string;
  tier: 1 | 2 | 3;
  inputs: Partial<Record<MaterialId, number>>;
  /** 基礎熬煮時間（秒） */
  brewTime: number;
  clickAdvance: number;
  basePrice: number;
  /** 解鎖配方（取得大釜）價格，0 = 初始擁有 */
  unlockCost: number;
  levelBaseCost: number;
  color: number;
}

const RAW: Record<PotionId, Omit<RecipeDef, 'name'>> = {
  glow: {
    id: 'glow', tier: 1, inputs: { redheart: 2 },
    brewTime: 4, clickAdvance: 0.5, basePrice: 5, unlockCost: 0, levelBaseCost: 15, color: 0xff5a7a,
  },
  // 高階配方也會用到低階原料，紅心草整場遊戲都有用途，不會只在前期有用
  focus: {
    id: 'focus', tier: 2, inputs: { redheart: 3, moonshroom: 2 },
    brewTime: 12, clickAdvance: 1.0, basePrice: 18, unlockCost: 800, levelBaseCost: 300, color: 0x3f7fff,
  },
  elixir: {
    id: 'elixir', tier: 3, inputs: { redheart: 3, moonshroom: 2, starvine: 1 },
    brewTime: 30, clickAdvance: 2.0, basePrice: 60, unlockCost: 150000, levelBaseCost: 6000, color: 0xc9a0ff,
  },
};

/** 名稱在語言檔 potion.<id>.name */
export const RECIPES = Object.fromEntries(
  Object.values(RAW).map((r) => [r.id, localized(r, `potion.${r.id}`, ['name'])]),
) as Record<PotionId, RecipeDef>;

export const POTION_IDS: PotionId[] = ['glow', 'focus', 'elixir'];
