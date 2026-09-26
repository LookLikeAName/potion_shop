// 美術資源清單。ID 對應 ArtAssetPrompts.md 的資源 ID。
// 正式圖用 scripts/import_art.py 匯入到 src/assets/art/<分類>/<ID>.webp，就會自動取代佔位圖。

export interface AssetDef {
  id: string;
  /** 遊戲內顯示框（圖片等比縮放塞進這個框），也是佔位圖尺寸 */
  w: number;
  h: number;
  color: number;
  label: string;
  shape?: 'rect' | 'round' | 'circle';
  /** 原圖角色面向：1 = 朝右、-1 = 朝左（翻轉時用） */
  facing?: 1 | -1;
}

const a = (
  id: string, w: number, h: number, color: number, label: string,
  shape: AssetDef['shape'] = 'rect', facing: 1 | -1 = 1,
): AssetDef => ({ id, w, h, color, label, shape, facing });

export const ASSETS: AssetDef[] = [
  // 背景（沒有正式圖時由場景程式繪製區域示意）
  a('bg_dollhouse_main', 1920, 1080, 0x3a2a20, '主背景'),

  // 花盆
  a('pot_t1', 100, 88, 0xb5673d, '素燒陶盆'),
  a('pot_t2', 100, 88, 0x2f7f86, '彩釉陶盆'),
  a('pot_t3', 110, 88, 0xaab4c8, '刻符銀盆'),
  a('pot_t4', 100, 88, 0x9b6fe0, '星晶盆'),
  a('pot_locked', 100, 88, 0x5a4a40, '上鎖花盆'),

  // 植物
  ...(['redheart', 'moonshroom', 'starvine'] as const).flatMap((p) => {
    const color = { redheart: 0xe0485f, moonshroom: 0x4d8dff, starvine: 0x9a5cd6 }[p];
    const name = { redheart: '紅心草', moonshroom: '月光菇', starvine: '星光藤蔓' }[p];
    return [
      a(`plant_${p}_sprout`, 80, 95, color, `${name}\n幼苗`, 'round'),
      a(`plant_${p}_growing`, 105, 115, color, `${name}\n成長中`, 'round'),
      a(`plant_${p}_mature`, 120, 125, color, `${name}\n成熟`, 'round'),
      a(`plant_${p}_lush`, 135, 130, color, `${name}\n茂盛`, 'round'),
    ];
  }),

  // 大釜（含底部火坑）
  a('cauldron_t1', 118, 105, 0x5b524c, '生鏽鐵鍋', 'round'),
  a('cauldron_t2', 118, 105, 0xc59a3c, '黃銅大釜', 'round'),
  a('cauldron_t3', 118, 105, 0xb8c3d8, '符文銀釜', 'round'),
  a('cauldron_t4', 118, 105, 0x9b6fe0, '星晶大釜', 'round'),
  a('fx_liquid_surface', 100, 80, 0xdddddd, '', 'circle'),
  a('fx_bubble', 24, 24, 0xffffff, '', 'circle'),

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
  a('upg_raincloud', 80, 54, 0x8a9bb0, '雨雲', 'round'),
  a('upg_fairy', 46, 46, 0x6cc36a, '妖精', 'circle'),
  a('upg_salamander', 64, 36, 0xff8a3c, '火蜥蜴', 'round'),
  a('upg_starsilver_can', 56, 50, 0xb8c6e0, '澆水壺', 'round'),
  a('upg_shears', 56, 56, 0xc9a44a, '園藝剪', 'round'),
  a('upg_servant_ladle', 54, 70, 0xc8a070, '湯勺', 'round'),
  a('upg_bellows', 64, 64, 0x8a4a3a, '風箱', 'round'),
  a('upg_condenser', 64, 64, 0x9ad0d8, '冷凝管', 'round'),
  a('upg_owl', 56, 66, 0x8a5a36, '貓頭鷹', 'round'),
  a('upg_signboard', 96, 70, 0x9a6a3e, '招牌', 'rect'),
  a('upg_diffuser', 50, 60, 0xa8c8a0, '擴香儀', 'round'),
  a('upg_bell', 46, 46, 0xd9a441, '鈴', 'circle'),
  a('upg_drunk', 56, 56, 0xc98a3a, '酒杯', 'round'),
  a('upg_crate', 96, 80, 0x7a5a3a, '收購箱', 'rect'),
  a('upg_guild_contract', 56, 56, 0xe8dcc0, '合約', 'round'),
  a('upg_fertilizer', 56, 56, 0x8ac06a, '肥料', 'round'),
  a('upg_warm_circle', 56, 56, 0xff9a5a, '魔法陣', 'circle'),
  a('upg_poster', 56, 56, 0xe8c56a, '海報', 'rect'),
  // 送給露米婭的禮物
  a('gift_snack', 56, 56, 0xf0b070, '點心', 'round'),
  a('gift_bouquet', 56, 56, 0xff9ec0, '花束', 'round'),
  a('gift_hairpin', 56, 56, 0xc9a0ff, '髮飾', 'round'),

  // 露米婭：每個動作一張圖，原圖都朝左。服裝差分沒有正式圖時會退回預設服裝的圖
  ...(['', 'maid_', 'pajama_', 'robe_'] as const).flatMap((o) => [
    a(`lumia_chibi_${o}idle`, 150, 210, 0xe98a4a, `露米婭\n${o}待機`, 'round', -1),
    a(`lumia_chibi_${o}walk`, 150, 210, 0xe98a4a, `露米婭\n${o}走路`, 'round', -1),
    a(`lumia_chibi_${o}back`, 150, 210, 0xe98a4a, `露米婭\n${o}背影`, 'round', -1),
    a(`lumia_chibi_${o}drag`, 150, 210, 0xe98a4a, `露米婭\n${o}拎起`, 'round', -1),
    a(`lumia_chibi_${o}sleep`, 170, 120, 0xe98a4a, `露米婭\n${o}睡覺`, 'round', -1),
    a(`lumia_chibi_${o}tired_walk`, 150, 210, 0xe98a4a, `露米婭\n${o}疲勞`, 'round', -1),
  ]),

  // 開心度兌換：特權天賦圖示、劇情 CG（CG 在介面中也當縮圖用）
  a('icon_cheer', 64, 64, 0xff8fb8, '聲', 'circle'),
  a('icon_attunement', 64, 64, 0x9ee8ff, '同', 'circle'),
  a('icon_green_thumb', 64, 64, 0x6cc36a, '綠', 'circle'),
  a('icon_telepathy', 64, 64, 0xc9a0ff, '心', 'circle'),
  a('icon_fever', 64, 64, 0xffc234, '狂', 'circle'),
  a('cg_celebration', 64, 36, 0xd9a441, '宴', 'rect'),
  a('cg_starry_vow', 64, 36, 0x3a4a8a, '誓', 'rect'),

  // 休息室家具
  a('furn_slime_doll', 50, 44, 0xff9ec0, '史萊姆', 'circle'),
  a('furn_gramophone', 76, 80, 0xc59a3c, '留聲機', 'round'),
  a('furn_tea_set', 80, 50, 0xd9b38c, '紅茶組', 'round'),

  // 顧客（原圖都朝左）
  a('npc_novice_adventurer', 170, 215, 0x8f7a5a, '新手\n冒險者', 'round', -1),
  a('npc_mage_apprentice', 170, 215, 0x5a6fae, '法師\n學徒', 'round', -1),
  a('npc_elf_noble', 170, 215, 0x7fb89a, '精靈\n貴族', 'round', -1),
  a('npc_dwarf_merchant', 185, 215, 0xa4553a, '矮人\n商人', 'round', -1),
  a('npc_drunk_adventurer', 185, 215, 0xb0703a, '醉酒\n冒險者', 'round', -1),
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
