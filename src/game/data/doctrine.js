// 教義軸。すべて 0〜100、初期値50。軸の名前と説明は src/content/doctrine.json。
import TABLE from '../../content/doctrine.json' with { type: 'json' }

export const DOCTRINE_AXES = Object.entries(TABLE).map(([id, a]) => ({ id, ...a }))

export const AXIS_IDS = DOCTRINE_AXES.map((a) => a.id)

export const DEFAULT_DOCTRINE = { asceticism: 50, apocalypse: 50, worldly: 50, hierarchy: 50 }

// 軸の値を -1〜+1 に正規化
export const norm = (v) => (v - 50) / 50

// 教義そのものが教団全体に与える効果
export function doctrineGlobalEffects(doctrine) {
  const a = norm(doctrine.asceticism)
  const p = norm(doctrine.apocalypse)
  const w = norm(doctrine.worldly)
  const h = norm(doctrine.hierarchy)
  return {
    donationMult: 1 + a * 0.45 + w * 0.35,
    growthMult: 1 + p * 0.40 + w * 0.10,
    churnMult: 1 + a * 0.50 + p * 0.30 - h * 0.35,
    warinessAdd: a * 0.11 + p * 0.26 - w * 0.08 + h * 0.09,
    priestMult: 1 + h * 0.55 + a * 0.20,
    faithMult: 1 + h * 0.25 + a * 0.15,
  }
}

// クラスタごとの教義親和度。1.0が中庸。0.05〜3.0にクランプ。
export function clusterAppeal(cluster, doctrine, regionBias) {
  let s = 0
  for (const axis of AXIS_IDS) {
    const aff = (cluster.affinity[axis] ?? 0) + (regionBias?.[axis] ?? 0)
    s += aff * norm(doctrine[axis])
  }
  return Math.max(0.05, Math.min(3.0, 1 + s * 0.55))
}
