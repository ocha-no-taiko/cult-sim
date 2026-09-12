import React, { useRef, useState, useCallback } from 'react'
import { FACILITY_MAP } from '../game/data/facilities.js'
import { GRID_W, GRID_H } from '../game/engine/constants.js'
import { isEdgeTile } from '../game/engine/city.js'
import { facilityLabel } from '../game/format.js'

// ── 立体表示（等角投影） ───────────────────────────
const ISO_TW = 96
const ISO_TH = 48
const ISO = {
  id: 'iso',
  VB_W: 536,
  VB_H: 368,
  OX: 268,
  OY: 104,
  toScreen: (x, y) => ({
    cx: (x - y) * (ISO_TW / 2) + ISO.OX,
    cy: (x + y) * (ISO_TH / 2) + ISO.OY,
  }),
  toTile: (sx, sy) => {
    const u = (sx - ISO.OX) / (ISO_TW / 2)
    const v = (sy - ISO.OY) / (ISO_TH / 2)
    return { x: Math.round((u + v) / 2), y: Math.round((v - u) / 2) }
  },
  // 建物を掴むとき、見た目の中心は地面よりだいぶ上にある
  grabLift: 26,
}

// ── 平面表示（真上から） ───────────────────────────
const FLAT_CW = 96
const FLAT_CH = 80
const FLAT = {
  id: 'flat',
  VB_W: GRID_W * FLAT_CW,
  VB_H: GRID_H * FLAT_CH,
  toScreen: (x, y) => ({ cx: x * FLAT_CW + FLAT_CW / 2, cy: y * FLAT_CH + FLAT_CH / 2 }),
  toTile: (sx, sy) => ({ x: Math.floor(sx / FLAT_CW), y: Math.floor(sy / FLAT_CH) }),
  grabLift: 0,
}

