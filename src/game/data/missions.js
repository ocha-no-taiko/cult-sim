// 布教施策。定義は src/content/missions.json。
//   layer 'followers' 信者数で解禁 / 'funds' 累計投下額で解禁
//   mode  'sustained' ON/OFFの継続施策（日額費用）/ 'oneshot' 一括費用の単発（duration 日持続）
//   mediaScaled 地方の広報適性に比例 / wordScaled 口コミ適性に比例 / requiresFounder 教祖が必要
import TABLE from '../../content/missions.json' with { type: 'json' }

export const MISSIONS = Object.entries(TABLE).map(([id, m]) => ({ id, ...m }))
export const MISSION_MAP = Object.fromEntries(MISSIONS.map((m) => [m.id, m]))
