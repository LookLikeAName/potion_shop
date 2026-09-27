import { CUSTOMER, UPGRADE_FX } from '../game/config/balance';
import { GLOBAL_UPGRADES, maxLevelOf, type GlobalUpgradeDef, type Zone } from '../game/config/upgrades';
import { formatRate } from '../game/format';
import type { GameState } from '../game/state';
import { arrivalRate, checkoutTime, cratePct, hasAutoCheckout } from '../game/stats';
import { BuyButton } from './BuyButton';
import { useGame } from './store';

function statusOf(def: GlobalUpgradeDef, s: GameState): string | undefined {
  const lvl = s.upgrades[def.id] ?? 0;
  const max = maxLevelOf(def);
  if (def.id.startsWith('crate_')) return lvl > 0 ? `收購價 ${Math.round(cratePct(s, def.id) * 100)}%` : undefined;
  if (def.id === 'bell') return lvl > 0 ? `剩 ${s.bellCharges} 次` : undefined;
  if (def.id === 'signboard' && hasAutoCheckout(s) && arrivalRate(s) / CUSTOMER.interval > 1 / checkoutTime(s)) {
    // 客人來得比櫃台結帳快：再升招牌只會讓客人卡在門外
    return `Lv ${lvl}/${max}・客人來得比結帳快，先升級算盤松鼠`;
  }
  if (def.id === 'garden_gloves' || def.id === 'rune_stirrer') {
    return lvl > 0 ? `Lv ${lvl}・每次點擊 +${formatRate(lvl * UPGRADE_FX.clickBonusSecPerLevel)} 秒產量` : undefined;
  }
  if (max === 1) return undefined;
  return Number.isFinite(max) ? `Lv ${lvl}/${max}` : `Lv ${lvl}`;
}

/** 某個區域的全域升級清單 */
export function GlobalUpgrades({ zone, title }: { zone: Zone; title: string }) {
  const game = useGame();
  const s = game.state;
  // 條件未達成的升級（例如配方還沒解鎖的收購箱）不顯示
  const defs = GLOBAL_UPGRADES.filter((u) => u.zone === zone && (!u.requires || u.requires(s)));
  if (defs.length === 0) return null;
  return (
    <div class="card" id={`upgrades-${zone}`}>
      <div class="card-title">{title}</div>
      {defs.map((u) => (
        <BuyButton
          key={u.id} k={{ kind: 'global', id: u.id }} title={u.name} desc={u.desc} icon={u.icon}
          status={statusOf(u, s)} doneText={maxLevelOf(u) === 1 ? '已擁有' : '已滿級'}
        />
      ))}
    </div>
  );
}
