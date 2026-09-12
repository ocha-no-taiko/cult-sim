import React from 'react'
import { yen, yenSigned, people, dayLabel, orderName } from '../game/format.js'
import { founderBusyOn, priestsFree, priestsAssigned } from '../game/engine/selectors.js'
import { WARINESS_STAGES, UNDERWORLD_STAGES } from '../game/engine/constants.js'

function warinessColor(w) {
  if (w >= 85) return 'var(--bad)'
  if (w >= 60) return 'var(--warn)'
  if (w >= 35) return 'var(--gold)'
  return 'var(--good)'
}

const SHADOW = new Set(['conspiracy', 'nightlife', 'usury', 'narcotics', 'syndicate'])

function underworldColor(u) {
  if (u >= 80) return 'var(--bad)'
  if (u >= 70) return 'var(--warn)'
  if (u >= 45) return 'var(--gold)'
  return 'var(--ink-dim)'
}

export default function Header({ state, act, totals: t, finance: fin, onTitle, onExport, onImport, onHelp, match = null }) {
  const busy = founderBusyOn(state)
  const free = priestsFree(state)
  const assigned = priestsAssigned(state)
  const stage = [...WARINESS_STAGES].reverse().find((s) => state.wariness >= s.at)
  const uwStage = [...UNDERWORLD_STAGES].reverse().find((s) => state.underworld >= s.at)
  const hasShadow = state.underworld > 0 || Object.keys(state.businesses).some((k) => state.businesses[k] && SHADOW.has(k))

  return (
    <header className="hdr">
      <div className="hdr-brand">
        <span className="nm">
          {orderName(state)}
          {state.victories > 0 && <span className="tag gold" style={{ marginLeft: 8, verticalAlign: 2 }}>国教</span>}
        </span>
        <span className="dy num">{dayLabel(state.day)}（{state.day}日目）</span>
      </div>

      <div className="stat">
        <span className="k">運転資金</span>
        <span className="v num" style={{ color: state.funds < 0 ? 'var(--bad)' : undefined }}>{yen(state.funds)}</span>
        <span className={`s ${fin.net >= 0 ? 'good' : 'bad'}`}>{yenSigned(fin.net)} / 日</span>
      </div>

      <div className="stat">
        <span className="k">信者数</span>
        <span className="v num">{people(t.followers)}</span>
        <span className="s faint num">全人口の {(t.nationalShare * 100).toFixed(2)}%</span>
      </div>

      <div className="stat">
        <span className="k">聖職者</span>
        <span className="v num">{state.priests}人</span>
        <span className="s faint num">配置 {assigned} / 遊休 {free}</span>
      </div>

      <div className="stat">
        <span className="k">平均信仰度</span>
        <span className="v num">{t.avgFaith.toFixed(1)}</span>
        <span className="s faint">お布施と離脱に直結</span>
      </div>

      <div className="stat">
        <span className="k">教祖</span>
        <span className="v" style={{ fontSize: 14, color: busy ? 'var(--warn)' : 'var(--good)' }}>
          {busy ? '拘束中' : '自由'}
        </span>
        <span className="s faint">{busy ? busy.label : '重要な決定が可能'}</span>
      </div>

      <div className="stat gauge-wrap">
        <span className="k">世間の警戒度</span>
        <span className="v num" style={{ color: warinessColor(state.wariness) }}>
          {state.wariness.toFixed(1)}
          <span className="faint" style={{ fontSize: 12, marginLeft: 6, fontFamily: 'var(--gothic)' }}>
            {stage ? stage.label : '無名'}
          </span>
        </span>
        <span className="gauge"><i style={{ width: `${state.wariness}%`, background: warinessColor(state.wariness) }} /></span>
      </div>

      {hasShadow && (
        <div className="stat gauge-wrap">
          <span className="k">闇度</span>
          <span className="v num" style={{ color: underworldColor(state.underworld) }}>
            {state.underworld.toFixed(1)}
            <span className="faint" style={{ fontSize: 12, marginLeft: 6, fontFamily: 'var(--gothic)' }}>
              {uwStage ? uwStage.label : '清廉'}
            </span>
          </span>
          <span className="gauge"><i style={{ width: `${state.underworld}%`, background: underworldColor(state.underworld) }} /></span>
        </div>
      )}

      <div className="hdr-right">
        {match ? (
          <span className="match-clock" title="対戦中は時間を止められない">
            対戦 <b>{match.room.players?.filter((p) => p.alive).length ?? 0}</b>教団
            <span className="faint">1日 {((match.room.msPerDay ?? 8000) / 1000).toFixed(1)}秒</span>
          </span>
        ) : (
          <div className="speed">
            {[0, 1, 2, 4].map((sp) => (
              <button
                key={sp}
                className={state.speed === sp ? 'on' : ''}
                onClick={() => act('SET_SPEED', sp)}
                title={sp === 0 ? '一時停止' : `${sp}倍速`}
              >
                {sp === 0 ? '∥' : `×${sp}`}
              </button>
            ))}
          </div>
        )}
        <button className="btn sm ghost" onClick={onHelp}>遊び方</button>
        <button className="btn sm ghost" onClick={onExport} title="現在の状態をJSONで書き出す">保存</button>
        <button className="btn sm ghost" onClick={onImport}>読込</button>
        <button className="btn sm ghost" onClick={onTitle}>タイトル</button>
      </div>
    </header>
  )
}
