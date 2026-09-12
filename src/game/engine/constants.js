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

// 闇度（教団の裏の顔の濃さ）
export const UNDERWORLD_FADE_BASE = 0.15
export const UNDERWORLD_FADE_SCALE = 0.008
export const ASSASSINATION_FLOOR = 80      // これを超えると暗殺が現実になる
export const ASSASSINATION_RATE = 0.055    // 闇度100のときの1日あたりの確率
export const ATTEMPT_FLOOR = 70            // 暗殺未遂が起きはじめる闇度
export const ATTEMPT_RATE = 0.012
export const FOUNDER_RECOVERY_DAYS = 20    // 未遂に遭った教祖が動けない日数

export const UNDERWORLD_STAGES = [
  { at: 45, label: '裏社会との距離', text: '教団の名が、堅気でない筋の口に上るようになった。' },
  { at: 70, label: '狙われる立場', text: '教祖の身辺を嗅ぎ回る者がいる。護衛を増やすべきだという声がある。' },
  { at: 90, label: '命の危険', text: 'いつ消されてもおかしくない。教祖自身がそれを分かっている。' },
]

// 国教化以外の決着
export const CONGLOMERATE_FUNDS = 100_000_000_000_000  // 100兆円
export const CONGREGATION_SHARE = 0.50                 // 全人口に占める信者の割合
// 国教化すると布教が制度に組み込まれ、地方ごとの上限が上がる
export const STATE_RELIGION_CAP_BONUS = 1.55
export const UPRISING_UNDERWORLD = 95
export const UPRISING_FOLLOWERS = 5_000_000

export const WARINESS_STAGES = [
  { at: 35, label: 'メディアの注目', text: '週刊誌が教団の名を出し始めた。' },
  { at: 60, label: '行政の監視', text: '所轄庁が教団を注視対象に指定した。' },
  { at: 85, label: '強制捜査の予兆', text: '捜査当局が令状の準備に入ったという情報が入った。' },
]
