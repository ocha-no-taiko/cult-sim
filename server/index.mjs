// CULT の対戦サーバ。
// Tailscale 上の1台で動かす前提の小さな WebSocket サーバで、
// 「共通の時計」「闇度の秘匿」「暗殺の判定」「決着の先着判定」だけを受け持つ。
// 各教団の経営シミュレーション自体は各クライアントで走る（身内対戦前提で、そこは信頼する）。

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { WebSocketServer } from 'ws'
import {
  decidePace, dayAt, resolveAssassination,
  ASSASSIN_COST, ASSASSIN_MIN_UNDERWORLD, PACE_DEFAULT_SEC, PACE_MIN_SEC, PACE_MAX_SEC,
} from './rules.mjs'

const PORT = Number(process.env.PORT ?? 8787)
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS ?? 8)
const ROOM_IDLE_MS = 1000 * 60 * 60 * 6

/** @type {Map<string, Room>} */
const rooms = new Map()

const hashPassword = (pw, salt = randomBytes(16).toString('hex')) =>
  `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`

function verifyPassword(pw, stored) {
  const [salt, hex] = stored.split(':')
  const a = Buffer.from(hex, 'hex')
  const b = scryptSync(pw, salt, 32)
  return a.length === b.length && timingSafeEqual(a, b)
}

function makeRoom(id, password) {
  return {
    id,
    password: hashPassword(password),
    createdAt: Date.now(),
    touchedAt: Date.now(),
    hostId: null,
    phase: 'lobby',          // lobby | running | over
    startedAt: null,
    msPerDay: PACE_DEFAULT_SEC * 1000,
    players: new Map(),      // id -> player
    feed: [],
    winner: null,
    winningEnding: null,
  }
}

function makePlayer(id, name) {
  return {
    id,
    name,
    connected: true,
    ready: false,
    paceVote: PACE_DEFAULT_SEC,
    alive: true,
    deadReason: null,
    // 公開情報
    pub: { day: 1, followers: 0, funds: 0, wariness: 0, priests: 0, faith: 50, share: 0, businesses: [] },
    // 秘匿情報（他のクライアントには決して送らない）
    secret: { underworld: 0 },
    lastAttackDay: 0,
    achieved: {},
  }
}

/** 他人に見せてよい形に落とす */
function publicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    connected: p.connected,
    ready: p.ready,
    paceVote: p.paceVote,
    alive: p.alive,
    deadReason: p.deadReason,
    achieved: p.achieved,
    ...p.pub,
  }
}

function roomState(room) {
  return {
    t: 'room',
    id: room.id,
    phase: room.phase,
    hostId: room.hostId,
    startedAt: room.startedAt,
    msPerDay: room.msPerDay,
    day: dayAt(room.startedAt, room.msPerDay),
    winner: room.winner,
    winningEnding: room.winningEnding,
    players: [...room.players.values()].map(publicPlayer),
    feed: room.feed.slice(-40),
    limits: { assassinCost: ASSASSIN_COST, assassinMinUnderworld: ASSASSIN_MIN_UNDERWORLD, maxPlayers: MAX_PLAYERS },
  }
}

function send(ws, msg) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(msg))
}

function broadcast(room, msg) {
  for (const p of room.players.values()) send(p.ws, msg)
}

function pushFeed(room, text, kind = 'info') {
  room.feed.push({ day: dayAt(room.startedAt, room.msPerDay), text, kind, at: Date.now() })
  if (room.feed.length > 200) room.feed = room.feed.slice(-200)
}

function syncRoom(room) {
  room.touchedAt = Date.now()
  broadcast(room, roomState(room))
}

