import React, { useState } from 'react'
import QUESTS from '../content/quests.json' with { type: 'json' }
import ENDINGS from '../content/endings.json' with { type: 'json' }
import { REGIONS } from '../game/data/regions.js'
import { BUSINESSES } from '../game/data/facilities.js'
import { isFacilityActive, totals } from '../game/engine/selectors.js'
import { yen, people, pct } from '../game/format.js'
import { portfolioValue } from '../game/engine/invest.js'

const has = (s, type) => s.facilities.some((f) => f.type === type)
const running = (s, type) => s.facilities.some((f) => f.type === type && isFacilityActive(s, f))

// 進行の判定。文言は content/quests.json 側にある。
const CHECKS = {
  buildPost: (s) => has(s, 'missionPost'),
  activatePost: (s) => s.facilities.some((f) => f.type !== 'hq' && isFacilityActive(s, f)),
  publishing: (s) => s.businesses.publishing,
  runPress: (s) => running(s, 'press'),
  education: (s) => s.businesses.education,
  buildSchool: (s) => has(s, 'school'),
  founderSchool: (s) => running(s, 'school') || s.priests > 0,
  firstPriests: (s) => s.priests >= 4,
  freeFounder: (s) => s.facilities.some((f) => f.type === 'school' && f.staff === 'priests'),
  branch: (s) => REGIONS.some((r) => !s.regions[r.id].isHome && s.regions[r.id].unlocked),
  foundation: (s) => running(s, 'foundationOffice'),
  party: (s) => s.businesses.party,
  win: (s) => !!s.achieved?.firstParty,
}

const ORDER = Object.keys(QUESTS)

/** 未達成の決着への距離 */
function endingProgress(state, t) {
  const rows = []
  const cg = ENDINGS.conglomerate
  const founded = BUSINESSES.filter((b) => state.businesses[b.id]).length
  const wealth = state.funds + portfolioValue(state.investments)
  rows.push({
    id: 'conglomerate',
    label: ENDINGS.conglomerate.title,
    value: `事業 ${founded}/${BUSINESSES.length}・総資産 ${yen(wealth)} / ${yen(cg.requireFunds)}`,
    ratio: Math.min(1, (founded / BUSINESSES.length) * 0.5 + Math.min(1, wealth / cg.requireFunds) * 0.5),
  })
  rows.push({
    id: 'congregation',
    label: ENDINGS.congregation.title,
    value: `全人口の ${pct(t.nationalShare, 2)} / ${pct(ENDINGS.congregation.requireShare, 0)}`,
    ratio: Math.min(1, t.nationalShare / ENDINGS.congregation.requireShare),
  })
  const up = ENDINGS.uprising
  rows.push({
    id: 'uprising',
    label: ENDINGS.uprising.title,
    value: state.businesses.syndicate
      ? `闇度 ${state.underworld.toFixed(0)}/${up.requireUnderworld}・信者 ${people(t.followers)} / ${people(up.requireFollowers)}`
      : '暴力団との盟約が必要',
    ratio: state.businesses.syndicate
      ? Math.min(1, (state.underworld / up.requireUnderworld) * 0.5 + Math.min(1, t.followers / up.requireFollowers) * 0.5)
      : 0,
  })
  return rows
}

export default function QuestPanel({ state, totals: t }) {
  const [showDone, setShowDone] = useState(false)
  const done = ORDER.filter((id) => CHECKS[id](state))
  const doneSet = new Set(done)
  const current = ORDER.find((id) => !doneSet.has(id))
  const allDone = !current

  if (allDone) {
    const rows = endingProgress(state, t)
    return (
      <div className="panel">
        <div className="panel-head">
          決着への道
          <span className="tag gold">達成 {Object.keys(state.achieved ?? {}).length}</span>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {Object.keys(state.achieved ?? {}).map((k) => (
            <div key={k} className="quest-row done">
              <span className="q-mark">✓</span>
              <span><b>{ENDINGS[k]?.title ?? k}</b>（{state.achieved[k]}日目）</span>
            </div>
          ))}
          {rows.filter((r) => !state.achieved?.[r.id]).map((r) => (
            <div key={r.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="mincho" style={{ fontSize: 14 }}>{r.label}</span>
                <span className="faint num" style={{ fontSize: 12 }}>{(r.ratio * 100).toFixed(0)}%</span>
              </div>
              <span className="bar" style={{ display: 'block', margin: '4px 0 3px' }}>
                <i style={{ width: `${r.ratio * 100}%`, background: 'var(--gold)' }} />
              </span>
              <div className="faint" style={{ fontSize: 11.5 }}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const idx = ORDER.indexOf(current)
  const upcoming = ORDER.slice(idx + 1, idx + 3)

  return (
    <div className="panel">
      <div className="panel-head">
        導きの書
        <span className="tag">{done.length} / {ORDER.length}</span>
      </div>
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setShowDone((v) => !v)}>
          {showDone ? '済んだ手順を隠す' : `済んだ手順を見る（${done.length}）`}
        </button>
        {showDone && done.map((id) => (
          <div key={id} className="quest-row done">
            <span className="q-mark">✓</span>
            <span>{QUESTS[id].title}</span>
          </div>
        ))}

        <div className="quest-row current">
          <span className="q-mark">▶</span>
          <div>
            <div className="q-title">{QUESTS[current].title}</div>
            <div className="q-detail">{QUESTS[current].detail}</div>
          </div>
        </div>

        {upcoming.map((id) => (
          <div key={id} className="quest-row next">
            <span className="q-mark">・</span>
            <span>{QUESTS[id].title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
