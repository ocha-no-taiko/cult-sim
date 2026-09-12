import React, { useState } from 'react'
import { yen, people, pct } from '../game/format.js'
import ENDINGS from '../content/endings.json' with { type: 'json' }

/**
 * 対戦中の他教団の様子。
 * 闇度だけは誰にも見えない。表の事業の設立は通知されるので、
 * 「表を厚くしている教団は、清廉なのか、闇を薄めているのか」を読むことになる。
 */
export default function RivalPanel({ state, match, onAssassinate }) {
  const [target, setTarget] = useState(null)
  const room = match.room
  const meId = match.me?.id
  const players = (room.players ?? []).filter((p) => p.id !== meId)
  const self = (room.players ?? []).find((p) => p.id === meId)
  const cost = room.limits?.assassinCost ?? 400_000_000
  const minUw = room.limits?.assassinMinUnderworld ?? 30

  const canPay = state.funds >= cost
  const alive = self?.alive !== false && state.phase === 'playing'

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          他教団
          <span className="tag">{players.length}</span>
        </div>
        <div className="panel-body" style={{ padding: 8 }}>
          {players.length === 0 && <div className="faint" style={{ fontSize: 12 }}>他に教団はいない。</div>}
          {players.map((p) => {
            const won = Object.keys(p.achieved ?? {})
            return (
              <div key={p.id} className={`rival${p.alive ? '' : ' dead'}${target === p.id ? ' sel' : ''}`}
                onClick={() => alive && p.alive && setTarget(target === p.id ? null : p.id)}>
                <div className="rival-head">
                  <span className="rival-name">{p.name}</span>
                  {!p.alive
                    ? <span className="tag locked">脱落・{p.deadReason}</span>
                    : !p.connected ? <span className="tag locked">切断</span> : null}
                </div>
                <div className="rival-stats">
                  <span>信者 {people(p.followers ?? 0)}</span>
                  <span>資金 {yen(p.funds ?? 0)}</span>
                  <span>警戒 {(p.wariness ?? 0).toFixed(0)}</span>
                  <span>全人口比 {pct(p.share ?? 0, 2)}</span>
                </div>
                <div className="rival-biz">
                  {(p.businesses ?? []).length === 0
                    ? <span className="faint" style={{ fontSize: 11.5 }}>事業なし</span>
                    : (p.businesses ?? []).map((b) => <span key={b} className="eff">{b}</span>)}
                </div>
                {won.length > 0 && (
                  <div className="good" style={{ fontSize: 12 }}>
                    到達：{won.map((k) => ENDINGS[k]?.title ?? k).join('・')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {alive && (
        <div className="panel">
          <div className="panel-head" style={{ fontSize: 14 }}>暗殺を差し向ける</div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.85 }}>
              1日に一度だけ、他教団の教祖を狙える。費用は{yen(cost)}。
              <b>闇の濃い側が勝つ</b>。実行には自分の闇度が{minUw}以上必要で、
              相手の闇度が自分を大きく上回っていれば逆襲されてこちらが終わる。
              相手の闇度は見えない。
            </div>
            <div className="kv">
              <span className="k">あなたの闇度</span>
              <span className="v" style={{ color: state.underworld >= minUw ? 'var(--warn)' : 'var(--ink-faint)' }}>
                {state.underworld.toFixed(1)}{state.underworld < minUw && `（あと${(minUw - state.underworld).toFixed(1)}）`}
              </span>
              <span className="k">狙う相手</span>
              <span className="v">{target ? players.find((p) => p.id === target)?.name : '未選択'}</span>
            </div>
            <button
              className="btn primary"
              disabled={!target || !canPay || state.underworld < minUw}
              onClick={() => { onAssassinate(target); setTarget(null) }}
            >
              {!canPay ? '資金が足りない'
                : state.underworld < minUw ? '裏社会のつてが無い'
                  : target ? `${players.find((p) => p.id === target)?.name}へ差し向ける` : '相手を選ぶ'}
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head" style={{ fontSize: 14 }}>各地の報せ</div>
        <div className="log" style={{ maxHeight: 200 }}>
          {(room.feed ?? []).slice().reverse().slice(0, 20).map((f, i) => (
            <div className={`log-row ${f.kind === 'bad' ? 'bad' : f.kind === 'good' ? 'good' : f.kind === 'warn' ? 'warn' : 'system'}`} key={i}>
              <span className="d">{f.day}</span>
              <span className="t">{f.text}</span>
            </div>
          ))}
          {(room.feed ?? []).length === 0 && <div className="log-row faint"><span className="t">まだ何も伝わってこない。</span></div>}
        </div>
      </div>
    </>
  )
}
