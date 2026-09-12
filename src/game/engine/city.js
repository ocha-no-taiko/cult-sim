// 宗教都市の配置から、施設効果とシナジーを計算する。
// シナジーの定義は src/content/synergies.json（隣接ペアと区画ゾーン）。
import SYNERGIES from '../../content/synergies.json' with { type: 'json' }
import { FACILITY_MAP } from '../data/facilities.js'
import { GRID_W, GRID_H } from './constants.js'

export const ADJACENCY_RULES = SYNERGIES.adjacency
export const ZONE_RULES = SYNERGIES.zones

const EFFECT_KEYS = [
  'growth', 'donation', 'faith', 'churn', 'wariness',
  'income', 'incomePerPriest', 'convertCap', 'votePower', 'flatRecruit',
]

export function emptyEffects() {
  return Object.fromEntries(EFFECT_KEYS.map((k) => [k, 0]))
}

function addEffects(acc, effect, mult = 1) {
  for (const [k, v] of Object.entries(effect ?? {})) {
    if (acc[k] === undefined) continue
    acc[k] += v * mult
  }
}

export const isEdgeTile = (x, y) => x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1
export const isCenterTile = (x, y) =>
  x === Math.floor((GRID_W - 1) / 2) && y === Math.floor((GRID_H - 1) / 2)

/** 直交4方向で接しているか（シナジーの隣接判定） */
export const isAdjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
/** 斜めを含む8方向で接しているか（本部の威光） */
export const isAround = (a, b) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1

function isActive(state, f) {
  const def = FACILITY_MAP[f.type]
  if (!def) return false
  if (def.alwaysActive) return true
  return f.staff === 'founder' ? state.founder === f.uid : f.staff === 'priests'
}

/**
 * 稼働中の施設からの効果合計と、成立しているシナジーの一覧を返す。
 * links / zoneHits は画面での図示にそのまま使う。
 */
export function computeCity(state) {
  const actives = (state.facilities ?? []).filter((f) => isActive(state, f))
  const hq = (state.facilities ?? []).find((f) => FACILITY_MAP[f.type]?.alwaysActive)

  const haloRule = ZONE_RULES.find((z) => z.kind === 'halo')
  const centerRule = ZONE_RULES.find((z) => z.kind === 'hqCenter')
  const edgeRules = ZONE_RULES.filter((z) => z.kind === 'edge')

  const centered = !!hq && isCenterTile(hq.x, hq.y)
  const globalMult = centered && centerRule ? centerRule.mult : 1

  const halo = new Set()
  if (hq && haloRule) {
    for (const f of actives) {
      if (f.uid !== hq.uid && isAround(f, hq)) halo.add(f.uid)
    }
  }

  const effects = emptyEffects()
  const zoneHits = []

  for (const f of actives) {
    const def = FACILITY_MAP[f.type]
    const mult = globalMult * (halo.has(f.uid) && haloRule ? haloRule.mult : 1)
    addEffects(effects, def.effect, mult)
    if (halo.has(f.uid)) zoneHits.push({ rule: haloRule, uid: f.uid })

    for (const z of edgeRules) {
      if (!z.types.includes(f.type)) continue
      if (!isEdgeTile(f.x, f.y)) continue
      addEffects(effects, z.effect, globalMult)
      zoneHits.push({ rule: z, uid: f.uid })
    }
  }
  if (centered && centerRule && hq) zoneHits.push({ rule: centerRule, uid: hq.uid })

  const links = []
  for (let i = 0; i < actives.length; i++) {
    for (let j = i + 1; j < actives.length; j++) {
      const a = actives[i]
      const b = actives[j]
      if (!isAdjacent(a, b)) continue
      for (const rule of ADJACENCY_RULES) {
        const [p, q] = rule.pair
        const match = (a.type === p && b.type === q) || (a.type === q && b.type === p)
        if (!match) continue
        addEffects(effects, rule.effect, globalMult)
        links.push({ rule, a: a.uid, b: b.uid })
      }
    }
  }

  return { effects, links, zoneHits, halo, centered, hq }
}

/** 表示用に、成立しているシナジーを種類ごとにまとめる */
export function summarizeSynergies(city) {
  const map = new Map()
  for (const l of city.links) {
    const cur = map.get(l.rule.id) ?? { rule: l.rule, count: 0, kind: 'adjacency' }
    cur.count += 1
    map.set(l.rule.id, cur)
  }
  for (const z of city.zoneHits) {
    const cur = map.get(z.rule.id) ?? { rule: z.rule, count: 0, kind: z.rule.kind }
    cur.count += 1
    map.set(z.rule.id, cur)
  }
  return [...map.values()]
}
