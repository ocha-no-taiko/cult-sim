import { REGIONS, REGION_MAP, TOTAL_POPULATION } from '../data/regions.js'
import { CLUSTERS } from '../data/clusters.js'
import { doctrineGlobalEffects } from '../data/doctrine.js'
import { FACILITY_MAP, BUSINESS_MAP } from '../data/facilities.js'
import { MISSION_MAP } from '../data/missions.js'
import { PRIEST_UPKEEP, VOTE_BASE_POWER, ELECTORATE_RATIO, PRIEST_BASE_COST } from './constants.js'
import { computeCity, emptyEffects } from './city.js'

export { emptyEffects, computeCity }

export function isFacilityActive(state, f) {
  const def = FACILITY_MAP[f.type]
  if (!def) return false
  if (def.alwaysActive) return true
  if (f.staff === 'founder') return state.founder === f.uid
  if (f.staff === 'priests') return true
  return false
}

/** 稼働中の施設効果の合計（配置シナジーを含む） */
export function facilityEffects(state) {
  return computeCity(state).effects
}

/** 教祖が巡回説法などで拘束されているか */
export function founderBusyOn(state) {
  if (state.founder != null) {
    const f = state.facilities.find((x) => x.uid === state.founder)
    return { kind: 'facility', label: f ? FACILITY_MAP[f.type].name : '施設', uid: state.founder }
  }
  for (const id of Object.keys(state.activeMissions)) {
    if (state.activeMissions[id] && MISSION_MAP[id]?.requiresFounder && MISSION_MAP[id].mode === 'sustained') {
      return { kind: 'mission', label: MISSION_MAP[id].name, uid: id }
    }
  }
  return null
}

export function isFounderFree(state) {
  return founderBusyOn(state) === null
}

export function priestsAssigned(state) {
  return state.facilities.reduce((s, f) => {
    if (f.staff !== 'priests') return s
    return s + (FACILITY_MAP[f.type]?.priests ?? 0)
  }, 0)
}

export function priestsFree(state) {
  return state.priests - priestsAssigned(state)
}

/** 現在有効な布教施策（継続ONのもの＋効果持続中の単発） */
export function activeMissions(state) {
  const out = []
  for (const [id, on] of Object.entries(state.activeMissions)) {
    if (!on) continue
    const m = MISSION_MAP[id]
    if (m) out.push({ mission: m, timed: false })
  }
  for (const [id, days] of Object.entries(state.timedMissions)) {
    if (days > 0 && MISSION_MAP[id]) out.push({ mission: MISSION_MAP[id], timed: true, days })
  }
  return out
}

/** 施策効果のうち、地方依存でないものを合計する */
export function missionFlatEffects(state) {
  const acc = emptyEffects()
  for (const { mission } of activeMissions(state)) {
    for (const [k, v] of Object.entries(mission.effect ?? {})) {
      if (k === 'growth' && (mission.mediaScaled || mission.wordScaled)) continue
      acc[k] = (acc[k] ?? 0) + v
    }
  }
  return acc
}

/** 地方ごとの施策由来の獲得ボーナス（広報/口コミ適性で補正） */
export function missionGrowthForRegion(state, regionId) {
  const reg = REGION_MAP[regionId]
  let g = 0
  for (const { mission } of activeMissions(state)) {
    const base = mission.effect?.growth ?? 0
    if (!base) continue
    if (mission.mediaScaled) g += base * reg.mods.media
    else if (mission.wordScaled) g += base * reg.mods.word
    else g += base
  }
  return g
}

export function unlockedRegions(state) {
  return REGIONS.filter((r) => state.regions[r.id].unlocked)
}

/** 信者数の集計 */
export function totals(state) {
  let followers = 0
  let faithWeighted = 0
  const byRegion = {}
  const byCluster = Object.fromEntries(CLUSTERS.map((c) => [c.id, 0]))

  for (const r of REGIONS) {
    const rs = state.regions[r.id]
    let rf = 0
    let rfaith = 0
    for (const c of CLUSTERS) {
      const cell = rs.clusters[c.id]
      rf += cell.followers
      rfaith += cell.followers * cell.faith
      byCluster[c.id] += cell.followers
    }
    byRegion[r.id] = {
      followers: rf,
      faith: rf > 0 ? rfaith / rf : 0,
      share: rf / r.population,
    }
    followers += rf
    faithWeighted += rfaith
  }
  return {
    followers,
    byRegion,
    byCluster,
    avgFaith: followers > 0 ? faithWeighted / followers : 0,
    nationalShare: followers / TOTAL_POPULATION,
  }
}

