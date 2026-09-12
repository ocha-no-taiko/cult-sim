import React, { useState } from 'react'
import { BUSINESSES, FACILITY_MAP } from '../game/data/facilities.js'
import { REGIONS } from '../game/data/regions.js'
import {
  businessAvailable, facilityEffects, isFacilityActive, voteProjection,
  convertCapacity, isFounderFree,
} from '../game/engine/selectors.js'
import { defaultBusinessNames, BUSINESS_NAME_KEY } from '../game/engine/state.js'
import { yen, people, pct } from '../game/format.js'
import PriestPanel from './PriestPanel.jsx'
import FounderRelease from './FounderRelease.jsx'
import TipCard from './TipCard.jsx'

const NAME_KEY = BUSINESS_NAME_KEY
const NAME_LABEL = {
  publishing: '出版局の名', education: '学校の名', foundation: '財団の名', party: '政党の名',
  welfare: '病院の名', arts: '文化施設の名',
  conspiracy: '工作機関の名', nightlife: '歓楽事業の名', usury: '金融会社の名',
  narcotics: '施設の名', syndicate: '盟約の名',
}

// 事業と、それが解禁する施設の対応
const BIZ_FACILITIES = {
  publishing: ['press', 'broadcast'],
  education: ['school'],
  welfare: ['hospital'],
  foundation: ['foundationOffice'],
  arts: ['cultureHall'],
  party: ['partyHQ'],
  conspiracy: ['infoRoom'],
  nightlife: ['nightOffice'],
  usury: ['usuryOffice'],
  narcotics: ['refinery'],
  syndicate: ['syndicateRoom'],
}

function countActive(state, typeId) {
  const all = state.facilities.filter((f) => f.type === typeId)
  return { total: all.length, active: all.filter((f) => isFacilityActive(state, f)).length }
}

/** 事業名を後から変更する行 */
function RenameRow({ state, act, bizId }) {
  const key = NAME_KEY[bizId]
  const [draft, setDraft] = useState(() => state.names?.[key] ?? '')
  const changed = draft.trim() && draft.trim() !== state.names[key]
  return (
    <div style={{ maxWidth: 380 }}>
      <div className="faint" style={{ fontSize: 12, letterSpacing: '0.1em', marginBottom: 5 }}>{NAME_LABEL[bizId]}</div>
      <div className="name-row">
        <input type="text" value={draft} maxLength={16} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn sm" disabled={!changed} onClick={() => act('SET_NAME', { key, value: draft })}>
          改名
        </button>
      </div>
    </div>
  )
}

