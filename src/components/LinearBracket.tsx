import { knownAsOf, slotHint, slotTeamId, upsetInfo } from '../lib/data'
import { stageName, t as tr } from '../lib/i18n'
import type { Picks, Scorecard } from '../lib/picks'
import { validPick } from '../lib/picks'
import type { DataBundle, Lang, Match, Selection, Stage } from '../types'

interface Props {
  data: DataBundle
  asOf: Date | null
  picks: Picks
  theirs: Picks | null
  scorecard: Scorecard
  onSelect: (sel: Selection) => void
  lang: Lang
}

const COLUMNS: Stage[] = ['r32', 'r16', 'qf', 'sf', 'final', 'third']

export default function LinearBracket({ data, asOf, picks, theirs, scorecard, onSelect, lang }: Props) {
  const t = data.tournament
  return (
    <div className="linear-wrap">
      {COLUMNS.map((stage) => {
        const ms = t.matches.filter((m) => m.stage === stage)
        return (
          <div key={stage} className="linear-col">
            <h3>{stageName(stage, lang)}</h3>
            {ms.map((m) => (
              <MatchCard
                key={m.id}
                data={data}
                m={m}
                asOf={asOf}
                picks={picks}
                theirs={theirs}
                scorecard={scorecard}
                onSelect={onSelect}
                lang={lang}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function MatchCard({
  data,
  m,
  asOf,
  picks,
  theirs,
  scorecard,
  onSelect,
  lang,
}: {
  data: DataBundle
  m: Match
  asOf: Date | null
  picks: Picks
  theirs: Picks | null
  scorecard: Scorecard
  onSelect: Props['onSelect']
  lang: Lang
}) {
  const t = data.tournament
  const known = knownAsOf(m, asOf)
  const upset = known ? upsetInfo(m, data.odds) : null
  const myPick = validPick(t, picks, m, asOf)
  const theirPick = theirs ? validPick(t, theirs, m, asOf) : null
  const result = scorecard.results[m.id]

  const row = (side: 'home' | 'away') => {
    const id = slotTeamId(t, m, side, asOf)
    const team = id ? t.teams[id] : null
    const showScore = known || m.status === 'live'
    const score = showScore ? (side === 'home' ? m.homeScore : m.awayScore) : null
    const pens = showScore ? (side === 'home' ? m.homePens : m.awayPens) : null
    const winner = known && m.winnerId != null && id === m.winnerId
    return (
      <div className={`mc-row ${winner ? 'winner' : known ? 'loser' : ''}`}>
        {team ? (
          <>
            <img src={team.logo} alt="" width={20} height={14} loading="lazy" />
            <span className="mc-name">{team.shortName}</span>
          </>
        ) : (
          <span className="mc-tbd">{slotHint(t, m, side)}</span>
        )}
        <span className="mc-marks">
          {myPick && id === myPick && <span className="mark-mine" title={tr('yourPick', lang)}>★</span>}
          {theirPick && id === theirPick && <span className="mark-theirs" title={tr('theirPick', lang)}>◆</span>}
        </span>
        {score != null && (
          <span className="mc-score">
            {score}
            {pens != null ? ` (${pens})` : ''}
          </span>
        )}
      </div>
    )
  }

  return (
    <button className={`match-card ${result ? `res-${result.outcome}` : ''}`} onClick={() => onSelect({ kind: 'match', id: m.id })}>
      {row('home')}
      {row('away')}
      <div className="mc-foot">
        <span>
          {known
            ? m.statusDetail
            : new Date(m.date).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
              })}
        </span>
        {upset && upset.kind !== 'expected' && <span className={`upset-tag ${upset.magnitude}`}>⚡</span>}
        {result && result.outcome === 'correct' && <span className="pts-tag">+{result.points}</span>}
        {result && result.outcome === 'wrong' && result.points < 0 && <span className="pts-tag neg">{result.points}</span>}
      </div>
    </button>
  )
}
