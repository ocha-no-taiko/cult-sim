import React from 'react'
import { yen, people, pct, dayLabel, orderName } from '../game/format.js'
import { REGIONS } from '../game/data/regions.js'

const DIFF_LABEL = { easy: '緩やか', normal: '標準', hard: '峻厳' }

export default function EndingModal({ state, totals: t, onTitle, onDismiss, onContinue, ranking = null }) {
  const e = state.ending
  const win = e.kind === 'victory'
  const open = REGIONS.filter((r) => state.regions[r.id].unlocked).length

  return (
    <div className="modal-bg">
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-body" style={{ paddingTop: 30 }}>
          <div className="faint" style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: 13 }}>
            {orderName(state)}
          </div>
          <div className={`ending-title ${win ? 'win' : 'lose'}`}>{e.title}</div>
          <p style={{ textAlign: 'center', color: 'var(--ink-dim)', margin: '0 0 22px' }}>{e.text}</p>

          {ranking && ranking.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginBottom: 16 }}>
              <div className="faint" style={{ fontSize: 12, letterSpacing: '0.12em', marginBottom: 6 }}>
                スコア（難易度を加味した評価。勝敗とは別）
              </div>
              <table className="tbl">
                <thead><tr><th>順位</th><th>教団</th><th>難易度</th><th>倍率</th><th>スコア</th></tr></thead>
                <tbody>
                  {ranking.map((r, i) => (
                    <tr key={r.name}>
                      <td>{i + 1}</td>
                      <td>{r.name}{!r.alive && <span className="tag locked" style={{ marginLeft: 6 }}>脱落</span>}</td>
                      <td>{DIFF_LABEL[r.difficulty] ?? r.difficulty}</td>
                      <td>×{r.mult.toFixed(1)}</td>
                      <td style={{ color: i === 0 ? 'var(--gold)' : undefined }}>{r.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="kv" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
            <span className="k">経過</span><span className="v">{dayLabel(state.day)}（通算{state.day}日）</span>
            <span className="k">最終信者数</span><span className="v">{people(t.followers)}</span>
            <span className="k">最大信者数</span><span className="v">{people(state.stats.peakFollowers)}</span>
            <span className="k">聖職者</span><span className="v">{state.priests}人</span>
            <span className="k">平均信仰度</span><span className="v">{t.avgFaith.toFixed(1)}</span>
            <span className="k">全人口に占める割合</span><span className="v">{pct(t.nationalShare, 2)}</span>
            <span className="k">展開地方</span><span className="v">{open} / 7</span>
            <span className="k">運転資金</span><span className="v">{yen(state.funds)}</span>
            <span className="k">累計投下額</span><span className="v">{yen(state.totalSpent)}</span>
            <span className="k">最終警戒度</span><span className="v">{state.wariness.toFixed(1)}</span>
            {state.election.lastResult && (
              <>
                <span className="k">最後の選挙</span>
                <span className="v">
                  {state.election.lastResult.day}日目 {pct(state.election.lastResult.share)}
                  {state.election.lastResult.won ? '（第一与党）' : '（敗北）'}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onTitle}>タイトルに戻る</button>
          {win && onContinue ? (
            <>
              <button className="btn ghost" onClick={onDismiss}>記録を眺める</button>
              <button className="btn primary" onClick={onContinue}>この国を統べ続ける</button>
            </>
          ) : (
            <button className="btn primary" onClick={onDismiss}>記録を眺める</button>
          )}
        </div>
      </div>
    </div>
  )
}
