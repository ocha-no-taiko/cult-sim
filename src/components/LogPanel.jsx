import React from 'react'

export default function LogPanel({ log }) {
  return (
    <div className="panel">
      <div className="panel-head">教団日誌</div>
      <div className="log">
        {log.length === 0 && <div className="log-row faint"><span className="t">まだ何も起きていない。</span></div>}
        {log.map((l, i) => (
          <div className={`log-row ${l.kind}`} key={`${l.day}-${i}`}>
            <span className="d">{l.day}</span>
            <span className="t">{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
