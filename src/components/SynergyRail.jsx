import React, { useState } from 'react'
import { summarizeSynergies } from '../game/engine/city.js'
import { FACILITY_MAP } from '../game/data/facilities.js'

const EFF_TEXT = {
  growth: (v) => `信者獲得 ${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`,
  donation: (v) => `お布施 ${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`,
  faith: (v) => `信仰度 ${v > 0 ? '+' : ''}${v.toFixed(2)}/日`,
  churn: (v) => `離脱 ${(v * 100).toFixed(0)}%`,
  wariness: (v) => `警戒度 ${v > 0 ? '+' : ''}${v.toFixed(2)}/日`,
  underworld: (v) => `闇度 ${v > 0 ? '+' : ''}${v.toFixed(2)}/日`,
  income: (v) => `収入 ${v > 0 ? '+' : ''}${v.toLocaleString()}円/日`,
  convertCap: (v) => `転向枠 ${v > 0 ? '+' : ''}${v}人/日`,
  votePower: (v) => `得票係数 ${v > 0 ? '+' : ''}${v.toFixed(2)}`,
}

export function EffectChips({ effect, mult }) {
  if (mult) return <span className="eff pos">効果 ×{mult.toFixed(2)}</span>
  return Object.entries(effect ?? {}).map(([k, v]) => {
    const f = EFF_TEXT[k]
    if (!f) return null
    const bad = ((k === 'wariness' || k === 'churn' || k === 'underworld') && v > 0)
    return <span key={k} className={`eff ${bad ? 'neg' : 'pos'}`}>{f(v)}</span>
  })
}

/** 宗教都市の脇に立てる、成立中のシナジー一覧 */
export default function SynergyRail({ city, hovered, onHover, onOpenAll }) {
  const [card, setCard] = useState(null)
  const active = summarizeSynergies(city)
    .sort((a, b) => (a.kind === 'adjacency' ? 1 : 0) - (b.kind === 'adjacency' ? 1 : 0))

  return (
    <div className="panel syn-rail">
      <div className="panel-head" style={{ fontSize: 14 }}>
        効いている配置
        <span className="tag on">{active.length}</span>
      </div>
      <div className="panel-body" style={{ padding: 8 }}>
        {active.length === 0 && (
          <div className="faint" style={{ fontSize: 12, lineHeight: 1.85, padding: '4px 4px 8px' }}>
            まだ何も成立していない。施設は隣に何を置くかで効き方が変わる。
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {active.map(({ rule, count, kind }) => (
            <div
              key={rule.id}
              className={`rail-row${hovered === rule.id ? ' on' : ''}`}
              onMouseEnter={() => { onHover(rule.id); setCard(rule) }}
              onMouseLeave={() => { onHover(null); setCard(null) }}
              onClick={() => { onHover(rule.id); setCard(rule) }}
            >
              <span className={`rail-dot ${kind === 'adjacency' ? 'adj' : 'zone'}`} />
              <span className="rail-name">{rule.name}</span>
              {count > 1 && <span className="rail-count">×{count}</span>}
            </div>
          ))}
        </div>

        <div className="rail-card">
          {card ? (
            <>
              <div className="rail-card-name">{card.name}</div>
              {card.pair && (
                <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>
                  {card.pair.map((tp) => FACILITY_MAP[tp]?.name ?? tp).join(' ＋ ')} を隣接
                </div>
              )}
              <div className="rail-card-desc">{card.desc}</div>
              <div className="card-eff" style={{ marginTop: 6 }}>
                <EffectChips effect={card.effect} mult={card.mult} />
              </div>
            </>
          ) : (
            <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.8 }}>
              上の項目にカーソルを合わせると、効果の内訳と地図上の位置が分かる。
            </div>
          )}
        </div>

        <button className="btn sm ghost" style={{ width: '100%', marginTop: 9 }} onClick={onOpenAll}>
          全組み合わせを見る
        </button>
      </div>
    </div>
  )
}
