import React, { useState, useEffect } from 'react'
import DoctrineEditor from './DoctrineEditor.jsx'
import { AXIS_IDS } from '../game/data/doctrine.js'
import { isFounderFree, founderBusyOn } from '../game/engine/selectors.js'
import FounderRelease from './FounderRelease.jsx'
import TipCard from './TipCard.jsx'
import { yen } from '../game/format.js'

export default function DoctrineView({ state, act }) {
  const [draft, setDraft] = useState(state.doctrine)
  useEffect(() => { setDraft(state.doctrine) }, [state.doctrine])

  const delta = AXIS_IDS.reduce((s, a) => s + Math.abs(draft[a] - state.doctrine[a]), 0)
  const cost = Math.round(2_000_000 * (1 + state.doctrineRevisions * 0.5))
  const lossFrac = Math.min(0.40, (delta / 100) * 0.10)
  const free = isFounderFree(state)
  const busy = founderBusyOn(state)
  const canRevise = delta > 0 && free && state.funds >= cost

  return (
    <>
    <TipCard id="doctrine" />
    <div className="panel">
      <div className="panel-head">
        教義
        <span>
          <span className="tag">改定 {state.doctrineRevisions}回</span>{' '}
          <span className={`tag ${free ? 'on' : 'locked'}`}>教祖 {free ? '自由' : `${busy.label}に拘束`}</span>
        </span>
      </div>
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <DoctrineEditor
          value={draft}
          baseline={state.doctrine}
          regionId={state.homeRegion}
          disabled={!free}
          onChange={setDraft}
        />

        {!free && <FounderRelease state={state} act={act} note="教義の改定は教祖にしかできない。" />}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="kv" style={{ flex: '0 0 auto', minWidth: 210 }}>
            <span className="k">変更幅の合計</span><span className="v">{delta}</span>
            <span className="k">改定費用</span><span className="v">{yen(cost)}</span>
            <span className="k">見込まれる離脱</span>
            <span className="v" style={{ color: lossFrac > 0.1 ? 'var(--bad)' : undefined }}>
              信者の {(lossFrac * 100).toFixed(1)}%
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" disabled={delta === 0} onClick={() => setDraft(state.doctrine)}>
              元に戻す
            </button>
            <button className="btn primary" disabled={!canRevise} onClick={() => act('REVISE_DOCTRINE', draft)}>
              この内容で改定する
            </button>
          </div>
        </div>

        <div className="hint">
          教義は「どの層を取りに行くか」の宣言そのもの。拠点や支部の人口構成と噛み合っているほど信者は増える。
          ただし改定は既存信者の一部を必ず失う。大きく振るほど代償も大きい。
        </div>
      </div>
    </div>
    </>
  )
}
