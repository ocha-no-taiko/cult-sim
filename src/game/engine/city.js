// 宗教都市の配置から、施設効果とシナジーを計算する。
// シナジーの定義は src/content/synergies.json（隣接ペアと区画ゾーン）。
import SYNERGIES from '../../content/synergies.json' with { type: 'json' }
import { FACILITY_MAP } from '../data/facilities.js'
import { REGION_MAP } from '../data/regions.js'
import { GRID_W, GRID_H } from './constants.js'

export const ADJACENCY_RULES = SYNERGIES.adjacency
export const ZONE_RULES = SYNERGIES.zones
export const REGIONAL = SYNERGIES.regional ?? {}

const EFFECT_KEYS = [
  'growth', 'donation', 'faith', 'churn', 'wariness', 'underworld',
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

/**
 * 宗教都市が立っている地方の性格を、施設とシナジーに乗せる。
 * 都市は拠点に一つなので、拠点地方の係数を使う。
 */
export function regionalModifiers(state) {
  const region = REGION_MAP[state.homeRegion]
  if (!region) return { region: null, ruleMult: () => 1, facilityMult: () => 1, notes: [] }

  const word = region.mods?.word ?? 1
  const media = region.mods?.media ?? 1
  const wordRules = new Set(REGIONAL.wordScaled?.rules ?? [])
  const mediaRules = new Set([...(REGIONAL.mediaScaled?.rules ?? []), ...(REGIONAL.mediaScaled?.zones ?? [])])

  // 土地柄の教義補正 → その軸に紐づく施設の効果を底上げする
  const scale = REGIONAL.doctrineBoost?.scale ?? 0
  const axes = REGIONAL.doctrineBoost?.axes ?? {}
  const facilityBoost = {}
  for (const [axis, types] of Object.entries(axes)) {
    const bias = region.bias?.[axis] ?? 0
    if (!bias) continue
    for (const t of types) facilityBoost[t] = (facilityBoost[t] ?? 1) * (1 + bias * scale)
  }

  const notes = []
  if (word !== 1) notes.push({ kind: 'word', label: '口コミ', mult: word })
  if (media !== 1) notes.push({ kind: 'media', label: '広報', mult: media })
  for (const [t, m] of Object.entries(facilityBoost)) {
    notes.push({ kind: 'doctrine', label: FACILITY_MAP[t]?.name ?? t, mult: m })
  }

  return {
    region,
    ruleMult: (id) => (wordRules.has(id) ? word : mediaRules.has(id) ? media : 1),
    facilityMult: (type) => facilityBoost[type] ?? 1,
    notes,
  }
}

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

  const regional = regionalModifiers(state)
  const effects = emptyEffects()
  const zoneHits = []

  for (const f of actives) {
    const def = FACILITY_MAP[f.type]
    const mult = globalMult
      * (halo.has(f.uid) && haloRule ? haloRule.mult : 1)
      * regional.facilityMult(f.type)
    addEffects(effects, def.effect, mult)
    if (halo.has(f.uid)) zoneHits.push({ rule: haloRule, uid: f.uid })

    for (const z of edgeRules) {
      if (!z.types.includes(f.type)) continue
      if (!isEdgeTile(f.x, f.y)) continue
      addEffects(effects, z.effect, globalMult * regional.ruleMult(z.id))
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
        addEffects(effects, rule.effect, globalMult * regional.ruleMult(rule.id))
        links.push({ rule, a: a.uid, b: b.uid })
      }
    }
  }

  return { effects, links, zoneHits, halo, centered, hq, regional }
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
