import React, { createContext, useContext, useState, useCallback } from 'react'
import TIPS from '../content/tips.json' with { type: 'json' }

const KEY = 'cult-tips-seen'

function load() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

const TipContext = createContext(null)

export function TipProvider({ children }) {
  const [seen, setSeen] = useState(load)

  const dismiss = useCallback((id) => {
    setSeen((prev) => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem(KEY, JSON.stringify([...next])) } catch { /* 保存できなくても続行 */ }
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    setSeen(new Set())
    try { localStorage.removeItem(KEY) } catch { /* noop */ }
  }, [])

  return (
    <TipContext.Provider value={{ seen, dismiss, resetAll }}>{children}</TipContext.Provider>
  )
}

export const useTips = () => useContext(TipContext) ?? { seen: new Set(), dismiss: () => {}, resetAll: () => {} }

/** 初回だけ出る手引きカード。閉じると以後は表示されない。 */
export default function TipCard({ id }) {
  const { seen, dismiss } = useTips()
  const tip = TIPS[id]
  if (!tip || seen.has(id)) return null
  return (
    <div className="tip-card">
      <div className="tip-head">
        <span>📖 {tip.title}</span>
        <button className="btn sm ghost" onClick={() => dismiss(id)}>わかった</button>
      </div>
      <ul className="tip-body">
        {tip.body.map((line, i) => <li key={i}>{line}</li>)}
      </ul>
    </div>
  )
}

/** すべての手引きをまとめて読む */
export function HelpModal({ onClose }) {
  const { resetAll } = useTips()
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680, maxHeight: '84vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">遊び方</div>
        <div className="modal-body" style={{ overflowY: 'auto', fontFamily: 'var(--gothic)', lineHeight: 1.7 }}>
          {Object.entries(TIPS).map(([id, tip]) => (
            <div key={id} className="tip-card" style={{ marginBottom: 12 }}>
              <div className="tip-head"><span>📖 {tip.title}</span></div>
              <ul className="tip-body">
                {tip.body.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={resetAll}>各画面の手引きを再表示する</button>
          <button className="btn primary" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  )
}
