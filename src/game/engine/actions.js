import { REGION_MAP } from '../data/regions.js'
import { CLUSTERS } from '../data/clusters.js'
import { AXIS_IDS } from '../data/doctrine.js'
import { FACILITY_MAP, BUSINESS_MAP } from '../data/facilities.js'
import { MISSION_MAP } from '../data/missions.js'
import { createInitialState, defaultBusinessNames, BUSINESS_NAME_KEY } from './state.js'
import ENDINGS from '../../content/endings.json' with { type: 'json' }
import { VEHICLE_MAP, portfolioValue } from './invest.js'
import { advanceDay } from './tick.js'
import {
  isFounderFree, priestsFree, totals, priestCost, convertCapacity,
  businessAvailable, missionUnlocked, founderBusyOn,
} from './selectors.js'
import {
  GRID_W, GRID_H, BRANCH_MIN_FOLLOWERS, ELECTION_LEAD_DAYS, ELECTION_RETRY_DAYS, LOG_CAP,
} from './constants.js'

function clone(state) {
  return {
    ...state,
    names: { ...state.names },
    regions: Object.fromEntries(
      Object.entries(state.regions).map(([rid, rs]) => [
        rid,
        { ...rs, clusters: Object.fromEntries(Object.entries(rs.clusters).map(([cid, c]) => [cid, { ...c }])) },
      ]),
    ),
    doctrine: { ...state.doctrine },
    investments: { ...(state.investments ?? {}) },
    businesses: { ...state.businesses },
    activeMissions: { ...state.activeMissions },
    timedMissions: { ...state.timedMissions },
    missionUses: { ...state.missionUses },
    election: { ...state.election },
    stats: { ...state.stats },
    facilities: state.facilities.map((f) => ({ ...f })),
  }
}

function log(s, kind, text) {
  s.log = [{ day: s.day, kind, text }, ...s.log].slice(0, LOG_CAP)
}

function spend(s, amount) {
  s.funds -= amount
  s.totalSpent += amount
}

/** 信者を比率で削る（教義改定の離脱など） */
function scaleFollowers(s, frac) {
  for (const rs of Object.values(s.regions)) {
    if (!rs.unlocked) continue
    for (const cell of Object.values(rs.clusters)) cell.followers = Math.max(0, cell.followers * frac)
  }
}

