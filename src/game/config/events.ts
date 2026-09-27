// 突發事件與特殊訪客（企劃書第 9 章）
// 所有事件都是正向獎勵：無視或錯過沒有任何懲罰。只在在線、分頁在前景時觸發。

export type EventId =
  | 'goblin' | 'dew' | 'raincloud' | 'butterfly'
  | 'sneeze' | 'bubble' | 'perfect_heat' | 'apprentice'
  | 'hero' | 'merchant' | 'princess' | 'guild_rush'
  | 'dream' | 'letter' | 'fortune' | 'meteor' | 'slime';

/** 事件發生的區域：露米婭指派在該區時出現率 ×2；any = 不分區 */
export type EventZone = 'greenhouse' | 'cauldron' | 'counter' | 'rest' | 'any';

/**
 * 操作方式：
 * tap = 點中目標 goal 下就完成；count = 限時內點越多越好（至少 1 下就算完成）；
 * drag = 拖到盆栽或大釜上；timing = 看準時機點；choice = 三選一
 */
export type EventKind = 'tap' | 'count' | 'drag' | 'timing' | 'choice';

export interface EventDef {
  id: EventId;
  name: string;
  zone: EventZone;
  /** 0 常見、1 少見、2 稀有 */
  rarity: 0 | 1 | 2;
  kind: EventKind;
  /** 限時（秒） */
  time: number;
  /** tap：要點幾下；count：最多算幾下；timing：幾次機會 */
  goal: number;
  /** 圖鑑縮圖與場景圖的資源 ID */
  icon: string;
  /** 出現時的提示（事件橫幅） */
  prompt: string;
  /** 還沒遇過時圖鑑上的模糊提示 */
  hint: string;
  /** 完成後圖鑑上的小故事 */
  story: string;
  /** 露米婭的感想 */
  lumia: string;
  /** 擺出這件禮物時出現率 ×2 */
  decor?: string;
}

