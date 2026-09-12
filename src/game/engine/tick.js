import { REGIONS, REGION_MAP } from '../data/regions.js'
import { CLUSTERS } from '../data/clusters.js'
import { clusterAppeal, doctrineGlobalEffects } from '../data/doctrine.js'
import { EVENTS, EVENT_CHANCE } from '../data/events.js'
import {
  BASE_GROWTH_RATE, NEWCOMER_FAITH, FAITH_DECAY, BANKRUPT_LIMIT,
  HISTORY_CAP, LOG_CAP, WARINESS_STAGES, DIFFICULTY_MAP,
  ELECTION_RETRY_DAYS,
} from './constants.js'
import {
  facilityEffects, missionFlatEffects, missionGrowthForRegion,
  totals, finance, voteProjection, priestsAssigned,
} from './selectors.js'
import { FACILITY_MAP } from '../data/facilities.js'

function log(state, kind, text) {
  state.log = [{ day: state.day, kind, text }, ...state.log].slice(0, LOG_CAP)
}

function cloneForTick(state) {
  const regions = {}
  for (const [rid, rs] of Object.entries(state.regions)) {
    const clusters = {}
    for (const [cid, cell] of Object.entries(rs.clusters)) clusters[cid] = { ...cell }
    regions[rid] = { ...rs, clusters }
  }
  return {
    ...state,
    regions,
    activeMissions: { ...state.activeMissions },
    timedMissions: { ...state.timedMissions },
    businesses: { ...state.businesses },
    election: { ...state.election },
    stats: { ...state.stats },
    facilities: state.facilities.map((f) => ({ ...f })),
  }
}