export function reducer(state, action) {
  switch (action.type) {
    case 'NEW_GAME':
      return createInitialState(action.payload)

    case 'LOAD':
      return action.payload

    case 'TICK': {
      if (state.phase !== 'playing') return state
      return advanceDay(state)
    }

    // 共通の時計に追いつく（まとめて進めるが、1回の上限を決めて固まらせない）
    case 'TICK_TO': {
      if (state.phase !== 'playing') return state
      let s = state
      let guard = 0
      while (s.day < action.payload && s.phase === 'playing' && guard < 40) {
        s = advanceDay(s)
        guard += 1
      }
      return s
    }

    case 'SET_SPEED': {
      if (state.phase !== 'playing') return state
      return { ...state, speed: action.payload }
    }

    case 'SET_DOCTRINE_DRAFT': {
      // 開教前は自由に設計できる
      if (state.phase !== 'founding') return state
      return { ...state, doctrine: { ...state.doctrine, ...action.payload } }
    }

    case 'BEGIN_PREACHING': {
      if (state.phase !== 'founding') return state
      const s = clone(state)
      s.phase = 'playing'
      s.speed = 1
      log(s, 'system', '教義を定め、開教した。まずは街頭に立つところから。')
      return s
    }

    case 'REVISE_DOCTRINE': {
      if (state.phase !== 'playing') return state
      if (!isFounderFree(state)) return state
      const next = action.payload
      let delta = 0
      for (const a of AXIS_IDS) delta += Math.abs((next[a] ?? state.doctrine[a]) - state.doctrine[a])
      if (delta <= 0) return state
      const cost = Math.round(2_000_000 * (1 + state.doctrineRevisions * 0.5))
      if (state.funds < cost) return state

      const s = clone(state)
      spend(s, cost)
      s.doctrine = { ...s.doctrine, ...next }
      s.doctrineRevisions += 1
      const lossFrac = Math.min(0.40, (delta / 100) * 0.10)
      scaleFollowers(s, 1 - lossFrac)
      for (const rs of Object.values(s.regions)) {
        for (const cell of Object.values(rs.clusters)) {
          cell.faith = Math.max(5, cell.faith - (delta / 100) * 6)
        }
      }
      s.wariness = Math.min(100, s.wariness + (delta / 100) * 1.5)
      log(s, 'warn', `教義を改定した（変更幅${Math.round(delta)}）。${(lossFrac * 100).toFixed(1)}%の信者が教団を離れた。`)
      return s
    }

    case 'SET_NAME': {
      const { key, value } = action.payload
      const name = String(value ?? '').slice(0, 16).trim()
      if (!name) return state
      return { ...state, names: { ...state.names, [key]: name } }
    }

    case 'BUILD': {
      if (state.phase !== 'playing') return state
      const { typeId, x, y } = action.payload
      const def = FACILITY_MAP[typeId]
      if (!def) return state
      if (def.requires && !state.businesses[def.requires]) return state
      if (def.unique && state.facilities.some((f) => f.type === typeId)) return state
      if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return state
      if (state.facilities.some((f) => f.x === x && f.y === y)) return state
      if (state.funds < def.cost) return state

      const s = clone(state)
      spend(s, def.cost)
      s.facilities.push({ uid: s.nextUid, type: typeId, x, y, staff: def.alwaysActive ? 'auto' : 'none' })
      s.nextUid += 1
      log(s, 'system', `${def.name}を建設した。稼働には教祖か聖職者${def.priests}人の配置が必要。`)
      return s
    }

    case 'DEMOLISH': {
      if (state.phase !== 'playing') return state
      const f = state.facilities.find((x) => x.uid === action.payload)
      if (!f) return state
      const def = FACILITY_MAP[f.type]
      if (def.alwaysActive) return state
      const s = clone(state)
      s.facilities = s.facilities.filter((x) => x.uid !== f.uid)
      if (s.founder === f.uid) s.founder = null
      s.funds += Math.round(def.cost * 0.3)
      log(s, 'system', `${def.name}を取り壊した（${Math.round(def.cost * 0.3).toLocaleString()}円を回収）。`)
      return s
    }

    case 'MOVE_FACILITY': {
      if (state.phase !== 'playing') return state
      const { uid, x, y } = action.payload
      if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return state
      const moving = state.facilities.find((f) => f.uid === uid)
      if (!moving) return state
      if (moving.x === x && moving.y === y) return state

      const s = clone(state)
      const target = s.facilities.find((f) => f.x === x && f.y === y)
      const self = s.facilities.find((f) => f.uid === uid)
      // 区画が埋まっていれば入れ替える
      if (target) {
        target.x = self.x
        target.y = self.y
      }
      self.x = x
      self.y = y
      return s
    }

    case 'SET_STAFF': {
      if (state.phase !== 'playing') return state
      const { uid, mode } = action.payload
      const f = state.facilities.find((x) => x.uid === uid)
      if (!f) return state
      const def = FACILITY_MAP[f.type]
      if (def.alwaysActive) return state
      // すでにその状態なら何もしない（日誌が同じ行で埋まるのを防ぐ）
      if (mode === 'founder' && f.staff === 'founder' && state.founder === uid) return state
      if (mode === 'priests' && f.staff === 'priests') return state
      if (mode === 'none' && f.staff === 'none') return state

      const s = clone(state)
      const target = s.facilities.find((x) => x.uid === uid)

      if (mode === 'founder') {
        const busy = founderBusyOn(s)
        if (busy && busy.kind === 'mission') return state
        // 他の施設から教祖を引き上げる
        for (const other of s.facilities) if (other.staff === 'founder') other.staff = 'none'
        target.staff = 'founder'
        s.founder = uid
        log(s, 'system', `教祖が${def.name}に入った。教祖にしかできない行動は取れなくなる。`)
      } else if (mode === 'priests') {
        if (s.founder === uid) s.founder = null
        const freeNow = priestsFree({ ...s, facilities: s.facilities.map((x) => (x.uid === uid ? { ...x, staff: 'none' } : x)) })
        if (freeNow < def.priests) return state
        target.staff = 'priests'
        log(s, 'system', `${def.name}に聖職者${def.priests}人を配置した。`)
      } else {
        if (s.founder === uid) s.founder = null
        target.staff = 'none'
      }
      return s
    }

    case 'TOGGLE_MISSION': {
      if (state.phase !== 'playing') return state
      const m = MISSION_MAP[action.payload]
      if (!m || m.mode !== 'sustained') return state
      if (!missionUnlocked(state, m)) return state
      const on = !!state.activeMissions[m.id]
      if (!on && m.requiresFounder && !isFounderFree(state)) return state

      const s = clone(state)
      s.activeMissions[m.id] = !on
      if (!s.activeMissions[m.id]) delete s.activeMissions[m.id]
      log(s, 'system', `${m.name}を${on ? '停止' : '開始'}した。`)
      return s
    }

    case 'RUN_MISSION': {
      if (state.phase !== 'playing') return state
      const m = MISSION_MAP[action.payload]
      if (!m || m.mode !== 'oneshot') return state
      if (!missionUnlocked(state, m)) return state
      if (state.timedMissions[m.id]) return state
      if (state.funds < m.cost) return state
      if (m.requiresFounder && !isFounderFree(state)) return state

      const s = clone(state)
      spend(s, m.cost)
      s.timedMissions[m.id] = m.duration
      s.missionUses[m.id] = (s.missionUses[m.id] ?? 0) + 1
      const inst = m.instant ?? {}
      if (inst.faith) {
        for (const rs of Object.values(s.regions)) {
          if (!rs.unlocked) continue
          for (const cell of Object.values(rs.clusters)) cell.faith = Math.min(100, cell.faith + inst.faith)
        }
      }
      if (inst.wariness) s.wariness = Math.min(100, s.wariness + inst.wariness)
      log(s, 'good', `${m.name}を実施した。効果は${m.duration}日間続く。`)
      return s
    }

    case 'FOUND_BUSINESS': {
      if (state.phase !== 'playing') return state
      const bizId = typeof action.payload === 'string' ? action.payload : action.payload?.id
      const givenName = typeof action.payload === 'object' ? action.payload?.name : null
      const check = businessAvailable(state, bizId)
      if (!check.ok) return state
      const b = BUSINESS_MAP[bizId]

      const s = clone(state)
      spend(s, b.cost)
      s.businesses[bizId] = true
      const nameKey = BUSINESS_NAME_KEY[bizId]
      const fallback = defaultBusinessNames(s.names.order)[nameKey] || b.name
      const label = String(givenName ?? '').trim().slice(0, 16) || s.names[nameKey] || fallback
      s.names[nameKey] = label
      log(s, 'good', `${b.name}として「${label}」を設立した。`)
      if (bizId === 'party') {
        s.election.foundedDay = s.day
        s.election.nextDay = s.day + ELECTION_LEAD_DAYS
        log(s, 'system', `「${label}」を届け出た。総選挙は${ELECTION_LEAD_DAYS}日後。`)
      }
      if (bizId === 'foundation') {
        s.wariness = Math.max(0, s.wariness - 12)
      }
      return s
    }

    case 'CONVERT_PRIESTS': {
      if (state.phase !== 'playing') return state
      const t = totals(state)
      const cap = convertCapacity(state) - state.convertedToday
      let n = Math.min(action.payload, cap, Math.floor(t.followers * 0.5))
      if (n <= 0) return state
      const unit = priestCost(state)
      const affordable = Math.floor(state.funds / unit)
      n = Math.min(n, affordable)
      if (n <= 0) return state

      const s = clone(state)
      spend(s, n * unit)
      s.priests += n
      s.convertedToday += n

      // 適性×信者数で按分して信者を減らす
      const picks = []
      let wSum = 0
      for (const [rid, rs] of Object.entries(s.regions)) {
        if (!rs.unlocked) continue
        for (const c of CLUSTERS) {
          const w = rs.clusters[c.id].followers * c.priestAptitude
          if (w > 0) {
            picks.push({ rid, cid: c.id, w })
            wSum += w
          }
        }
      }
      for (const p of picks) {
        const take = n * (p.w / wSum)
        const cell = s.regions[p.rid].clusters[p.cid]
        cell.followers = Math.max(0, cell.followers - take)
      }
      log(s, 'system', `信者${n}人を聖職者に転向させた（${(n * unit).toLocaleString()}円）。お布施はその分減る。`)
      return s
    }

    case 'OPEN_BRANCH': {
      if (state.phase !== 'playing') return state
      const rid = action.payload
      const reg = REGION_MAP[rid]
      if (!reg || state.regions[rid].unlocked) return state
      const t = totals(state)
      if (t.followers < BRANCH_MIN_FOLLOWERS) return state
      if (state.funds < reg.branchCost) return state
      // 支部には人を置いてこなければならない。遊休の聖職者からそのまま派遣する
      const need = reg.branchPriests ?? 0
      if (priestsFree(state) < need) return state

      const s = clone(state)
      spend(s, reg.branchCost)
      s.priests = Math.max(0, s.priests - need)
      const rs = s.regions[rid]
      rs.unlocked = true
      rs.openedDay = s.day
      let assigned = 0
      const seed = 400
      CLUSTERS.forEach((c, i) => {
        const n = i === CLUSTERS.length - 1 ? seed - assigned : Math.round(seed * (reg.demographics[c.id] ?? 0))
        rs.clusters[c.id].followers = Math.max(0, n)
        rs.clusters[c.id].faith = 40
        assigned += n
      })
      s.wariness = Math.min(100, s.wariness + 2)
      log(
        s,
        'good',
        `${reg.name}に支部を開設し、聖職者${need}人を送り出した。この地方の信者率も得票率に乗る。`,
      )
      return s
    }

    case 'CONTINUE_AFTER_VICTORY': {
      if (state.phase !== 'victory') return state
      const s = clone(state)
      s.phase = 'playing'
      s.ending = null
      s.speed = 0
      if (s.businesses.party && (!s.election.nextDay || s.election.nextDay <= s.day)) {
        s.election.nextDay = s.day + ELECTION_RETRY_DAYS
      }
      log(s, 'system', '決着のあとも、教団の経営は続く。')
      return s
    }

    // ── 対戦でのみ使う行動 ──────────────────────────
    case 'SET_MULTIPLAYER':
      return { ...state, multiplayer: !!action.payload }

    case 'PAY_ASSASSINATION': {
      // 暗殺を差し向けた側の代償（判定自体はサーバが行う）
      const { cost = 0, underworld = 0, note } = action.payload ?? {}
      const s = clone(state)
      spend(s, cost)
      s.underworld = Math.min(100, s.underworld + underworld)
      if (note) log(s, 'bad', note)
      return s
    }

    case 'MATCH_ADJUST': {
      const { funds = 0, wariness = 0, underworld = 0, note, kind = 'system' } = action.payload ?? {}
      const s = clone(state)
      if (funds < 0) spend(s, -funds)
      else s.funds += funds
      s.wariness = Math.max(0, Math.min(100, s.wariness + wariness))
      s.underworld = Math.max(0, Math.min(100, s.underworld + underworld))
      if (note) log(s, kind, note)
      return s
    }

    case 'KILLED_BY': {
      if (state.phase !== 'playing') return state
      const { type = 'rivalAssassin', by = '何者か' } = action.payload ?? {}
      const s = clone(state)
      const def = ENDINGS[type] ?? { title: '敗北', text: '' }
      s.phase = 'gameover'
      s.speed = 0
      s.ending = { type, title: def.title, text: (def.text ?? '').replaceAll('{by}', by), kind: 'defeat' }
      log(s, 'bad', `【${def.title}】${s.ending.text}`)
      return s
    }

    case 'OUTPACED': {
      const { by = '他の教団', ending = '' } = action.payload ?? {}
      const s = clone(state)
      const def = ENDINGS.outpaced
      s.phase = 'gameover'
      s.speed = 0
      s.ending = { type: 'outpaced', title: def.title, text: def.text.replaceAll('{by}', by), kind: 'defeat', rivalEnding: ending }
      log(s, 'warn', `【${def.title}】${s.ending.text}`)
      return s
    }

    case 'CLEAR_CLAIM':
      return { ...state, pendingClaim: null }

    case 'MATCH_RESULT': {
      const { win, ending, by } = action.payload ?? {}
      const s = clone(state)
      s.speed = 0
      if (win) {
        const def = ENDINGS[ending] ?? { title: '勝利', text: '' }
        s.phase = 'victory'
        s.achieved = { ...(s.achieved ?? {}), [ending]: s.day }
        s.ending = { type: ending, title: def.title, text: def.text.replaceAll('{by}', by ?? ''), kind: 'victory' }
        log(s, 'good', `【${def.title}】この対戦を制した。`)
      } else {
        const def = ENDINGS.outpaced
        s.phase = 'gameover'
        s.ending = {
          type: 'outpaced',
          title: def.title,
          text: def.text.replaceAll('{by}', by ?? '他の教団'),
          kind: 'defeat',
        }
        log(s, 'warn', `【${def.title}】${s.ending.text}`)
      }
      return s
    }

    case 'INVEST': {
      if (state.phase !== 'playing') return state
      const { vehicle, amount } = action.payload ?? {}
      const v = VEHICLE_MAP[vehicle]
      const put = Math.floor(Math.min(Number(amount) || 0, state.funds))
      if (!v || put <= 0) return state
      const s = clone(state)
      s.investments = { ...s.investments, [vehicle]: (s.investments?.[vehicle] ?? 0) + put }
      s.funds -= put
      s.investTotalIn = (s.investTotalIn ?? 0) + put
      log(s, 'system', `${v.name}に${put.toLocaleString()}円を投じた。`)
      return s
    }

    case 'DIVEST': {
      if (state.phase !== 'playing') return state
      const { vehicle, amount } = action.payload ?? {}
      const v = VEHICLE_MAP[vehicle]
      const held = state.investments?.[vehicle] ?? 0
      const take = Math.floor(Math.min(Number(amount) || 0, held))
      if (!v || take <= 0) return state
      const s = clone(state)
      s.investments = { ...s.investments, [vehicle]: held - take }
      s.funds += take
      s.investTotalOut = (s.investTotalOut ?? 0) + take
      log(s, 'system', `${v.name}から${take.toLocaleString()}円を引き上げた。`)
      return s
    }

    case 'DISMISS_EVENT':
      return { ...state, pendingEvent: null }

    default:
      return state
  }
}