export const EVENTS: EventDef[] = [
  // ---------- 溫室 ----------
  {
    id: 'goblin', name: '迷路的尋寶地精', zone: 'greenhouse', rarity: 0, kind: 'tap', time: 8, goal: 5,
    icon: 'npc_goblin', decor: 'snack',
    prompt: '尋寶地精跑進溫室了！趁他跑掉前點他 5 下！',
    hint: '溫室裡偶爾會有小小的腳步聲，還有叮叮噹噹的聲音…',
    story: '背著比自己還大的布袋、到處找寶藏的小地精。被老師抓到之後，一邊嘟囔「這次就算了」，一邊從袋子裡倒出一大把種子和原料，然後頭也不回地跑掉了。',
    lumia: '他的袋子裡好像還有我上次弄丟的髮圈…',
  },
  {
    id: 'dew', name: '溫室的星塵朝露', zone: 'greenhouse', rarity: 0, kind: 'tap', time: 20, goal: 3,
    icon: 'evt_dew',
    prompt: '盆栽上凝結了星塵朝露！把 3 顆朝露都點下來！',
    hint: '清晨的溫室裡，葉子上有時會閃閃發亮…',
    story: '星星掉下來的碎屑溶在露水裡，凝成會發光的朝露。收集起來澆回盆栽，植物會像被施了魔法一樣，一口氣長得又高又壯。',
    lumia: '朝露涼涼的、甜甜的…啊，不能偷喝！',
  },
  {
    id: 'raincloud', name: '雨雲寶寶', zone: 'greenhouse', rarity: 1, kind: 'drag', time: 25, goal: 1,
    icon: 'evt_raincloud', decor: 'bouquet',
    prompt: '雨雲寶寶飄進來了！把它拖到盆栽上（也可以點一下再點盆栽）',
    hint: '買過雨雲之後，好像有小小的雲跟著跑來玩…',
    story: '溫室裡的雨雲生下的雲寶寶，還不太會控制雨量。把它放到盆栽上，它就會開心地嘩啦嘩啦下起小雨，連旁邊的盆栽都一起淋濕了。',
    lumia: '它跟著我走來走去耶！可以養嗎？',
  },
  {
    id: 'butterfly', name: '螢光蝴蝶', zone: 'greenhouse', rarity: 1, kind: 'count', time: 15, goal: 5,
    icon: 'evt_butterfly', decor: 'music_box',
    prompt: '螢光蝴蝶在溫室裡飛舞！點一下讓牠停到盆栽上！',
    hint: '盆栽多起來之後，溫室裡會開始有翅膀發光的訪客…',
    story: '只在花開得最好的溫室裡出現的螢光蝴蝶。停在盆栽上時會灑下發光的鱗粉，植物就會跟著牠拍翅膀的節奏一起長大。',
    lumia: '老師你看！牠停在我的鼻子上了！',
  },
  // ---------- 大釜 ----------
  {
    id: 'sneeze', name: '火蜥蜴打噴嚏', zone: 'cauldron', rarity: 0, kind: 'count', time: 8, goal: 8,
    icon: 'evt_spark',
    prompt: '哈啾！火蜥蜴打噴嚏噴出火花了！接住掉下來的火花！',
    hint: '爐火旁邊的小傢伙，鼻子好像有點癢…',
    story: '大釜底下的火蜥蜴被煙嗆到，打了一個大噴嚏。噴出來的火花其實是精純的魔力，接住它丟回爐子裡，所有大釜的火都變得旺盛起來。',
    lumia: '牠是不是感冒了？要不要幫牠圍條圍巾…',
  },
  {
    id: 'bubble', name: '彩虹大泡泡', zone: 'cauldron', rarity: 0, kind: 'tap', time: 9, goal: 1,
    icon: 'evt_bubble',
    prompt: '大釜冒出一顆彩虹泡泡！在它飄走之前點破它！',
    hint: '熬煮得太順利的時候，鍋子裡偶爾會冒出特別大的泡泡…',
    story: '藥水熬得太完美時，多出來的魔力會包成一顆彩虹色的大泡泡。點破它，裡面滿滿的藥水就會一口氣掉回鍋子裡。',
    lumia: '泡泡裡面倒映著我們的店耶，好漂亮！',
  },
  {
    id: 'perfect_heat', name: '完美火候', zone: 'cauldron', rarity: 1, kind: 'timing', time: 15, goal: 3,
    icon: 'evt_heat', decor: 'gramophone',
    prompt: '火候錶出現了！指針走到金色區間時點火候錶（3 次機會）',
    hint: '有了雙口冷凝管之後，鍋子上偶爾會浮現奇怪的刻度…',
    story: '古老的鍊金書上說，火候只有一瞬間是完美的。抓準那一瞬間，冷凝管裡的每一滴藥水都會變成兩滴。',
    lumia: '老師好厲害！我每次都按太早…',
  },
  {
    id: 'apprentice', name: '精靈學徒來實習', zone: 'cauldron', rarity: 1, kind: 'drag', time: 25, goal: 1,
    icon: 'evt_apprentice',
    prompt: '工會的精靈學徒來實習了！把他拖到一口大釜上（也可以點一下再點大釜）',
    hint: '和過勞精靈工會簽約之後，好像會有新人來見習…',
    story: '剛從工會學校畢業的精靈學徒，拿著比自己還高的攪拌棒。雖然很緊張，但被分配到大釜之後攪得超級認真，那口大釜的速度一下子快了好多。',
    lumia: '他好努力喔…我也要加油才行！',
  },
  // ---------- 櫃台 ----------
  {
    id: 'hero', name: '土豪勇者的掃貨', zone: 'counter', rarity: 1, kind: 'count', time: 10, goal: 40,
    icon: 'npc_rich_hero',
    prompt: '土豪勇者來掃貨了！一直點他：「再來一箱！」',
    hint: '店的名聲傳開之後，好像會有很有錢的客人上門…',
    story: '打倒魔王之後賞金多到花不完的勇者。一進門就說「全部都要！」，點一下就搬走一箱。買得開心的時候，還會到處幫忙宣傳這間店。',
    lumia: '他、他剛剛是把錢包整個丟過來嗎！？',
  },
  {
    id: 'merchant', name: '流浪行商', zone: 'counter', rarity: 0, kind: 'choice', time: 30, goal: 1,
    icon: 'evt_merchant',
    prompt: '流浪行商帶著稀奇的貨物來了！從三樣商品裡挑一樣',
    hint: '店開了一段時間之後，會有背著大包袱的旅人來做生意…',
    story: '走遍各地的流浪行商，包袱裡什麼都有。他說這間店的藥水在旅途中幫了他很多次，所以每次來都用很划算的價格交換。',
    lumia: '他的包袱裡好像有會動的東西…',
  },
  {
    id: 'princess', name: '微服出巡的公主', zone: 'counter', rarity: 2, kind: 'tap', time: 30, goal: 1,
    icon: 'evt_princess', decor: 'bouquet',
    prompt: '排隊的客人裡，好像有一位不太一樣…找出頭上閃過皇冠光芒的客人，點她！',
    hint: '名聲響亮、又有精靈羽化靈藥的店，也許會有尊貴的客人偷偷來訪…',
    story: '戴著斗篷排在隊伍裡的，竟然是王國的公主。被老師認出來之後，她吐了吐舌頭說「被發現了呢」，然後把城堡一整季要用的藥水都訂下來了。',
    lumia: '公、公主殿下！？我剛剛是不是找錯零錢了…',
  },
  {
    id: 'guild_rush', name: '商會緊急收購', zone: 'counter', rarity: 0, kind: 'tap', time: 12, goal: 1,
    icon: 'evt_guild',
    prompt: '商會發來緊急收購通知！點一下發光的收購箱',
    hint: '有了收購箱之後，商會偶爾會發出特別的通知…',
    story: '遠方的城鎮爆發流感，商會急著收購大量藥水。這段時間收購箱照售價全額收購，老師也算是幫了大家一個大忙。',
    lumia: '希望大家都能早點好起來…',
  },
  // ---------- 休息室與特殊 ----------
  {
    id: 'dream', name: '露米婭的夢話', zone: 'rest', rarity: 0, kind: 'tap', time: 20, goal: 3,
    icon: 'evt_dream', decor: 'dream_catcher',
    prompt: '露米婭在說夢話…點破飄出來的 3 個夢泡泡！',
    hint: '露米婭在休息室睡覺的時候，好像會飄出什麼東西…',
    story: '睡著的露米婭嘴裡念念有詞，飄出來的泡泡裡是她的夢：夢裡她學會了所有的魔法、店裡擠滿了客人，還有老師摸著她的頭說「做得好」。',
    lumia: '我、我剛剛有說什麼奇怪的話嗎！？',
  },
  {
    // 寄信人與內容待定（配合之後的背景故事），先用佔位文字
    id: 'letter', name: '遠方的來信', zone: 'any', rarity: 2, kind: 'tap', time: 20, goal: 1,
    icon: 'evt_letter', decor: 'tea_set',
    prompt: '貓頭鷹叼著一封信飛來了！點一下收信',
    hint: '和露米婭的羈絆變深之後，會有遠方的來信…',
    story: '（故事待定：之後配合背景故事撰寫）',
    lumia: '（台詞待定）',
  },
  {
    id: 'fortune', name: '占卜婆婆', zone: 'any', rarity: 1, kind: 'choice', time: 30, goal: 1,
    icon: 'evt_fortune', decor: 'crystal_ball',
    prompt: '占卜婆婆來了：「選一張牌吧，孩子。」',
    hint: '擺上水晶球、或是店的名聲夠響亮時，神祕的老婆婆會來敲門…',
    story: '拄著星星手杖的老婆婆，據說她的占卜從來沒有失準過。翻開的牌會告訴你今天的好運從哪裡來，而且真的會實現。',
    lumia: '婆婆說我的戀愛運…不、不告訴老師！',
  },
  {
    id: 'meteor', name: '窗外的流星雨', zone: 'any', rarity: 2, kind: 'count', time: 15, goal: 10,
    icon: 'evt_meteor', decor: 'star_lamp',
    prompt: '流星雨！趁流星劃過時點它們許願！',
    hint: '夜深的時候（19:00–05:00），窗外好像…',
    story: '夜空突然下起流星雨，露米婭拉著老師的袖子跑到窗邊。每抓住一顆流星許一個願，店裡就會多一點幸運。',
    lumia: '我許的願望是…秘密！',
  },
  {
    id: 'slime', name: '史萊姆搬家', zone: 'any', rarity: 1, kind: 'tap', time: 12, goal: 3,
    icon: 'evt_slime', decor: 'slime_doll',
    prompt: '有隻史萊姆在店裡蹦來蹦去！點牠 3 下！',
    hint: '休息室擺著某個軟綿綿的娃娃時，好像會吸引同伴過來…',
    story: '看到休息室的史萊姆娃娃，以為找到同伴的野生史萊姆。在店裡蹦了一圈之後，吐出一大堆牠在路上撿的原料當作見面禮。',
    lumia: '噗啾！噗啾！牠在跟娃娃說話耶！',
  },
];

