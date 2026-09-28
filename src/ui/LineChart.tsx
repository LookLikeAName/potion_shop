import { useState } from 'preact/hooks';
import { t } from '../i18n';
import { yRange, type YMode } from './chartScale';

export interface Series {
  label: string;
  color: string;
  values: number[];
}

/** 水平參考線（例如大釜全速需要、顧客需求） */
export interface RefLine {
  label: string;
  value: number;
}



interface Props {
  /** 每一點距離現在幾秒（負數） */
  ago: number[];
  series: Series[];
  refLine?: RefLine;
  /** 軸與圖例的數值格式 */
  format: (n: number) => string;
  /** 提示框的數值格式（預設同 format；通常給不縮寫的精確數字） */
  tipFormat?: (n: number) => string;
  yMode?: YMode;
  /** zero 模式的固定上限（例如百分比用 1） */
  yMax?: number;
}

const W = 560;
const H = 170;
const PAD = { right: 12, top: 10, bottom: 24 };
/** x 軸固定顯示最近 30 秒 */
const SPAN = 30;

/**
 * 最近 30 秒的折線圖：單一 y 軸、細線、圖例（附目前的值）、滑鼠／手指移到圖上時的十字線與提示框。
 */
export function LineChart({ ago, series, refLine, format, tipFormat = format, yMode = 'zero', yMax }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const n = ago.length;
  const values = series.flatMap((s) => s.values);
  if (refLine && refLine.value > 0) values.push(refLine.value);
  const { lo, hi, ticks } = yRange(yMode, values.length ? values : [0], yMax);
  // 軸標籤寬度跟著最長的數字（完整數字可能很長）
  const labelChars = Math.max(...ticks.map((v) => format(v).length));
  const left = Math.max(40, labelChars * 7.6 + 12);
  const pw = W - left - PAD.right;
  const ph = H - PAD.top - PAD.bottom;
  const x = (a: number) => left + ((a + SPAN) / SPAN) * pw;
  const y = (v: number) => PAD.top + ph - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * ph;

  const pick = (e: PointerEvent) => {
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let k = 1; k < n; k++) if (Math.abs(x(ago[k]) - vx) < Math.abs(x(ago[best]) - vx)) best = k;
    setHover(best);
  };

  const h = hover !== null && hover < n ? hover : null;
  const last = n - 1;
  return (
    <div class="chart">
      <div class="chart-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i class="chart-key" style={{ background: s.color }} />
            {s.label} <b>{format(s.values[last] ?? 0)}</b>
          </span>
        ))}
        {refLine && refLine.value > 0 && (
          <span><i class="chart-key dashed" />{refLine.label} <b>{format(refLine.value)}</b></span>
        )}
      </div>
      <div class="chart-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`} class="chart-svg"
          onPointerMove={(e) => pick(e as PointerEvent)} onPointerDown={(e) => pick(e as PointerEvent)}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={left} x2={W - PAD.right} y1={y(v)} y2={y(v)} class={v === 0 || (yMode === 'fit' && v === lo) ? 'chart-base' : 'chart-grid'} />
              <text x={left - 6} y={y(v) + 5} class="chart-ytick">{format(v)}</text>
            </g>
          ))}
          {[-30, -20, -10, 0].map((a) => (
            <text key={a} x={x(a)} y={H - 6} class="chart-xtick" text-anchor={a === -30 ? 'start' : a === 0 ? 'end' : 'middle'}>
              {a === 0 ? t('chart.now') : t('chart.ago', { n: -a })}
            </text>
          ))}
          {refLine && refLine.value > 0 && (
            <line x1={left} x2={W - PAD.right} y1={y(refLine.value)} y2={y(refLine.value)} class="chart-ref" />
          )}
          {series.map((s) => (
            <polyline
              key={s.label} fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round"
              points={s.values.map((v, k) => `${x(ago[k]).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
            />
          ))}
          {h !== null && (
            <g>
              <line x1={x(ago[h])} x2={x(ago[h])} y1={PAD.top} y2={PAD.top + ph} class="chart-cross" />
              {series.map((s) => (
                <circle key={s.label} cx={x(ago[h])} cy={y(s.values[h])} r="4" fill={s.color} stroke="#fffaf0" stroke-width="2" />
              ))}
            </g>
          )}
        </svg>
        {h !== null && (
          <div class={`chart-tip ${x(ago[h]) > W * 0.6 ? 'left' : ''}`} style={{ left: `${(x(ago[h]) / W) * 100}%` }}>
            <div class="chart-tip-time">{t('chart.ago', { n: Math.round(-ago[h]) })}</div>
            {series.map((s) => (
              <div key={s.label} class="chart-tip-row">
                <i class="chart-key" style={{ background: s.color }} />
                <b>{tipFormat(s.values[h])}</b> <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
