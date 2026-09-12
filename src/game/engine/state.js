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
export function defaultBusinessNames(order) {
  const base = order || DEFAULT_ORDER_NAME
  return { press: `${base}出版`, school: `${base}学園`, foundation: `${base}財団`, party: `${base}党` }
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
    bankruptDays: 0,
    election: { foundedDay: null, nextDay: null, attempts: 0, lastResult: null },
    victories: 0,
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
