// 信者は個体ではなく「クラスタ」として管理する。
// 定義は src/content/clusters.json（affinity は教義軸への感応度 -1〜+1）。
import TABLE from '../../content/clusters.json' with { type: 'json' }

export const CLUSTERS = Object.entries(TABLE).map(([id, c]) => ({ id, ...c }))
export const CLUSTER_MAP = Object.fromEntries(CLUSTERS.map((c) => [c.id, c]))
export const CLUSTER_IDS = CLUSTERS.map((c) => c.id)
