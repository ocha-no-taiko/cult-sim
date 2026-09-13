// 投資事業。運転資金の一部を運用に回し、日ごとに評価額が動く。
// 運用先の定義は src/content/investments.json。
import TABLE from '../../content/investments.json' with { type: 'json' }

export const VEHICLES = Object.entries(TABLE).map(([id, v]) => ({ id, ...v }))
export const VEHICLE_MAP = Object.fromEntries(VEHICLES.map((v) => [v.id, v]))

export const emptyPortfolio = () => Object.fromEntries(VEHICLES.map((v) => [v.id, 0]))

/** 正規分布に近い乱数（-1〜1あたりに収まる） */
function noise() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5
}

export function portfolioValue(inv) {
  return VEHICLES.reduce((s, v) => s + (inv?.[v.id] ?? 0), 0)
}

/**
 * 市場の受け入れ容量。capacity までは働くが、それを超えて預けた分はただ寝ている。
 * 積み増し続けても青天井にはならず、かといって元本を食いもしない。
 */
export function activePortion(v, amount) {
  const cap = v.capacity
  if (!cap || !Number.isFinite(cap)) return Math.max(0, amount)
  return Math.min(Math.max(0, amount), cap)
}

export function idlePortion(v, amount) {
  return Math.max(0, (amount ?? 0) - activePortion(v, amount ?? 0))
}

/** 預けている全額に対する、1日あたりの期待値 */
export function expectedDaily(v, amount = 0) {
  const base = v.dailyReturn - v.crashChance * v.crashLoss
  if (!amount) return base
  return base * (activePortion(v, amount) / amount)
}

/**
 * 1日ぶんの運用結果。
 * 元本割れ（crash）は日次の抽選で、起きると評価額がまとめて減る。
 * 警戒度・闇度への影響は「総資産のうちどれだけをそこに置いているか」に比例させる。
 */
export function runInvestments(inv, totalWealth) {
  const next = { ...inv }
  const events = []
  let wariness = 0
  let underworld = 0

  for (const v of VEHICLES) {
    const amount = next[v.id] ?? 0
    if (amount <= 0) continue

    // 容量までの分だけが働く。超えた分はそのまま置かれているだけ。
    const active = activePortion(v, amount)
    const idle = amount - active
    let value = active * (1 + v.dailyReturn + noise() * v.volatility)
    if (Math.random() < v.crashChance) {
      const lost = value * v.crashLoss
      value -= lost
      events.push({ id: v.id, name: v.name, lost: Math.round(lost) })
    }
    next[v.id] = Math.max(0, value + idle)

    const share = totalWealth > 0 ? Math.min(1, amount / totalWealth) : 0
    wariness += v.wariness * share
    underworld += v.underworld * share
  }

  return { portfolio: next, events, wariness, underworld }
}
