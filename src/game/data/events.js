// ランダムイベント。名前・本文・重みは src/content/events.json で差し替えられる。
// 発生条件(cond)と効果(apply)はロジックなのでここに置く（idで対応づける）。
import TABLE from '../../content/events.json' with { type: 'json' }

export const EVENT_CHANCE = 0.09

const LOGIC = {
  bestseller: {
    kind: 'good',
    cond: (c) => c.businesses.publishing,
    apply: (c) => ({ funds: Math.round(c.income * 6), faith: 2, followerMult: 1.03 }),
  },
  celebrityJoin: {
    kind: 'good',
    cond: (c) => c.followers > 5_000,
    apply: () => ({ followerMult: 1.08, wariness: 2, faith: 1 }),
  },
  charityPraised: {
    kind: 'good',
    cond: (c) => c.businesses.foundation || c.followers > 30_000,
    apply: () => ({ wariness: -6, faith: 1 }),
  },
  donationRush: {
    kind: 'good',
    cond: (c) => c.followers > 2_000,
    apply: (c) => ({ funds: Math.round(Math.max(3_000_000, c.income * 14)) }),
  },
  miracleRumor: {
    kind: 'good',
    cond: (c) => c.doctrine.apocalypse > 60 || c.doctrine.asceticism > 65,
    apply: () => ({ followerMult: 1.06, faith: 4, wariness: 2 }),
  },
  tabloid: {
    kind: 'bad',
    cond: (c) => c.followers > 1_000,
    apply: () => ({ wariness: 7, faith: -2 }),
  },
  exMember: {
    kind: 'bad',
    cond: (c) => c.followers > 8_000,
    apply: (c) => ({ wariness: 9, faith: -4, followerMult: c.doctrine.asceticism > 65 ? 0.94 : 0.97 }),
  },
  taxAudit: {
    kind: 'bad',
    cond: (c) => c.wariness > 35,
    apply: (c) => ({
      funds: -Math.round(Math.min(Math.max(c.income * 18, 2_000_000), Math.max(0, c.funds) * 0.3)),
      wariness: 4,
    }),
  },
  localOpposition: {
    kind: 'bad',
    cond: (c) => c.facilityCount >= 4,
    apply: () => ({ wariness: 6, followerMult: 0.98 }),
  },
  internalSplit: {
    kind: 'bad',
    cond: (c) => c.priests >= 10,
    apply: (c) => ({ priests: -Math.max(1, Math.floor(c.priests * 0.08)), faith: -3 }),
  },
  investigation: {
    kind: 'bad',
    cond: (c) => c.wariness > 60,
    apply: (c) => ({
      funds: -Math.round(Math.min(Math.max(c.income * 25, 5_000_000), Math.max(0, c.funds) * 0.35)),
      wariness: 5,
      faith: -5,
      followerMult: 0.95,
    }),
  },
}

export const EVENTS = Object.entries(TABLE)
  .filter(([id]) => LOGIC[id])
  .map(([id, text]) => ({ id, ...text, ...LOGIC[id] }))
