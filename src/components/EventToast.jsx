import React from 'react'
import { yen } from '../game/format.js'

const LABELS = {
  funds: (v) => [`資金 ${v > 0 ? '+' : '-'}${yen(Math.abs(v))}`, v > 0],
  wariness: (v) => [`警戒度 ${v > 0 ? '+' : ''}${v.toFixed(1)}`, v < 0],
  faith: (v) => [`信仰度 ${v > 0 ? '+' : ''}${v.toFixed(1)}`, v > 0],
  priests: (v) => [`聖職者 ${v > 0 ? '+' : ''}${v}人`, v > 0],
  followerMult: (v) => [`信者 ${((v - 1) * 100).toFixed(1)}%`, v > 1],
}

/** 時間を止めずに出来事を知らせる。クリックか一定時間で消える。 */
export default function EventToast({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className="toasts">
      {toasts.map((e) => (
        <div key={e.key} className={`toast ${e.kind}`} onClick={() => onDismiss(e.key)} title="クリックで閉じる">
          <div className="tt">{e.kind === 'good' ? '◇' : '◆'} {e.name}</div>
          <div className="tx">{e.text}</div>
          <div className="card-eff">
            {Object.entries(e.res ?? {}).map(([k, v]) => {
              const f = LABELS[k]
              if (!f || !v) return null
              const [text, good] = f(v)
              return <span key={k} className={`eff ${good ? 'pos' : 'neg'}`}>{text}</span>
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
