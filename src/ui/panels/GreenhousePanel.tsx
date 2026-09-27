import { BOUNTY } from '../../game/config/balance';
import { MATERIAL_IDS, PLANTS } from '../../game/config/plants';
import { FLOATING_POT } from '../../game/config/upgrades';
import { replantCost } from '../../game/commands';
import { formatCycle, formatNumber, formatRate } from '../../game/format';
import type { SlotState } from '../../game/state';
import { growthSpeed, harvestPerRound, milestoneMult, nextMilestone, potOutputPerSec } from '../../game/stats';
import { BuyButton } from '../BuyButton';
import { GlobalUpgrades } from '../GlobalUpgrades';
import { Icon } from '../Icon';
import { useGame } from '../store';

export function GreenhousePanel() {
  const game = useGame();
  return (
    <div class="cards">
      <p class="hint">
        點擊盆栽可催熟；成熟後要再點一下採收（雇用花妖精後自動採收）。<br />
        每次收成有 {Math.round(BOUNTY.chance * 100)}% 機率<b>豐收</b>：產量 +{Math.round(BOUNTY.bonus * 100)}%。
      </p>
      <GlobalUpgrades zone="greenhouse" title="溫室工具" />
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
        <div class="card-title">🔒 浮空盆栽格 {i + 1}</div>
        {i === nextToOpen ? (
          <BuyButton
            k={{ kind: 'global', id: FLOATING_POT }} title="召喚浮空魔法盆栽" icon="pot_hidden_slot"
            desc="讓花盆飄在溫室半空中，多一格可以種植物"
          />
        ) : (
          <p class="hint">先開啟第 {nextToOpen + 1} 格，才能召喚這一格。</p>
        )}
      </div>
    );
  }

  if (!slot.plant) {
    return (
      <div class="card" id={id}>
        <div class="card-title">空花盆 {i + 1}</div>
        <p class="hint">選擇要種下的植物：</p>
        {MATERIAL_IDS.map((m) => {
          const p = PLANTS[m];
          return (
            <div class="buy-row" key={m}>
              <div class="buy-text">
                <div class="buy-title"><Icon id={`item_${m}`} /> {p.name}</div>
                <div class="buy-desc">
                  生長 {p.growTime} 秒，點擊 +{p.clickAdvance} 秒{p.yieldMult !== 1 && `，每輪採收 ×${p.yieldMult}`}
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
  const nextText = (gain: number) => (slot.fairy ? `（下一級：每秒 +${formatRate(gain)}）` : '');
  return (
    <div class="card" id={id}>
      <div class="card-title">
        <Icon id={`item_${slot.plant}`} /> {p.name} <span class="lv">Lv {slot.level}</span>
      </div>
      <PlantLevels slot={slot} />
      <div class="stats">
        <span>每次採收 <b>{formatNumber(harvestPerRound(s, i))}</b> 個</span>
        <span>生長 <b>{formatCycle(p.growTime / speed)}</b></span>
        <span>速度 ×{formatRate(speed)}</span>
        <span>{slot.fairy ? <>每秒約 <b>{formatRate(perSec)}</b> 個</> : '要點擊採收（雇用花妖精後自動）'}</span>
        {next && <span>Lv {next} 時速度 ×{milestoneMult(next) / milestoneMult(slot.level)}</span>}
      </div>
      <BuyButton k={{ kind: 'potLevel', slot: i }} title="升級盆栽" desc={`採收量隨等級加速成長${nextText(gainLevel)}`} />
      <BuyButton
        k={{ kind: 'rain', slot: i }} title="局部微型雨雲" icon="upg_raincloud" status={`Lv ${slot.rain}`}
        desc={`只在這盆上方下雨的生氣小烏雲。生長速度 +25%/級${nextText(gainRain)}`}
      />
      <BuyButton
        k={{ kind: 'fairy', slot: i }} title="貪吃花妖精" icon="upg_fairy" doneText="已雇用"
        desc="植物一成熟就一口吞下，再吐到倉庫。自動採收"
      />
      <Replant i={i} slot={slot} />
    </div>
  );
}

/** 這個盆栽各種植物的培育紀錄：種植中的、種過的（等級、雨雲、花妖精）、沒種過的，調度時一眼看得出來 */
function PlantLevels({ slot }: { slot: SlotState }) {
  return (
    <div class="plant-levels">
      {MATERIAL_IDS.map((m) => {
        const cur = slot.plant === m;
        const rec = cur ? { level: slot.level, rain: slot.rain, fairy: slot.fairy } : slot.memory[m];
        return (
          <span key={m} class={`plant-level ${cur ? 'current' : ''} ${rec ? '' : 'never'}`} title={PLANTS[m].name}>
            <Icon id={`item_${m}`} size={1} />
            {rec ? <b>Lv {rec.level}</b> : <b>未種過</b>}
            {rec && rec.rain > 0 && <small>雨雲 {rec.rain}</small>}
            {rec?.fairy && <Icon id="upg_fairy" size={0.9} />}
            {cur && <em>種植中</em>}
          </span>
        );
      })}
    </div>
  );
}

/** 改種：這盆種過的植物免費換回（保留當時的等級與升級），沒種過的付種子價 */
function Replant({ i, slot }: { i: number; slot: SlotState }) {
  const game = useGame();
  const s = game.state;
  const others = MATERIAL_IDS.filter((m) => m !== slot.plant);
  return (
    <details class="replant">
      <summary>改種其他植物</summary>
      <p class="hint">
        目前的等級與升級會保留在這個盆栽裡，之後種回{PLANTS[slot.plant!].name}時免費恢復。
      </p>
      {others.map((m) => {
        const p = PLANTS[m];
        const cost = replantCost(s, i, m);
        if (cost === null) return null;
        const mem = slot.memory[m];
        return (
          <div class="buy-row" key={m}>
            <div class="buy-text">
              <div class="buy-title"><Icon id={`item_${m}`} /> {p.name}</div>
              <div class="buy-desc">
                {mem
                  ? `種過：恢復 Lv ${mem.level}${mem.rain ? `、雨雲 Lv ${mem.rain}` : ''}${mem.fairy ? '、花妖精' : ''}`
                  : `從 Lv 1 開始；生長 ${p.growTime} 秒`}
              </div>
            </div>
            <button class="buy-btn" disabled={s.gold < cost} onClick={() => game.replant(i, m)}>
              {cost === 0 ? '免費改種' : <><Icon id="icon_gold" size={1} /> {formatNumber(cost)}</>}
            </button>
          </div>
        );
      })}
    </details>
  );
}
