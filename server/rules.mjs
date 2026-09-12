// 対戦のルール。クライアントに詐称されたくない判定はここに集約する。

export const PACE_MIN_SEC = 2      // 1日あたりの実時間（秒）の下限
export const PACE_MAX_SEC = 60
export const PACE_DEFAULT_SEC = 8

// 暗殺
export const ASSASSIN_MIN_UNDERWORLD = 30   // 裏社会のつてが要る
export const ASSASSIN_COST = 400_000_000    // 1回あたりの費用
export const ASSASSIN_BACKLASH_GAP = 25     // 相手がこれ以上濃ければ逆襲される
export const ASSASSIN_FAIL_UNDERWORLD = 18  // 失敗時に自分へ乗る闇度
export const ASSASSIN_WIN_UNDERWORLD = 6    // 成功時にも多少は濃くなる

/**
 * 暗殺の判定。闇の濃い側が勝つ。
 *   - 実行には自分の闇度が ASSASSIN_MIN_UNDERWORLD 以上必要
 *   - 相手も同じ水準に達していないと、そもそも手がかりが無い
 *   - 自分の方が濃ければ成功、薄ければ失敗して足がつく
 *   - 相手が大きく上回っていれば逆襲されて自分が終わる
 */
export function resolveAssassination(attackerUw, targetUw) {
  if (attackerUw < ASSASSIN_MIN_UNDERWORLD) {
    return { outcome: 'unable', reason: `裏社会のつてが無い（闇度${ASSASSIN_MIN_UNDERWORLD}以上が必要）` }
  }
  if (targetUw < ASSASSIN_MIN_UNDERWORLD) {
    return { outcome: 'unable', reason: '相手は裏社会と繋がっておらず、手がかりが掴めない' }
  }
  if (targetUw >= attackerUw + ASSASSIN_BACKLASH_GAP) {
    return { outcome: 'backlash', attackerUnderworld: ASSASSIN_FAIL_UNDERWORLD }
  }
  if (attackerUw > targetUw) {
    return { outcome: 'success', attackerUnderworld: ASSASSIN_WIN_UNDERWORLD }
  }
  return { outcome: 'failed', attackerUnderworld: ASSASSIN_FAIL_UNDERWORLD }
}

/** 希望時間の平均で1日の長さを決める */
export function decidePace(votes) {
  const vals = Object.values(votes).filter((v) => Number.isFinite(v))
  if (vals.length === 0) return PACE_DEFAULT_SEC * 1000
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  return Math.round(Math.min(PACE_MAX_SEC, Math.max(PACE_MIN_SEC, avg)) * 1000)
}

/** 共通の日数。停止できない。 */
export function dayAt(startedAt, msPerDay, now = Date.now()) {
  if (!startedAt) return 1
  return Math.floor((now - startedAt) / msPerDay) + 1
}
