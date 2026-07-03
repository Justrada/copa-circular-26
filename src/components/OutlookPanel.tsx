import { useMemo, useState } from 'react'
import { stageName, t as tr } from '../lib/i18n'
import type { Picks, Scorecard } from '../lib/picks'
import { ROUND_WEIGHT, validPick } from '../lib/picks'
import type { DataBundle, Lang } from '../types'

interface Props {
  data: DataBundle
  picks: Picks
  scorecard: Scorecard
  lang: Lang
}

interface Item {
  matchId: string
  stage: string
  teamAbbrev: string
  prob: number | null
  potential: number
}

/** Odds-implied outlook for pending picks: how doomed am I? */
export default function OutlookPanel({ data, picks, scorecard, lang }: Props) {
  const [open, setOpen] = useState(false)
  const t = data.tournament

  const items = useMemo<Item[]>(() => {
    const out: Item[] = []
    for (const m of t.matches) {
      if (m.stage === 'group' || m.status === 'ft') continue
      const pick = validPick(t, picks, m)
      if (!pick) continue
      const conf = picks.conf[m.id] ?? 1
      const potential = ROUND_WEIGHT[m.stage] + 2 * (conf - 1)
      let prob: number | null = null
      const o = data.odds[m.id]
      if (o && m.homeId && m.awayId) {
        const side = pick === m.homeId ? o.home : pick === m.awayId ? o.away : null
        if (side != null) {
          // Advance ≈ win-in-90 plus roughly half the draw mass (pens are a coin flip)
          const toAdvance = /advance/i.test(o.note ?? '')
          prob = Math.min(1, side + (toAdvance || o.draw == null ? 0 : o.draw / 2))
        }
      }
      out.push({ matchId: m.id, stage: m.stage, teamAbbrev: t.teams[pick].abbrev, prob, potential })
    }
    return out
  }, [t, picks, data.odds])

  if (!items.length) return null
  const withProb = items.filter((i) => i.prob != null)
  const expected = scorecard.points + withProb.reduce((s, i) => s + i.prob! * i.potential, 0)
  const boldest = withProb.length ? withProb.reduce((a, b) => (a.prob! < b.prob! ? a : b)) : null
  const marketFav = data.champion ? Object.entries(data.champion).sort((a, b) => b[1] - a[1])[0] : null

  return (
    <div className="outlook">
      <button className="outlook-head" onClick={() => setOpen(!open)}>
        🔭 {tr('outlook', lang)}: {tr('expected', lang)} ≈ <b>{expected.toFixed(1)}</b> {tr('points', lang)}
        {boldest && (
          <span className="outlook-bold">
            · {tr('boldest', lang)}: {boldest.teamAbbrev} {Math.round(boldest.prob! * 100)}%
          </span>
        )}
        <span className="outlook-caret">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="outlook-list">
          {items
            .sort((a, b) => (a.prob ?? 1.01) - (b.prob ?? 1.01))
            .map((i) => (
              <li key={i.matchId}>
                <span className="ol-stage">{stageName(i.stage as never, lang)}</span>
                <span className="ol-team">{i.teamAbbrev}</span>
                <span className="ol-prob">{i.prob != null ? `${Math.round(i.prob * 100)}%` : '—'}</span>
                <span className="ol-pts">+{i.potential}</span>
              </li>
            ))}
          {marketFav && (
            <li className="ol-market">
              📈 {tr('marketFavorite', lang)}: {marketFav[0]} {Math.round(marketFav[1] * 100)}%
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
