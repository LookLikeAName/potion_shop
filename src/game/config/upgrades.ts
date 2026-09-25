// 升級定義。效果一律描述為「修正值 (Mod)」，由 stats.ts 依企劃書第 5 章的疊加規則計算。

export type StatId = 'growthSpeed' | 'brewSpeed' | 'sellPrice' | 'arrivalRate' | 'patience';

/** G=金幣池 M=看板娘池 H=開心度池（池內相加）；S=特殊乘數（直接相乘） */
export type Pool = 'G' | 'M' | 'H' | 'S';

export interface Mod {
  stat: StatId;
  pool: Pool;
  /** G/M/H：加算值（0.1 = +10%）；S：乘數（2 = ×2） */
  value: number;
}

export type Zone = 'greenhouse' | 'cauldron' | 'counter' | 'system';

export interface GlobalUpgradeDef {
  id: string;
  name: string;
  desc: string;
  zone: Zone;
  cost: { base: number; growth: number };
  maxLevel?: number;
  mods: (level: number) => Mod[];
}

export const GLOBAL_UPGRADES: GlobalUpgradeDef[] = [
  {
    id: 'fortune_owl', name: '招財貓頭鷹', zone: 'counter',
    desc: '站在收銀機上的木雕貓頭鷹。藥水售價 +10%/級。',
    cost: { base: 200, growth: 1.6 },
    mods: (l) => [{ stat: 'sellPrice', pool: 'G', value: 0.1 * l }],
  },
  {
    id: 'signboard', name: '魔法招牌', zone: 'counter',
    desc: '會對路人拋媚眼的招牌。來客速度 +15%/級，每 10 級顧客需求上限 +1。',
    cost: { base: 150, growth: 1.3 },
    mods: (l) => [{ stat: 'arrivalRate', pool: 'G', value: 0.15 * l }],
  },
  {
    id: 'diffuser', name: '迷幻擴香儀', zone: 'counter',
    desc: '薄荷與薰衣草香氣讓顧客忘記時間。顧客耐心 +30%。',
    cost: { base: 1000, growth: 1 }, maxLevel: 1,
    mods: () => [{ stat: 'patience', pool: 'G', value: 0.3 }],
  },
];

export const GLOBAL_UPGRADE_MAP: Record<string, GlobalUpgradeDef> =
  Object.fromEntries(GLOBAL_UPGRADES.map((u) => [u.id, u]));

/** 針對單一盆栽/大釜購買的升級（價格會乘上階級倍率 TM） */
export const TARGET_UPGRADES = {
  raincloud: { name: '局部微型雨雲', desc: '生長速度 +25%/級', base: 25, growth: 1.25, perLevel: 0.25 },
  fairy: { name: '貪吃花妖精', desc: '植物成熟時自動採收', base: 50 },
  salamander: {
    name: '鍋底火蜥蜴', desc: 'Lv1 賦予被動熬煮（基礎速度 50%），之後每級 +25%',
    base: 30, growth: 1.25,
  },
};