const diamond = (cx, cy, w = ISO_TW, h = ISO_TH) =>
  `${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.max(0, Math.min(255, Math.round(c + amount))),
  )
  return `rgb(${ch.join(',')})`
}

const DEFAULT_LOOK = { height: 34, color: '#7c8aa6', roof: 'flat' }
const lookOf = (type) => ({ ...DEFAULT_LOOK, ...(FACILITY_MAP[type]?.look ?? {}) })

const statusText = (state, f) => {
  const def = FACILITY_MAP[f.type]
  if (def.alwaysActive) return '常時稼働'
  if (f.staff === 'founder' && state.founder === f.uid) return '教祖が常駐'
  if (f.staff === 'priests') return `聖職者${def.priests}人`
  return '停止中'
}

// ── 立体の建物 ────────────────────────────────────
function IsoBuilding({ f, cx, cy, active, selected, label, status }) {
  const def = FACILITY_MAP[f.type]
  const look = lookOf(f.type)
  const h = look.height
  const w = ISO_TW * 0.68
  const d = ISO_TH * 0.68
  const base = active ? look.color : '#4b4f58'
  const top = shade(base, active ? 34 : 14)

  return (
    <g style={{ cursor: 'grab' }}>
      <polygon points={diamond(cx, cy + 3, w * 1.12, d * 1.12)} fill="rgba(0,0,0,0.42)" />
      <polygon
        points={`${cx - w / 2},${cy} ${cx},${cy + d / 2} ${cx},${cy + d / 2 - h} ${cx - w / 2},${cy - h}`}
        fill={shade(base, -46)}
      />
      <polygon
        points={`${cx + w / 2},${cy} ${cx},${cy + d / 2} ${cx},${cy + d / 2 - h} ${cx + w / 2},${cy - h}`}
        fill={shade(base, -14)}
      />
      <polygon points={diamond(cx, cy - h, w, d)} fill={top} stroke={shade(base, 60)} strokeWidth="0.8" />

      {look.roof === 'tower' && (
        <>
          <polygon points={`${cx},${cy - h - 26} ${cx + w / 2.6},${cy - h - 4} ${cx},${cy - h + 8} ${cx - w / 2.6},${cy - h - 4}`}
            fill={shade(base, 56)} />
          <rect x={cx - 2} y={cy - h - 40} width="4" height="16" fill={shade(base, 70)} />
        </>
      )}
      {look.roof === 'gable' && (
        <polygon points={`${cx},${cy - h - 16} ${cx + w / 2},${cy - h} ${cx},${cy - h + d / 2} ${cx - w / 2},${cy - h}`}
          fill={shade(base, 52)} />
      )}
      {look.roof === 'dome' && <ellipse cx={cx} cy={cy - h - 2} rx={w / 3.2} ry={d / 2.4} fill={shade(base, 52)} />}
      {look.roof === 'antenna' && (
        <>
          <line x1={cx} y1={cy - h} x2={cx} y2={cy - h - 34} stroke={shade(base, 60)} strokeWidth="2.5" />
          <circle cx={cx} cy={cy - h - 36} r="3.2" fill="var(--accent-soft)" />
          <line x1={cx - 9} y1={cy - h - 16} x2={cx + 9} y2={cy - h - 16} stroke={shade(base, 40)} strokeWidth="1.6" />
        </>
      )}

      {active
        ? <text x={cx} y={cy - h + 5} textAnchor="middle" fontSize="16">{def.icon}</text>
        : <text x={cx} y={cy - h + 4} textAnchor="middle" fontSize="15" fill="#e0a33f" opacity="0.85">✕</text>}

      {selected && (
        <polygon points={diamond(cx, cy, ISO_TW * 0.94, ISO_TH * 0.94)} fill="none" stroke="var(--accent)" strokeWidth="2.2" />
      )}
      <text x={cx} y={cy + ISO_TH / 2 + 11} textAnchor="middle" className="iso-label">{label}</text>
      <title>{`${label}／${status}`}</title>
    </g>
  )
}

// ── 平面の建物 ────────────────────────────────────
function FlatBuilding({ f, cx, cy, active, selected, label, status }) {
  const def = FACILITY_MAP[f.type]
  const look = lookOf(f.type)
  const w = FLAT_CW - 12
  const h = FLAT_CH - 14
  const color = active ? look.color : '#5a5f6a'

  return (
    <g style={{ cursor: 'grab' }}>
      <rect
        x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx="3"
        fill={active ? `${look.color}26` : '#1c2029'}
        stroke={selected ? 'var(--accent)' : color}
        strokeWidth={selected ? 2.2 : 1.3}
      />
      <rect x={cx - w / 2} y={cy - h / 2} width="4" height={h} rx="2" fill={color} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="19">{def.icon}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" className="flat-label">{label}</text>
      <text
        x={cx} y={cy + 24} textAnchor="middle" className="flat-status"
        style={{ fill: active ? 'var(--good)' : 'var(--warn)' }}
      >
        {status}
      </text>
      <title>{`${label}／${status}`}</title>
    </g>
  )
}

export default function CityMap({ state, city, selected, onSelect, onMove, showSynergy, mode = 'iso' }) {
  const svgRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const proj = mode === 'flat' ? FLAT : ISO
  const Building = mode === 'flat' ? FlatBuilding : IsoBuilding

  const facAt = (x, y) => state.facilities.find((f) => f.x === x && f.y === y)

  const pointerToSvg = useCallback((e) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = svg.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = pt.matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }, [])

  const onPointerDown = (e, f) => {
    e.preventDefault()
    const p = pointerToSvg(e)
    const { cx, cy } = proj.toScreen(f.x, f.y)
    // ポインタ捕捉は環境によっては失敗しうるので、失敗してもドラッグは続行する
    try { svgRef.current?.setPointerCapture?.(e.pointerId) } catch { /* noop */ }
    setDrag({ uid: f.uid, grabDX: p.x - cx, grabDY: p.y - cy, px: p.x, py: p.y, over: { x: f.x, y: f.y }, moved: false })
  }

  const onPointerMove = (e) => {
    if (!drag) return
    const p = pointerToSvg(e)
    const t = proj.toTile(p.x - drag.grabDX, p.y - drag.grabDY)
    const over = {
      x: Math.max(0, Math.min(GRID_W - 1, t.x)),
      y: Math.max(0, Math.min(GRID_H - 1, t.y)),
    }
    const moved = drag.moved || Math.abs(p.x - drag.px) > 5 || Math.abs(p.y - drag.py) > 5
    setDrag({ ...drag, px: p.x, py: p.y, over, moved })
  }

  const endDrag = (e) => {
    if (!drag) return
    try { svgRef.current?.releasePointerCapture?.(e.pointerId) } catch { /* noop */ }
    const f = state.facilities.find((x) => x.uid === drag.uid)
    if (drag.moved && f && drag.over && (drag.over.x !== f.x || drag.over.y !== f.y)) {
      onMove(drag.uid, drag.over.x, drag.over.y)
    } else if (f) {
      onSelect({ x: f.x, y: f.y })
    }
    setDrag(null)
  }

  const ordered = [...state.facilities].sort((a, b) => a.x + a.y - (b.x + b.y))
  const dragging = drag ? state.facilities.find((f) => f.uid === drag.uid) : null

  const tileShape = (x, y, extra) => {
    const { cx, cy } = proj.toScreen(x, y)
    if (mode === 'flat') {
      return <rect x={cx - (FLAT_CW - 10) / 2} y={cy - (FLAT_CH - 10) / 2}
        width={FLAT_CW - 10} height={FLAT_CH - 10} rx="3" {...extra} />
    }
    return <polygon points={diamond(cx, cy)} {...extra} />
  }

  const haloShape = (x, y) => {
    const { cx, cy } = proj.toScreen(x, y)
    const props = {
      fill: 'none', stroke: 'rgba(201,162,39,0.38)', strokeWidth: 1.2, strokeDasharray: '3 3',
    }
    if (mode === 'flat') {
      return <rect x={cx - (FLAT_CW - 18) / 2} y={cy - (FLAT_CH - 18) / 2}
        width={FLAT_CW - 18} height={FLAT_CH - 18} rx="3" {...props} />
    }
    return <polygon points={diamond(cx, cy, ISO_TW * 0.86, ISO_TH * 0.86)} {...props} />
  }

  return (
    <svg
      ref={svgRef}
      className="city-svg"
      viewBox={`0 0 ${proj.VB_W} ${proj.VB_H}`}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      role="img"
      aria-label="宗教都市の区画"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#151922" />
          <stop offset="100%" stopColor="#0e1116" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={proj.VB_W} height={proj.VB_H} fill="url(#sky)" />

      {/* 地面 */}
      {Array.from({ length: GRID_H }).map((_, y) =>
        Array.from({ length: GRID_W }).map((_, x) => {
          const { cx, cy } = proj.toScreen(x, y)
          const f = facAt(x, y)
          const haloTile = showSynergy && city.hq &&
            Math.max(Math.abs(x - city.hq.x), Math.abs(y - city.hq.y)) === 1
          const isOver = drag?.over && drag.over.x === x && drag.over.y === y
          const isSel = selected && selected.x === x && selected.y === y
          return (
            <g key={`t-${x}-${y}`} onClick={() => !drag?.moved && onSelect({ x, y })} style={{ cursor: 'pointer' }}>
              {tileShape(x, y, {
                fill: isOver ? '#3a2f2c' : haloTile ? '#1d2028' : '#171b22',
                stroke: isOver || isSel ? 'var(--accent)' : '#252b36',
                strokeWidth: isOver || isSel ? 1.8 : 1,
              })}
              {haloTile && haloShape(x, y)}
              {showSynergy && isEdgeTile(x, y) && (
                mode === 'flat'
                  ? <circle cx={cx - FLAT_CW / 2 + 12} cy={cy - FLAT_CH / 2 + 12} r="3" fill="rgba(94,184,255,0.4)" />
                  : <polygon points={diamond(cx, cy, ISO_TW * 0.2, ISO_TH * 0.2)} fill="rgba(94,184,255,0.22)" />
              )}
              {!f && <text x={cx} y={cy + 5} textAnchor="middle" className="iso-plus">＋</text>}
            </g>
          )
        }),
      )}

      {/* 建物（立体表示では奥から手前へ） */}
      {ordered.map((f) => {
        if (drag && drag.uid === f.uid && drag.moved) return null
        const { cx, cy } = proj.toScreen(f.x, f.y)
        const def = FACILITY_MAP[f.type]
        const active = def.alwaysActive
          || (f.staff === 'founder' ? state.founder === f.uid : f.staff === 'priests')
        return (
          <g key={f.uid} onPointerDown={(e) => onPointerDown(e, f)}>
            <Building
              f={f} cx={cx} cy={cy} active={active}
              selected={selected && selected.x === f.x && selected.y === f.y}
              label={facilityLabel(state, f.type, def.name)}
              status={statusText(state, f)}
            />
          </g>
        )
      })}

      {/* シナジーの線（建物の上に重ねて見せる） */}
      {showSynergy && city.links.map((l, i) => {
        const a = state.facilities.find((f) => f.uid === l.a)
        const b = state.facilities.find((f) => f.uid === l.b)
        if (!a || !b) return null
        const p1 = proj.toScreen(a.x, a.y)
        const p2 = proj.toScreen(b.x, b.y)
        const mx = (p1.cx + p2.cx) / 2
        const my = (p1.cy + p2.cy) / 2
        return (
          <g key={`l-${i}`} pointerEvents="none">
            <line x1={p1.cx} y1={p1.cy} x2={p2.cx} y2={p2.cy}
              stroke="rgba(12,10,8,0.55)" strokeWidth="5" strokeLinecap="round" />
            <line x1={p1.cx} y1={p1.cy} x2={p2.cx} y2={p2.cy}
              stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="5 4" />
            <circle cx={mx} cy={my} r="4.6" fill="#1a1509" stroke="var(--gold)" strokeWidth="1.4" />
            <circle cx={mx} cy={my} r="1.7" fill="var(--gold)" />
          </g>
        )
      })}

      {/* ドラッグ中の仮置き */}
      {drag && drag.moved && dragging && (() => {
        const { cx, cy } = proj.toScreen(drag.over.x, drag.over.y)
        const swap = facAt(drag.over.x, drag.over.y)
        const def = FACILITY_MAP[dragging.type]
        return (
          <g pointerEvents="none">
            <Building
              f={dragging} cx={cx} cy={cy} active
              label={facilityLabel(state, dragging.type, def.name)}
              status={statusText(state, dragging)}
            />
            {swap && swap.uid !== dragging.uid && (
              <text x={cx} y={cy - (mode === 'flat' ? FLAT_CH / 2 + 4 : 76)} textAnchor="middle" className="iso-hint">
                入れ替え
              </text>
            )}
          </g>
        )
      })()}
    </svg>
  )
}
