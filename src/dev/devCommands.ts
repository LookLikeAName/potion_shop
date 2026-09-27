// 開發用的主控台指令（只在 npm run dev 時載入；正式建置時 import.meta.env.DEV 是 false，這個檔案整個不會打包進去）
// 用法：在瀏覽器主控台輸入 __events.help()
import { EVENTS, EVENT_MAP, RARITY_NAMES, type EventId } from '../game/config/events';
import { eventAvailable, eventPool, eventWeight, startEvent } from '../game/events';
import type { Game } from '../game/game';
import type { SimContext } from '../game/sim';

export function installDevCommands(game: Game): void {
  // 模擬用的 context 是私有的；開發工具直接拿來用
  const ctx = () => game['ctx'] as SimContext;

  const events = {
    /** 列出所有事件：目前能不能出現、權重、完成次數 */
    list() {
      const s = game.state;
      console.table(EVENTS.map((d) => ({
        id: d.id,
        名稱: d.name,
        稀有度: RARITY_NAMES[d.rarity],
        條件符合: eventAvailable(s, d.id, ctx()),
        冷卻秒數: Math.ceil(s.events.cooldowns[d.id] ?? 0),
        權重: eventWeight(s, d),
        完成次數: s.events.codex[d.id]?.done ?? 0,
      })));
    },

    /**
     * 觸發事件。不給 id = 照正常權重從候選池抽一個。
     * 條件不符的事件預設不觸發；force = true 時照樣觸發（缺目標時可能表現不完整）
     */
    start(id?: EventId, force = false) {
      const s = game.state;
      let target = id;
      if (!target) {
        const pool = eventPool(s, ctx());
        if (pool.length === 0) return console.warn('目前沒有可以出現的事件（用 __events.list() 看條件）');
        target = pool[Math.floor(Math.random() * pool.length)].id;
      }
      if (!EVENT_MAP[target]) return console.warn(`沒有這個事件：${target}（用 __events.list() 看所有 id）`);
      if (!force && !eventAvailable(s, target, ctx())) {
        return console.warn(`「${EVENT_MAP[target].name}」目前條件不符。要強制觸發：__events.start('${target}', true)`);
      }
      s.events.active = null;
      try {
        startEvent(s, target, ctx());
        console.info(`已觸發：${EVENT_MAP[target].name}`);
      } catch (err) {
        s.events.active = null;
        console.warn(`「${EVENT_MAP[target].name}」缺少需要的目標，無法觸發`, err);
      }
    },

    /** 結束目前的事件（不給獎勵、不算冷卻） */
    end() {
      game.state.events.active = null;
    },

    /** 讓下一個 tick 立刻做一次正常的檢定（62% 機率出現事件） */
    check() {
      game.state.events.timer = 0;
    },

    /** 清掉所有事件的冷卻 */
    clearCooldowns() {
      game.state.events.cooldowns = {};
    },

    help() {
      console.info([
        '__events.list()                列出所有事件（條件、冷卻、權重、完成次數）',
        "__events.start()               照權重隨機觸發一個符合條件的事件",
        "__events.start('goblin')       觸發指定的事件（id 見 list）",
        "__events.start('meteor', true) 條件不符也強制觸發",
        '__events.end()                 結束目前的事件',
        '__events.check()               下一個 tick 立刻做一次正常檢定',
        '__events.clearCooldowns()      清掉所有事件的冷卻',
      ].join('\n'));
    },
  };

  Object.assign(window, { __game: game, __events: events });
  console.info('開發指令：__events.help()');
}
