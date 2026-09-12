import React from 'react'
import { MISSIONS } from '../game/data/missions.js'
import { missionUnlocked, isFounderFree, founderBusyOn } from '../game/engine/selectors.js'
import FounderRelease from './FounderRelease.jsx'
import TipCard from './TipCard.jsx'
import { yen, people } from '../game/format.js'

const EFF_LABEL = {
  growth: (v) => ['信者獲得', `+${(v * 100).toFixed(0)}%`, v > 0],
  flatRecruit: (v) => ['新規入信', `+${v}人/日`, true],
  faith: (v) => ['信仰度', `+${v.toFixed(2)}/日`, true],
  churn: (v) => ['離脱', `${(v * 100).toFixed(0)}%`, v < 0],
  donation: (v) => ['お布施', `+${(v * 100).toFixed(0)}%`, true],
  wariness: (v) => ['警戒度', `${v > 0 ? '+' : ''}${v.toFixed(2)}/日`, v < 0],
  votePower: (v) => ['得票係数', `+${v.toFixed(2)}`, true],
}

function Chips({ effect }) {
  return (
    <div className="card-eff">
      {Object.entries(effect ?? {}).map(([k, v]) => {
        const f = EFF_LABEL[k]
        if (!f) return null
        const [label, text, good] = f(v)
        return <span key={k} className={`eff ${good ? 'pos' : 'neg'}`}>{label} {text}</span>
      })}
    </div>
  )
}

function Layer({ title, note, list, state, act, totals: t }) {
  const free = isFounderFree(state)
  const busy = founderBusyOn(state)
  return (
    <div className="panel">
      <div className="panel-head">{title}<span className="faint" style={{ fontSize: 12 }}>{note}</span></div>
      <div className="panel-body">
        <div className="cards">
          {list.map((m) => {
            const unlocked = missionUnlocked(state, m, t)
            const on = !!state.activeMissions[m.id]
            const timed = state.timedMissions[m.id]
            const founderIssue = m.requiresFounder && !free && !on
            const cost = m.mode === 'sustained' ? m.dailyCost : m.cost
            const affordable = m.mode === 'sustained' ? true : state.funds >= m.cost
            return (
              <div key={m.id} className={`card${!unlocked ? ' locked' : ''}${on || timed ? ' active' : ''}`}>
                <div className="card-head">
                  <span className="card-name">{m.name}</span>
                  {m.mode === 'sustained'
                    ? <span className="tag">{yen(m.dailyCost)}/日</span>
                    : <span className="tag gold">{yen(m.cost)}</span>}
                </div>
                <div className="card-desc">{m.desc}</div>
                <Chips effect={m.effect} />
                {m.mediaScaled && <div className="faint" style={{ fontSize: 12 }}>効果は地方の広報適性に比例する</div>}
                {m.wordScaled && <div className="faint" style={{ fontSize: 12 }}>効果は地方の口コミ適性に比例する</div>}
                {m.requiresFounder && <div className="warn" style={{ fontSize: 12 }}>教祖が自ら動く必要がある</div>}
                {m.mode === 'oneshot' && <div className="faint" style={{ fontSize: 12 }}>効果は{m.duration}日間持続</div>}

                <div className="card-foot">
                  {!unlocked ? (
                    <span className="tag locked">
                      {m.layer === 'followers'
                        ? `信者 ${people(m.unlock.followers)} で解禁`
                        : `累計投下 ${yen(m.unlock.spent)} で解禁`}
                    </span>
                  ) : m.mode === 'sustained' ? (
                    <button
                      className={`btn sm${on ? '' : ' primary'}`}
                      disabled={founderIssue}
                      title={founderIssue ? `教祖が${busy.label}に拘束されている` : ''}
                      onClick={() => act('TOGGLE_MISSION', m.id)}
                    >
                      {on ? '停止する' : '開始する'}
                    </button>
                  ) : timed ? (
                    <span className="tag on">残り {timed}日</span>
                  ) : (
                    <button
                      className="btn sm primary"
                      disabled={!affordable || founderIssue}
                      onClick={() => act('RUN_MISSION', m.id)}
                    >
                      実施する（{yen(cost)}）
                    </button>
                  )}
                  {on && <span className="tag on">実施中</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function MissionView({ state, act, totals: t, finance: fin }) {
  const byFollowers = MISSIONS.filter((m) => m.layer === 'followers')
  const byFunds = MISSIONS.filter((m) => m.layer === 'funds')
  // 教祖を要する施策が解禁済みなのに教祖が塞がっている場合だけ案内する
  const blocked = !isFounderFree(state) && MISSIONS.some(
    (m) => m.requiresFounder && missionUnlocked(state, m, t) && !state.activeMissions[m.id] && !state.timedMissions[m.id],
  )
  return (
    <>
      <TipCard id="mission" />
      <TipCard id="wariness" />
      <div className="hint">
        布教は二層構造になっている。<b>信者数</b>が一定を超えると人手による施策が、
        <b>累計投下額</b>が一定を超えると資金による施策が解禁される。
        現在：信者 {people(t.followers)}／累計投下 {yen(state.totalSpent)}／施策の日額 {yen(fin.missionCost)}。
      </div>
      {blocked && <FounderRelease state={state} act={act} note="教祖が自ら動く布教施策がある。" />}
      <Layer title="信者数レイヤー" note="信者が増えるほど手数が増える" list={byFollowers} state={state} act={act} totals={t} />
      <Layer title="資金レイヤー" note="金を使うほど選べる手が増える" list={byFunds} state={state} act={act} totals={t} />
    </>
  )
}
