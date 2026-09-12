import React from 'react'
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { CLUSTERS } from '../game/data/clusters.js'
import { yen, people, pct } from '../game/format.js'
import TipCard from './TipCard.jsx'

const axis = { stroke: '#4a5060', fontSize: 11.5 }
const xAxis = { dataKey: 'day', interval: 'preserveStartEnd', minTickGap: 46, ...axis }
const tooltipStyle = {
  contentStyle: { background: '#181b22', border: '1px solid #2b303b', borderRadius: 3, fontSize: 13 },
  labelStyle: { color: '#a5a09a' },
}

function compact(n) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}億`
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}万`
  return String(Math.round(n))
}

export default function StatsView({ state, totals: t, finance: fin }) {
  const h = state.history
  // 長期プレイでも描画が重くならないよう間引く
  const step = Math.max(1, Math.ceil(h.length / 400))
  const data = h.filter((_, i) => i % step === 0 || i === h.length - 1)

  const clusterData = CLUSTERS.map((c) => ({
    name: c.short,
    信者: Math.round(t.byCluster[c.id] ?? 0),
    color: c.color,
  }))

  return (
    <>
      <TipCard id="stats" />
      <div className="panel">
        <div className="panel-head">収支の内訳<span className="faint" style={{ fontSize: 12 }}>1日あたり</span></div>
        <div className="panel-body" style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
          <div className="kv" style={{ minWidth: 220 }}>
            <span className="k">お布施</span><span className="v good">{yen(fin.donations)}</span>
            <span className="k">施設収益</span><span className="v good">{yen(fin.facilityIncome)}</span>
            <span className="k" style={{ paddingTop: 6 }}>収入計</span>
            <span className="v" style={{ paddingTop: 6 }}>{yen(fin.income)}</span>
          </div>
          <div className="kv" style={{ minWidth: 220 }}>
            <span className="k">施設維持費</span><span className="v bad">-{yen(fin.upkeep)}</span>
            <span className="k">聖職者の維持</span><span className="v bad">-{yen(fin.priestUpkeep)}</span>
            <span className="k">布教施策</span><span className="v bad">-{yen(fin.missionCost)}</span>
            <span className="k">教団運営費</span><span className="v bad">-{yen(fin.admin)}</span>
            <span className="k" style={{ paddingTop: 6 }}>支出計</span>
            <span className="v" style={{ paddingTop: 6 }}>{yen(fin.expense)}</span>
          </div>
          <div className="kv" style={{ minWidth: 200 }}>
            <span className="k">運営収支</span>
            <span className={`v ${fin.net >= 0 ? 'good' : 'bad'}`} style={{ fontSize: 17 }}>{yen(fin.net)}</span>
            <span className="k">累計投下額</span><span className="v">{yen(state.totalSpent)}</span>
            <span className="k">最大信者数</span><span className="v">{people(state.stats.peakFollowers)}</span>
            <span className="k">遭遇した出来事</span><span className="v">{state.stats.eventsSeen}回</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">信者数と聖職者</div>
        <div className="panel-body chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c8452f" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#c8452f" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#232833" vertical={false} />
              <XAxis {...xAxis} />
              <YAxis yAxisId="f" {...axis} tickFormatter={compact} width={48} />
              <YAxis yAxisId="p" orientation="right" {...axis} width={34} />
              <Tooltip
                {...tooltipStyle}
                formatter={(v, n) => [n === '信者数' ? people(v) : `${v}人`, n]}
                labelFormatter={(d) => `${d}日目`}
              />
              <Area yAxisId="f" type="monotone" dataKey="followers" name="信者数" stroke="#e2705a" fill="url(#gF)" strokeWidth={1.6} dot={false} />
              <Line yAxisId="p" type="monotone" dataKey="priests" name="聖職者" stroke="#c9a227" strokeWidth={1.4} dot={false} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">資金と収支</div>
        <div className="panel-body chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#232833" vertical={false} />
              <XAxis {...xAxis} />
              <YAxis yAxisId="a" {...axis} tickFormatter={compact} width={48} />
              <YAxis yAxisId="b" orientation="right" {...axis} tickFormatter={compact} width={48} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [yen(v), n]} labelFormatter={(d) => `${d}日目`} />
              <Line yAxisId="a" type="monotone" dataKey="funds" name="運転資金" stroke="#6cc08a" strokeWidth={1.6} dot={false} />
              <Line yAxisId="b" type="monotone" dataKey="net" name="運営収支/日" stroke="#c9a227" strokeWidth={1.2} dot={false} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">警戒度・信仰度・得票率</div>
        <div className="panel-body chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#232833" vertical={false} />
              <XAxis {...xAxis} />
              <YAxis {...axis} domain={[0, 100]} width={32} />
              <Tooltip {...tooltipStyle} labelFormatter={(d) => `${d}日目`} />
              <Line type="monotone" dataKey="wariness" name="警戒度" stroke="#e05a4a" strokeWidth={1.6} dot={false} />
              <Line type="monotone" dataKey="faith" name="平均信仰度" stroke="#5eb8ff" strokeWidth={1.4} dot={false} />
              <Line type="monotone" dataKey="share" name="得票率(%)" stroke="#c9a227" strokeWidth={1.4} dot={false} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">クラスタ別の信者構成</div>
        <div className="panel-body">
          <table className="tbl">
            <thead><tr><th>層</th><th>信者数</th><th>構成比</th><th></th><th>性格</th></tr></thead>
            <tbody>
              {clusterData.map((c) => {
                const share = t.followers > 0 ? c.信者 / t.followers : 0
                const def = CLUSTERS.find((x) => x.short === c.name)
                return (
                  <tr key={c.name}>
                    <td style={{ color: c.color }}>{def.name}</td>
                    <td>{people(c.信者)}</td>
                    <td>{pct(share)}</td>
                    <td style={{ width: 110 }}>
                      <span className="bar"><i style={{ width: `${share * 100}%`, background: c.color }} /></span>
                    </td>
                    <td style={{ textAlign: 'left', color: 'var(--ink-faint)', fontSize: 12 }}>{def.note}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