// ── 接続ごとの処理 ──────────────────────────────
function handle(ws, raw) {
  let msg
  try { msg = JSON.parse(raw) } catch { return }
  const ctx = ws._ctx

  if (msg.t === 'join') return onJoin(ws, msg)
  if (!ctx) return send(ws, { t: 'error', msg: 'まだ部屋に入っていない' })

  const room = rooms.get(ctx.roomId)
  const me = room?.players.get(ctx.playerId)
  if (!room || !me) return

  switch (msg.t) {
    case 'pace': {
      if (room.phase !== 'lobby') return
      me.paceVote = Math.min(PACE_MAX_SEC, Math.max(PACE_MIN_SEC, Number(msg.seconds) || PACE_DEFAULT_SEC))
      return syncRoom(room)
    }
    case 'ready': {
      if (room.phase !== 'lobby') return
      me.ready = !!msg.ready
      return syncRoom(room)
    }
    case 'start': {
      if (room.phase !== 'lobby' || room.hostId !== me.id) return
      const votes = Object.fromEntries([...room.players.values()].map((p) => [p.id, p.paceVote]))
      room.msPerDay = decidePace(votes)
      room.startedAt = Date.now() + 3000   // 3秒後に一斉に開始する
      room.phase = 'running'
      pushFeed(room, `開教。1日 = ${(room.msPerDay / 1000).toFixed(1)}秒（希望の平均）。`, 'system')
      return syncRoom(room)
    }
    case 'sync': {
      if (msg.pub) me.pub = { ...me.pub, ...msg.pub }
      if (typeof msg.underworld === 'number') me.secret.underworld = msg.underworld
      if (msg.achieved) me.achieved = msg.achieved
      return
    }
    case 'announce': {
      // 表の事業の設立だけは全員に通知される
      if (room.phase !== 'running') return
      pushFeed(room, `${me.name}が${String(msg.text ?? '').slice(0, 40)}`, 'biz')
      return syncRoom(room)
    }
    case 'assassinate': return onAssassinate(room, me, msg)
    case 'claim': return onClaim(room, me, msg)
    case 'dead': {
      if (!me.alive) return
      me.alive = false
      me.deadReason = String(msg.reason ?? '').slice(0, 40)
      pushFeed(room, `${me.name}が脱落した（${me.deadReason}）。`, 'bad')
      return syncRoom(room)
    }
    default:
  }
}

function onJoin(ws, msg) {
  const roomId = String(msg.room ?? '').trim().slice(0, 24)
  const password = String(msg.password ?? '')
  const name = String(msg.name ?? '').trim().slice(0, 16)
  if (!roomId || !password || !name) {
    return send(ws, { t: 'error', msg: '部屋ID・合言葉・教団名がすべて要る' })
  }

  let room = rooms.get(roomId)
  if (!room) {
    room = makeRoom(roomId, password)
    rooms.set(roomId, room)
  } else if (!verifyPassword(password, room.password)) {
    return send(ws, { t: 'error', msg: '合言葉が違う' })
  }

  // 同じ教団名なら再接続とみなす
  const existing = [...room.players.values()].find((p) => p.name === name)
  if (existing && existing.connected) {
    return send(ws, { t: 'error', msg: 'その教団名はすでに使われている' })
  }
  if (existing) {
    existing.connected = true
    existing.ws = ws
    ws._ctx = { roomId, playerId: existing.id }
    send(ws, { t: 'joined', playerId: existing.id, name })
    pushFeed(room, `${name}が戻ってきた。`, 'system')
    return syncRoom(room)
  }

  if (room.phase !== 'lobby') return send(ws, { t: 'error', msg: 'その対戦はもう始まっている' })
  if (room.players.size >= MAX_PLAYERS) return send(ws, { t: 'error', msg: '定員がいっぱい' })

  const player = makePlayer(randomUUID(), name)
  player.ws = ws
  room.players.set(player.id, player)
  if (!room.hostId) room.hostId = player.id
  ws._ctx = { roomId, playerId: player.id }
  send(ws, { t: 'joined', playerId: player.id, name })
  pushFeed(room, `${name}が加わった。`, 'system')
  syncRoom(room)
}

