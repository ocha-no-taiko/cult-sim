// 地方データ。数値・文言ともに src/content/regions.json で差し替えられる。
import TABLE from '../../content/regions.json' with { type: 'json' }

export const REGIONS = Object.entries(TABLE).map(([id, r]) => ({ id, ...r }))
export const REGION_MAP = Object.fromEntries(REGIONS.map((r) => [r.id, r]))
export const TOTAL_POPULATION = REGIONS.reduce((s, r) => s + r.population, 0)
