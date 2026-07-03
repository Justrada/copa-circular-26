import { useEffect, useMemo, useRef, useState } from 'react'
import FavoritesSidebar from './components/FavoritesSidebar'
import GroupsView from './components/GroupsView'
import LinearBracket from './components/LinearBracket'
import MatchSheet from './components/MatchSheet'
import OutlookPanel from './components/OutlookPanel'
import RadialBracket from './components/RadialBracket'
import ScorePanel from './components/ScorePanel'
import ShareBar from './components/ShareBar'
import TimeSlider from './components/TimeSlider'
import TodayStrip from './components/TodayStrip'
import { loadData, matchById, team } from './lib/data'
import { t as tr } from './lib/i18n'
import { inLiveWindow, refreshLiveScores } from './lib/live'
import type { Picks } from './lib/picks'
import { decodePicks, isLocked, isPickable, loadPicks, pickedChampion, savePicks, scorePicks } from './lib/picks'
import { buildShareCard, shareOrDownload } from './lib/sharecard'
import type { DataBundle, Lang, Selection, Tournament, View } from './types'

const STAGE_ORDER = ['r32', 'r16', 'qf', 'sf', 'third', 'final']

export default function App() {
  const [data, setData] = useState<DataBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('cc26-lang') as Lang) || 'en')
  const [view, setView] = useState<View>(() => (window.innerWidth < 760 ? 'bracket' : 'circle'))
  const [selection, setSelection] = useState<Selection | null>(null)
  const [asOf, setAsOf] = useState<Date | null>(null)
  const [timeTravel, setTimeTravel] = useState(false)
  const [retro, setRetro] = useState(false)
  const [livePicks, setLivePicks] = useState<Picks>(() => loadPicks(false))
  const [retroPicks, setRetroPicks] = useState<Picks>(() => loadPicks(true))
  const [theirs, setTheirs] = useState<Picks | null>(null)
  const [wizardOn, setWizardOn] = useState(false)
  const [coachSeen, setCoachSeen] = useState(() => localStorage.getItem('cc26-coach') === '1')
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('cc26-favs') ?? '[]'))
    } catch {
      return new Set()
    }
  })
  const [sidebarOn, setSidebarOn] = useState(false)
  const [untangle, setUntangle] = useState(() => localStorage.getItem('cc26-untangle') !== '0')

  const toggleFav = (teamId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      localStorage.setItem('cc26-favs', JSON.stringify([...next]))
      return next
    })
  }

  useEffect(() => {
    loadData().then(setData, (e) => setError(String(e)))
    const mm = location.hash.match(/#p=([A-Za-z0-9_-]+)/)
    if (mm) setTheirs(decodePicks(mm[1]))
  }, [])

  // Match-day live mode: poll ESPN every 2 minutes while a match window is open
  const liveRef = useRef<Tournament | null>(null)
  liveRef.current = data?.tournament ?? null
  useEffect(() => {
    const id = setInterval(async () => {
      const t = liveRef.current
      if (!t || !inLiveWindow(t)) return
      const fresh = await refreshLiveScores(t)
      if (fresh) setData((d) => (d ? { ...d, tournament: fresh } : d))
    }, 120_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => localStorage.setItem('cc26-lang', lang), [lang])

  const picks = retro ? retroPicks : livePicks
  const setPicks = (p: Picks) => {
    savePicks(p)
    if (p.retro) setRetroPicks(p)
    else setLivePicks(p)
  }

  // All matches the user can currently pick, bracket order; drives the wizard + FAB count
  const pickQueue = useMemo(() => {
    if (!data) return []
    return data.tournament.matches
      .filter((m) => isPickable(m) && !isLocked(m, retro))
      .sort(
        (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.bracketIndex - b.bracketIndex
      )
  }, [data, retro])
  const unpickedCount = useMemo(
    () => pickQueue.filter((m) => !(retro ? retroPicks : livePicks).winners[m.id]).length,
    [pickQueue, retro, retroPicks, livePicks]
  )

  const scorecard = useMemo(
    () => (data ? scorePicks(data, picks, asOf) : { results: {}, points: 0, correct: 0, wrong: 0, pending: 0, exact: 0 }),
    [data, picks, asOf]
  )
  const theirCard = useMemo(() => (data && theirs ? scorePicks(data, theirs, asOf) : null), [data, theirs, asOf])

  if (error)
    return (
      <div className="boot">
        <p>Data failed to load ({error}). Refresh?</p>
      </div>
    )
  if (!data)
    return (
      <div className="boot">
        <p>⚽ {tr('loading', lang)}</p>
      </div>
    )

  const t = data.tournament
  const selMatch = selection?.kind === 'match' ? matchById(t, selection.id) : undefined
  const selTeam = selection?.kind === 'team' ? team(t, selection.id) : null

  const onPick = (matchId: string, teamId: string | null) => {
    const winners = { ...picks.winners }
    if (teamId) winners[matchId] = teamId
    else delete winners[matchId]
    setPicks({ ...picks, winners })
    if (wizardOn && teamId) {
      // step to the next unpicked match, giving the star/score row a beat to register
      const idx = pickQueue.findIndex((m) => m.id === matchId)
      const next = pickQueue.find((m, i) => i > idx && !winners[m.id]) ?? pickQueue.find((m) => !winners[m.id])
      setTimeout(() => {
        if (next) setSelection({ kind: 'match', id: next.id })
        else {
          setSelection(null)
          setWizardOn(false)
        }
      }, 450)
    }
  }
  const startWizard = () => {
    const first = pickQueue.find((m) => !picks.winners[m.id]) ?? pickQueue[0]
    if (!first) return
    setWizardOn(true)
    setSelection({ kind: 'match', id: first.id })
  }
  const onConf = (matchId: string, conf: 1 | 2 | 3) => setPicks({ ...picks, conf: { ...picks.conf, [matchId]: conf } })
  const shareCard = async () => {
    if (view !== 'circle') {
      setView('circle')
      await new Promise((r) => setTimeout(r, 450))
    }
    const svg = document.getElementById('bracket-svg') as SVGSVGElement | null
    if (!svg) throw new Error('bracket svg not found')
    const decided = scorecard.correct + scorecard.wrong
    const champId = pickedChampion(t, picks)
    const sub = [
      decided ? `${scorecard.correct}/${decided} ${lang === 'es' ? 'aciertos' : 'picks right'} · ${scorecard.points} pts` : tr('tagline', lang),
      champId ? `🏆 ${t.teams[champId].name}` : '',
    ]
      .filter(Boolean)
      .join('  ·  ')
    const blob = await buildShareCard(svg, {
      title: "⚽ Copa Circular '26",
      sub,
      footer: `${location.origin}${location.pathname}`,
    })
    await shareOrDownload(blob, 'copa-circular-26-bracket.png', sub)
  }
  const onScore = (matchId: string, score: [number, number] | null) => {
    const scores = { ...picks.scores }
    if (score) scores[matchId] = score
    else delete scores[matchId]
    setPicks({ ...picks, scores })
  }

  return (
    <div className="app" onClick={() => setSelection(null)}>
      <header className="topbar" onClick={(e) => e.stopPropagation()}>
        <div className="brand">
          <h1>⚽ {tr('title', lang)}</h1>
          <p className="tagline">{tr('tagline', lang)}</p>
        </div>
        <nav className="controls">
          <div className="tabs">
            {(['circle', 'bracket', 'groups'] as View[]).map((v) => (
              <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
                {tr(v, lang)}
              </button>
            ))}
          </div>
          <button className={`toggle ${retro ? 'on' : ''}`} onClick={() => setRetro(!retro)} title={tr('retroHint', lang)}>
            {retro ? '📼 ' : ''}
            {tr('retroMode', lang)}
          </button>
          <button className={`toggle ${timeTravel ? 'on' : ''}`} onClick={() => { setTimeTravel(!timeTravel); if (timeTravel) setAsOf(null) }}>
            🕰 {tr('timeTravel', lang)}
          </button>
          <button
            className={`toggle ${untangle ? 'on' : ''}`}
            title={tr('untangleHint', lang)}
            onClick={() => {
              localStorage.setItem('cc26-untangle', untangle ? '0' : '1')
              setUntangle(!untangle)
            }}
          >
            ✦ {tr('untangle', lang)}
          </button>
          <button className={`toggle ${sidebarOn ? 'on' : ''}`} onClick={() => setSidebarOn(!sidebarOn)}>
            ★ {tr('watching', lang)}{favorites.size ? ` · ${favorites.size}` : ''}
          </button>
          <button className="toggle lang" onClick={() => setLang(lang === 'en' ? 'es' : 'en')}>
            {lang === 'en' ? 'ES' : 'EN'}
          </button>
        </nav>
      </header>

      <div className="statusbar" onClick={(e) => e.stopPropagation()}>
        <ScorePanel data={data} picks={picks} scorecard={scorecard} theirs={theirs} theirCard={theirCard} champion={data.champion} lang={lang} />
        <ShareBar data={data} picks={picks} scorecard={scorecard} lang={lang} onCard={shareCard} />
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <TodayStrip data={data} favorites={favorites} onSelect={setSelection} lang={lang} />
        <OutlookPanel data={data} picks={picks} scorecard={scorecard} lang={lang} />
      </div>

      {timeTravel && (
        <div onClick={(e) => e.stopPropagation()}>
          <TimeSlider asOf={asOf} onChange={setAsOf} lang={lang} />
        </div>
      )}

      {retro && <div className="retro-banner">📼 {tr('retroHint', lang)}</div>}

      {!coachSeen && (
        <div className="coach" onClick={(e) => e.stopPropagation()}>
          <span>💡 {tr('coach', lang)}</span>
          <button
            onClick={() => {
              localStorage.setItem('cc26-coach', '1')
              setCoachSeen(true)
            }}
          >
            {tr('gotIt', lang)}
          </button>
        </div>
      )}

      {selTeam && (
        <div className="path-pill" onClick={(e) => e.stopPropagation()}>
          <img src={selTeam.logo} alt="" width={22} height={15} />
          <span>
            {tr('pathOf', lang)} <b>{selTeam.name}</b>
          </span>
          <button onClick={() => setSelection(null)}>{tr('clearPath', lang)} ✕</button>
        </div>
      )}

      <main className={`view-${view}`}>
        {view === 'circle' && (
          <RadialBracket
            data={data}
            asOf={asOf}
            selection={selection}
            onSelect={setSelection}
            picks={picks}
            scorecard={scorecard}
            favorites={favorites}
            untangle={untangle}
            lang={lang}
          />
        )}
        {view === 'bracket' && (
          <LinearBracket data={data} asOf={asOf} picks={picks} theirs={theirs} scorecard={scorecard} onSelect={setSelection} lang={lang} />
        )}
        {view === 'groups' && (
          <GroupsView
            data={data}
            asOf={asOf}
            onSelect={(sel) => {
              setSelection(sel)
              if (sel.kind === 'team') setView('circle')
            }}
            lang={lang}
          />
        )}
      </main>

      {view !== 'groups' && unpickedCount > 0 && !wizardOn && (
        <button className="pick-fab" onClick={(e) => { e.stopPropagation(); startWizard() }}>
          ⭐ {tr('fillBracket', lang)} · {unpickedCount}
        </button>
      )}

      {sidebarOn && (
        <FavoritesSidebar
          data={data}
          favorites={favorites}
          picks={picks}
          onToggle={toggleFav}
          onSelectTeam={(id) => {
            setSelection({ kind: 'team', id })
            setView('circle')
          }}
          onClose={() => setSidebarOn(false)}
          lang={lang}
        />
      )}

      {selMatch && (
        <MatchSheet
          data={data}
          m={selMatch}
          asOf={asOf}
          picks={picks}
          onPick={onPick}
          onConf={onConf}
          onScore={onScore}
          favorites={favorites}
          onToggleFav={toggleFav}
          onSelectTeam={(id) => {
            setWizardOn(false)
            setSelection({ kind: 'team', id })
            setView('circle')
          }}
          onClose={() => {
            setSelection(null)
            setWizardOn(false)
          }}
          lang={lang}
          wizard={
            wizardOn && pickQueue.some((m) => m.id === selMatch.id)
              ? {
                  pos: pickQueue.findIndex((m) => m.id === selMatch.id) + 1,
                  total: pickQueue.length,
                  onPrev: () => {
                    const i = pickQueue.findIndex((m) => m.id === selMatch.id)
                    if (i > 0) setSelection({ kind: 'match', id: pickQueue[i - 1].id })
                  },
                  onNext: () => {
                    const i = pickQueue.findIndex((m) => m.id === selMatch.id)
                    if (i < pickQueue.length - 1) setSelection({ kind: 'match', id: pickQueue[i + 1].id })
                  },
                }
              : undefined
          }
        />
      )}

      <footer onClick={(e) => e.stopPropagation()}>
        <p>{tr('disclaimer', lang)}</p>
        <p className="fine">
          Data refreshed {new Date(t.generatedAt).toLocaleString()} · results via ESPN · odds via Polymarket/sportsbooks · video via
          official YouTube embeds
        </p>
      </footer>
    </div>
  )
}
