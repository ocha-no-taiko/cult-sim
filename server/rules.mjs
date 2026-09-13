// 対戦のルール。クライアントに詐称されたくない判定はここに集約する。

export const PACE_MIN_SEC = 2      // 1日あたりの実時間（秒）の下限
export const PACE_MAX_SEC = 60
export const PACE_DEFAULT_SEC = 8

// ── 暗殺（闇の濃い側の攻撃手段） ──────────────────
export const ASSASSIN_COOLDOWN_DAYS = 7
export const ASSASSIN_MIN_UNDERWORLD = 30   // 裏社会のつてが要る
export const ASSASSIN_COST = 400_000_000
export const ASSASSIN_BACKLASH_GAP = 25     // 相手がこれ以上濃ければ逆襲される
export const ASSASSIN_FAIL_UNDERWORLD = 18  // 失敗時に自分へ乗る闇度
export const ASSASSIN_WIN_UNDERWORLD = 6

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

// ── 訴訟（警戒度の低い側＝クリーンな側の攻撃手段） ──
export const LAWSUIT_COOLDOWN_DAYS = 3
export const LAWSUIT_COST = 100_000_000
export const LAWSUIT_COUNTER_GAP = 25        // 相手がこれ以上クリーンなら反訴される
export const LAWSUIT_SEIZE_MIN = 0.15        // 成功時に横取りする相手の運転資金の割合
export const LAWSUIT_SEIZE_MAX = 0.25
export const LAWSUIT_TARGET_WARINESS = 4     // 成功時に相手へ乗る警戒度
export const LAWSUIT_FAIL_WARINESS = 5       // 失敗時に自分へ乗る警戒度
export const LAWSUIT_COUNTER_WARINESS = 20   // 反訴されたときに自分へ乗る警戒度

/**
 * 訴訟の判定。相手が「汚れて見える」ほど通りやすく、自分が裏に沈んでいるほど通らない。
 * 警戒度は対戦中も公開情報なので、暗殺と違って読み合いではなく計算で撃てる。
 */
export function resolveLawsuit(attacker, target, roll = Math.random()) {
  const gap = target.wariness - attacker.wariness
  if (gap <= -LAWSUIT_COUNTER_GAP) {
    return { outcome: 'counter', attackerWariness: LAWSUIT_COUNTER_WARINESS, chance: 0 }
  }
  const chance = Math.max(0.05, Math.min(0.90, 0.15 + gap * 0.012 - attacker.underworld * 0.004))
  if (roll < chance) {
    const ratio = LAWSUIT_SEIZE_MIN + Math.random() * (LAWSUIT_SEIZE_MAX - LAWSUIT_SEIZE_MIN)
    return {
      outcome: 'success',
      chance,
      seizeRatio: ratio,
      seized: Math.floor(Math.max(0, target.funds) * ratio),
      targetWariness: LAWSUIT_TARGET_WARINESS,
    }
  }
  return { outcome: 'failed', chance, attackerWariness: LAWSUIT_FAIL_WARINESS }
}

/** 成立率だけを先に見せる（クライアントの表示用に同じ式を使う） */
export function lawsuitChance(attacker, target) {
  const gap = target.wariness - attacker.wariness
  if (gap <= -LAWSUIT_COUNTER_GAP) return 0
  return Math.max(0.05, Math.min(0.90, 0.15 + gap * 0.012 - attacker.underworld * 0.004))
}

// ── 他教団の事業への出資 ──────────────────────────
export const STAKE_DAYS = 7                 // 回収までの日数
export const STAKE_MAX_RATIO = 0.20         // 1件あたり、自分の運転資金の何割まで
export const STAKE_MAX_OPEN = 3             // 同時に持てる出資の件数

/**
 * 出資の回収。出資先がその事業の施設をどれだけ建てたか、
 * および7日間でどれだけ伸びたかで利率が決まる。伸びなければ元本割れもある。
 */
export function resolveStake(stake, now) {
  const facilities = now.facilityCount ?? 0
  const base = facilities * 0.035 - 0.05
  const before = Math.max(1, stake.snapshot.followers ?? 1)
  const growth = Math.max(-0.3, Math.min(0.5, (now.followers ?? 0) / before - 1))
  const rate = Math.max(-0.35, Math.min(0.45, base + growth * 0.4))
  return { rate, facilities, growth, payout: Math.round(stake.amount * (1 + rate)) }
}

// ── 難易度リターン（スコア） ──────────────────────
export const DIFFICULTY_SCORE = { easy: 0.7, normal: 1.0, hard: 1.5 }
export const ENDING_SCORE = {
  firstParty: 100,
  uprising: 140,
  congregation: 160,
  conglomerate: 180,
}

/**
 * 勝敗とは別に記録するスコア。
 * 1着を逃しても、難しい条件でどこまで積んだかが残るようにする。
 */
export function playerScore(p) {
  const mult = DIFFICULTY_SCORE[p.difficulty] ?? 1.0
  const endings = Object.keys(p.achieved ?? {}).reduce((a, k) => a + (ENDING_SCORE[k] ?? 0), 0)
  const progress =
    (p.pub?.share ?? 0) * 300 +
    (p.pub?.businesses?.length ?? 0) * 20 +
    (p.alive ? 50 : 0)
  return {
    total: Math.round((endings + progress) * mult),
    endings: Math.round(endings * mult),
    progress: Math.round(progress * mult),
    mult,
  }
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
