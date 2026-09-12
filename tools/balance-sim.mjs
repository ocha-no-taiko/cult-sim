// バランス確認用のヘッドレスシミュレータ。
//   node tools/balance-sim.mjs [difficulty] [regionId]
// 単純な方針のAIに1500日プレイさせ、到達マイルストーンを出力する。

import { createInitialState } from '../src/game/engine/state.js'
import { reducer } from '../src/game/engine/actions.js'
import {
  totals, finance, priestsFree, isFounderFree, convertCapacity,
  priestCost, voteProjection, businessAvailable, missionUnlocked,
} from '../src/game/engine/selectors.js'
import { FACILITY_MAP, FACILITY_TYPES, BUSINESSES } from '../src/game/data/facilities.js'
import { MISSIONS } from '../src/game/data/missions.js'
import { REGIONS } from '../src/game/data/regions.js'
import { GRID_W, GRID_H } from '../src/game/engine/constants.js'

const difficulty = process.argv[2] ?? 'normal'
const home = process.argv[3] ?? 'kanto'

let s = createInitialState({ difficulty, homeRegionId: home })
const act = (type, payload) => { s = reducer(s, { type, payload }) }

// 教義：現世利益寄り＋やや終末、階層は中の上
act('SET_DOCTRINE_DRAFT', { worldly: 85, apocalypse: 62, hierarchy: 62, asceticism: 42 })
act('BEGIN_PREACHING')

const BUILD_ORDER = ['missionPost', 'hall', 'press', 'dojo', 'school', 'foundationOffice',
  'broadcast', 'partyHQ']
const BUILD_LIMIT = { missionPost: 4, hall: 3, press: 2, dojo: 2, school: 3, broadcast: 2, foundationOffice: 1, partyHQ: 1 }
const CAUTIOUS = !!process.env.CAUTIOUS
const RISKY_MISSIONS = ['tvcm', 'celebrity', 'doorToDoor', 'newspaperAd']

function freeTile() {
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
    if (!s.facilities.some((f) => f.x === x && f.y === y)) return { x, y }
  }
  return null
}

const milestones = {}
const mark = (k) => { if (!milestones[k]) milestones[k] = s.day }

