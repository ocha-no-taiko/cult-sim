import React, { useState } from 'react'
import { VEHICLES, portfolioValue, expectedDaily, idlePortion } from '../game/engine/invest.js'
import { yen, pct } from '../game/format.js'
import TipCard from './TipCard.jsx'
import StakePanel from './StakePanel.jsx'

const RISK_WORD = (v) => {
  const p = v.crashChance
  if (p >= 0.015) return { t: '極大', c: 'var(--bad)' }
  if (p >= 0.005) return { t: '中', c: 'var(--warn)' }
  return { t: '小', c: 'var(--good)' }
}

function Vehicle({ state, act, v }) {
  const held = state.investments?.[v.id] ?? 0
  const [ratio, setRatio] = useState(10)
  const putAmount = Math.floor(state.funds * (ratio / 100))
  const takeAmount = Math.floor(held * (ratio / 100))
  const risk = RISK_WORD(v)
  const ev = expectedDaily(v, held)
  const evFresh = expectedDaily(v, 0)
  const idle = idlePortion(v, held)

  return (
    <div className={`card${v.shadow ? ' shadow' : ''}${held > 0 ? ' active' : ''}`}>
      <div className="card-head">
        <span className="card-name">{v.icon} {v.name}</span>
        <span className="tag" style={{ color: risk.c, borderColor: risk.c }}>リスク {risk.t}</span>
      </div>
      <div className="card-desc">{v.desc}</div>
      <dl className="invest-stats">
        <div>
          <dt>預けている額</dt>
          <dd style={{ color: held > 0 ? 'var(--gold)' : undefined }}>{yen(held)}</dd>
        </div>
        <div>
          <dt>1日の期待</dt>
          <dd className={ev >= 0 ? 'good' : 'bad'}>{ev >= 0 ? '+' : ''}{(ev * 100).toFixed(3)}%</dd>
        </div>
        <div>
          <dt>年にすると</dt>
          <dd>×{Math.pow(1 + Math.max(0, ev), 365).toFixed(2)}</dd>
        </div>
        <div>
          <dt>振れ幅</dt>
          <dd>±{(v.volatility * 100).toFixed(2)}%</dd>
        </div>
        <div>
          <dt>元本割れ</dt>
          <dd style={{ color: risk.c }}>
            {(v.crashChance * 100).toFixed(2)}%/日 で −{(v.crashLoss * 100).toFixed(0)}%
          </dd>
        </div>
        {v.capacity && (
          <div>
            <dt>受け入れ容量</dt>
            <dd>{yen(v.capacity)}</dd>
          </div>
        )}
        {idle > 0 && (
          <div>
            <dt>寝ている額</dt>
            <dd className="warn">{yen(idle)}（容量内なら+{(evFresh * 100).toFixed(3)}%）</dd>
          </div>
        )}
        {v.wariness > 0 && (
          <div><dt>副作用</dt><dd className="bad">警戒度 +{v.wariness.toFixed(2)}/日まで</dd></div>
        )}
        {v.underworld > 0 && (
          <div><dt>副作用</dt><dd className="bad">闇度 +{v.underworld.toFixed(2)}/日まで</dd></div>
        )}
      </dl>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="range" min="1" max="100" value={ratio} style={{ flex: 1 }}
          onChange={(e) => setRatio(Number(e.target.value))} />
        <span className="num" style={{ width: 40, textAlign: 'right' }}>{ratio}%</span>
      </div>
      <div className="invest-actions">
        <button className="btn sm primary invest-btn"
          disabled={putAmount <= 0}
          onClick={() => act('INVEST', { vehicle: v.id, amount: putAmount })}>
          <span>投じる</span>
          <span className="invest-amt">運転資金の{ratio}%／{yen(putAmount)}</span>
        </button>
        <button className="btn sm invest-btn"
          disabled={takeAmount <= 0}
          onClick={() => act('DIVEST', { vehicle: v.id, amount: takeAmount })}>
          <span>引き上げる</span>
          <span className="invest-amt">預けている額の{ratio}%／{yen(takeAmount)}</span>
        </button>
      </div>
      <div className="faint" style={{ fontSize: 12, lineHeight: 1.8 }}>{v.tip}</div>
    </div>
  )
}

export default function InvestView({ state, act, match }) {
  const invested = portfolioValue(state.investments)
  const wealth = state.funds + invested
  const openVehicles = VEHICLES.filter((v) => !v.shadow)
  const shadowVehicles = VEHICLES.filter((v) => v.shadow)
  const shadowKnown = shadowVehicles.some((v) => (state.investments?.[v.id] ?? 0) > 0)
    || Object.entries(state.businesses).some(([, on]) => on && state.underworld > 0)
    || state.underworld > 0

  return (
    <>
      <TipCard id="invest" />

      <div className="panel">
        <div className="panel-head">
          資産の内訳
          <span className="tag gold">総資産 {yen(wealth)}</span>
        </div>
        <div className="panel-body" style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          <div className="kv" style={{ minWidth: 230 }}>
            <span className="k">運転資金</span><span className="v">{yen(state.funds)}</span>
            <span className="k">運用中</span><span className="v gold">{yen(invested)}</span>
            <span className="k">総資産に占める運用</span>
            <span className="v">{wealth > 0 ? pct(invested / wealth) : '0%'}</span>
          </div>
          <div className="kv" style={{ minWidth: 230 }}>
            <span className="k">これまでに投じた額</span><span className="v">{yen(state.investTotalIn ?? 0)}</span>
            <span className="k">これまでに引き上げた額</span><span className="v">{yen(state.investTotalOut ?? 0)}</span>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="hint">
              運用に回した資金は<b>施設の維持費や布教費には使えない</b>。
              資金が尽きると3日で教団は解散するので、日々の収支がマイナスのうちは手を出さないこと。
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">表の運用</div>
        <div className="panel-body">
          <div className="cards invest-cards">
            {openVehicles.map((v) => <Vehicle key={v.id} state={state} act={act} v={v} />)}
          </div>
        </div>
      </div>

      {shadowKnown && (
        <div className="panel shadow-panel">
          <div className="panel-head">
            裏の運用
            <span className="faint" style={{ fontSize: 12 }}>増え方は桁違い。消え方も桁違い。</span>
          </div>
          <div className="panel-body">
            <div className="hint alert" style={{ marginBottom: 11 }}>
              裏の運用は闇度を押し上げる。上がり幅は<b>総資産のうちどれだけを預けているか</b>に比例する。
              少額なら影響は小さいが、資産の大半を回せば暗殺の抽選と地続きになる。
            </div>
            <div className="cards invest-cards">
              {shadowVehicles.map((v) => <Vehicle key={v.id} state={state} act={act} v={v} />)}
            </div>
          </div>
        </div>
      )}

      {match && <StakePanel state={state} match={match} />}
    </>
  )
}
