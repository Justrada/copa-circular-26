import { useMemo } from 'react'
import { t as tr } from '../lib/i18n'
import type { DataBundle, Lang, Selection } from '../types'

interface Props {
  data: DataBundle
  favorites: Set<string>
  onSelect: (sel: Selection) => void
  lang: Lang
}

/** Slim strip of the matchday: live, just-finished, and upcoming-soon games. */
export default function TodayStrip({ data, favorites, onSelect, lang }: Props) {
  const t = data.tournament
  const items = useMemo(() => {
    const now = Date.now()
    return t.matches
      .filter((m) => {
        const k = new Date(m.date).getTime()
        return m.status === 'live' || (k > now - 10 * 3600_000 && k < now + 22 * 3600_000)
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10)
  }, [t])

  if (!items.length) return null
  return (
    <div className="today-strip">
      <span className="today-title">{tr('today', lang)}</span>
      {items.map((m) => {
        const h = m.homeId ? t.teams[m.homeId] : null
        const a = m.awayId ? t.teams[m.awayId] : null
        const fav = (m.homeId && favorites.has(m.homeId)) || (m.awayId && favorites.has(m.awayId))
        const label =
          m.status === 'scheduled'
            ? new Date(m.date).toLocaleTimeString(lang === 'es' ? 'es-MX' : 'en-US', { hour: 'numeric', minute: '2-digit' })
            : m.status === 'live'
              ? m.statusDetail
              : `${m.homeScore}–${m.awayScore}${m.homePens != null ? ' p' : ''}`
        return (
          <button
            key={m.id}
            className={`today-chip ${m.status} ${fav ? 'fav' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onSelect({ kind: 'match', id: m.id })
            }}
          >
            {fav && <span className="today-star">★</span>}
            {m.status === 'live' && <span className="today-live">●</span>}
            <span>{h?.abbrev ?? '?'}</span>
            <span className="today-label">{label}</span>
            <span>{a?.abbrev ?? '?'}</span>
          </button>
        )
      })}
    </div>
  )
}
