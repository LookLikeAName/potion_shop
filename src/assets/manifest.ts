// 美術資源清單。ID 對應 ArtAssetPrompts.md 的資源 ID。
// 正式圖放到 src/assets/art/<分類>/<ID>.png 就會自動取代佔位圖（不需要改程式）。

export interface AssetDef {
  id: string;
  /** 佔位圖尺寸（也是遊戲內預設顯示尺寸） */
  w: number;
  h: number;
  color: number;
  label: string;
  shape?: 'rect' | 'round' | 'circle';
}

const a = (id: string, w: number, h: number, color: number, label: string, shape: AssetDef['shape'] = 'rect'): AssetDef =>
  ({ id, w, h, color, label, shape });

export const ASSETS: AssetDef[] = [
  // 背景（沒有正式圖時由場景程式繪製區域示意）
  a('bg_dollhouse_main', 1920, 1080, 0x3a2a20, '主背景'),

  // 花盆
  a('pot_t1', 120, 95, 0xb5673d, '素燒陶盆'),
  a('pot_t2', 120, 95, 0x2f7f86, '彩釉陶盆'),
  a('pot_t3', 120, 95, 0xaab4c8, '刻符銀盆'),
  a('pot_t4', 120, 95, 0x9b6fe0, '星晶盆'),
  a('pot_locked', 120, 95, 0x5a4a40, '上鎖花盆'),

  // 植物
  ...(['redheart', 'moonshroom', 'starvine'] as const).flatMap((p) => {
    const color = { redheart: 0xe0485f, moonshroom: 0x4d8dff, starvine: 0x9a5cd6 }[p];
    const name = { redheart: '紅心草', moonshroom: '月光菇', starvine: '星光藤蔓' }[p];
    return [
      a(`plant_${p}_sprout`, 120, 140, color, `${name}\n幼苗`, 'round'),
      a(`plant_${p}_growing`, 120, 140, color, `${name}\n成長中`, 'round'),
      a(`plant_${p}_mature`, 120, 140, color, `${name}\n成熟`, 'round'),
      a(`plant_${p}_lush`, 120, 140, color, `${name}\n茂盛`, 'round'),
    ];
  }),

  // 大釜
  a('cauldron_t1', 200, 180, 0x5b524c, '生鏽鐵鍋', 'round'),
  a('cauldron_t2', 200, 180, 0xc59a3c, '黃銅大釜', 'round'),
  a('cauldron_t3', 200, 180, 0xb8c3d8, '符文銀釜', 'round'),
  a('cauldron_t4', 200, 180, 0x9b6fe0, '星晶大釜', 'round'),

  // 圖示
  a('item_redheart', 64, 64, 0xe0485f, '紅', 'circle'),
  a('item_moonshroom', 64, 64, 0x4d8dff, '菇', 'circle'),
  a('item_starvine', 64, 64, 0x9a5cd6, '藤', 'circle'),
  a('potion_glow', 64, 64, 0xff5a7a, '微光', 'round'),
  a('potion_focus', 64, 64, 0x3f7fff, '專注', 'round'),
  a('potion_elixir', 64, 64, 0xc9a0ff, '羽化', 'round'),
  a('icon_gold', 64, 64, 0xe8b93a, '金', 'circle'),
  a('icon_happiness', 64, 64, 0xff8fb8, '♥', 'circle'),
  a('icon_charcrystal', 64, 64, 0x2b2230, '晶', 'circle'),

  // 升級道具（場景內顯示）
  a('upg_raincloud', 90, 60, 0x8a9bb0, '雨雲', 'round'),
  a('upg_fairy', 56, 56, 0x6cc36a, '妖精', 'circle'),
  a('upg_salamander', 80, 44, 0xff8a3c, '火蜥蜴', 'round'),

  // 角色
  a('lumia_chibi_idle', 110, 170, 0xe98a4a, '露米婭', 'round'),
  a('lumia_chibi_walk_a', 110, 170, 0xe98a4a, '露米婭\n走A', 'round'),
  a('lumia_chibi_walk_b', 110, 170, 0xe98a4a, '露米婭\n走B', 'round'),

  // 顧客
  a('npc_novice_adventurer', 110, 160, 0x8f7a5a, '新手\n冒險者', 'round'),
  a('npc_mage_apprentice', 110, 160, 0x5a6fae, '法師\n學徒', 'round'),
  a('npc_elf_noble', 110, 160, 0x7fb89a, '精靈\n貴族', 'round'),
  a('npc_dwarf_merchant', 110, 160, 0xa4553a, '矮人\n商人', 'round'),
];

export const ASSET_MAP: Record<string, AssetDef> = Object.fromEntries(ASSETS.map((d) => [d.id, d]));

// 掃描 src/assets/art 下已經存在的正式圖（建置時決定，開發時新增檔案會自動重新整理）
const found = import.meta.glob('./art/**/*.{png,webp,jpg}', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

/** 資源 ID → 正式圖 URL（沒有正式圖就不在這裡） */
export const ART_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(found).map(([path, url]) => [path.split('/').pop()!.replace(/\.\w+$/, ''), url]),
);
