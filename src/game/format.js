const OKU = 100_000_000
const MAN = 10_000
const CHO = 1_000_000_000_000

/** 円を日本語の桁で読みやすく */
export function yen(n) {
  const v = Math.round(n)
  const sign = v < 0 ? '-' : ''
  const a = Math.abs(v)
  if (a >= CHO) return `${sign}${(a / CHO).toFixed(2)}兆円`
  if (a >= OKU) return `${sign}${(a / OKU).toFixed(2)}億円`
  if (a >= MAN) return `${sign}${Math.round(a / MAN).toLocaleString()}万円`
  return `${sign}${a.toLocaleString()}円`
}

/** 収支など、符号を明示したい金額 */
export function yenSigned(n) {
  const v = Math.round(n)
  return (v > 0 ? '+' : '') + yen(v)
}

/** 人数 */
export function people(n) {
  const v = Math.floor(n)
  if (v >= OKU) return `${(v / OKU).toFixed(2)}億人`
  if (v >= MAN) return `${Math.round(v / MAN).toLocaleString()}万人`
  return `${v.toLocaleString()}人`
}

/** 人数（厳密） */
export function peopleExact(n) {
  return `${Math.floor(n).toLocaleString()}人`
}

export function pct(x, digits = 1) {
  return `${(x * 100).toFixed(digits)}%`
}

export function dayLabel(day) {
  const y = Math.floor((day - 1) / 365) + 1
  const d = ((day - 1) % 365) + 1
  return `${y}年目 ${d}日`
}

/** 施設に固有名がついていればそれを返す */
const FACILITY_NAME_KEY = {
  press: 'press',
  school: 'school',
  foundationOffice: 'foundation',
  partyHQ: 'party',
}

export function facilityLabel(state, typeId, fallback) {
  const key = FACILITY_NAME_KEY[typeId]
  const custom = key ? state.names?.[key] : null
  return custom || fallback
}

export function orderName(state) {
  return state.names?.order || '教団'
}