for (let i = 0; i < 3000 && s.phase === 'playing'; i++) {
  const t = totals(s)
  const fin = finance(s, t)
  const reserve = Math.max(3_000_000, fin.expense * 8)

  // 解禁済みで未設立の事業があるなら、教祖を施設から引き上げて設立に充てる
  const wantBiz = BUSINESSES.find((b) => {
    if (s.businesses[b.id]) return false
    if (b.unlock.business && !s.businesses[b.unlock.business]) return false
    return t.followers >= b.unlock.followers
  })
  const founderFac = s.founder != null ? s.facilities.find((f) => f.uid === s.founder) : null
  const founderIsBootstrapping = founderFac?.type === 'school' && s.priests < 12
  if (wantBiz && !founderIsBootstrapping) {
    if (!isFounderFree(s) && s.founder != null) act('SET_STAFF', { uid: s.founder, mode: 'none' })
    if (businessAvailable(s, wantBiz.id).ok && s.funds > wantBiz.cost) {
      act('FOUND_BUSINESS', wantBiz.id)
      mark('biz:' + wantBiz.id)
    }
  }

  // 継続施策：黒字を保てる範囲でONにする（慎重モードでは警戒度を見て絞る）
  const tooHot = CAUTIOUS && s.wariness > 62
  const cooled = CAUTIOUS && s.wariness < 45
  for (const m of MISSIONS) {
    if (m.mode !== 'sustained') continue
    if (!missionUnlocked(s, m)) continue
    const on = !!s.activeMissions[m.id]
    const risky = RISKY_MISSIONS.includes(m.id)
    if (on) {
      if (tooHot && risky) act('TOGGLE_MISSION', m.id)
      continue
    }
    if (m.requiresFounder) continue
    if (risky && CAUTIOUS && !cooled) continue
    if (fin.net > m.dailyCost * 3 && s.funds > reserve) act('TOGGLE_MISSION', m.id)
  }
  for (const m of MISSIONS) {
    if (m.mode !== 'oneshot' || s.timedMissions[m.id]) continue
    if (!missionUnlocked(s, m)) continue
    if (CAUTIOUS && s.wariness > 55 && (m.instant?.wariness ?? 0) > 0) continue
    if (m.requiresFounder && !isFounderFree(s)) continue
    if (s.funds > m.cost + reserve) act('RUN_MISSION', m.id)
  }

  // 建設：建てられるもののうち、優先度順に最初の1つ
  for (const typeId of BUILD_ORDER) {
    const def = FACILITY_MAP[typeId]
    if (def.requires && !s.businesses[def.requires]) continue
    const built = s.facilities.filter((f) => f.type === typeId).length
    if (built >= (BUILD_LIMIT[typeId] ?? 1)) continue
    const tile = freeTile()
    if (!tile || s.funds < def.cost + reserve) continue
    act('BUILD', { typeId, ...tile })
    break
  }

  // 聖職者転向：施設を回すのに必要な数だけ
  const need = s.facilities.filter((f) => f.staff === 'none' && !FACILITY_MAP[f.type].alwaysActive)
    .reduce((a, f) => a + FACILITY_MAP[f.type].priests, 0)
  const cap = convertCapacity(s) - s.convertedToday
  if (need > priestsFree(s) && cap > 0 && s.funds > priestCost(s) * cap + reserve) {
    act('CONVERT_PRIESTS', Math.min(cap, need - priestsFree(s)))
    mark('priest:first')
  }

  // 配置：まず聖職者で埋める
  const priority = ['foundationOffice', 'school', 'press', 'broadcast', 'missionPost', 'hall', 'dojo', 'partyHQ']
  const sortedFac = [...s.facilities].sort(
    (a, b) => priority.indexOf(a.type) - priority.indexOf(b.type))
  for (const f of sortedFac) {
    const def = FACILITY_MAP[f.type]
    if (def.alwaysActive || f.staff !== 'none') continue
    if (priestsFree(s) >= def.priests) act('SET_STAFF', { uid: f.uid, mode: 'priests' })
  }

  // 教祖の使いどころ：聖職者を生み出せる神学校が最優先、次に事業設立、最後に空き施設
  const idleSchool = s.facilities.find((f) => f.type === 'school' && f.staff === 'none')
  if (idleSchool && convertCapacity(s) === 0) {
    if (s.founder !== idleSchool.uid) act('SET_STAFF', { uid: idleSchool.uid, mode: 'founder' })
    mark('founder:school')
  } else if (!wantBiz && isFounderFree(s)) {
    const idle = sortedFac.find((f) => f.staff === 'none' && !FACILITY_MAP[f.type].alwaysActive)
    if (idle) act('SET_STAFF', { uid: idle.uid, mode: 'founder' })
  }

  // 支部展開：安い地方から
  const closed = REGIONS.filter((r) => !s.regions[r.id].unlocked).sort((a, b) => a.branchCost - b.branchCost)
  if (closed[0] && t.followers >= 25_000 && s.funds > closed[0].branchCost + reserve) {
    act('OPEN_BRANCH', closed[0].id)
    mark('branch:' + closed[0].id)
  }

  if (process.env.TRACE && s.day % 20 === 0) {
    console.log(`d${String(s.day).padStart(4)} 信者${String(Math.round(t.followers)).padStart(10)} 聖${String(s.priests).padStart(3)} 信仰${t.avgFaith.toFixed(0)} 警戒${s.wariness.toFixed(1)} 資金${(s.funds/1e6).toFixed(0)}M 収支${(fin.net/1e6).toFixed(1)}M 得票${(voteProjection(s,t).share*100).toFixed(1)}%`)
  }
  for (const n of [1_000, 10_000, 100_000, 1_000_000, 5_000_000, 10_000_000]) {
    if (t.followers >= n) mark('followers:' + n)
  }
  if (s.election.nextDay) mark('election:scheduled')

  if (process.env.DUMP_AT && s.day >= Number(process.env.DUMP_AT)) break
  act('TICK')
}

const t = totals(s)
const fin = finance(s, t)
const vp = voteProjection(s, t)
const y = (n) => n.toLocaleString('ja-JP', { maximumFractionDigits: 0 })

console.log(`\n=== ${difficulty} / ${home} ===`)
console.log(`終了: day ${s.day} / phase ${s.phase}` + (s.ending ? ` / ${s.ending.title}` : ''))
console.log(`信者 ${y(t.followers)}  聖職者 ${s.priests}  平均信仰度 ${t.faithAvg ?? t.avgFaith.toFixed(1)}`)
console.log(`資金 ${y(s.funds)}円  日次収支 ${y(fin.net)}円  警戒度 ${s.wariness.toFixed(1)}`)
console.log(`得票率見込 ${(vp.share * 100).toFixed(1)}%  対抗第一党 ${(vp.rival * 100).toFixed(1)}%`)
console.log(`施設 ${s.facilities.length}  展開地方 ${REGIONS.filter((r) => s.regions[r.id].unlocked).length}/7`)
console.log('マイルストーン:', Object.entries(milestones).map(([k, v]) => `${k}=d${v}`).join(' '))
console.log('地方別:', REGIONS.map((r) => `${r.name} ${(t.byRegion[r.id].share * 100).toFixed(1)}%`).join(' / '))
console.log('施設:', s.facilities.map((f) => `${FACILITY_MAP[f.type].name}(${f.staff})`).join(' '))
console.log('施策:', Object.keys(s.activeMissions).join(' '))
if (process.env.DUMP_AT) {
  const fs = await import('node:fs')
  fs.writeFileSync(process.env.DUMP_FILE ?? 'dump.json', JSON.stringify(s))
  console.log('dumped ->', process.env.DUMP_FILE ?? 'dump.json')
}
console.log('直近ログ:')
for (const l of s.log.slice(0, 6)) console.log(`  d${l.day} [${l.kind}] ${l.text}`)