export const EVENT_MAP = Object.fromEntries(EVENTS.map((e) => [e.id, e])) as Record<EventId, EventDef>;

export const RARITY_NAMES = ['常見', '少見', '稀有'] as const;

/** 事件出現時露米婭說的話 */
export const EVENT_LINES = {
  start: ['老師老師！你看那邊！', '咦？好像有什麼東西…', '哇，發生什麼事了？', '有客人…不對，是訪客！'],
};

export const EVENT = {
  /** 檢定間隔：固定 checkMin 秒 + 隨機 0–checkRand 秒（只算前景時間） */
  checkMin: 600,
  checkRand: 600,
  /** 每次檢定出現事件的機率（平均一小時約 2.5 個） */
  chance: 0.62,
  /** 權重：稀有度基礎、沒完成過、指派區域、相關擺設 */
  weights: [10, 5, 2] as const,
  unseenMult: 3,
  zoneMult: 2,
  decorMult: 2,
  /** 各稀有度的個別冷卻（秒，前景時間） */
  cooldown: [600, 900, 1800] as const,
  /** 圖鑑：每收集這麼多個（和全部收齊時）收入 +incomePerMilestone */
  milestoneEvery: 6,
  incomePerMilestone: 0.03,
  /** 每個事件第一次完成時的開心度（× 開心度倍率） */
  firstHappy: 0.1,
  /** 秒收入的下限（剛開店收入很少時） */
  minIncome: 1,
  /** 原料報酬的下限（每種） */
  minMaterial: 10,
};

