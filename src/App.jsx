import React, { useReducer, useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { reducer } from './game/engine/actions.js'
import { createInitialState, SAVE_VERSION } from './game/engine/state.js'
import { totals, finance } from './game/engine/selectors.js'

import TitleScreen from './components/TitleScreen.jsx'
import FoundingScreen from './components/FoundingScreen.jsx'
import Header from './components/Header.jsx'
import LogPanel from './components/LogPanel.jsx'
import QuestPanel from './components/QuestPanel.jsx'
import OpeningTutorial, { openingSeen } from './components/OpeningTutorial.jsx'
import CityView from './components/CityView.jsx'
import DoctrineView from './components/DoctrineView.jsx'
import MissionView from './components/MissionView.jsx'
import BusinessView from './components/BusinessView.jsx'
import BranchView from './components/BranchView.jsx'
import StatsView from './components/StatsView.jsx'
import InvestView from './components/InvestView.jsx'
import EventToast from './components/EventToast.jsx'
import EndingModal from './components/EndingModal.jsx'
import TipCardLazy, { TipProvider, HelpModal } from './components/TipCard.jsx'
import LobbyScreen from './components/LobbyScreen.jsx'
import RivalPanel from './components/RivalPanel.jsx'
import { useMatch, matchDay } from './net/match.js'
import { BUSINESS_MAP, BUSINESSES, FACILITY_MAP } from './game/data/facilities.js'

const SAVE_KEY = 'cult-save-v2'
const SPEED_MS = { 1: 900, 2: 400, 4: 160 }

const TABS = [
  { id: 'city', label: '宗教都市' },
  { id: 'doctrine', label: '教義' },
  { id: 'mission', label: '布教' },
  { id: 'business', label: '事業' },
  { id: 'invest', label: '投資' },
  { id: 'branch', label: '支部' },
  { id: 'stats', label: '統計' },
]

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data?.version !== SAVE_VERSION) return null
    return data
  } catch {
    return null
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, () => createInitialState())
  const [started, setStarted] = useState(false)
  const [tab, setTab] = useState('city')
  const [hasSave, setHasSave] = useState(() => !!loadSave())
  const [hideEnding, setHideEnding] = useState(false)
  const [toasts, setToasts] = useState([])
  const [help, setHelp] = useState(false)
  const [opening, setOpening] = useState(false)
  const [screen, setScreen] = useState('game')   // game | lobby
  const [multi, setMulti] = useState(false)
  const fileRef = useRef(null)
  const match = useMatch()
  const announced = useRef(new Set())
  const totalsRef = useRef({ followers: 0, avgFaith: 50, nationalShare: 0 })

  const act = useCallback((type, payload) => dispatch({ type, payload }), [])

  // ── 時間経過（単独プレイ） ─────────────────
  useEffect(() => {
    if (multi || !started || state.phase !== 'playing' || !state.speed) return
    const ms = SPEED_MS[state.speed] ?? 900
    const id = setInterval(() => dispatch({ type: 'TICK' }), ms)
    return () => clearInterval(id)
  }, [multi, started, state.phase, state.speed])

  // ── 時間経過（対戦：共通の時計。止められない） ──
  useEffect(() => {
    if (!multi || !started || state.phase !== 'playing') return
    if (match.room.phase !== 'running' || !match.room.startedAt) return
    const id = setInterval(() => {
      const target = matchDay(match.room)
      dispatch({ type: 'TICK_TO', payload: target })
    }, 120)
    return () => clearInterval(id)
  }, [multi, started, state.phase, match.room.phase, match.room.startedAt, match.room.msPerDay])

  // ── 対戦：自分の状態をサーバへ送る（闇度は他人には配られない） ──
  useEffect(() => {
    if (!multi || match.status !== 'joined' || match.room.phase !== 'running') return
    const push = () => {
      match.send({
        t: 'sync',
        underworld: state.underworld,
        achieved: state.achieved ?? {},
        difficulty: state.difficulty,
        wantChances: true,
        pub: {
          day: state.day,
          followers: Math.round(totalsRef.current.followers),
          funds: Math.round(state.funds),
          wariness: Math.round(state.wariness * 10) / 10,
          priests: state.priests,
          faith: Math.round(totalsRef.current.avgFaith),
          share: totalsRef.current.nationalShare,
          businesses: Object.keys(state.businesses)
            .filter((k) => state.businesses[k] && !BUSINESS_MAP[k]?.shadow)
            .map((k) => BUSINESS_MAP[k].name),
          // 出資の利率は「その事業の施設を何棟建てているか」で決まる
          facilityCounts: Object.fromEntries(
            BUSINESSES.filter((b) => !b.shadow && state.businesses[b.id]).map((b) => [
              b.name,
              state.facilities.filter((f) => FACILITY_MAP[f.type]?.requires === b.id).length,
            ]),
          ),
        },
      })
    }
    push()
    const id = setInterval(push, 1500)
    return () => clearInterval(id)
  }, [multi, match.status, match.room.phase, state])

  // ── 対戦：表の事業の設立は全員に伝わる ──────
  useEffect(() => {
    if (!multi || match.room.phase !== 'running') return
    for (const [id, on] of Object.entries(state.businesses)) {
      if (!on || announced.current.has(id)) continue
      announced.current.add(id)
      const b = BUSINESS_MAP[id]
      if (b && !b.shadow) match.send({ t: 'announce', text: `${b.name}を設立した。` })
    }
  }, [multi, state.businesses, match.room.phase])

  // ── 対戦：決着に届いたら申告する（先着をサーバが決める） ──
  useEffect(() => {
    if (!multi || !state.pendingClaim) return
    match.send({ t: 'claim', ending: state.pendingClaim.type })
    dispatch({ type: 'CLEAR_CLAIM' })
  }, [multi, state.pendingClaim])

  // ── 対戦：敗北の通知をサーバへ ──────────────
  useEffect(() => {
    if (!multi || state.phase !== 'gameover' || !state.ending) return
    match.send({ t: 'dead', reason: state.ending.title })
  }, [multi, state.phase, state.ending])

  // ── 対戦：サーバからの報せ ──────────────────
  useEffect(() => {
    match.on({
      killed: (m) => dispatch({ type: 'KILLED_BY', payload: { type: 'rivalAssassin', by: m.by } }),
      backlash: () => dispatch({ type: 'KILLED_BY', payload: { type: 'retaliation' } }),
      attacked: (m) => pushToast({ kind: 'bad', name: '襲撃', text: m.note ?? '何者かに狙われた。' }),
      attackResult: (m) => {
        if (m.outcome === 'unable' || m.outcome === 'cooldown') {
          return pushToast({ kind: 'bad', name: '差し向けられない', text: m.reason ?? '' })
        }
        const label = {
          success: `${m.targetName}の教祖を消した。`,
          failed: '刺客は仕損じた。こちらの動きに足がついている。',
          backlash: '返り討ちに遭った。',
        }[m.outcome] ?? ''
        dispatch({
          type: 'PAY_ASSASSINATION',
          payload: { cost: m.cost ?? 0, underworld: m.underworldAdd ?? 0, note: `【暗殺】${label}` },
        })
        pushToast({ kind: m.outcome === 'success' ? 'good' : 'bad', name: '暗殺', text: label })
      },
      sued: (m) => {
        if (m.seized > 0) {
          dispatch({
            type: 'MATCH_ADJUST',
            payload: {
              funds: -m.seized, wariness: m.warinessAdd ?? 0, kind: 'bad',
              note: `【訴訟】${m.by}に「${m.charge}」で訴えられ、${Math.round(m.seized).toLocaleString()}円を持っていかれた。`,
            },
          })
          pushToast({ kind: 'bad', name: '敗訴', text: `${m.by}の「${m.charge}」が通ってしまった。` })
        } else {
          pushToast({ kind: 'good', name: '訴訟', text: m.note ?? '訴えを退けた。' })
        }
      },
      lawsuitResult: (m) => {
        if (m.outcome === 'unable' || m.outcome === 'cooldown') {
          return pushToast({ kind: 'bad', name: '訴えられない', text: m.reason ?? '' })
        }
        const label = {
          success: `${m.targetName}から${Math.round(m.seized).toLocaleString()}円を勝ち取った。`,
          failed: '訴えは退けられた。着手金だけが消えた。',
          counter: '反訴された。こちらの評判が地に落ちた。',
        }[m.outcome] ?? ''
        dispatch({
          type: 'MATCH_ADJUST',
          payload: {
            funds: (m.seized ?? 0) - (m.cost ?? 0),
            wariness: m.warinessAdd ?? 0,
            kind: m.outcome === 'success' ? 'good' : 'bad',
            note: `【訴訟・${m.charge}】${label}`,
          },
        })
        pushToast({ kind: m.outcome === 'success' ? 'good' : 'bad', name: `訴訟・${m.charge}`, text: label })
      },
      stakeResult: (m) => {
        if (!m.ok) return pushToast({ kind: 'bad', name: '出資できない', text: m.reason ?? '' })
        dispatch({
          type: 'MATCH_ADJUST',
          payload: {
            funds: -(m.charged ?? 0),
            note: `【出資】${m.stake.targetName}の${m.stake.business}に${Math.round(m.charged).toLocaleString()}円を出した。`,
          },
        })
      },
      stakeSettled: (m) => {
        const pctText = `${m.rate >= 0 ? '+' : ''}${(m.rate * 100).toFixed(1)}%`
        dispatch({
          type: 'MATCH_ADJUST',
          payload: {
            funds: m.payout ?? 0,
            kind: m.rate >= 0 ? 'good' : 'warn',
            note: `【出資の満期】${m.stake.targetName}の${m.stake.business}が${pctText}。${Math.round(m.payout).toLocaleString()}円が戻った。`,
          },
        })
        pushToast({
          kind: m.rate >= 0 ? 'good' : 'bad',
          name: '出資の満期',
          text: `${m.stake.targetName}の${m.stake.business}（施設${m.facilities}棟）が${pctText}。`,
        })
      },
      over: (m) => {
        const win = m.winnerId === match.me?.id
        dispatch({ type: 'MATCH_RESULT', payload: { win, ending: m.ending, by: m.winner } })
      },
      claimResult: (m) => {
        if (!m.ok) dispatch({ type: 'MATCH_RESULT', payload: { win: false, by: m.winner } })
      },
    })
  }, [match.me?.id])

  // ── 対戦：部屋が始まったら開教する ──────────
  useEffect(() => {
    if (!multi || screen !== 'lobby') return
    if (match.room.phase !== 'running') return
    dispatch({ type: 'SET_MULTIPLAYER', payload: true })
    dispatch({ type: 'BEGIN_PREACHING' })
    setScreen('game')
    setTab('city')
  }, [multi, screen, match.room.phase])

  // スペースキーで一時停止／再開
  useEffect(() => {
    if (!started || multi) return
    const onKey = (e) => {
      if (e.code !== 'Space' || e.target instanceof HTMLInputElement) return
      e.preventDefault()
      dispatch({ type: 'SET_SPEED', payload: state.speed ? 0 : 1 })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started, multi, state.speed])

  const pushToast = useCallback((item) => {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => [...prev.slice(-2), { ...item, key, res: item.res ?? {} }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.key !== key)), 9000)
  }, [])

  // 出来事は時間を止めずに通知だけ流す
  useEffect(() => {
    const ev = state.pendingEvent
    if (!ev) return
    const key = `${ev.day}-${ev.id}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => [...prev.slice(-2), { ...ev, key }])
    dispatch({ type: 'DISMISS_EVENT' })
    const timer = setTimeout(() => setToasts((prev) => prev.filter((x) => x.key !== key)), 9000)
    return () => clearTimeout(timer)
  }, [state.pendingEvent])

  // ── オートセーブ ───────────────────────────
  useEffect(() => {
    if (multi || !started || state.phase === 'founding') return
    if (state.day % 10 !== 0) return
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state))
      setHasSave(true)
    } catch { /* 容量超過などは黙って諦める */ }
  }, [state.day, started, multi, state.phase])

  const t = useMemo(() => totals(state), [state])
  const fin = useMemo(() => finance(state, t), [state, t])
  totalsRef.current = t

  const newGame = (payload, asMatch = false) => {
    act('NEW_GAME', payload)
    setStarted(true)
    setHideEnding(false)
    setMulti(asMatch)
    setScreen('game')
    announced.current = new Set()
    setTab('city')
  }

  const continueGame = () => {
    const data = loadSave()
    if (!data) return
    act('LOAD', { ...data, speed: 0 })
    setStarted(true)
    setHideEnding(false)
    setTab('city')
  }

  const backToTitle = () => {
    if (multi) match.leave()
    setStarted(false)
    setMulti(false)
    setScreen('game')
    act('SET_SPEED', 0)
    setHasSave(!!loadSave())
  }

  const exportSave = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kaiso-day${state.day}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importSave = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fr = new FileReader()
    fr.onload = () => {
      try {
        const data = JSON.parse(String(fr.result))
        if (data?.version !== SAVE_VERSION) return
        act('LOAD', { ...data, speed: 0 })
        setStarted(true)
      } catch { /* 壊れたファイルは無視 */ }
    }
    fr.readAsText(file)
    e.target.value = ''
  }

  if (!started) {
    return (
      <TitleScreen
        hasSave={hasSave}
        onStart={newGame}
        onStartMatch={(payload) => newGame(payload, true)}
        onContinue={continueGame}
        onImport={() => fileRef.current?.click()}
        fileInput={<input ref={fileRef} type="file" accept="application/json" hidden onChange={importSave} />}
      />
    )
  }

  if (screen === 'lobby') {
    return (
      <LobbyScreen
        state={state}
        match={match}
        onBack={() => { match.leave(); setScreen('game'); setMulti(false); setStarted(false) }}
      />
    )
  }

  if (state.phase === 'founding') {
    return (
      <FoundingScreen
        state={state}
        act={act}
        onBack={backToTitle}
        onBegin={() => {
          if (multi) return setScreen('lobby')
          act('BEGIN_PREACHING')
          if (!openingSeen()) setOpening(true)
        }}
      />
    )
  }

  const view = {
    city: <CityView state={state} act={act} totals={t} />,
    doctrine: <DoctrineView state={state} act={act} />,
    mission: <MissionView state={state} act={act} totals={t} finance={fin} />,
    business: <BusinessView state={state} act={act} totals={t} />,
    invest: <InvestView state={state} act={act} match={multi ? match : null} />,
    branch: <BranchView state={state} act={act} totals={t} />,
    stats: <StatsView state={state} totals={t} finance={fin} />,
  }[tab]

  return (
    <TipProvider>
    <div className="game">
      <Header
        state={state}
        act={act}
        totals={t}
        finance={fin}
        onTitle={backToTitle}
        onExport={exportSave}
        onImport={() => fileRef.current?.click()}
        onHelp={() => setHelp(true)}
        match={multi ? match : null}
      />
      {fileRef && <input ref={fileRef} type="file" accept="application/json" hidden onChange={importSave} />}

      <nav className="tabs">
        {TABS.map((x) => (
          <button key={x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </nav>

      <div className="body">
        <div className="main-col">{view}</div>
        <div className="side-col">
          {multi && <TipCardLazy id="multiplayer" />}
          {multi && (
            <RivalPanel
              state={state}
              match={match}
              onAssassinate={(target) => match.send({ t: 'assassinate', target, funds: state.funds })}
              onLawsuit={(target, charge) => match.send({ t: 'lawsuit', target, charge, funds: state.funds })}
            />
          )}
          <QuestPanel state={state} totals={t} />
          <LogPanel log={state.log} />
        </div>
      </div>

      <EventToast toasts={toasts} onDismiss={(key) => setToasts((prev) => prev.filter((x) => x.key !== key))} />
      {state.ending && !hideEnding && (
        <EndingModal
          state={state}
          totals={t}
          onTitle={backToTitle}
          onDismiss={() => setHideEnding(true)}
          onContinue={multi ? null : () => { setHideEnding(false); act('CONTINUE_AFTER_VICTORY') }}
          ranking={multi ? match.ranking : null}
        />
      )}
      {help && <HelpModal onClose={() => setHelp(false)} onOpening={() => { setHelp(false); setOpening(true) }} />}
      {opening && <OpeningTutorial state={state} onClose={() => setOpening(false)} />}
    </div>
    </TipProvider>
  )
}
