import React from 'react'
import { founderBusyOn } from '../game/engine/selectors.js'

/**
 * 教祖が拘束されていて行動できないときに、その場で解放するためのボタン。
 * 教祖ロックは意図した制約だが、詰まったまま気づけない事故は防ぐ。
 */
export default function FounderRelease({ state, act, note }) {
  const busy = founderBusyOn(state)
  if (!busy) return null

  return (
    <div className="hint alert" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 200 }}>
        {note ?? 'この操作は教祖にしかできない。'}
        いま教祖は<b>{busy.label}</b>に出ているため手が空いていない。
      </span>
      {busy.kind === 'facility' ? (
        <button className="btn sm" onClick={() => act('SET_STAFF', { uid: busy.uid, mode: 'none' })}>
          教祖を{busy.label}から引き上げる
        </button>
      ) : (
        <button className="btn sm" onClick={() => act('TOGGLE_MISSION', busy.uid)}>
          {busy.label}を中止して教祖を戻す
        </button>
      )}
    </div>
  )
}