/** 1日進める。新しい state を返す。 */
export function advanceDay(prev) {
  const s = cloneForTick(prev)
  s.day = prev.day + 1
  s.convertedToday = 0
  // 何らかの理由で聖職者が足りなくなっていたら、配置を整理してから1日を始める
  reconcilePriests(s)

  const dg = doctrineGlobalEffects(s.doctrine)
  const fx = facilityEffects(s)
  const mx = missionFlatEffects(s)

  // ── 収支 ────────────────────────────────────────────
  const t0 = totals(s)
  const fin = finance(s, t0)
  s.funds += fin.net

  // ── 布教施策の定額獲得を地方へ配分 ──────────────────
  const open = REGIONS.filter((r) => s.regions[r.id].unlocked)
  const openPop = open.reduce((a, r) => a + r.population, 0) || 1
  const flatTotal = mx.flatRecruit ?? 0

  // ── 信者・信仰度の更新 ──────────────────────────────
  let gainTotal = 0
  let lossTotal = 0

  for (const r of open) {
    const rs = s.regions[r.id]
    const missionGrowth = missionGrowthForRegion(s, r.id)
    const regionFlat = flatTotal * (r.population / openPop)
    // 支部は開設直後は根を張っておらず、時間をかけて本領を発揮する
    const daysOpen = s.day - (rs.openedDay ?? s.day)
    const settle = rs.isHome ? 1 : Math.min(0.95, 0.35 + (daysOpen / 180) * 0.60)
    // その地方で大きくなるほど、1人を増やす手間は増える（地方ごとに独立して効く）
    const regionFollowers = t0.byRegion[r.id].followers
    const scaleDrag = 1 / (1 + Math.max(0, Math.log10(Math.max(1, regionFollowers / 50_000))) * 0.38)

    // 地方内でのクラスタ別配分重み（親和度×人口構成）
    const weights = {}
    let wSum = 0
    for (const c of CLUSTERS) {
      const w = clusterAppeal(c, s.doctrine, r.bias) * (r.demographics[c.id] ?? 0)
      weights[c.id] = w
      wSum += w
    }

    for (const c of CLUSTERS) {
      const cell = rs.clusters[c.id]
      const pop = r.population * (r.demographics[c.id] ?? 0)
      const appeal = clusterAppeal(c, s.doctrine, r.bias)
      const F = cell.followers

      const cap = pop * Math.min(0.60, 0.10 * appeal * (0.4 + (cell.faith / 100) * 0.8) * (1 + fx.growth * 0.25))
      // 施策・施設を積み増しても効果は逓減する
      const stack = Math.pow(1 + Math.max(0, fx.growth + missionGrowth), 0.62)
      const gMult = dg.growthMult * stack * r.mods.growth * settle * scaleDrag
      const rate = BASE_GROWTH_RATE * gMult * appeal * (0.55 + (cell.faith / 100) * 0.45)

      let gain = F * rate * Math.max(0, 1 - F / Math.max(1, cap))
      gain += regionFlat * (wSum > 0 ? weights[c.id] / wSum : 0)
      if (F + gain > cap * 1.15) gain = Math.max(0, cap * 1.15 - F)

      const churn =
        c.baseChurn *
        dg.churnMult *
        Math.max(0.15, 1 + fx.churn + mx.churn) *
        Math.max(0.25, 1.2 - cell.faith / 125) *
        (1 + s.wariness / 220)
      const loss = F * churn

      // 新規流入は信仰度を薄める
      if (gain > 0) {
        cell.faith = (cell.faith * F + NEWCOMER_FAITH * gain) / Math.max(1, F + gain)
      }
      const faithRoom = Math.max(0.08, 1 - Math.pow(cell.faith / 100, 2))
      cell.faith +=
        (fx.faith + mx.faith) * r.mods.faith * dg.faithMult * faithRoom -
        FAITH_DECAY -
        (s.wariness / 100) * 0.25
      cell.faith = Math.max(5, Math.min(100, cell.faith))

      cell.followers = Math.max(0, F + gain - loss)
      gainTotal += gain
      lossTotal += loss
    }
  }

  const t1 = totals(s)
  const growthRate = t0.followers > 0 ? (t1.followers - t0.followers) / t0.followers : 0

  // ── 世間の警戒度 ────────────────────────────────────
  const diffMult = (DIFFICULTY_MAP[s.difficulty] ?? DIFFICULTY_MAP.normal).warinessMult
  let regionWariness = 0
  let wBase = 0
  for (const r of open) {
    const f = t1.byRegion[r.id].followers
    regionWariness += r.mods.wariness * f
    wBase += f
  }
  const regionWarinessAvg = wBase > 0 ? regionWariness / wBase : REGION_MAP[s.homeRegion].mods.wariness

  // 母数が小さいうちの急成長は世間の目に留まらない
  const scaleAwareness = Math.min(1, t1.followers / 5_000)
  const growthPressure = Math.max(0, Math.min(1.0, (growthRate - 0.05) * 10)) * scaleAwareness
  const scalePressure = Math.max(0, Math.log10(t1.followers + 10) - 3.3) * 0.17
  // 世間は忘れる。警戒度が高いほど自然な鎮静も大きく働き、均衡点ができる
  const fade = 0.10 + s.wariness * 0.010
  const dW =
    (0.05 + dg.warinessAdd + growthPressure + scalePressure) * diffMult * regionWarinessAvg +
    fx.wariness + mx.wariness - fade
  s.wariness = Math.max(0, Math.min(100, s.wariness + dW))

  // ── 単発施策の残日数 ────────────────────────────────
  for (const id of Object.keys(s.timedMissions)) {
    s.timedMissions[id] -= 1
    if (s.timedMissions[id] <= 0) delete s.timedMissions[id]
  }

  // ── 警戒度の段階通知 ────────────────────────────────
  for (let i = WARINESS_STAGES.length - 1; i >= 0; i--) {
    if (s.wariness >= WARINESS_STAGES[i].at && s.warinessStage < i) {
      s.warinessStage = i
      log(s, 'warn', `【${WARINESS_STAGES[i].label}】${WARINESS_STAGES[i].text}`)
      break
    }
  }
  if (s.warinessStage >= 0 && s.wariness < WARINESS_STAGES[Math.max(0, s.warinessStage)].at - 6) {
    s.warinessStage -= 1
  }

  // ── ランダムイベント ────────────────────────────────
  if (Math.random() < EVENT_CHANCE && s.day - (s.stats.lastEventDay ?? -99) >= 6) {
    const ctx = {
      followers: t1.followers,
      priests: s.priests,
      wariness: s.wariness,
      funds: s.funds,
      income: fin.income,
      doctrine: s.doctrine,
      businesses: s.businesses,
      facilityCount: s.facilities.length,
    }
    const pool = EVENTS.filter((e) => !e.cond || e.cond(ctx))
    const total = pool.reduce((a, e) => a + e.weight, 0)
    if (total > 0) {
      let roll = Math.random() * total
      const picked = pool.find((e) => (roll -= e.weight) <= 0) ?? pool[0]
      applyEvent(s, picked, ctx)
    }
  }

  // ── 選挙 ────────────────────────────────────────────
  if (s.election.nextDay && s.day >= s.election.nextDay && s.phase === 'playing') {
    runElection(s)
  }

  // ── 敗北条件 ────────────────────────────────────────
  if (s.funds < 0) {
    s.bankruptDays += 1
    if (s.bankruptDays === 1) log(s, 'warn', `運転資金が尽きた。${BANKRUPT_LIMIT}日以内に立て直さなければ教団は解散する。`)
    if (s.bankruptDays >= BANKRUPT_LIMIT && s.phase === 'playing') {
      s.phase = 'gameover'
      s.ending = { type: 'bankrupt', title: '資金枯渇', text: '給与も維持費も払えず、聖職者は去り、施設は差し押さえられた。教団は解散した。' }
      s.speed = 0
    }
  } else {
    s.bankruptDays = 0
  }

  if (s.wariness >= 100 && s.phase === 'playing') {
    s.phase = 'gameover'
    s.ending = { type: 'raid', title: '強制捜査', text: '早朝、本部の門が叩かれた。押収された帳簿とともに、教団は解体された。' }
    s.speed = 0
  }

  // ── 履歴 ────────────────────────────────────────────
  const vp = voteProjection(s, t1)
  s.stats.peakFollowers = Math.max(s.stats.peakFollowers, t1.followers)
  s.stats.peakFunds = Math.max(s.stats.peakFunds, s.funds)
  s.history = [
    ...s.history,
    {
      day: s.day,
      followers: Math.round(t1.followers),
      priests: s.priests,
      funds: Math.round(s.funds),
      net: Math.round(fin.net),
      wariness: Math.round(s.wariness * 10) / 10,
      faith: Math.round(t1.avgFaith * 10) / 10,
      share: Math.round(vp.share * 10000) / 100,
    },
  ].slice(-HISTORY_CAP)

  return s
}