function Detail({ id, state, act, totals: t }) {
  const fx = facilityEffects(state)
  const n = state.names

  if (id === 'publishing') {
    const press = countActive(state, 'press')
    const bc = countActive(state, 'broadcast')
    const income = (FACILITY_MAP.press.effect.income * press.active) + (FACILITY_MAP.broadcast.effect.income * bc.active)
    return (
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div className="kv" style={{ maxWidth: 380 }}>
          <span className="k">出版局</span><span className="v">{press.active} / {press.total} 稼働</span>
          <span className="k">放送局</span><span className="v">{bc.active} / {bc.total} 稼働</span>
          <span className="k">刊行・放送による収入</span><span className="v">{yen(income)}/日</span>
        </div>
        <RenameRow state={state} act={act} bizId={id} />
        <div className="hint">
          「{n.press}」は教団最初の収益の柱であり、同時に布教の起点でもある。
          宗教都市に出版局を建て、教祖か聖職者3人を配置すると動き出す。
          近畿のように広報適性の高い地方では、資金レイヤーの施策も併せてよく効く。
        </div>
      </div>
    )
  }

  if (id === 'education') {
    const school = countActive(state, 'school')
    return (
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div className="kv" style={{ maxWidth: 380 }}>
          <span className="k">神学校</span><span className="v">{school.active} / {school.total} 稼働</span>
          <span className="k">1日の転向枠</span><span className="v">{convertCapacity(state)}人</span>
          <span className="k">授業料・認証料</span><span className="v">{yen(fx.incomePerPriest * state.priests)}/日</span>
        </div>
        <RenameRow state={state} act={act} bizId={id} />
        <PriestPanel state={state} act={act} totals={t} />
      </div>
    )
  }

  if (id === 'foundation') {
    const off = countActive(state, 'foundationOffice')
    return (
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div className="kv" style={{ maxWidth: 380 }}>
          <span className="k">財団事務局</span><span className="v">{off.active} / {off.total} 稼働</span>
          <span className="k">警戒度への効き</span>
          <span className="v good">{(FACILITY_MAP.foundationOffice.effect.wariness * off.active).toFixed(2)}/日</span>
          <span className="k">現在の警戒度</span><span className="v">{state.wariness.toFixed(1)}</span>
        </div>
        <RenameRow state={state} act={act} bizId={id} />
        <div className="hint">
          慈善と社会貢献は、教団の顔を変える。「{n.foundation}」の事務局は教団に一つだけ置け、
          稼働している間ずっと世間の警戒を引き下げる。急拡大に踏み切る前に建てておきたい。
        </div>
      </div>
    )
  }

  if (id !== 'party') {
    const biz = BUSINESSES.find((b) => b.id === id)
    const types = BIZ_FACILITIES[id] ?? []
    const uw = types.reduce(
      (a, ty) => a + (FACILITY_MAP[ty]?.effect?.underworld ?? 0) * countActive(state, ty).active, 0,
    )
    const wr = types.reduce(
      (a, ty) => a + (FACILITY_MAP[ty]?.effect?.wariness ?? 0) * countActive(state, ty).active, 0,
    )
    const inc = types.reduce(
      (a, ty) => a + (FACILITY_MAP[ty]?.effect?.income ?? 0) * countActive(state, ty).active, 0,
    )
    return (
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div className="kv" style={{ maxWidth: 400 }}>
          {types.map((ty) => {
            const c = countActive(state, ty)
            return (
              <React.Fragment key={ty}>
                <span className="k">{FACILITY_MAP[ty]?.name ?? ty}</span>
                <span className="v">{c.active} / {c.total} 稼働</span>
              </React.Fragment>
            )
          })}
          {inc !== 0 && (<><span className="k">この事業の収入</span><span className="v">{yen(inc)}/日</span></>)}
          {wr !== 0 && (
            <><span className="k">警戒度への効き</span>
              <span className={`v ${wr < 0 ? 'good' : 'bad'}`}>{wr > 0 ? '+' : ''}{wr.toFixed(2)}/日</span></>
          )}
          {uw !== 0 && (<><span className="k">闇度への効き</span><span className="v bad">+{uw.toFixed(2)}/日</span></>)}
        </div>
        <RenameRow state={state} act={act} bizId={id} />
        <div className={`hint${biz?.shadow ? ' alert' : ''}`}>{biz?.desc}</div>
        {biz?.shadow && (
          <div className="hint alert">
            現在の闇度は <b>{state.underworld.toFixed(1)}</b>。80を超えると暗殺の危険が現実になる。
            施設の配置を解除すれば闇度は自然に下がっていく。
          </div>
        )}
      </div>
    )
  }

  const vp = voteProjection(state, t)
  const until = state.election.nextDay ? state.election.nextDay - state.day : null
  return (
    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 270 }}>
          <div className="kv">
            <span className="k">次の総選挙</span>
            <span className="v">{until != null ? `${until}日後（${state.election.nextDay}日目）` : '未定'}</span>
            <span className="k">得票率の見込み</span>
            <span className="v" style={{ color: vp.wins ? 'var(--good)' : 'var(--warn)' }}>{pct(vp.share)}</span>
            <span className="k">対抗する第一党</span><span className="v">{pct(vp.rival)}</span>
            <span className="k">得票係数</span><span className="v">×{vp.power.toFixed(2)}</span>
            <span className="k">これまでの挑戦</span><span className="v">{state.election.attempts}回</span>
          </div>
          <div style={{ marginTop: 13 }}><RenameRow state={state} act={act} bizId={id} /></div>
        </div>
        <div style={{ flex: 1, minWidth: 250 }}>
          <div className="faint" style={{ fontSize: 12, letterSpacing: '0.1em', marginBottom: 6 }}>
            地方別の得票率（信者率×得票係数）
          </div>
          <table className="tbl">
            <tbody>
              {REGIONS.map((r) => {
                const open = state.regions[r.id].unlocked
                return (
                  <tr key={r.id} className={open ? '' : 'dim'}>
                    <td>{r.name}</td>
                    <td style={{ width: 90 }}>
                      <span className="bar"><i style={{ width: `${Math.min(100, vp.byRegion[r.id] * 200)}%` }} /></span>
                    </td>
                    <td style={{ width: 58 }}>{open ? pct(vp.byRegion[r.id]) : '未展開'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className={`hint${vp.wins ? '' : ' alert'}`}>
        {vp.wins
          ? `現状の見込みなら「${n.party}」は第一与党を取れる。選挙日まで信者と信仰度を落とさないこと。`
          : '第一党に届いていない。信者を増やすか、党本部と政界工作で得票係数を押し上げる必要がある。'}
        {state.election.lastResult && !state.election.lastResult.won && (
          <> 前回（{state.election.lastResult.day}日目）は{pct(state.election.lastResult.share)}で敗れている。</>
        )}
      </div>
    </div>
  )
}

/** 設立時に名前をつけるダイアログ */
function NamingDialog({ biz, state, onCancel, onConfirm }) {
  const key = NAME_KEY[biz.id]
  const [name, setName] = useState(
    () => state.names?.[key] || defaultBusinessNames(state.names?.order)[key] || biz.name,
  )
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">{biz.icon} {biz.name}の設立</div>
        <div className="modal-body" style={{ fontFamily: 'var(--gothic)' }}>
          <div className="card-desc" style={{ marginBottom: 14 }}>{biz.desc}</div>
          <div className="faint" style={{ fontSize: 12, letterSpacing: '0.1em', marginBottom: 6 }}>{NAME_LABEL[biz.id]}</div>
          <input
            type="text" value={name} maxLength={16} autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim()) }}
          />
          <div className="kv" style={{ marginTop: 16 }}>
            <span className="k">設立費用</span><span className="v">{yen(biz.cost)}</span>
            <span className="k">設立後の運転資金</span><span className="v">{yen(state.funds - biz.cost)}</span>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onCancel}>やめる</button>
          <button className="btn primary" disabled={!name.trim()} onClick={() => onConfirm(name.trim())}>
            この名で設立する
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BusinessView({ state, act, totals: t }) {
  const founded = BUSINESSES.filter((b) => state.businesses[b.id])
  const openBiz = BUSINESSES.filter((b) => !b.shadow)
  const shadowBiz = BUSINESSES.filter((b) => b.shadow)
  const shadowKnown = shadowBiz.some((b) => state.businesses[b.id])
    || t.followers >= Math.min(...shadowBiz.map((b) => b.unlock.followers))
  const [tab, setTab] = useState(null)
  const [naming, setNaming] = useState(null)
  const activeTab = state.businesses[tab] ? tab : (founded[founded.length - 1]?.id ?? null)

  // 教祖の拘束だけが設立を阻んでいる事業があるか
  const blockedByFounder = !isFounderFree(state) && BUSINESSES.some((b) => {
    if (state.businesses[b.id]) return false
    if (b.unlock.business && !state.businesses[b.unlock.business]) return false
    return t.followers >= b.unlock.followers && state.funds >= b.cost
  })

  return (
    <>
      <TipCard id="business" />
      <TipCard id="priest" />
      {shadowKnown && <TipCard id="shadow" />}
      <TipCard id="endings" />
      <div className="hint">
        事業は<b>出版 → 教育 → 財団 → 政党</b>の順に解禁されていく。設立できるのは教祖だけなので、
        施設に教祖を置いている間は手をつけられない。設立時に事業ごとの名前を決められる。
      </div>

      {blockedByFounder && (
        <FounderRelease state={state} act={act} note="設立できる事業があるが、事業の設立は教祖にしかできない。" />
      )}

      <div className="panel">
        <div className="panel-head">
          表の事業
          <span className="faint" style={{ fontSize: 12 }}>
            設立済み {founded.length} / {BUSINESSES.length}
          </span>
        </div>
        <div className="panel-body">
          <div className="cards">
            {openBiz.map((b) => {
              const done = state.businesses[b.id]
              const chk = businessAvailable(state, b.id)
              const name = state.names[NAME_KEY[b.id]]
              return (
                <div key={b.id} className={`card${done ? ' active' : ''}`}>
                  <div className="card-head">
                    <span className="card-name">{b.icon} {done && name ? name : b.name}</span>
                    {done ? <span className="tag on">設立済み</span> : <span className="tag gold">{yen(b.cost)}</span>}
                  </div>
                  {done && name && <div className="faint" style={{ fontSize: 12 }}>{b.name}</div>}
                  <div className="card-desc">{b.desc}</div>
                  <div className="faint" style={{ fontSize: 12 }}>
                    解禁条件：信者 {people(b.unlock.followers)}
                    {b.unlock.business ? ` ／ ${BUSINESSES.find((x) => x.id === b.unlock.business).name}の設立` : ''}
                  </div>
                  <div className="card-foot">
                    {done ? (
                      <button className="btn sm" onClick={() => setTab(b.id)}>管理する</button>
                    ) : (
                      <button className="btn sm primary" disabled={!chk.ok} onClick={() => setNaming(b)}>
                        設立する
                      </button>
                    )}
                    {!done && !chk.ok && <span className="tag locked">{chk.reason}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {shadowKnown && (
        <div className="panel shadow-panel">
          <div className="panel-head">
            裏の事業
            <span className="faint" style={{ fontSize: 12 }}>金は入る。教団は濁る。</span>
          </div>
          <div className="panel-body">
            <div className="hint alert" style={{ marginBottom: 11 }}>
              裏の事業は<b>闇度</b>を押し上げる。80を超えると教祖が暗殺される危険が現実になり、
              信仰も濁って離脱が増える。一方で収入の桁は表の事業と比べものにならない。
              一度も手を出さずに国教化まで行くこともできる。
            </div>
            <div className="cards">
              {shadowBiz.map((b) => {
                const done = state.businesses[b.id]
                const chk = businessAvailable(state, b.id)
                const name = state.names[NAME_KEY[b.id]]
                return (
                  <div key={b.id} className={`card shadow${done ? ' active' : ''}`}>
                    <div className="card-head">
                      <span className="card-name">{b.icon} {done && name ? name : b.name}</span>
                      {done ? <span className="tag on">設立済み</span> : <span className="tag gold">{yen(b.cost)}</span>}
                    </div>
                    {done && name && <div className="faint" style={{ fontSize: 12 }}>{b.name}</div>}
                    <div className="card-desc">{b.desc}</div>
                    <div className="faint" style={{ fontSize: 12 }}>
                      解禁条件：信者 {people(b.unlock.followers)}
                      {b.unlock.business ? ` ／ ${BUSINESSES.find((x) => x.id === b.unlock.business).name}の設立` : ''}
                    </div>
                    <div className="card-foot">
                      {done ? (
                        <button className="btn sm" onClick={() => setTab(b.id)}>管理する</button>
                      ) : (
                        <button className="btn sm primary" disabled={!chk.ok} onClick={() => setNaming(b)}>
                          手を染める
                        </button>
                      )}
                      {!done && !chk.ok && <span className="tag locked">{chk.reason}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab && (
        <div className="panel">
          <div className="panel-head" style={{ padding: 0, borderBottom: '1px solid var(--line-soft)' }}>
            <div style={{ display: 'flex' }}>
              {founded.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setTab(b.id)}
                  style={{
                    padding: '10px 17px',
                    fontFamily: 'var(--mincho)',
                    letterSpacing: '0.08em',
                    color: activeTab === b.id ? 'var(--ink)' : 'var(--ink-dim)',
                    borderBottom: `2px solid ${activeTab === b.id ? 'var(--accent)' : 'transparent'}`,
                  }}
                >
                  {b.icon} {state.names[NAME_KEY[b.id]] || b.name}
                </button>
              ))}
            </div>
          </div>
          <Detail id={activeTab} state={state} act={act} totals={t} />
        </div>
      )}

      {naming && (
        <NamingDialog
          biz={naming}
          state={state}
          onCancel={() => setNaming(null)}
          onConfirm={(name) => {
            act('FOUND_BUSINESS', { id: naming.id, name })
            setTab(naming.id)
            setNaming(null)
          }}
        />
      )}
    </>
  )
}
