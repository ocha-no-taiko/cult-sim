import React, { useState } from 'react'
import { defaultServerUrl } from '../net/match.js'
import { REGION_MAP } from '../game/data/regions.js'
import { DIFFICULTY_MAP } from '../game/engine/constants.js'
import { orderName } from '../game/format.js'

const PACE_PRESETS = [
  { sec: 4, label: '駆け足', note: '1日=4秒。1000日でも70分ほど' },
  { sec: 8, label: '標準', note: '1日=8秒。考える余裕がある' },
  { sec: 15, label: 'じっくり', note: '1日=15秒。腰を据えて読み合う' },
]

export default function LobbyScreen({ state, match, onBack, onStart }) {
  const [url, setUrl] = useState(() => defaultServerUrl())
  const [roomId, setRoomId] = useState('')
  const [password, setPassword] = useState('')
  const [pace, setPace] = useState(8)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const name = orderName(state)
  const region = REGION_MAP[state.homeRegion]
  const diff = DIFFICULTY_MAP[state.difficulty]

  const joined = match.status === 'joined'
  const room = match.room
  const isHost = joined && room.hostId === match.me?.id
  const players = room.players ?? []
  const allReady = players.length >= 2 && players.every((p) => p.ready)
  const avgPace = players.length
    ? players.reduce((a, p) => a + p.paceVote, 0) / players.length
    : pace

  const submitPace = (sec) => {
    setPace(sec)
    match.send({ t: 'pace', seconds: sec })
  }

  return (
    <div className="screen" style={{ justifyContent: 'flex-start', paddingTop: 40 }}>
      <div className="screen-inner" style={{ maxWidth: 900 }}>
        <h1 className="title-mark" style={{ fontSize: 38 }}>対 戦</h1>
        <p className="title-lead" style={{ margin: '14px auto 24px' }}>
          同じ時計の上で、複数の教団が同時に国を狙う。<br />
          決着に最初に辿り着いた教団が勝つ。
        </p>

        <div className="panel">
          <div className="panel-head">
            出撃する教団
            <span className="tag gold">{name}</span>
          </div>
          <div className="panel-body">
            <div className="kv" style={{ maxWidth: 420 }}>
              <span className="k">拠点</span><span className="v">{region.name}</span>
              <span className="k">難易度</span><span className="v">{diff.name}</span>
              <span className="k">教義</span>
              <span className="v">
                禁欲{state.doctrine.asceticism}／終末{state.doctrine.apocalypse}／
                現世{state.doctrine.worldly}／階層{state.doctrine.hierarchy}
              </span>
            </div>
            <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
              教団名がそのまま対戦での名前になる。変えたい場合は一度タイトルへ戻ること。
            </div>
          </div>
        </div>

        {!joined && (
          <div className="panel" style={{ marginTop: 12 }}>
            <div className="panel-head">部屋に入る</div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <div className="faint" style={{ fontSize: 12, marginBottom: 4 }}>部屋ID</div>
                  <input type="text" value={roomId} maxLength={24} placeholder="例：kichigai"
                    onChange={(e) => setRoomId(e.target.value)} />
                </div>
                <div style={{ flex: '1 1 220px' }}>
                  <div className="faint" style={{ fontSize: 12, marginBottom: 4 }}>合言葉</div>
                  <input type="text" value={password} maxLength={32} placeholder="参加者で共有する文字列"
                    onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <div className="faint" style={{ fontSize: 12, lineHeight: 1.85 }}>
                同じ部屋IDと合言葉を入れた人どうしが対戦する。
                まだ無い部屋IDなら、最初に入った人がホストになって新しく作られる。
              </div>
              <div className="hint">
                対戦は<b>身内で対戦サーバを立てて遊ぶ</b>かたち。誰か1人が
                <code>server/</code> のサーバを動かし、そのURLを全員で開けば繋がる。
                単独プレイだけならサーバは要らない。
              </div>

              <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }}
                onClick={() => setShowAdvanced((v) => !v)}>
                {showAdvanced ? '接続先を隠す' : '接続先を指定する'}
              </button>
              {showAdvanced && (
                <div>
                  <div className="faint" style={{ fontSize: 12, marginBottom: 4 }}>対戦サーバ</div>
                  <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} />
                  <div className="faint" style={{ fontSize: 11.5, marginTop: 5, lineHeight: 1.8 }}>
                    既定ではこのページを配っているホストを見る。
                    別のマシンで動かしている場合は <code>ws://machine.tailnet.ts.net:8787/ws</code> のように指定する。
                  </div>
                </div>
              )}

              {match.error && (
                <div className="hint alert">
                  {match.error}
                  {match.error.includes('繋がらない') && (
                    <>
                      <br />
                      対戦には<b>対戦サーバ</b>が要る。誰か1人がサーバを立て、その人のURLを全員で開くこと。
                      立て方はリポジトリの <code>server/README.md</code> にある。
                      すでに誰かが立てているなら「接続先を指定する」からそのアドレスを入れる。
                    </>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={onBack}>戻る</button>
                <button
                  className="btn primary"
                  disabled={!roomId.trim() || !password || match.status === 'connecting'}
                  onClick={() => match.join({ url, room: roomId.trim(), password, name })}
                >
                  {match.status === 'connecting' ? '接続中…' : '入る'}
                </button>
              </div>
            </div>
          </div>
        )}

        {joined && (
          <>
            <div className="panel" style={{ marginTop: 12 }}>
              <div className="panel-head">
                部屋「{room.id}」
                <span>
                  <span className="tag">{players.length} / {room.limits?.maxPlayers ?? 8}人</span>{' '}
                  {isHost && <span className="tag gold">ホスト</span>}
                </span>
              </div>
              <div className="panel-body">
                <table className="tbl">
                  <thead><tr><th>教団</th><th>希望する1日の長さ</th><th>状態</th></tr></thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.name}
                          {p.id === match.me?.id && <span className="tag gold" style={{ marginLeft: 6 }}>あなた</span>}
                          {p.id === room.hostId && <span className="tag" style={{ marginLeft: 6 }}>ホスト</span>}
                        </td>
                        <td>{p.paceVote}秒</td>
                        <td style={{ color: p.ready ? 'var(--good)' : 'var(--ink-faint)' }}>
                          {p.connected ? (p.ready ? '準備完了' : '準備中') : '切断'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <div className="panel-head">
                1日の長さ
                <span className="tag gold">全員の希望の平均 {avgPace.toFixed(1)}秒</span>
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="choice-grid c3">
                  {PACE_PRESETS.map((p) => (
                    <button key={p.sec} className={`choice${pace === p.sec ? ' sel' : ''}`}
                      onClick={() => submitPace(p.sec)}>
                      <div className="choice-title">{p.label}</div>
                      <div className="choice-meta">1日 = {p.sec}秒</div>
                      <div className="choice-desc">{p.note}</div>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="faint" style={{ fontSize: 12 }}>細かく指定</span>
                  <input type="range" min="2" max="60" value={pace} style={{ flex: 1 }}
                    onChange={(e) => submitPace(Number(e.target.value))} />
                  <span className="num" style={{ width: 46, textAlign: 'right' }}>{pace}秒</span>
                </div>
                <div className="hint">
                  対戦が始まると<b>時間は止められない</b>。全員の希望の平均が、そのまま全員の1日の長さになる。
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
              <button className="btn ghost" onClick={() => { match.leave(); onBack() }}>部屋を出る</button>
              <button
                className={`btn${players.find((p) => p.id === match.me?.id)?.ready ? '' : ' primary'}`}
                onClick={() => match.send({ t: 'ready', ready: !players.find((p) => p.id === match.me?.id)?.ready })}
              >
                {players.find((p) => p.id === match.me?.id)?.ready ? '準備を解除' : '準備完了'}
              </button>
              {isHost && (
                <button className="btn primary" disabled={!allReady} onClick={() => match.send({ t: 'start' })}
                  title={allReady ? '' : '2人以上が準備完了になると押せる'}>
                  開教する（全員同時）
                </button>
              )}
            </div>
            {room.feed?.length > 0 && (
              <div className="panel" style={{ marginTop: 14 }}>
                <div className="panel-head" style={{ fontSize: 13 }}>控えの間</div>
                <div className="log">
                  {room.feed.slice().reverse().slice(0, 8).map((f, i) => (
                    <div className="log-row system" key={i}><span className="t">{f.text}</span></div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
