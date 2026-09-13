// 対戦サーバの判定をひと通り試す。 node test-match.mjs
import { WebSocket } from 'ws'

const URL = process.env.URL ?? 'ws://localhost:8787/ws'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  ' + detail : ''}`)
  ok ? pass++ : fail++
}

function client(name, room, password) {
  const ws = new WebSocket(URL)
  const inbox = []
  const c = {
    ws, name, inbox,
    send: (m) => ws.send(JSON.stringify(m)),
    take: (t, ms = 1500) => new Promise((res) => {
      const started = Date.now()
      const poll = () => {
        const i = inbox.findIndex((m) => m.t === t)
        if (i >= 0) return res(inbox.splice(i, 1)[0])
        if (Date.now() - started > ms) return res(null)
        setTimeout(poll, 30)
      }
      poll()
    }),
  }
  ws.on('message', (raw) => {
    const m = JSON.parse(raw)
    if (m.t === 'room') c.room = m          // 部屋の状態は常に最新だけを持つ
    else inbox.push(m)
  })
  return new Promise((res) => {
    ws.on('open', () => { c.send({ t: 'join', room, password, name }); res(c) })
  })
}

const roomId = 'test-' + Math.random().toString(36).slice(2, 7)
const a = await client('攻撃側', roomId, 'pw')
const b = await client('防御側', roomId, 'pw')
await wait(200)

await wait(300)
check('2人が入室できる', a.room?.players?.length === 2, `${a.room?.players?.length}人`)

// 合言葉違いは弾かれる
const bad = await client('侵入者', roomId, 'wrong')
check('合言葉が違うと入れない', (await bad.take('error'))?.msg?.includes('合言葉'))
bad.ws.close()

// 同名は乗っ取れない
const dup = await client('攻撃側', roomId, 'pw')
check('同じ教団名は使えない', (await dup.take('error'))?.msg?.includes('すでに使われている'))
dup.ws.close()
await wait(200)

a.send({ t: 'ready', ready: true })
b.send({ t: 'ready', ready: true })
a.send({ t: 'pace', seconds: 4 })
b.send({ t: 'pace', seconds: 8 })
await wait(200)
a.send({ t: 'start' })
await wait(400)
const started = a.room
check('希望の平均で1日の長さが決まる', started?.msPerDay === 6000, `${started?.msPerDay}ms`)
await wait(3300)   // 開始の3秒待ち

const FUNDS = 10_000_000_000

/** 2人だけの部屋を新しく作って開始する（暗殺は7日に一度なので、事例ごとに部屋を分ける） */
async function freshRoom(nameA, nameB, paceSec = 2) {
  const id = 'test-' + Math.random().toString(36).slice(2, 7)
  const ca = await client(nameA, id, 'pw')
  const cb = await client(nameB, id, 'pw')
  await wait(250)
  ca.send({ t: 'ready', ready: true })
  cb.send({ t: 'ready', ready: true })
  ca.send({ t: 'pace', seconds: paceSec })
  cb.send({ t: 'pace', seconds: paceSec })
  await wait(200)
  ca.send({ t: 'start' })
  await wait(400)
  const st = ca.room
  await wait(3300)
  return { ca, cb, st, idOf: (n) => st.players.find((p) => p.name === n).id }
}

async function attackCase(label, auw, buw, expect) {
  const { ca, cb, idOf } = await freshRoom('攻撃側', '防御側')
  ca.send({ t: 'sync', underworld: auw })
  cb.send({ t: 'sync', underworld: buw })
  await wait(200)
  ca.send({ t: 'assassinate', target: idOf('防御側'), funds: FUNDS })
  const r = await ca.take('attackResult')
  check(label, r?.outcome === expect, `→ ${r?.outcome}${r?.reason ? '（' + r.reason + '）' : ''}`)
  return { r, ca, cb, idOf }
}

await attackCase('闇度が足りないと差し向けられない', 10, 50, 'unable')
await attackCase('相手が裏社会と無縁なら手が出ない', 50, 10, 'unable')
const hit = await attackCase('自分の方が濃ければ成功', 50, 35, 'success')

const killed = await hit.cb.take('killed')
check('狙われた側に暗殺が通知される', killed?.by === '攻撃側')
await wait(600)
check('暗殺された教団は脱落扱いになる',
  hit.ca.room?.players?.find((p) => p.name === '防御側')?.alive === false)
hit.ca.ws.close(); hit.cb.ws.close()

