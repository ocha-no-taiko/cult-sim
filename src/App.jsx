import React, { useReducer, useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { reducer } from './game/engine/actions.js'
import { createInitialState, SAVE_VERSION } from './game/engine/state.js'
import { totals, finance } from './game/engine/selectors.js'

import TitleScreen from './components/TitleScreen.jsx'
import FoundingScreen from './components/FoundingScreen.jsx'
import Header from './components/Header.jsx'
import LogPanel from './components/LogPanel.jsx'
import GuidePanel from './components/GuidePanel.jsx'
import CityView from './components/CityView.jsx'
import DoctrineView from './components/DoctrineView.jsx'
import MissionView from './components/MissionView.jsx'
import BusinessView from './components/BusinessView.jsx'
import BranchView from './components/BranchView.jsx'
import StatsView from './components/StatsView.jsx'
import EventToast from './components/EventToast.jsx'
import EndingModal from './components/EndingModal.jsx'
import { TipProvider, HelpModal } from './components/TipCard.jsx'

const SAVE_KEY = 'cult-save-v2'
const SPEED_MS = { 1: 900, 2: 400, 4: 160 }

const TABS = [
  { id: 'city', label: '宗教都市' },
  { id: 'doctrine', label: '教義' },
  { id: 'mission', label: '布教' },
  { id: 'business', label: '事業' },
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
  const fileRef = useRef(null)

  const act = useCallback((type, payload) => dispatch({ type, payload }), [])

  // ── 時間経過 ───────────────────────────────
  useEffect(() => {
    if (!started || state.phase !== 'playing' || !state.speed) return
    const ms = SPEED_MS[state.speed] ?? 900
    const id = setInterval(() => dispatch({ type: 'TICK' }), ms)
    return () => clearInterval(id)
  }, [started, state.phase, state.speed])

  // スペースキーで一時停止／再開
  useEffect(() => {
    if (!started) return
    const onKey = (e) => {
      if (e.code !== 'Space' || e.target instanceof HTMLInputElement) return
      e.preventDefault()
      dispatch({ type: 'SET_SPEED', payload: state.speed ? 0 : 1 })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started, state.speed])

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
    if (!started || state.phase === 'founding') return
    if (state.day % 10 !== 0) return
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state))
      setHasSave(true)
    } catch { /* 容量超過などは黙って諦める */ }
  }, [state.day, started, state.phase])

  const t = useMemo(() => totals(state), [state])
  const fin = useMemo(() => finance(state, t), [state, t])

  const newGame = (payload) => {
    act('NEW_GAME', payload)
    setStarted(true)
    setHideEnding(false)
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
    setStarted(false)
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
        onContinue={continueGame}
        onImport={() => fileRef.current?.click()}
        fileInput={<input ref={fileRef} type="file" accept="application/json" hidden onChange={importSave} />}
      />
    )
  }

  if (state.phase === 'founding') {
    return <FoundingScreen state={state} act={act} onBack={backToTitle} />
  }

  const view = {
    city: <CityView state={state} act={act} totals={t} />,
    doctrine: <DoctrineView state={state} act={act} />,
    mission: <MissionView state={state} act={act} totals={t} finance={fin} />,
    business: <BusinessView state={state} act={act} totals={t} />,
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
          <GuidePanel state={state} totals={t} />
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
          onContinue={() => { setHideEnding(false); act('CONTINUE_AFTER_VICTORY') }}
        />
      )}
      {help && <HelpModal onClose={() => setHelp(false)} />}
    </div>
    </TipProvider>
  )
}
