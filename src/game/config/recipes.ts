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

export const RECIPES: Record<PotionId, RecipeDef> = {
  glow: {
    id: 'glow', name: '微光恢復劑', tier: 1, inputs: { redheart: 2 },
    brewTime: 4, clickAdvance: 0.5, basePrice: 5, unlockCost: 0, levelBaseCost: 15, color: 0xff5a7a,
  },
  focus: {
    id: 'focus', name: '專注糖漿', tier: 2, inputs: { redheart: 1, moonshroom: 2 },
    brewTime: 12, clickAdvance: 1.0, basePrice: 18, unlockCost: 800, levelBaseCost: 300, color: 0x3f7fff,
  },
  elixir: {
    id: 'elixir', name: '精靈羽化靈藥', tier: 3, inputs: { moonshroom: 2, starvine: 1 },
    brewTime: 30, clickAdvance: 2.0, basePrice: 60, unlockCost: 15000, levelBaseCost: 6000, color: 0xc9a0ff,
  },
};

export const POTION_IDS: PotionId[] = ['glow', 'focus', 'elixir'];