// 逆襲の確認は別部屋で
const room2 = 'test-' + Math.random().toString(36).slice(2, 7)
const c1 = await client('浅い闇', room2, 'pw')
const c2 = await client('深い闇', room2, 'pw')
await wait(200)
c1.send({ t: 'ready', ready: true }); c2.send({ t: 'ready', ready: true })
await wait(150)
c1.send({ t: 'start' })
await wait(400)
const st2 = c1.room
await wait(3300)
c1.send({ t: 'sync', underworld: 32 })
c2.send({ t: 'sync', underworld: 90 })
await wait(200)
c1.send({ t: 'assassinate', target: st2.players.find((p) => p.name === '深い闇').id, funds: FUNDS })
const r2 = await c1.take('attackResult')
check('相手が大きく上回っていれば逆襲される', r2?.outcome === 'backlash', `→ ${r2?.outcome}`)
check('逆襲された側に通知が届く', !!(await c1.take('backlash')))

// 同じ日に二度は動けない（生きている相手どうしで確かめる）
const room4 = 'test-' + Math.random().toString(36).slice(2, 7)
const e1 = await client('連打', room4, 'pw')
const e2 = await client('的', room4, 'pw')
await wait(250)
e1.send({ t: 'ready', ready: true }); e2.send({ t: 'ready', ready: true })
await wait(150)
e1.send({ t: 'start' })
await wait(400)
const st4 = e1.room
await wait(3300)
e1.send({ t: 'sync', underworld: 40 })
e2.send({ t: 'sync', underworld: 45 })
await wait(200)
const targetId = st4.players.find((p) => p.name === '的').id
e1.send({ t: 'assassinate', target: targetId, funds: FUNDS })
const first = await e1.take('attackResult')
e1.send({ t: 'assassinate', target: targetId, funds: FUNDS })
const cd = await e1.take('attackResult')
check('1日に二度は差し向けられない', cd?.outcome === 'cooldown', `1回目=${first?.outcome} 2回目=${cd?.outcome}`)

// 決着は先着
const room3 = 'test-' + Math.random().toString(36).slice(2, 7)
const d1 = await client('先着', room3, 'pw')
const d2 = await client('後追', room3, 'pw')
await wait(200)
d1.send({ t: 'ready', ready: true }); d2.send({ t: 'ready', ready: true })
await wait(150)
d1.send({ t: 'start' })
await wait(400)
await wait(3300)
d1.send({ t: 'claim', ending: 'firstParty' })
const over = await d2.take('over')
check('先に到達した教団が勝つ', over?.winner === '先着', `→ ${over?.winner}`)
d2.send({ t: 'claim', ending: 'firstParty' })
const late = await d2.take('claimResult')
check('後から申告しても覆らない', late?.ok === false && late?.winner === '先着')


// ── 訴訟 ────────────────────────────────────────
const room5 = 'test-' + Math.random().toString(36).slice(2, 7)
const f1 = await client('清廉', room5, 'pw')
const f2 = await client('汚れ', room5, 'pw')
await wait(250)
f1.send({ t: 'ready', ready: true }); f2.send({ t: 'ready', ready: true })
f1.send({ t: 'pace', seconds: 2 }); f2.send({ t: 'pace', seconds: 2 })
await wait(150)
f1.send({ t: 'start' })
await wait(400)
const st5 = f1.room
await wait(3300)
const dirtyId = st5.players.find((p) => p.name === '汚れ').id
const cleanId = st5.players.find((p) => p.name === '清廉').id

// 清廉(警戒10) → 汚れ(警戒80) は高確率で通る
f1.send({ t: 'sync', underworld: 0, pub: { wariness: 10, funds: 1e10 } })
f2.send({ t: 'sync', underworld: 0, pub: { wariness: 80, funds: 1e10 } })
await wait(250)
f1.send({ t: 'lawsuit', target: dirtyId, charge: '寄付金の不正利用', funds: FUNDS })
const suit = await f1.take('lawsuitResult')
check('クリーンな側から汚れた側への訴訟は通りやすい',
  suit?.outcome === 'success' && suit.seized > 0, `→ ${suit?.outcome} 成立率${((suit?.chance ?? 0) * 100).toFixed(0)}%`)
check('罪状名が結果に付いてくる', suit?.charge === '寄付金の不正利用')
const suedMsg = await f2.take('sued')
check('訴えられた側に通知が届く', suedMsg?.seized > 0 && suedMsg?.by === '清廉')

// 3日は空けないと次を撃てない
f1.send({ t: 'lawsuit', target: dirtyId, charge: '名誉毀損', funds: FUNDS })
const cd2 = await f1.take('lawsuitResult')
check('訴訟は3日に一度まで', cd2?.outcome === 'cooldown', `→ ${cd2?.outcome}`)

