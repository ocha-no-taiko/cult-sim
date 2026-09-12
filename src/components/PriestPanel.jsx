import React, { useState } from 'react'
import {
  convertCapacity, priestCost, priestsFree,
  isFacilityActive, isFounderFree,
} from '../game/engine/selectors.js'
import { yen } from '../game/format.js'
import { CLUSTERS } from '../game/data/clusters.js'
import FounderRelease from './FounderRelease.jsx'

/** 信者→聖職者の転換パネル。稼働中の神学校がないと使えない。 */
export default function PriestPanel({ state, act, totals: t, compact = false }) {
  const cap = convertCapacity(state)
  const left = Math.max(0, cap - state.convertedToday)
  const unit = priestCost(state)
  const [n, setN] = useState(1)
  const want = Math.max(1, Math.min(n, left || 1))
  const cost = want * unit

  const schools = state.facilities.filter((f) => f.type === 'school')
  const idleSchool = schools.find((f) => !isFacilityActive(state, f))
  const schoolName = state.names?.school || '神学校'

  // 転向で失われる1日あたりのお布施の概算
  const aptWeighted = CLUSTERS.reduce((s, c) => s + (t.byCluster[c.id] ?? 0) * c.priestAptitude, 0)
  const avgDonation = aptWeighted > 0
    ? CLUSTERS.reduce((s, c) => s + (t.byCluster[c.id] ?? 0) * c.donation * c.priestAptitude, 0) / aptWeighted
    : 0

  const canConvert = left > 0 && state.funds >= cost && t.followers > want * 2

  return (
    <div className="panel">
      <div className="panel-head">
        聖職者の育成
        <span className="tag">{state.priests}人 ／ 遊休 {priestsFree(state)}</span>
      </div>
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cap === 0 ? (
          <>
            {!state.businesses.education ? (
              <>
                <div className="faint" style={{ lineHeight: 1.9 }}>
                  信者を聖職者にするには、まず<b>教育事業</b>を設立し、宗教都市に神学校を建てる必要がある。
                  解禁は信者8,000人から。事業タブで設立できる。
                </div>
                {!isFounderFree(state) && (
                  <FounderRelease state={state} act={act} note="教育事業の設立は教祖にしかできない。" />
                )}
              </>
            ) : schools.length === 0 ? (
              <div className="faint" style={{ lineHeight: 1.9 }}>
                教育事業は設立済み。宗教都市の空き区画に<b>神学校</b>を建てると、ここから転向させられるようになる。
              </div>
            ) : (
              <>
                <div className="faint" style={{ lineHeight: 1.9 }}>
                  {schoolName}が止まっている。<span className="warn">最初の聖職者は、教祖が自ら神学校に入って育てるほかない。</span>
                  聖職者が{state.facilities.find((f) => f.type === 'school') ? 4 : 4}人そろえば、教祖は別の仕事に戻れる。
                </div>
                {idleSchool && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className="btn primary sm"
                      onClick={() => act('SET_STAFF', { uid: idleSchool.uid, mode: 'founder' })}
                    >
                      教祖を{schoolName}に入れる
                    </button>
                    {priestsFree(state) >= 4 && (
                      <button className="btn sm" onClick={() => act('SET_STAFF', { uid: idleSchool.uid, mode: 'priests' })}>
                        聖職者4人を配置する
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className="kv">
              <span className="k">本日の転向枠</span><span className="v">{left} / {cap}人</span>
              <span className="k">1人あたり育成費</span><span className="v">{yen(unit)}</span>
              <span className="k">失うお布施（概算）</span><span className="v">{yen(avgDonation * want)}/日</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="range" min="1" max={Math.max(1, left)} value={want}
                onChange={(e) => setN(Number(e.target.value))}
                style={{ flex: 1 }} disabled={left === 0}
              />
              <span className="num" style={{ width: 44, textAlign: 'right' }}>{want}人</span>
            </div>
            <button className="btn primary" disabled={!canConvert} onClick={() => act('CONVERT_PRIESTS', want)}>
              {yen(cost)}で{want}人を転向させる
            </button>
            {left === 0 && <div className="faint" style={{ fontSize: 12 }}>本日の転向枠は使い切った。翌日また転向できる。</div>}
            {!compact && (
              <div className="faint" style={{ fontSize: 12, lineHeight: 1.85 }}>
                転向した分だけ信者は減り、お布施も減る。施設を回す手と、日々の実入り。
                どちらを取るかは毎日の判断になる。
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