/** 各事件的數值 */
export const EVENT_FX = {
  goblin: { materialSec: 120, growth: 2, buffSec: 90 },
  dew: { yieldSec: 120, growth: 3, buffSec: 90 },
  raincloud: { growth: 3, buffSec: 120 },
  butterfly: { growth: 2, buffSec: 120 },
  /** 每接住一顆火花：所有大釜熬煮 ×2 多 12 秒 */
  sneeze: { brew: 2, secPerHit: 12 },
  bubble: { brewSec: 120 },
  /** 每命中一次：這口大釜 60 秒內每輪都是雙倍 */
  perfect_heat: { secPerHit: 60 },
  apprentice: { brew: 3, buffSec: 120 },
  /** 每點一下 5 秒收入；點滿 hypeAt 下市場熱度拉到 hype */
  hero: { incomePerHit: 5, hypeAt: 30, hype: 1.4, buffSec: 120 },
  princess: { incomeSec: 360 },
  guild_rush: { buffSec: 90 },
  dream: { happy: 0.1 },
  letter: { incomeSec: 420 },
  /** 每顆流星 20 秒收入，全部點到再加倍 */
  meteor: { incomePerHit: 20 },
  slime: { materialSec: 240 },
};

/** 事件簿用：一句話簡介、出現條件 */
export const EVENT_INFO: Record<EventId, { summary: string; need: string }> = {
  goblin: { summary: '背著大布袋、到處找寶藏的小地精。', need: '溫室有種植物' },
  dew: { summary: '星星碎屑溶在露水裡，凝成會發光的朝露。', need: '至少 2 盆有種植物' },
  raincloud: { summary: '還不太會控制雨量的雲寶寶。', need: '買過雨雲' },
  butterfly: { summary: '只在花開得最好的溫室出現的發光蝴蝶。', need: '至少 4 盆有種植物' },
  sneeze: { summary: '被煙嗆到的火蜥蜴打了一個大噴嚏。', need: '有大釜養了火蜥蜴' },
  bubble: { summary: '藥水熬得太完美時冒出的彩虹泡泡。', need: '有大釜正在產出' },
  perfect_heat: { summary: '火候只有一瞬間是完美的。', need: '買過雙口冷凝管' },
  apprentice: { summary: '剛畢業的精靈學徒來店裡見習。', need: '簽了過勞精靈工會合約' },
  hero: { summary: '賞金多到花不完的勇者上門掃貨。', need: '店舖名聲 5 級以上' },
  merchant: { summary: '包袱裡什麼都有的流浪行商。', need: '店舖名聲 3 級以上' },
  princess: { summary: '排在隊伍裡的斗篷客人，好像不太一樣。', need: '店舖名聲 9 級以上、解鎖精靈羽化靈藥' },
  guild_rush: { summary: '商會發來的緊急收購通知。', need: '至少有一個收購箱' },
  dream: { summary: '睡著的露米婭飄出了夢泡泡。', need: '露米婭在休息室睡覺' },
  letter: { summary: '（簡介待定）', need: '羈絆等級 2／4／6（依序寄來三封）' },
  fortune: { summary: '拄著星星手杖、占卜從不失準的老婆婆。', need: '送過占星水晶球，或店舖名聲 8 級以上' },
  meteor: { summary: '夜空突然下起流星雨。', need: '現實時間 19:00–05:00，或休息室擺出許願星燈' },
  slime: { summary: '以為找到同伴的野生史萊姆。', need: '休息室擺出史萊姆娃娃' },
};

