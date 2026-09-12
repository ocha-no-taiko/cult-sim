import React, { useState } from 'react'
import { FACILITY_TYPES, FACILITY_MAP } from '../game/data/facilities.js'
import { GRID_W, GRID_H } from '../game/engine/constants.js'
import { isFacilityActive, priestsFree, founderBusyOn } from '../game/engine/selectors.js'
import { computeCity } from '../game/engine/city.js'
import { yen, facilityLabel } from '../game/format.js'
import PriestPanel from './PriestPanel.jsx'
import CityMap from './CityMap.jsx'
import SynergyPanel from './SynergyPanel.jsx'
import SynergyRail from './SynergyRail.jsx'
import TipCard from './TipCard.jsx'

const BUSINESS_LABEL = { publishing: '出版', education: '教育', foundation: '財団', party: '政党' }
const MAP_MODE_KEY = 'cult-city-view-mode'

const EFFECT_LABEL = {
  growth: ['信者獲得', '', 1],
  donation: ['お布施', '', 1],
  faith: ['信仰度', '/日', 1],
  churn: ['離脱', '', 1],
  wariness: ['警戒度', '/日', 1],
  income: ['収入', '円/日', 0],
  incomePerPriest: ['聖職者1人収入', '円/日', 0],
  convertCap: ['転向枠', '人/日', 0],
  votePower: ['得票係数', '', 0],
}

function effectChips(effect) {
  return Object.entries(effect ?? {})
    .filter(([k, v]) => v !== 0 && EFFECT_LABEL[k])
    .map(([k, v]) => {
      const [label, unit, kind] = EFFECT_LABEL[k]
      const bad = (k === 'wariness' && v > 0) || (k === 'churn' && v > 0)
      const sign = v > 0 ? '+' : ''
      let text
      if (k === 'faith' || k === 'wariness') text = `${label} ${sign}${v.toFixed(2)}/日`
      else if (k === 'votePower') text = `${label} ${sign}${v.toFixed(2)}`
      else if (kind === 1) text = `${label} ${sign}${(v * 100).toFixed(0)}%`
      else text = `${label} ${sign}${v.toLocaleString()}${unit}`
      return <span key={k} className={`eff ${bad ? 'neg' : 'pos'}`}>{text}</span>
    })
}

const short = (s, n = 7) => (s.length > n ? `${s.slice(0, n)}…` : s)

