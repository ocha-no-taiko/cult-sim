import React from 'react'
import { yen, people, pct, dayLabel, orderName } from '../game/format.js'
import { REGIONS } from '../game/data/regions.js'

export default function EndingModal({ state, totals: t, onTitle, onDismiss, onContinue }) {
  const e = state.ending
  const win = e.type === 'victory'
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
          {win ? (
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
