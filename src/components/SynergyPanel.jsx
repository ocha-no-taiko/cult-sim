import React, { useState } from 'react'
import { ADJACENCY_RULES, ZONE_RULES, summarizeSynergies } from '../game/engine/city.js'
import { FACILITY_MAP } from '../game/data/facilities.js'

const EFF_TEXT = {
  growth: (v) => `信者獲得 ${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`,
  donation: (v) => `お布施 ${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`,
  faith: (v) => `信仰度 ${v > 0 ? '+' : ''}${v.toFixed(2)}/日`,
  churn: (v) => `離脱 ${(v * 100).toFixed(0)}%`,
  wariness: (v) => `警戒度 ${v > 0 ? '+' : ''}${v.toFixed(2)}/日`,
  income: (v) => `収入 ${v > 0 ? '+' : ''}${v.toLocaleString()}円/日`,
  convertCap: (v) => `転向枠 ${v > 0 ? '+' : ''}${v}人/日`,
  votePower: (v) => `得票係数 ${v > 0 ? '+' : ''}${v.toFixed(2)}`,
}

function Chips({ effect, mult }) {
  if (mult) return <span className="eff pos">効果 ×{mult.toFixed(2)}</span>
  return Object.entries(effect ?? {}).map(([k, v]) => {
    const f = EFF_TEXT[k]
    if (!f) return null
    const bad = (k === 'wariness' && v > 0) || (k === 'churn' && v > 0)
    return <span key={k} className={`eff ${bad ? 'neg' : 'pos'}`}>{f(v)}</span>
  })
}

function RuleRow({ rule, count }) {
  const on = count > 0
  return (
    <div className={`syn-row${on ? ' on' : ''}`}>
      <div className="syn-head">
        <span className="syn-name">{rule.name}</span>
        {on ? <span className="tag gold">成立 {count}</span> : <span className="tag locked">未成立</span>}
      </div>
      {rule.pair && (
        <div className="faint" style={{ fontSize: 12 }}>
          {rule.pair.map((t) => FACILITY_MAP[t]?.name ?? t).join(' ＋ ')} を直交で隣接
        </div>
      )}
      <div className="card-desc" style={{ fontSize: 12 }}>{rule.desc}</div>
      <div className="card-eff"><Chips effect={rule.effect} mult={rule.mult} /></div>
    </div>
  )
}

export default function SynergyPanel({ city, showSynergy, onToggleShow }) {
  const [openAll, setOpenAll] = useState(false)
  const active = summarizeSynergies(city)
  const counts = Object.fromEntries(active.map((a) => [a.rule.id, a.count]))
  const all = [...ZONE_RULES, ...ADJACENCY_RULES]
  const list = openAll ? all : all.filter((r) => counts[r.id] > 0)

  return (
    <div className="panel">
      <div className="panel-head">
        配置シナジー
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="tag on">成立 {active.length}種</span>
          <button className="btn sm ghost" onClick={onToggleShow}>
            {showSynergy ? '線を隠す' : '線を表示'}
          </button>
        </span>
      </div>
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {list.length === 0 && (
          <div className="faint" style={{ fontSize: 12, lineHeight: 1.9 }}>
            まだシナジーは成立していない。施設は隣に何を置くかで効き方が変わる。
            下の一覧から狙いを定めて建て直すとよい。
          </div>
        )}
        {list.map((r) => <RuleRow key={r.id} rule={r} count={counts[r.id] ?? 0} />)}
        <button className="btn sm ghost" onClick={() => setOpenAll((v) => !v)}>
          {openAll ? '成立中のみ表示' : `すべての組み合わせを見る（${all.length}種）`}
        </button>
      </div>
    </div>
  )
}
