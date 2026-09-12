import React from 'react'
import DoctrineEditor from './DoctrineEditor.jsx'
import { REGION_MAP } from '../game/data/regions.js'
import { yen, orderName } from '../game/format.js'

export default function FoundingScreen({ state, act, onBack }) {
  const region = REGION_MAP[state.homeRegion]
  return (
    <div className="screen" style={{ justifyContent: 'flex-start', paddingTop: 40 }}>
      <div className="screen-inner" style={{ maxWidth: 980 }}>
        <h1 className="title-mark" style={{ fontSize: 40 }}>教義の設計</h1>
        <p className="title-lead" style={{ margin: '16px auto 26px' }}>
          {region.name}に「{orderName(state)}」の小さな教会を借りた。<br />
          信者は20人、手元の資金は{yen(state.funds)}。何を説くかを、いま決めなければならない。
        </p>

        <div className="panel">
          <div className="panel-head">四つの軸</div>
          <div className="panel-body">
            <DoctrineEditor
              value={state.doctrine}
              regionId={state.homeRegion}
              onChange={(d) => act('SET_DOCTRINE_DRAFT', d)}
            />
          </div>
        </div>

        <div className="hint" style={{ marginTop: 12 }}>
          開教後も教義は改定できるが、改定には費用がかかり、変更幅に応じて既存の信者が離脱する。
          最初の設計は、拠点地方の人口構成に合わせておくのが無難。
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 26 }}>
          <button className="btn ghost" onClick={onBack}>拠点を選び直す</button>
          <button className="btn primary" style={{ padding: '9px 34px' }} onClick={() => act('BEGIN_PREACHING')}>
            この教義で開教する
          </button>
        </div>
      </div>
    </div>
  )
}