/** 事件簿用：完成後能得到的東西（跟著數值設定產生） */
export function eventRewardText(id: EventId): string[] {
  const inc = (sec: number) => `${sec} 秒份的收入`;
  switch (id) {
    case 'goblin': return [`每種原料各 ${EVENT_FX.goblin.materialSec} 秒份`, `所有盆栽生長 ×${EVENT_FX.goblin.growth}（${EVENT_FX.goblin.buffSec} 秒）`];
    case 'dew': return [`那一盆 ${EVENT_FX.dew.yieldSec} 秒份的產量`, `那一盆生長 ×${EVENT_FX.dew.growth}（${EVENT_FX.dew.buffSec} 秒）`];
    case 'raincloud': return [`放下的那盆與左右相鄰的盆生長 ×${EVENT_FX.raincloud.growth}（${EVENT_FX.raincloud.buffSec} 秒）`];
    case 'butterfly': return [`每隻蝴蝶讓一盆生長 ×${EVENT_FX.butterfly.growth}（同一盆疊加 +1 倍，${EVENT_FX.butterfly.buffSec} 秒）`];
    case 'sneeze': return [`所有大釜熬煮 ×${EVENT_FX.sneeze.brew}，持續「接住的火花數 × ${EVENT_FX.sneeze.secPerHit} 秒」`];
    case 'bubble': return [`那口大釜 ${EVENT_FX.bubble.brewSec} 秒份的藥水（不耗原料）`];
    case 'perfect_heat': return [`每命中一次，那口大釜 ${EVENT_FX.perfect_heat.secPerHit} 秒內每輪都是雙倍`];
    case 'apprentice': return [`那口大釜熬煮 ×${EVENT_FX.apprentice.brew}（${EVENT_FX.apprentice.buffSec} 秒）`];
    case 'hero': return [`每點一下 ${inc(EVENT_FX.hero.incomePerHit)}（最多 ${EVENT_MAP.hero.goal} 下）`, `點滿 ${EVENT_FX.hero.hypeAt} 下：市場熱度拉到 ×${EVENT_FX.hero.hype}（${EVENT_FX.hero.buffSec} 秒）`];
    case 'merchant': return Object.values(MERCHANT_OFFERS).map((o) => `${o.name}：${o.desc}`).concat('（每次隨機三樣，選一樣）');
    case 'princess': return [inc(EVENT_FX.princess.incomeSec)];
    case 'guild_rush': return [`收購箱照售價全額收購（${EVENT_FX.guild_rush.buffSec} 秒）`];
    case 'dream': return ['露米婭的體力回滿', `開心度 +${EVENT_FX.dream.happy} × 開心度倍率`];
    case 'letter': return [inc(EVENT_FX.letter.incomeSec), '一封信（收到的信可以在這裡重讀）'];
    case 'fortune': return Object.values(FORTUNE_CARDS).map((c) => `${c.name}：${c.desc}`).concat('（翻開前不知道是哪一張）');
    case 'meteor': return [`每顆流星 ${inc(EVENT_FX.meteor.incomePerHit)}`, '10 顆全部抓到：再加碼一樣多'];
    case 'slime': return [`每種原料各 ${EVENT_FX.slime.materialSec} 秒份`];
  }
}