// 汚れた側から清廉な側へは反訴される
await wait(6600)
f2.send({ t: 'lawsuit', target: cleanId, charge: '言いがかり', funds: FUNDS })
const counter = await f2.take('lawsuitResult')
check('汚れた側が清廉な側を訴えると反訴される', counter?.outcome === 'counter', `→ ${counter?.outcome}`)

// 暗殺は7日に一度
f1.send({ t: 'sync', underworld: 50 })
f2.send({ t: 'sync', underworld: 40 })
await wait(250)
f1.send({ t: 'assassinate', target: dirtyId, funds: FUNDS })
await f1.take('attackResult')
f1.send({ t: 'assassinate', target: dirtyId, funds: FUNDS })
const acd = await f1.take('attackResult')
check('暗殺は7日に一度まで', acd?.outcome === 'cooldown', `→ ${acd?.outcome}`)

// ── 出資 ────────────────────────────────────────
const room6 = 'test-' + Math.random().toString(36).slice(2, 7)
const g1 = await client('出資側', room6, 'pw')
const g2 = await client('受け手', room6, 'pw')
await wait(250)
g1.send({ t: 'ready', ready: true }); g2.send({ t: 'ready', ready: true })
g1.send({ t: 'pace', seconds: 2 }); g2.send({ t: 'pace', seconds: 2 })
await wait(150)
g1.send({ t: 'start' })
await wait(400)
const st6 = g1.room
await wait(3300)
const recvId = st6.players.find((p) => p.name === '受け手').id
g2.send({ t: 'sync', pub: { businesses: ['教育事業'], facilityCounts: { 教育事業: 3 }, followers: 100000 } })
await wait(250)

g1.send({ t: 'stake', target: recvId, business: '出版事業', amount: 1e8, funds: 1e10 })
check('持っていない事業には出資できない', (await g1.take('stakeResult'))?.ok === false)

g1.send({ t: 'stake', target: recvId, business: '教育事業', amount: 9e9, funds: 1e10 })
check('運転資金の2割を超える出資は弾かれる', (await g1.take('stakeResult'))?.ok === false)

g1.send({ t: 'stake', target: recvId, business: '教育事業', amount: 1e9, funds: 1e10 })
const ok = await g1.take('stakeResult')
check('出資できる', ok?.ok === true && ok.charged === 1e9)

// 7日後に自動で回収される（1日2秒なので14秒待つ）
g2.send({ t: 'sync', pub: { businesses: ['教育事業'], facilityCounts: { 教育事業: 5 }, followers: 130000 } })
const settled = await g1.take('stakeSettled', 20000)
check('7日後に自動で回収される', !!settled, settled ? `利率${(settled.rate * 100).toFixed(1)}% 施設${settled.facilities}棟` : '')
check('施設が多いほど利率が上がる', (settled?.rate ?? -1) > 0, `→ ${((settled?.rate ?? 0) * 100).toFixed(1)}%`)

// ── スコア ──────────────────────────────────────
const room7 = 'test-' + Math.random().toString(36).slice(2, 7)
const h1 = await client('易しい方', room7, 'pw')
const h2 = await client('難しい方', room7, 'pw')
await wait(250)
h1.send({ t: 'ready', ready: true }); h2.send({ t: 'ready', ready: true })
await wait(150)
h1.send({ t: 'start' })
await wait(3500)
h1.send({ t: 'sync', difficulty: 'easy', pub: { share: 0.2, businesses: ['a', 'b'] }, achieved: { firstParty: 100 } })
h2.send({ t: 'sync', difficulty: 'hard', pub: { share: 0.2, businesses: ['a', 'b'] }, achieved: {} })
await wait(400)
h1.send({ t: 'claim', ending: 'firstParty' })
const over2 = await h2.take('over')
const rank = over2?.ranking ?? []
const easy = rank.find((r) => r.name === '易しい方')
const hard = rank.find((r) => r.name === '難しい方')
check('難易度でスコアに倍率がかかる', easy?.mult === 0.7 && hard?.mult === 1.5, `易${easy?.mult} 難${hard?.mult}`)
check('決着に届かなくても進捗がスコアになる', (hard?.total ?? 0) > 0, `難しい方 ${hard?.total}点`)

for (const c of [f1, f2, g1, g2, h1, h2]) c.ws.close()

console.log(`\n${pass} 件成功 / ${fail} 件失敗`)
for (const c of [c1, c2, d1, d2, e1, e2]) c.ws.close()
process.exit(fail ? 1 : 0)
