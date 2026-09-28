import { BOUNTY } from '../../game/config/balance';
import { MATERIAL_IDS, PLANTS } from '../../game/config/plants';
import { FLOATING_POT, TARGET_UPGRADES } from '../../game/config/upgrades';
import { replantCost } from '../../game/commands';
import { formatCycle, formatNumber, formatRate } from '../../game/format';
import type { SlotState } from '../../game/state';
import { growthSpeed, harvestPerRound, milestoneMult, nextMilestone, potOutputPerSec } from '../../game/stats';
import { t, tx } from '../../i18n';
import { BuyButton } from '../BuyButton';
import { GlobalUpgrades } from '../GlobalUpgrades';
import { Glyph } from '../Glyph';
import { Icon } from '../Icon';
import { useGame } from '../store';

export function GreenhousePanel() {
  const game = useGame();
  return (
    <div class="cards">
      <p class="hint">
        {t('green.intro')}<br />
        {tx('green.bounty', { bounty: <b>{t('green.bountyWord')}</b> }, { pct: Math.round(BOUNTY.chance * 100), bonus: Math.round(BOUNTY.bonus * 100) })}
      </p>
      <GlobalUpgrades zone="greenhouse" title={t('green.tools')} />
      {game.state.slots.map((slot, i) => <SlotCard key={i} i={i} slot={slot} />)}
    </div>
  );
}

function SlotCard({ i, slot }: { i: number; slot: SlotState }) {
  const game = useGame();
  const s = game.state;
  const id = `slot-${i}`;

  if (!slot.open) {
    // 浮空盆栽格依序開啟：只有下一格可以買
    const nextToOpen = s.slots.findIndex((x) => !x.open);
    return (
      <div class="card locked" id={id}>
        <div class="card-title"><Glyph id="icon_lock" text="🔒" size={1.1} /> {t('green.lockedSlot', { n: i + 1 })}</div>
        {i === nextToOpen ? (
          <BuyButton
            k={{ kind: 'global', id: FLOATING_POT }} title={t('green.summonPot')} icon="pot_hidden_slot"
            desc={t('green.summonPotDesc')}
          />
        ) : (
          <p class="hint">{t('green.openFirst', { n: nextToOpen + 1 })}</p>
        )}
      </div>
    );
  }

  if (!slot.plant) {
    return (
      <div class="card" id={id}>
        <div class="card-title">{t('green.emptyPot', { n: i + 1 })}</div>
        <p class="hint">{t('green.choose')}</p>
        {MATERIAL_IDS.map((m) => {
          const p = PLANTS[m];
          return (
            <div class="buy-row" key={m}>
              <div class="buy-text">
                <div class="buy-title"><Icon id={`item_${m}`} /> {p.name}</div>
                <div class="buy-desc">
                  {t('green.seedInfo', { grow: p.growTime, click: p.clickAdvance })}
                  {p.yieldMult !== 1 && t('green.seedYield', { x: p.yieldMult })}
                </div>
              </div>
              <button class="buy-btn" disabled={s.gold < p.seedCost} onClick={() => game.plantSeed(i, m)}>
                <Icon id="icon_gold" size={1} /> {formatNumber(p.seedCost)}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  const p = PLANTS[slot.plant];
  const speed = growthSpeed(s, slot);
  const next = nextMilestone(slot.level);
  // 每秒產量（有花妖精自動採收時），以及再升一級會多多少
  const perSec = potOutputPerSec(s, i);
  const gainLevel = potOutputPerSec(s, i, { ...slot, level: slot.level + 1 }) - perSec;
  const gainRain = potOutputPerSec(s, i, { ...slot, rain: slot.rain + 1 }) - perSec;
  const nextText = (gain: number) => (slot.fairy ? t('green.nextLevel', { n: formatRate(gain) }) : '');
  return (
    <div class="card" id={id}>
      <div class="card-title">
        <Icon id={`item_${slot.plant}`} /> {p.name} <span class="lv">Lv {slot.level}</span>
      </div>
      <PlantLevels i={i} slot={slot} />
      <p class="hint plant-levels-hint">{t('green.replantHint')}</p>
      <div class="stats">
        <span>{tx('green.perHarvest', { n: <b>{formatNumber(harvestPerRound(s, i))}</b> })}</span>
        <span>{tx('green.growTime', { t: <b>{formatCycle(p.growTime / speed)}</b> })}</span>
        <span>{t('green.speed', { x: formatRate(speed) })}</span>
        <span>{slot.fairy ? tx('green.perSec', { n: <b>{formatRate(perSec)}</b> }) : t('green.manualHarvest')}</span>
        {next && <span>{t('green.milestone', { lv: next, x: milestoneMult(next) / milestoneMult(slot.level) })}</span>}
      </div>
      <BuyButton k={{ kind: 'potLevel', slot: i }} title={t('green.upgradePot')} desc={t('green.upgradePotDesc') + nextText(gainLevel)} />
      <BuyButton
        k={{ kind: 'rain', slot: i }} title={TARGET_UPGRADES.raincloud.name} icon="upg_raincloud" status={`Lv ${slot.rain}`}
        desc={t('green.rainDesc') + nextText(gainRain)}
      />
      <BuyButton
        k={{ kind: 'fairy', slot: i }} title={TARGET_UPGRADES.fairy.name} icon="upg_fairy" doneText={t('green.hired')}
        desc={t('green.fairyDesc')}
      />
    </div>
  );
}

/**
 * 這個盆栽各種植物的培育紀錄：種植中的、種過的（等級、雨雲、花妖精）、沒種過的，調度時一眼看得出來。
 * 點其他植物就改種：種過的免費換回（恢復當時的等級與升級），沒種過的付種子錢從 Lv 1 開始；
 * 目前這種的等級與升級會留在這盆裡
 */
function PlantLevels({ i, slot }: { i: number; slot: SlotState }) {
  const game = useGame();
  const s = game.state;
  return (
    <div class="plant-levels">
      {MATERIAL_IDS.map((m) => {
        const cur = slot.plant === m;
        const rec = cur ? { level: slot.level, rain: slot.rain, fairy: slot.fairy } : slot.memory[m];
        const cost = cur ? null : replantCost(s, i, m);
        const affordable = cost !== null && s.gold >= cost;
        const name = PLANTS[m].name;
        const title = cur ? t('green.tipCurrent', { name })
          : cost === 0 ? t('green.tipFree', { name, lv: rec?.level ?? 1 })
          : t('green.tipBuy', { name, cost: formatNumber(cost ?? 0) });
        return (
          <button
            key={m} type="button" title={title}
            class={`plant-level ${cur ? 'current' : 'swap'} ${rec ? '' : 'never'}`}
            disabled={cur || !affordable} onClick={() => game.replant(i, m)}
          >
            <Icon id={`item_${m}`} size={1} />
            {rec ? <b>Lv {rec.level}</b> : <b>{t('green.never')}</b>}
            {rec && rec.rain > 0 && <small>{t('green.rainCount', { n: rec.rain })}</small>}
            {rec?.fairy && <Icon id="upg_fairy" size={0.9} />}
            {cur ? <em>{t('green.growing')}</em> : <span class="plant-swap">{cost === 0 ? t('green.swap') : <><Icon id="icon_gold" size={0.9} />{formatNumber(cost ?? 0)}</>}</span>}
          </button>
        );
      })}
    </div>
  );
}
