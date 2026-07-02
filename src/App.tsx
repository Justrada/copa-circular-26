import { useEffect, useMemo, useState } from 'react'
import GroupsView from './components/GroupsView'
import LinearBracket from './components/LinearBracket'
import MatchSheet from './components/MatchSheet'
import RadialBracket from './components/RadialBracket'
import ScorePanel from './components/ScorePanel'
import ShareBar from './components/ShareBar'
import TimeSlider from './components/TimeSlider'
import { loadData, matchById, team } from './lib/data'
import { t as tr } from './lib/i18n'
import type { Picks } from './lib/picks'
import { decodePicks, loadPicks, savePicks, scorePicks } from './lib/picks'
import type { DataBundle, Lang, Selection, View } from './types'

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

  useEffect(() => {
    loadData().then(setData, (e) => setError(String(e)))
    const mm = location.hash.match(/#p=([A-Za-z0-9_-]+)/)
    if (mm) setTheirs(decodePicks(mm[1]))
  }, [])

  useEffect(() => localStorage.setItem('cc26-lang', lang), [lang])

  const picks = retro ? retroPicks : livePicks
  const setPicks = (p: Picks) => {
    savePicks(p)
    if (p.retro) setRetroPicks(p)
    else setLivePicks(p)
  }

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
  }
  const onConf = (matchId: string, conf: 1 | 2 | 3) => setPicks({ ...picks, conf: { ...picks.conf, [matchId]: conf } })
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
          <button className="toggle lang" onClick={() => setLang(lang === 'en' ? 'es' : 'en')}>
            {lang === 'en' ? 'ES' : 'EN'}
          </button>
        </nav>
      </header>

      <div className="statusbar" onClick={(e) => e.stopPropagation()}>
        <ScorePanel data={data} picks={picks} scorecard={scorecard} theirs={theirs} theirCard={theirCard} champion={data.champion} lang={lang} />
        <ShareBar data={data} picks={picks} scorecard={scorecard} lang={lang} />
      </div>

      {timeTravel && (
        <div onClick={(e) => e.stopPropagation()}>
          <TimeSlider asOf={asOf} onChange={setAsOf} lang={lang} />
        </div>
      )}

      {retro && <div className="retro-banner">📼 {tr('retroHint', lang)}</div>}

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
          <RadialBracket data={data} asOf={asOf} selection={selection} onSelect={setSelection} picks={picks} scorecard={scorecard} lang={lang} />
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

      {selMatch && (
        <MatchSheet
          data={data}
          m={selMatch}
          asOf={asOf}
          picks={picks}
          onPick={onPick}
          onConf={onConf}
          onScore={onScore}
          onSelectTeam={(id) => {
            setSelection({ kind: 'team', id })
            setView('circle')
          }}
          onClose={() => setSelection(null)}
          lang={lang}
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
