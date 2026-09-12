// 宗教都市の施設と事業。定義は src/content/facilities.json / businesses.json。
//
// 施設は建てただけでは効果が出ず、「教祖ロック」か「規定数の聖職者ロック」で初めて稼働する。
// effect の各値は稼働中のみ加算される。
//   growth 信者獲得倍率 / donation お布施倍率 / faith 信仰度の日次回復 / churn 離脱率倍率
//   wariness 警戒度の日次変化 / income 固定日次収入 / incomePerPriest 聖職者1人あたり日次収入
//   convertCap 1日の聖職者転向枠 / votePower 得票係数
import FACILITY_TABLE from '../../content/facilities.json' with { type: 'json' }
import BUSINESS_TABLE from '../../content/businesses.json' with { type: 'json' }

export const FACILITY_TYPES = Object.entries(FACILITY_TABLE).map(([id, f]) => ({ id, ...f }))
export const FACILITY_MAP = Object.fromEntries(FACILITY_TYPES.map((f) => [f.id, f]))

export const BUSINESSES = Object.entries(BUSINESS_TABLE).map(([id, b]) => ({ id, ...b }))
export const BUSINESS_MAP = Object.fromEntries(BUSINESSES.map((b) => [b.id, b]))
