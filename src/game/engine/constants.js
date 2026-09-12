export const GRID_W = 5
export const GRID_H = 5

export const BASE_GROWTH_RATE = 0.018
export const NEWCOMER_FAITH = 35
export const FAITH_DECAY = 0.28
export const PRIEST_UPKEEP = 3_000
export const PRIEST_BASE_COST = 180_000
export const BRANCH_MIN_FOLLOWERS = 25_000
export const ELECTION_LEAD_DAYS = 120
export const ELECTION_RETRY_DAYS = 180
export const VOTE_BASE_POWER = 1.60
export const ELECTORATE_RATIO = 0.82
export const BANKRUPT_LIMIT = 3
export const HISTORY_CAP = 4000
export const LOG_CAP = 200

export const DIFFICULTIES = [
  {
    id: 'easy',
    name: '緩やか',
    funds: 50_000_000,
    warinessMult: 0.70,
    desc: '初期資金5,000万円。世間は寛容で、警戒度がなかなか上がらない。',
  },
  {
    id: 'normal',
    name: '標準',
    funds: 20_000_000,
    warinessMult: 1.00,
    desc: '初期資金2,000万円。標準的な社会の目。',
  },
  {
    id: 'hard',
    name: '峻厳',
    funds: 8_000_000,
    warinessMult: 1.45,
    desc: '初期資金800万円。世間は新興教団に極めて敏感。',
  },
]

export const DIFFICULTY_MAP = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]))

export const WARINESS_STAGES = [
  { at: 35, label: 'メディアの注目', text: '週刊誌が教団の名を出し始めた。' },
  { at: 60, label: '行政の監視', text: '所轄庁が教団を注視対象に指定した。' },
  { at: 85, label: '強制捜査の予兆', text: '捜査当局が令状の準備に入ったという情報が入った。' },
]
