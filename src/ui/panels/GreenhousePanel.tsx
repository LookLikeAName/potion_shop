import { MATERIAL_IDS, PLANTS } from '../../game/config/plants';
import { formatNumber, formatSeconds } from '../../game/format';
import type { SlotState } from '../../game/state';
import { growthSpeed, milestoneMult, nextMilestone } from '../../game/stats';
import { BuyButton } from '../BuyButton';
import { Icon } from '../Icon';
import { useGame } from '../store';

export function GreenhousePanel() {
  const game = useGame();
  return (
    <div class="cards">
      <p class="hint">點擊盆栽可催熟；成熟後要再點一下採收（雇用花妖精後自動採收）。</p>
      {game.state.slots.map((slot, i) => <SlotCard key={i} i={i} slot={slot} />)}
    </div>
  );
}

function SlotCard({ i, slot }: { i: number; slot: SlotState }) {
  const game = useGame();
  const s = game.state;
  const id = `slot-${i}`;

  if (!slot.open) {
    return (
      <div class="card locked" id={id}>
        <div class="card-title">🔒 隱藏盆栽格 {i + 1}</div>
        <p class="hint">需要開心度特權「奇蹟綠手指」解鎖（開心度系統將在後續版本開放）。</p>
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
                <div class="buy-desc">生長 {p.growTime} 秒，點擊 +{p.clickAdvance} 秒</div>
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
  return (
    <div class="card" id={id}>
      <div class="card-title">
        <Icon id={`item_${slot.plant}`} /> {p.name} <span class="lv">Lv {slot.level}</span>
      </div>
      <div class="stats">
        <span>每次採收 <b>{formatNumber(slot.level)}</b> 個</span>
        <span>生長 <b>{formatSeconds(p.growTime / speed)}</b></span>
        <span>速度 ×{speed.toFixed(2)}</span>
        {next && <span>Lv {next} 時速度 ×{milestoneMult(next) / milestoneMult(slot.level)}</span>}
      </div>
      <BuyButton k={{ kind: 'potLevel', slot: i }} title="升級盆栽" desc="每級採收量 +1" />
      <BuyButton
        k={{ kind: 'rain', slot: i }} title="局部微型雨雲" status={`Lv ${slot.rain}`}
        desc="只在這盆上方下雨的生氣小烏雲。生長速度 +25%/級"
      />
      <BuyButton
        k={{ kind: 'fairy', slot: i }} title="貪吃花妖精" doneText="已雇用"
        desc="植物一成熟就一口吞下，再吐到倉庫。自動採收"
      />
    </div>
  );
}
