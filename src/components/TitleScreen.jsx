import React, { useState } from 'react'
import { REGIONS } from '../game/data/regions.js'
import { CLUSTER_MAP } from '../game/data/clusters.js'
import { DIFFICULTIES } from '../game/engine/constants.js'
import { DEFAULT_ORDER_NAME } from '../game/engine/state.js'
import { yen, people } from '../game/format.js'

export default function TitleScreen({ hasSave, onStart, onContinue, onImport, fileInput }) {
  const [difficulty, setDifficulty] = useState('normal')
  const [order, setOrder] = useState(DEFAULT_ORDER_NAME)
  const [region, setRegion] = useState('kanto')
  const sel = REGIONS.find((r) => r.id === region)

  // その地方で最も厚いクラスタを3つ
  const topClusters = Object.entries(sel.demographics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return (
    <div className="screen">
      <div className="screen-inner">
        <h1 className="title-mark">C U L T</h1>
        <div className="title-sub">Congregation Under Local Tycoon</div>
        <p className="title-lead">
          あなたは、まだ名もない教えの創始者である。<br />
          教義を定め、人を集め、事業を興し、都市を築き、<br />
          やがてこの国の第一与党となることを目指す。
        </p>

        <div className="section-label">教団の名</div>
        <div style={{ maxWidth: 380, margin: '0 auto' }}>
          <input
            type="text" value={order} maxLength={16} placeholder="例：天啓会"
            onChange={(e) => setOrder(e.target.value)}
            style={{ textAlign: 'center', fontSize: 19 }}
          />
          <div className="faint" style={{ fontSize: 12, textAlign: 'center', marginTop: 6 }}>
            出版・学校・財団・政党の名は、この名から自動で案が作られる（後から変更できる）。
          </div>
        </div>

        <div className="section-label">拠点とする地方</div>
        <div className="choice-grid c4">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              className={`choice${region === r.id ? ' sel' : ''}`}
              onClick={() => setRegion(r.id)}
            >
              <div className="choice-title">{r.name}</div>
              <div className="choice-meta">人口 {people(r.population)}</div>
            </button>
          ))}
        </div>

        <div className="panel" style={{ marginTop: 10 }}>
          <div className="panel-body" style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 330px', minWidth: 260 }}>
              <div className="choice-title">{sel.name}</div>
              <div className="choice-desc">{sel.blurb}</div>
            </div>
            <div style={{ flex: '0 0 auto' }}>
              <div className="faint" style={{ fontSize: 12, letterSpacing: '0.1em' }}>人口構成（上位）</div>
              {topClusters.map(([cid, w]) => (
                <div key={cid} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ width: 112, color: CLUSTER_MAP[cid].color, fontSize: 13, whiteSpace: 'nowrap' }}>
                    {CLUSTER_MAP[cid].name}
                  </span>
                  <span className="bar" style={{ width: 84 }}>
                    <i style={{ width: `${w * 250}%`, background: CLUSTER_MAP[cid].color }} />
                  </span>
                  <span className="num faint" style={{ fontSize: 12 }}>{Math.round(w * 100)}%</span>
                </div>
              ))}
            </div>
            <div style={{ flex: '0 0 auto' }}>
              <div className="faint" style={{ fontSize: 12, letterSpacing: '0.1em' }}>地方特性</div>
              <div className="kv" style={{ marginTop: 4, minWidth: 168 }}>
                <span className="k">警戒されやすさ</span><span className="v">×{sel.mods.wariness.toFixed(2)}</span>
                <span className="k">信仰の定着</span><span className="v">×{sel.mods.faith.toFixed(2)}</span>
                <span className="k">口コミの効き</span><span className="v">×{sel.mods.word.toFixed(2)}</span>
                <span className="k">広報の効き</span><span className="v">×{sel.mods.media.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="section-label">難易度</div>
        <div className="choice-grid c3">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              className={`choice${difficulty === d.id ? ' sel' : ''}`}
              onClick={() => setDifficulty(d.id)}
            >
              <div className="choice-title">{d.name}</div>
              <div className="choice-meta">初期資金 {yen(d.funds)}</div>
              <div className="choice-desc">{d.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 30, flexWrap: 'wrap' }}>
          <button className="btn primary" style={{ padding: '9px 34px' }}
            disabled={!order.trim()}
            onClick={() => onStart({ difficulty, homeRegionId: region, orderName: order.trim() })}>
            開教の準備に入る
          </button>
          <button className="btn" disabled={!hasSave} onClick={onContinue}>続きから</button>
          <button className="btn ghost" onClick={onImport}>セーブを読み込む</button>
        </div>
        {fileInput}
      </div>
    </div>
  )
}