/** 収支 */
export function finance(state, t = totals(state)) {
  const fx = facilityEffects(state)
  const mx = missionFlatEffects(state)
  const dg = doctrineGlobalEffects(state.doctrine)
  const donationMult = dg.donationMult * (1 + fx.donation + mx.donation)

  let donations = 0
  for (const r of REGIONS) {
    const rs = state.regions[r.id]
    if (!rs.unlocked) continue
    for (const c of CLUSTERS) {
      const cell = rs.clusters[c.id]
      if (cell.followers <= 0) continue
      donations += cell.followers * c.donation * (0.4 + (cell.faith / 100) * 0.9)
    }
  }
  donations = Math.round(donations * donationMult)

  const facilityIncome = Math.round(fx.income + fx.incomePerPriest * state.priests)
  const upkeep = state.facilities.reduce((s, f) => {
    const def = FACILITY_MAP[f.type]
    if (!def) return s
    // 稼働していない施設も最低限の維持費はかかる（40%）
    return s + def.upkeep * (isFacilityActive(state, f) ? 1 : 0.4)
  }, 0)
  const priestUpkeep = state.priests * PRIEST_UPKEEP
  const admin = Math.round(t.followers * 22)
  const missionCost = activeMissions(state)
    .filter((m) => !m.timed)
    .reduce((s, m) => s + (m.mission.dailyCost ?? 0), 0)

  const income = donations + facilityIncome
  const expense = upkeep + priestUpkeep + missionCost + admin
  return {
    donations,
    facilityIncome,
    income,
    upkeep,
    priestUpkeep,
    missionCost,
    admin,
    expense,
    net: income - expense,
  }
}

/** 聖職者への転向 1人あたり費用 */
export function priestCost(state) {
  const dg = doctrineGlobalEffects(state.doctrine)
  return Math.round(PRIEST_BASE_COST / dg.priestMult)
}

export function convertCapacity(state) {
  return Math.floor(facilityEffects(state).convertCap)
}

/** 得票率の見込み */
export function voteProjection(state, t = totals(state)) {
  const fx = facilityEffects(state)
  const mx = missionFlatEffects(state)
  const power = VOTE_BASE_POWER + fx.votePower + mx.votePower + (t.avgFaith / 100) * 0.55
  const electorate = TOTAL_POPULATION * ELECTORATE_RATIO
  const share = Math.min(0.85, (t.followers * power) / electorate)
  const rival = Math.max(0.12, 0.36 - share * 0.55)
  const byRegion = {}
  for (const r of REGIONS) {
    const rr = t.byRegion[r.id]
    byRegion[r.id] = Math.min(0.9, rr.share * power)
  }
  return { power, share, rival, electorate, byRegion, wins: share > rival }
}

export function businessAvailable(state, bizId) {
  const b = BUSINESS_MAP[bizId]
  if (!b) return { ok: false, reason: '不明な事業' }
  if (state.businesses[bizId]) return { ok: false, reason: '設立済み' }
  const t = totals(state)
  if (b.unlock.business && !state.businesses[b.unlock.business]) {
    return { ok: false, reason: `${BUSINESS_MAP[b.unlock.business].name}の設立が先` }
  }
  if (t.followers < b.unlock.followers) {
    return { ok: false, reason: `信者${b.unlock.followers.toLocaleString()}人が必要` }
  }
  if (state.funds < b.cost) return { ok: false, reason: '資金不足' }
  if (!isFounderFree(state)) return { ok: false, reason: '教祖が拘束されている' }
  return { ok: true }
}

export function missionUnlocked(state, mission, t = totals(state)) {
  if (mission.layer === 'followers') return t.followers >= mission.unlock.followers
  return state.totalSpent >= mission.unlock.spent
}