/** 事件簿用：操作方式 */
export const KIND_NAMES: Record<EventKind, string> = {
  tap: '點擊', count: '連點（點越多越好）', drag: '拖曳', timing: '看準時機', choice: '三選一',
};

/** 流浪行商的商品（每次隨機三樣） */
export type MerchantOffer = 'gold' | 'growth' | 'brew' | 'arrival' | 'materials';
export const MERCHANT_OFFERS: Record<MerchantOffer, { name: string; desc: string; icon: string }> = {
  gold: { name: '高價收購', desc: '用高價買下一批藥水：立刻獲得 120 秒份的收入', icon: 'icon_gold' },
  growth: { name: '魔法肥料試用包', desc: '所有盆栽生長速度 ×2，持續 120 秒', icon: 'upg_fertilizer' },
  brew: { name: '火精靈木炭', desc: '所有大釜熬煮速度 ×2，持續 120 秒', icon: 'upg_warm_circle' },
  arrival: { name: '招客香包', desc: '來客速度 ×2，持續 120 秒', icon: 'upg_diffuser' },
  materials: { name: '原料福袋', desc: '每種原料各 180 秒份的產量', icon: 'item_redheart' },
};
export const MERCHANT_FX = { goldSec: 120, mult: 2, buffSec: 120, materialSec: 180 };

/** 占卜婆婆的牌（翻開前看不到是哪一張） */
export type FortuneCard = 'sun' | 'star' | 'moon' | 'wheel';
export const FORTUNE_CARDS: Record<FortuneCard, { name: string; desc: string }> = {
  sun: { name: '太陽', desc: '植物生長與大釜熬煮速度 ×2，持續 180 秒' },
  star: { name: '星星', desc: '藥水售價 ×1.5，持續 180 秒' },
  moon: { name: '月亮', desc: '來客速度 ×2，持續 180 秒' },
  wheel: { name: '命運之輪', desc: '立刻獲得 300 秒份的收入' },
};
export const FORTUNE_FX = { speed: 2, price: 1.5, arrival: 2, buffSec: 180, goldSec: 300 };

/**
 * 三封來信（依序寄來；收齊之後再來的信隨機重讀一封）。
 * 內容待定：之後配合完整的背景故事（露米婭的出身、和老師認識的契機、老師為什麼是魔導書）撰寫，
 * 和兩個開心度劇情、開頭場景串在一起。目前先用佔位文字。
 */
export const LETTERS: { title: string; lines: string[]; bond: number }[] = [1, 2, 3].map((n, k) => ({
  title: `第${'一二三'[k]}封來信`,
  bond: [2, 4, 6][k],
  lines: [`（第 ${n} 封信的內容待定：之後配合背景故事撰寫）`],
}));
