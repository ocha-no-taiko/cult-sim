import { useState, useRef, useCallback, useEffect } from 'react'

// 接続先。既定では「このページを配っているホストの :8787」を見る。
// Tailscale 上の別マシンで動かす場合は ?server=host:port か localStorage で上書きできる。
export function defaultServerUrl() {
  try {
    const q = new URLSearchParams(location.search).get('server')
    if (q) return normalize(q)
    const saved = localStorage.getItem('cult-match-server')
    if (saved) return normalize(saved)
  } catch { /* noop */ }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = location.hostname || 'localhost'
  // tailscale serve などで同一オリジンに載せている場合は既定ポートのまま /ws を叩く
  const port = location.protocol === 'https:' ? '' : ':8787'
  return `${proto}//${host}${port}/ws`
}

function normalize(v) {
  if (v.startsWith('ws://') || v.startsWith('wss://')) return v.endsWith('/ws') ? v : `${v.replace(/\/$/, '')}/ws`
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${v.replace(/\/$/, '')}/ws`
}

const EMPTY_ROOM = { phase: 'idle', players: [], feed: [], limits: {} }

/**
 * 対戦サーバとの接続。
 * 教団のシミュレーション自体は各クライアントで走り、ここでは
 * 共通の時計・公開情報・暗殺・決着の先着だけをやり取りする。
 */
export function useMatch() {
  const wsRef = useRef(null)
  const [status, setStatus] = useState('idle')  // idle | connecting | joined | error
  const [error, setError] = useState(null)
  const [room, setRoom] = useState(EMPTY_ROOM)
  const [me, setMe] = useState(null)
  const [chances, setChances] = useState({})
  const [ranking, setRanking] = useState(null)
  const handlers = useRef({})

  const on = useCallback((map) => { handlers.current = { ...handlers.current, ...map } }, [])

  const send = useCallback((msg) => {
    const ws = wsRef.current
    if (ws?.readyState === 1) ws.send(JSON.stringify(msg))
  }, [])

  const join = useCallback(({ url, room: roomId, password, name }) => {
    setError(null)
    setStatus('connecting')
    try {
      const ws = new WebSocket(url || defaultServerUrl())
      wsRef.current = ws
      ws.onopen = () => ws.send(JSON.stringify({ t: 'join', room: roomId, password, name }))
      ws.onmessage = (ev) => {
        let m
        try { m = JSON.parse(ev.data) } catch { return }
        if (m.t === 'room') setRoom(m)
        else if (m.t === 'chances') setChances(m)
        else if (m.t === 'over' && m.ranking) setRanking(m.ranking)
        else if (m.t === 'joined') { setMe({ id: m.playerId, name: m.name }); setStatus('joined') }
        else if (m.t === 'error') { setError(m.msg); setStatus('error') }
        handlers.current[m.t]?.(m)
      }
      ws.onerror = () => { setError('サーバに繋がらない'); setStatus('error') }
      ws.onclose = () => { setStatus((s) => (s === 'error' ? s : 'idle')) }
    } catch {
      setError('接続先の指定が正しくない')
      setStatus('error')
    }
  }, [])

  const leave = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setRoom(EMPTY_ROOM)
    setMe(null)
    setStatus('idle')
  }, [])

  useEffect(() => () => wsRef.current?.close(), [])

  return { status, error, room, me, chances, ranking, join, leave, send, on }
}

/** 共通の時計から、いま何日目かを出す */
export function matchDay(room, now = Date.now()) {
  if (!room?.startedAt) return 1
  return Math.max(1, Math.floor((now - room.startedAt) / room.msPerDay) + 1)
}
