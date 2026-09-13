import React, { useState } from 'react'
import { yen, pct } from '../game/format.js'

/**
 * 対戦限定：他教団の事業に出資する。
 * 暗殺や訴訟と違って妨害ではなく、相手の伸びに相乗りする手段。
 * 出資できるのは「表の事業」だけ（裏は闇度が見えず、判断材料が無いため）。
 */
export default function StakePanel({ state, match }) {
  const [target, setTarget] = useState(null)
  const [business, setBusiness] = useState(null)
  const [ratio, setRatio] = useState(10)

  const room = match.room
  const meId = match.me?.id
  const rivals = (room.players ?? []).filter((p) => p.id !== meId && p.alive)
  const days = room.limits?.stakeDays ?? 7
  const maxRatio = room.limits?.stakeMaxRatio ?? 0.2
  const maxOpen = room.limits?.stakeMaxOpen ?? 3
  const mine = (room.stakes ?? []).filter((s) => s.investorId === meId)

  const cap = Math.floor(state.funds * maxRatio)
  const amount = Math.floor(state.funds * (ratio / 100))
  const selected = rivals.find((p) => p.id === target)
  const canStake = selected && business && amount > 0 && amount <= cap && mine.length < maxOpen

  return (
    <div className="panel">
      <div className="panel-head">
        他教団への出資
        <span className="tag">{mine.length} / {maxOpen}件</span>
      </div>
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div className="faint" style={{ fontSize: 12, lineHeight: 1.85 }}>
          他教団が設立している<b>表の事業</b>に出資し、<b>{days}日後に自動で回収</b>する。
          利率は出資先がその事業の施設を何棟建てているか、
          およびその間にどれだけ伸びたかで決まる。伸びなければ元本割れもある。
          1件あたり運転資金の{pct(maxRatio, 0)}（{yen(cap)}）まで。
        </div>

        {mine.length > 0 && (
          <table className="tbl">
            <thead><tr><th>出資先</th><th>事業</th><th>額</th><th>満期</th></tr></thead>
            <tbody>
              {mine.map((s) => (
                <tr key={s.id}>
                  <td>{s.targetName}</td>
                  <td>{s.business}</td>
                  <td>{yen(s.amount)}</td>
                  <td>{Math.max(0, s.dueDay - (room.day ?? 0))}日後</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div>
          <div className="faint" style={{ fontSize: 12, marginBottom: 5 }}>出資先の教団</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {rivals.length === 0 && <span className="faint" style={{ fontSize: 12 }}>相手がいない。</span>}
            {rivals.map((p) => (
              <button key={p.id} className={`btn sm${target === p.id ? ' primary' : ''}`}
                onClick={() => { setTarget(p.id); setBusiness(null) }}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <div>
            <div className="faint" style={{ fontSize: 12, marginBottom: 5 }}>
              {selected.name}が設立している表の事業
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(selected.businesses ?? []).length === 0
                ? <span className="faint" style={{ fontSize: 12 }}>まだ表の事業を持っていない。</span>
                : (selected.businesses ?? []).map((b) => (
                  <button key={b} className={`btn sm${business === b ? ' primary' : ''}`}
                    onClick={() => setBusiness(b)}>
                    {b}
                  </button>
                ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="range" min="1" max={Math.round(maxRatio * 100)} value={Math.min(ratio, maxRatio * 100)}
            style={{ flex: 1 }} onChange={(e) => setRatio(Number(e.target.value))} />
          <span className="num" style={{ width: 78, textAlign: 'right' }}>{yen(amount)}</span>
        </div>

        <button
          className="btn primary"
          disabled={!canStake}
          onClick={() => {
            match.send({ t: 'stake', target, business, amount, funds: state.funds })
            setTarget(null)
            setBusiness(null)
          }}
        >
          {mine.length >= maxOpen ? `出資は同時に${maxOpen}件まで`
            : !selected ? '教団を選ぶ'
              : !business ? '事業を選ぶ'
                : `${selected.name}の${business}に${yen(amount)}を出資する`}
        </button>
      </div>
    </div>
  )
}