export default function CityView({ state, act, totals: t }) {
  const [sel, setSel] = useState(null) // {x,y}
  const [showSynergy, setShowSynergy] = useState(true)
  const [hovered, setHovered] = useState(null)
  const [allSynergies, setAllSynergies] = useState(false)
  const [mapMode, setMapMode] = useState(() => {
    try { return localStorage.getItem(MAP_MODE_KEY) === 'flat' ? 'flat' : 'iso' } catch { return 'iso' }
  })

  const switchMode = (m) => {
    setMapMode(m)
    try { localStorage.setItem(MAP_MODE_KEY, m) } catch { /* 保存できなくても続行 */ }
  }
  const busy = founderBusyOn(state)
  const free = priestsFree(state)
  const city = computeCity(state)
  const fx = city.effects

  const facAt = (x, y) => state.facilities.find((f) => f.x === x && f.y === y)
  const selFac = sel ? facAt(sel.x, sel.y) : null

  const buildable = FACILITY_TYPES.filter(
    (d) => !d.alwaysActive && (!d.requires || state.businesses[d.requires]),
  )
  const lockedTypes = FACILITY_TYPES.filter((d) => !d.alwaysActive && d.requires && !state.businesses[d.requires])
  const activeCount = state.facilities.filter((f) => isFacilityActive(state, f)).length
  const emptyTiles = GRID_W * GRID_H - state.facilities.length

  return (
    <>
      <TipCard id="city" />
      <TipCard id="founder" />
      <div className="city-wrap">
        <SynergyRail
          city={city}
          hovered={hovered}
          onHover={setHovered}
          onOpenAll={() => setAllSynergies(true)}
        />

        <div className="panel">
          <div className="panel-head">
            宗教都市
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="tag">施設 {state.facilities.length}</span>
              <span className="tag on">稼働 {activeCount}</span>
              <span className="tag">空き区画 {emptyTiles}</span>
              {city.centered && <span className="tag gold">本部が中央</span>}
              <span className="seg">
                <button className={mapMode === 'iso' ? 'on' : ''} onClick={() => switchMode('iso')} title="立体で見る">
                  立体
                </button>
                <button className={mapMode === 'flat' ? 'on' : ''} onClick={() => switchMode('flat')} title="真上から見る">
                  平面
                </button>
              </span>
            </span>
          </div>
          <div className="panel-body">
            <CityMap
              state={state}
              city={city}
              selected={sel}
              showSynergy={showSynergy}
              mode={mapMode}
              highlight={hovered}
              onSelect={setSel}
              onMove={(uid, x, y) => act('MOVE_FACILITY', { uid, x, y })}
            />
            <div className="faint" style={{ fontSize: 12, marginTop: 9, lineHeight: 1.85 }}>
              区画をクリックして建設・配置。建物は<span className="warn">ドラッグで移動</span>でき、
              区画が埋まっていれば入れ替わる（教会本部も動かせる）。
              金色の破線は成立しているシナジー、本部まわりの点線は<span style={{ color: 'var(--gold)' }}>本部の威光</span>が届く8区画。
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!sel && (
            <div className="panel">
              <div className="panel-head" style={{ fontSize: 14 }}>稼働している効果の合計</div>
              <div className="panel-body">
                <div className="card-eff">{effectChips(fx)}</div>
                {Object.values(fx).every((v) => v === 0) && (
                  <div className="faint">まだ何も稼働していない。</div>
                )}
                <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>
                  遊休の聖職者 {free}人／シナジー {city.links.length + city.zoneHits.length}件
                </div>
              </div>
            </div>
          )}

          {sel && selFac && (() => {
            const def = FACILITY_MAP[selFac.type]
            const active = isFacilityActive(state, selFac)
            const founderBlocked = busy && busy.kind === 'mission'
            const label = facilityLabel(state, selFac.type, def.name)
            const myLinks = city.links.filter((l) => l.a === selFac.uid || l.b === selFac.uid)
            const myZones = city.zoneHits.filter((z) => z.uid === selFac.uid)
            return (
              <div className="panel">
                <div className="panel-head" style={{ fontSize: 14 }}>
                  {def.icon} {label}
                  <span className={`tag ${active ? 'on' : 'locked'}`}>{active ? '稼働中' : '停止中'}</span>
                </div>
                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {label !== def.name && <div className="faint" style={{ fontSize: 12 }}>{def.name}</div>}
                  <div className="card-desc">{def.desc}</div>
                  {def.tip && <div className="hint" style={{ fontSize: 12 }}>{def.tip}</div>}
                  <div className="card-eff">{effectChips(def.effect)}</div>
                  <div className="kv">
                    <span className="k">維持費</span><span className="v">{yen(def.upkeep)}/日</span>
                    {!def.alwaysActive && (
                      <>
                        <span className="k">必要聖職者</span><span className="v">{def.priests}人</span>
                      </>
                    )}
                    <span className="k">区画</span>
                    <span className="v">{selFac.x + 1}列 {selFac.y + 1}行</span>
                  </div>

                  {(myLinks.length > 0 || myZones.length > 0) && (
                    <>
                      <div className="faint" style={{ fontSize: 12, letterSpacing: '0.1em' }}>この区画で効いているシナジー</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {myZones.map((z, i) => (
                          <div key={`z${i}`} className="syn-mini">◆ {z.rule.name}</div>
                        ))}
                        {myLinks.map((l, i) => (
                          <div key={`l${i}`} className="syn-mini">◆ {l.rule.name}</div>
                        ))}
                      </div>
                    </>
                  )}

                  {!def.alwaysActive && (
                    <>
                      <div className="faint" style={{ fontSize: 12, letterSpacing: '0.1em' }}>要員の配置</div>
                      <div className="staff-opts">
                        <button
                          className={`btn sm${selFac.staff === 'founder' ? ' on' : ''}`}
                          disabled={founderBlocked && selFac.staff !== 'founder'}
                          onClick={() => act('SET_STAFF', { uid: selFac.uid, mode: 'founder' })}
                          title={founderBlocked ? `教祖は${busy.label}に出ている` : '教祖1人で稼働させる'}
                        >
                          教祖
                        </button>
                        <button
                          className={`btn sm${selFac.staff === 'priests' ? ' on' : ''}`}
                          disabled={selFac.staff !== 'priests' && free < def.priests}
                          onClick={() => act('SET_STAFF', { uid: selFac.uid, mode: 'priests' })}
                          title={`聖職者${def.priests}人が必要（遊休${free}人）`}
                        >
                          聖職者{def.priests}
                        </button>
                        <button
                          className={`btn sm${selFac.staff === 'none' ? ' on' : ''}`}
                          onClick={() => act('SET_STAFF', { uid: selFac.uid, mode: 'none' })}
                        >
                          解除
                        </button>
                      </div>
                      {selFac.staff === 'founder' && (
                        <div className="hint alert" style={{ fontSize: 12 }}>
                          教祖はこの施設に釘付けになっている。教義改定・事業設立・教祖を要する布教はできない。
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button className="btn sm ghost" style={{ flex: 1 }}
                          onClick={() => { act('DEMOLISH', selFac.uid); setSel(null) }}>
                          取り壊す（{yen(def.cost * 0.3)}回収）
                        </button>
                        <button className="btn sm ghost" onClick={() => setSel(null)}>閉じる</button>
                      </div>
                    </>
                  )}
                  {def.alwaysActive && (
                    <button className="btn sm ghost" onClick={() => setSel(null)}>閉じる</button>
                  )}
                </div>
              </div>
            )
          })()}

          {sel && !selFac && (
            <div className="panel">
              <div className="panel-head" style={{ fontSize: 14 }}>区画に建てる</div>
              <div className="panel-body">
                <div className="build-list">
                  {buildable.map((d) => {
                    const affordable = state.funds >= d.cost
                    const uniqueTaken = d.unique && state.facilities.some((f) => f.type === d.id)
                    return (
                      <button
                        key={d.id} className="build-item"
                        disabled={!affordable || uniqueTaken}
                        onClick={() => act('BUILD', { typeId: d.id, x: sel.x, y: sel.y })}
                      >
                        <span className="r1">
                          <span className="nm">{d.icon} {facilityLabel(state, d.id, d.name)}</span>
                          <span className="cost">{uniqueTaken ? '建設済み' : yen(d.cost)}</span>
                        </span>
                        <span className="ds">{d.desc}</span>
                        <span className="ds">維持 {yen(d.upkeep)}/日・聖職者{d.priests}人 または 教祖</span>
                      </button>
                    )
                  })}
                  {lockedTypes.map((d) => (
                    <div key={d.id} className="build-item" style={{ opacity: 0.42 }}>
                      <span className="r1">
                        <span className="nm">{d.icon} {d.name}</span>
                        <span className="tag locked">未解禁</span>
                      </span>
                      <span className="ds">事業「{BUSINESS_LABEL[d.requires]}」の設立が必要</span>
                    </div>
                  ))}
                </div>
                <button className="btn sm ghost" style={{ marginTop: 9, width: '100%' }} onClick={() => setSel(null)}>
                  選択を解除
                </button>
              </div>
            </div>
          )}

          <PriestPanel state={state} act={act} totals={t} compact />
        </div>
      </div>

      {allSynergies && (
        <div className="modal-bg" onClick={() => setAllSynergies(false)}>
          <div
            className="modal" style={{ maxWidth: 640, maxHeight: '84vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">配置シナジーの一覧</div>
            <div style={{ overflowY: 'auto' }}>
              <SynergyPanel city={city} showSynergy={showSynergy} onToggleShow={() => setShowSynergy((v) => !v)} embedded />
            </div>
            <div className="modal-foot">
              <button className="btn primary" onClick={() => setAllSynergies(false)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
