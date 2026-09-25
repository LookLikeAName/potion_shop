export type MaterialId = 'redheart' | 'moonshroom' | 'starvine';

export interface PlantDef {
  id: MaterialId;
  name: string;
  tier: 1 | 2 | 3;
  /** 基礎生長時間（秒） */
  growTime: number;
  /** 單次點擊推進（秒） */
  clickAdvance: number;
  /** 在空花盆種下的價格 */
  seedCost: number;
  /** 盆栽升級基礎價 */
  levelBaseCost: number;
  /**
   * 原料收購基準價（再乘上收購箱收購比例）。刻意壓低：
   * 紅心草熬成藥水約值 2.5 金，直接賣只值 0.5 × 30~60%。
   */
  sellValue: number;
  color: number;
}

export const PLANTS: Record<MaterialId, PlantDef> = {
  redheart: {
    id: 'redheart', name: '紅心草', tier: 1,
    growTime: 3, clickAdvance: 0.5, seedCost: 50, levelBaseCost: 10, sellValue: 0.5, color: 0xe0485f,
  },
  moonshroom: {
    id: 'moonshroom', name: '月光菇', tier: 2,
    growTime: 8, clickAdvance: 1.0, seedCost: 300, levelBaseCost: 200, sellValue: 2, color: 0x4d8dff,
  },
  starvine: {
    id: 'starvine', name: '星光藤蔓', tier: 3,
    growTime: 20, clickAdvance: 2.0, seedCost: 20000, levelBaseCost: 4000, sellValue: 8, color: 0x9a5cd6,
  },
};

export const MATERIAL_IDS: MaterialId[] = ['redheart', 'moonshroom', 'starvine'];
