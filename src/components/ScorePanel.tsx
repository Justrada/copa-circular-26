import { t as tr } from '../lib/i18n'
import type { Picks, Scorecard } from '../lib/picks'
import { pickedChampion } from '../lib/picks'
import type { DataBundle, Lang } from '../types'

interface Props {
  data: DataBundle
  picks: Picks
  scorecard: Scorecard
  theirs: Picks | null
  theirCard: Scorecard | null
  champion: Record<string, number> | null
  lang: Lang
}

export default function ScorePanel({ data, picks, scorecard, theirs, theirCard, champion, lang }: Props) {
  const t = data.tournament
  const decided = scorecard.correct + scorecard.wrong
  const champId = pickedChampion(t, picks)
  const marketFav = champion
    ? Object.entries(champion).sort((a, b) => b[1] - a[1])[0]
    : null

  return (
    <div className="score-panel">
      <div className="score-chips">
        <span className="chip-stat pts">
          {scorecard.points} {tr('points', lang)}
        </span>
        <span className="chip-stat">
          {tr('record', lang)}: {scorecard.correct}/{decided}
          {scorecard.pending ? ` · ${scorecard.pending} ${tr('pending', lang).toLowerCase()}` : ''}
        </span>
        {champId && (
          <span className="chip-stat champ">
            🏆 {t.teams[champId].abbrev}
          </span>
        )}
        {marketFav && (
          <span className="chip-stat market" title={tr('marketFavorite', lang)}>
            📈 {marketFav[0]} {Math.round(marketFav[1] * 100)}%
          </span>
        )}
        {picks.retro && <span className="chip-stat retro">{tr('retroMode', lang)}</span>}
      </div>
      {theirs && theirCard && (
        <div className="compare-row">
          <span>
            {tr('compare', lang)} <b>{theirs.name || 'a friend'}</b>: {theirCard.correct}/{theirCard.correct + theirCard.wrong} ·{' '}
            {theirCard.points} {tr('points', lang)}
          </span>
          <span className={scorecard.points >= theirCard.points ? 'lead' : 'trail'}>
            {scorecard.points >= theirCard.points ? '🥇' : '🥈'}
          </span>
        </div>
      )}
    </div>
  )
}
