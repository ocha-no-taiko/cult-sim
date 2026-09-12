import React from 'react'
import { DOCTRINE_AXES, clusterAppeal, doctrineGlobalEffects } from '../game/data/doctrine.js'
import { CLUSTERS } from '../game/data/clusters.js'
import { REGION_MAP } from '../game/data/regions.js'

function appealWord(a) {
  if (a >= 1.7) return { t: '熱狂', c: 'var(--gold)' }
  if (a >= 1.3) return { t: '好意的', c: 'var(--good)' }
  if (a >= 1.05) return { t: 'やや好意', c: 'var(--ink)' }
  if (a >= 0.9) return { t: '中立', c: 'var(--ink-dim)' }
  if (a >= 0.65) return { t: '冷淡', c: 'var(--warn)' }
  return { t: '拒絶', c: 'var(--bad)' }
}

/** 教義スライダー＋クラスタ別の刺さり方プレビュー */
export default function DoctrineEditor({ value, onChange, regionId, disabled = false, baseline = null }) {
  const region = REGION_MAP[regionId]
  const g = doctrineGlobalEffects(value)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 290px', gap: 18 }} className="doctrine-grid">
      <div>
        {DOCTRINE_AXES.map((ax) => {
          const v = value[ax.id]
          const diff = baseline ? v - baseline[ax.id] : 0
          return (
            <div className="axis" key={ax.id}>
              <div className="axis-head">
                <span className="axis-name">{ax.name}</span>
                <span className="axis-val num">
                  {v}
                  {diff !== 0 && (
                    <span className={diff > 0 ? 'good' : 'bad'} style={{ fontSize: 12, marginLeft: 6 }}>
                      {diff > 0 ? '+' : ''}{diff}
                    </span>
                  )}
                </span>
              </div>
              <input
                type="range" min="0" max="100" step="1" value={v} disabled={disabled}
                onChange={(e) => onChange({ ...value, [ax.id]: Number(e.target.value) })}
              />
              <div className="axis-ends">
                <span>{ax.low}</span>
                <span>{ax.high}</span>
              </div>
              <div className="axis-desc">{ax.desc}</div>
            </div>
          )
        })}
      </div>

      <div>
        <div className="faint" style={{ fontSize: 12, letterSpacing: '0.12em', marginBottom: 6 }}>
          この教義の刺さり方（{region.name}）
        </div>
        <table className="tbl">
          <tbody>
            {CLUSTERS.map((c) => {
              const a = clusterAppeal(c, value, region.bias)
              const w = appealWord(a)
              return (
                <tr key={c.id}>
                  <td style={{ color: c.color }}>{c.name}</td>
                  <td>
                    <span className="bar" style={{ display: 'inline-block', width: 58, verticalAlign: 'middle' }}>
                      <i style={{ width: `${Math.min(100, (a / 2.4) * 100)}%`, background: c.color }} />
                    </span>
                  </td>
                  <td style={{ color: w.c, width: 58 }}>{w.t}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="faint" style={{ fontSize: 12, letterSpacing: '0.12em', margin: '16px 0 6px' }}>
          教団全体への影響
        </div>
        <div className="kv">
          <span className="k">お布施</span><span className="v">×{g.donationMult.toFixed(2)}</span>
          <span className="k">布教の伸び</span><span className="v">×{g.growthMult.toFixed(2)}</span>
          <span className="k">離脱のしやすさ</span><span className="v">×{g.churnMult.toFixed(2)}</span>
          <span className="k">聖職者の育ち</span><span className="v">×{g.priestMult.toFixed(2)}</span>
          <span className="k">信仰の深まり</span><span className="v">×{g.faithMult.toFixed(2)}</span>
          <span className="k">世間の警戒</span>
          <span className="v" style={{ color: g.warinessAdd > 0.06 ? 'var(--bad)' : g.warinessAdd < -0.02 ? 'var(--good)' : undefined }}>
            {g.warinessAdd > 0 ? '+' : ''}{g.warinessAdd.toFixed(3)}/日
          </span>
        </div>
      </div>
    </div>
  )
}
