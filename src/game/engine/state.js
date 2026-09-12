import { REGIONS, REGION_MAP } from '../data/regions.js'
import { CLUSTERS } from '../data/clusters.js'
import { DEFAULT_DOCTRINE } from '../data/doctrine.js'
import { DIFFICULTY_MAP } from './constants.js'

export const SAVE_VERSION = 2

function emptyRegionClusters(faith) {
  const out = {}
  for (const c of CLUSTERS) out[c.id] = { followers: 0, faith }
  return out
}

export const DEFAULT_ORDER_NAME = '天啓会'

/** 教団名から各事業の既定名を導く */
/** 事業idと、その事業でつける名前の保存先キーの対応 */
export const BUSINESS_NAME_KEY = {
  publishing: 'press',
  education: 'school',
  welfare: 'hospital',
  foundation: 'foundation',
  arts: 'culture',
  party: 'party',
  conspiracy: 'info',
  nightlife: 'night',
  usury: 'usury',
  narcotics: 'lab',
  syndicate: 'syndicate',
}

export function defaultBusinessNames(order) {
  const base = order || DEFAULT_ORDER_NAME
  return {
    press: `${base}出版`,
    school: `${base}学園`,
    hospital: `${base}病院`,
    foundation: `${base}財団`,
    culture: `${base}美術館`,
    party: `${base}党`,
    info: `${base}通信`,
    night: `${base}興業`,
    usury: `${base}ファイナンス`,
    lab: `${base}研究所`,
    syndicate: `${base}会`,
  }
}

export function createInitialState({ difficulty = 'normal', homeRegionId = 'kanto', orderName = DEFAULT_ORDER_NAME } = {}) {
  const diff = DIFFICULTY_MAP[difficulty] ?? DIFFICULTY_MAP.normal
  const home = REGION_MAP[homeRegionId]

  const regions = {}
  for (const r of REGIONS) {
    regions[r.id] = {
      id: r.id,
      unlocked: r.id === homeRegionId,
      isHome: r.id === homeRegionId,
      openedDay: r.id === homeRegionId ? 1 : null,
      clusters: emptyRegionClusters(r.id === homeRegionId ? 50 : 40),
    }
  }

  // 初期信者20人を拠点地方の人口構成に沿って配分する
  const seed = 20
  let assigned = 0
  const entries = CLUSTERS.map((c) => [c.id, home.demographics[c.id] ?? 0])
  entries.forEach(([cid, w], i) => {
    const n = i === entries.length - 1 ? seed - assigned : Math.max(1, Math.round(seed * w))
    regions[homeRegionId].clusters[cid].followers = Math.max(0, n)
    assigned += n
  })

  return {
    version: SAVE_VERSION,
    phase: 'founding',
    difficulty,
    day: 1,
    speed: 0,
    funds: diff.funds,
    totalSpent: 0,
    homeRegion: homeRegionId,
    names: { order: orderName || DEFAULT_ORDER_NAME, press: '', school: '', foundation: '', party: '' },
    doctrine: { ...DEFAULT_DOCTRINE },
    doctrineRevisions: 0,
    regions,
    priests: 0,
    founder: null,
    facilities: [{ uid: 1, type: 'hq', x: 2, y: 2, staff: 'auto' }],
    nextUid: 2,
    businesses: { publishing: false, education: false, foundation: false, party: false },
    activeMissions: { street: true },
    timedMissions: {},
    missionUses: {},
    convertedToday: 0,
    wariness: 0,
    warinessStage: -1,
    underworld: 0,
    underworldStage: -1,
    founderInjuredUntil: 0,
    bankruptDays: 0,
    election: { foundedDay: null, nextDay: null, attempts: 0, lastResult: null },
    victories: 0,
    achieved: {},
    multiplayer: false,
    pendingEvent: null,
    ending: null,
    history: [],
    log: [
      {
        day: 1,
        kind: 'system',
        text: `${home.name}に「${orderName || DEFAULT_ORDER_NAME}」の小さな教会を構えた。信者は20人。ここから始まる。`,
      },
    ],
    stats: { peakFollowers: seed, peakFunds: diff.funds, eventsSeen: 0 },
  }
}
