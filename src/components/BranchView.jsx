import React from 'react'
import { REGIONS } from '../game/data/regions.js'
import { CLUSTERS } from '../game/data/clusters.js'
import { clusterAppeal } from '../game/data/doctrine.js'
import { voteProjection, priestsFree } from '../game/engine/selectors.js'
import { BRANCH_MIN_FOLLOWERS } from '../game/engine/constants.js'
import { yen, people, pct } from '../game/format.js'
import TipCard from './TipCard.jsx'

export default function BranchView({ state, act, totals: t }) {
  const vp = voteProjection(state, t)
  const openCount = REGIONS.filter((r) => state.regions[r.id].unlocked).length
  const free = priestsFree(state)

  return (
    <>
      <TipCard id="branch" />
      <div className="hint">
        支部を置いた地方でも信者が増え、お布施が入り、そして<b>その地方の信者率がそのまま得票率に乗る</b>。
        ただし支部は開設直後こそ弱く、根を張るまでに時間がかかる。
        開設には信者 {people(BRANCH_MIN_FOLLOWERS)} 以上と、<b>置いてくる聖職者</b>が要る。
        送り出した聖職者は本部には戻らないので、拡大のたびに手が減る。
        現在 {openCount}/7 地方に展開中。遊休の聖職者は {free}人。
      </div>

      <div className="panel">
        <div className="panel-head">地方の展開状況</div>
        <div className="panel-body scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>地方</th><th>人口</th><th>信者</th><th>信者率</th><th>得票率</th>
                <th>平均信仰度</th><th>最も刺さる層</th><th>警戒</th><th>口コミ</th><th>広報</th>
                <th>派遣</th><th></th>
              </tr>
            </thead>
            <tbody>
              {REGIONS.map((r) => {
                const rs = state.regions[r.id]
                const rt = t.byRegion[r.id]
                // その地方で教義が最も刺さる層（人口比ではなく親和度で見る）
                const best = CLUSTERS
                  .map((c) => ({ c, a: clusterAppeal(c, state.doctrine, r.bias) }))
                  .sort((a, b) => b.a - a.a)[0]
                const need = r.branchPriests ?? 0
                const canOpen = t.followers >= BRANCH_MIN_FOLLOWERS
                  && state.funds >= r.branchCost && free >= need
                return (
                  <tr key={r.id} className={rs.unlocked ? '' : 'dim'}>
                    <td>
                      {r.name}
                      {rs.isHome && <span className="tag gold" style={{ marginLeft: 6 }}>拠点</span>}
                    </td>
                    <td>{people(r.population)}</td>
                    <td>{rs.unlocked ? people(rt.followers) : '—'}</td>
                    <td>{rs.unlocked ? pct(rt.share, 2) : '—'}</td>
                    <td style={{ color: rs.unlocked ? 'var(--gold)' : undefined }}>
                      {rs.unlocked ? pct(vp.byRegion[r.id]) : '—'}
                    </td>
                    <td>{rs.unlocked ? rt.faith.toFixed(0) : '—'}</td>
                    <td style={{ color: best.c.color }}>{best.c.short}<span className="faint" style={{ fontSize: 11.5, marginLeft: 4 }}>×{best.a.toFixed(2)}</span></td>
                    <td>×{r.mods.wariness.toFixed(2)}</td>
                    <td>×{r.mods.word.toFixed(2)}</td>
                    <td>×{r.mods.media.toFixed(2)}</td>
                    <td style={{ color: !rs.unlocked && free < need ? 'var(--bad)' : undefined }}>
                      {rs.unlocked ? '—' : `${need}人`}
                    </td>
                    <td>
                      {rs.unlocked ? (
                        <span className="tag on">{rs.isHome ? '本拠' : `${state.day - rs.openedDay}日目`}</span>
                      ) : (
                        <button
                          className="btn sm primary" disabled={!canOpen}
                          onClick={() => act('OPEN_BRANCH', r.id)}
                          title={free < need ? `遊休の聖職者が${need - free}人足りない` : ''}
                        >
                          {free < need ? `聖職者${need}人が要る` : `${yen(r.branchCost)}で開設`}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">地方の性格</div>
        <div className="panel-body">
          <div className="cards">
            {REGIONS.map((r) => (
              <div key={r.id} className={`card${state.regions[r.id].unlocked ? ' active' : ''}`}>
                <div className="card-head">
                  <span className="card-name">{r.name}</span>
                  <span className="tag">{people(r.population)}</span>
                </div>
                <div className="card-desc">{r.blurb}</div>
                <div className="card-eff">
                  {Object.entries(r.bias).filter(([, v]) => v !== 0).map(([k, v]) => (
                    <span key={k} className={`eff ${v > 0 ? 'pos' : 'neg'}`}>
                      {{ asceticism: '禁欲', apocalypse: '終末', worldly: '現世利益', hierarchy: '階層' }[k]}
                      {v > 0 ? '+' : ''}{v.toFixed(2)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