function onAssassinate(room, me, msg) {
  if (room.phase !== 'running' || !me.alive) return
  const day = dayAt(room.startedAt, room.msPerDay)
  if (me.lastAttackDay === day) {
    return send(me.ws, { t: 'attackResult', outcome: 'cooldown', reason: '同じ日に二度は動かせない' })
  }
  const target = room.players.get(msg.target)
  if (!target || !target.alive || target.id === me.id) {
    return send(me.ws, { t: 'attackResult', outcome: 'unable', reason: '相手がいない' })
  }
  if ((msg.funds ?? 0) < ASSASSIN_COST) {
    return send(me.ws, { t: 'attackResult', outcome: 'unable', reason: '資金が足りない' })
  }

  me.lastAttackDay = day
  const res = resolveAssassination(me.secret.underworld, target.secret.underworld)

  if (res.outcome === 'unable') {
    return send(me.ws, { t: 'attackResult', outcome: 'unable', reason: res.reason, charged: false })
  }

  send(me.ws, {
    t: 'attackResult',
    outcome: res.outcome,
    targetName: target.name,
    underworldAdd: res.attackerUnderworld ?? 0,
    charged: true,
    cost: ASSASSIN_COST,
  })

  if (res.outcome === 'success') {
    target.alive = false
    target.deadReason = '暗殺'
    send(target.ws, { t: 'killed', by: me.name })
    pushFeed(room, `${target.name}の教祖が何者かに暗殺された。`, 'bad')
  } else if (res.outcome === 'backlash') {
    me.alive = false
    me.deadReason = '逆襲'
    send(me.ws, { t: 'backlash', by: target.name })
    send(target.ws, { t: 'attacked', by: null, note: '何者かの襲撃を、返り討ちにした。' })
    pushFeed(room, `${me.name}の教祖が返り討ちに遭った。`, 'bad')
  } else {
    send(target.ws, { t: 'attacked', by: null, note: '何者かに襲われたが、事なきを得た。' })
    pushFeed(room, `どこかの教団の教祖が襲われたが、失敗に終わったらしい。`, 'warn')
  }
  syncRoom(room)
}

function onClaim(room, me, msg) {
  if (!me.alive) return
  const ending = String(msg.ending ?? '').slice(0, 32)
  if (room.winner) {
    return send(me.ws, { t: 'claimResult', ok: false, winner: room.winner, ending: room.winningEnding })
  }
  if (room.phase !== 'running') return
  room.winner = me.name
  room.winningEnding = ending
  room.phase = 'over'
  pushFeed(room, `${me.name}が決着に到達した。`, 'good')
  broadcast(room, { t: 'over', winner: me.name, ending, winnerId: me.id })
  syncRoom(room)
}

// ── 起動 ────────────────────────────────────────
// ビルド済みのゲーム本体も同じポートから配る。
// こうしておくと Tailscale 上の1台を指すだけで、参加者はそのまま遊べる。
const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

async function serveStatic(req, res) {
  const url = (req.url ?? '/').split('?')[0]
  const rel = url === '/' ? 'index.html' : normalize(url).replace(/^([/\\.]+)/, '')
  let file = join(DIST, rel)
  try {
    const s = await stat(file)
    if (s.isDirectory()) file = join(file, 'index.html')
  } catch {
    file = join(DIST, 'index.html')   // SPA なので見つからなければ index を返す
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('ゲーム本体が見つからない。先に npm run build を実行すること。')
  }
}

const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size }))
  }
  serveStatic(req, res).catch(() => { res.writeHead(500); res.end() })
})

const wss = new WebSocketServer({ server: http, path: '/ws' })

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try { handle(ws, raw) } catch (e) { console.error('handle error', e) }
  })
  ws.on('close', () => {
    const ctx = ws._ctx
    if (!ctx) return
    const room = rooms.get(ctx.roomId)
    const p = room?.players.get(ctx.playerId)
    if (!p) return
    p.connected = false
    if (room.phase === 'lobby') {
      room.players.delete(p.id)
      if (room.hostId === p.id) room.hostId = [...room.players.keys()][0] ?? null
    }
    if (room.players.size === 0) rooms.delete(room.id)
    else syncRoom(room)
  })
})

// 部屋の状態を定期的に配る（時計合わせを兼ねる）
setInterval(() => {
  for (const [id, room] of rooms) {
    if (Date.now() - room.touchedAt > ROOM_IDLE_MS) { rooms.delete(id); continue }
    if (room.phase !== 'lobby') broadcast(room, roomState(room))
  }
}, 2000)

http.listen(PORT, '0.0.0.0', () => {
  console.log(`CULT 対戦サーバ起動  http://0.0.0.0:${PORT}/   ws://<host>:${PORT}/ws`)
  console.log('参加者には  http://<このマシンのTailscale名>:%d/  を開いてもらう', PORT)
})