/**
 * 聖職者が減ったとき、配置が定員を超えたままにならないよう施設を止める。
 * （幹部の離反などで人数だけが減るため）
 */
function reconcilePriests(s) {
  const released = []
  // 新しく建てた施設から順に手を引く
  for (let i = s.facilities.length - 1; i >= 0 && priestsAssigned(s) > s.priests; i--) {
    const f = s.facilities[i]
    if (f.staff !== 'priests') continue
    f.staff = 'none'
    released.push(FACILITY_MAP[f.type]?.name ?? '施設')
  }
  if (released.length > 0) {
    log(s, 'warn', `聖職者が足りなくなり、${released.join('・')}が止まった。`)
  }
}

function applyEvent(s, ev, ctx) {
  const res = ev.apply(ctx) ?? {}
  if (res.funds) s.funds += res.funds
  if (res.wariness) s.wariness = Math.max(0, Math.min(100, s.wariness + res.wariness))
  if (res.priests) {
    s.priests = Math.max(0, s.priests + res.priests)
    reconcilePriests(s)
  }
  if (res.faith || res.followerMult) {
    for (const rs of Object.values(s.regions)) {
      if (!rs.unlocked) continue
      for (const cell of Object.values(rs.clusters)) {
        if (res.faith) cell.faith = Math.max(5, Math.min(100, cell.faith + res.faith))
        if (res.followerMult) cell.followers = Math.max(0, cell.followers * res.followerMult)
      }
    }
  }
  s.stats.eventsSeen += 1
  s.stats.lastEventDay = s.day
  s.pendingEvent = { id: ev.id, name: ev.name, kind: ev.kind, text: ev.text, day: s.day, res }
  log(s, ev.kind === 'good' ? 'good' : 'bad', `【${ev.name}】${ev.text}`)
}

function runElection(s) {
  const t = totals(s)
  const vp = voteProjection(s, t)
  s.election.attempts += 1
  s.election.lastResult = { day: s.day, share: vp.share, rival: vp.rival, won: vp.wins }

  // 2回目以降の勝利は政権維持として流し、ゲームは止めない
  if (vp.wins && s.victories > 0) {
    s.victories += 1
    s.election.nextDay = s.day + ELECTION_RETRY_DAYS
    log(s, 'good', `【総選挙】得票率${(vp.share * 100).toFixed(1)}%。第一与党の座を守った（通算${s.victories}期）。`)
    return
  }
  // 一度でも国教化したあとの敗北は、議席を失うだけで教団は続く
  if (!vp.wins && s.victories > 0) {
    s.election.nextDay = s.day + ELECTION_RETRY_DAYS
    s.wariness = Math.min(100, s.wariness + 4)
    log(s, 'warn', `【総選挙】得票率${(vp.share * 100).toFixed(1)}%。第一党の座を明け渡した。次の選挙は${ELECTION_RETRY_DAYS}日後。`)
    return
  }

  if (vp.wins) {
    s.phase = 'victory'
    s.speed = 0
    s.victories = 1
    const party = s.names?.party || '教団の政党'
    const order = s.names?.order || '教団'
    s.ending = {
      type: 'victory',
      title: '第一与党',
      text: `得票率${(vp.share * 100).toFixed(1)}%。「${party}」が第一与党の座に就いた。${order}の教義は、この国の背骨になった。`,
    }
    log(s, 'good', `【総選挙】「${party}」が得票率${(vp.share * 100).toFixed(1)}%で第一与党を獲得。国教化を達成した。`)
  } else {
    s.election.nextDay = s.day + ELECTION_RETRY_DAYS
    s.wariness = Math.min(100, s.wariness + 6)
    log(
      s,
      'warn',
      `【総選挙】得票率${(vp.share * 100).toFixed(1)}%。第一党の${(vp.rival * 100).toFixed(1)}%に届かず。次の選挙は${ELECTION_RETRY_DAYS}日後。`,
    )
  }
}
