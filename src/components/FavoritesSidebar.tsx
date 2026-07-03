import { useState } from 'react'
import { actualExitMatch, teamPath } from '../lib/data'
import { fmtDate, stageName, t as tr } from '../lib/i18n'
import type { Picks } from '../lib/picks'
import { predictedRoute } from '../lib/picks'
import type { DataBundle, Lang } from '../types'

interface Props {
  data: DataBundle
  favorites: Set<string>
  picks: Picks
  onToggle: (teamId: string) => void
  onSelectTeam: (teamId: string) => void
  onClose: () => void
  lang: Lang
}

export default function FavoritesSidebar({ data, favorites, picks, onToggle, onSelectTeam, onClose, lang }: Props) {
  const t = data.tournament
  const [adding, setAdding] = useState(favorites.size === 0)

  const status = (teamId: string): string => {
    const team = t.teams[teamId]
    if (!team.advanced) return tr('outInGroups', lang)
    const exit = actualExitMatch(t, teamId)
    if (exit) {
      const opp = exit.winnerId ? t.teams[exit.winnerId].shortName : '?'
      return `${tr('outAt', lang)} ${stageName(exit.stage, lang)} · vs ${opp}`
    }
    const final = t.matches.find((m) => m.stage === 'final')
    if (final?.status === 'ft' && final.winnerId === teamId) return `🏆 ${tr('champion', lang)}`
    const next = teamPath(t, teamId).find((m) => m.status !== 'ft')
    if (next) {
      const oppId = next.homeId === teamId ? next.awayId : next.homeId
      const opp = oppId ? t.teams[oppId].shortName : '?'
      return `${tr('nextMatch', lang)}: vs ${opp} · ${fmtDate(next.date, lang)}`
    }
    return tr('awaitingOpponent', lang)
  }

  const yourCall = (teamId: string): string => {
    const p = predictedRoute(t, picks, teamId)
    if (p.champion) return `${tr('yourCall', lang)}: 🏆 ${tr('champion', lang)}`
    if (p.exitId) {
      const m = t.matches.find((x) => x.id === p.exitId)
      return `${tr('yourCall', lang)}: ${tr('outAt', lang)} ${m ? stageName(m.stage, lang) : '?'}`
    }
    if (p.winIds.size > 0) {
      const last = [...p.route].reverse().find((id) => p.winIds.has(id))
      const m = t.matches.find((x) => x.id === last)
      return `${tr('yourCall', lang)}: ✓ ${m ? stageName(m.stage, lang) : ''}…`
    }
    return `${tr('yourCall', lang)}: ${tr('noPicksYet', lang)}`
  }

  return (
    <aside className="fav-sidebar" onClick={(e) => e.stopPropagation()}>
      <header className="sheet-head">
        <div className="sheet-stage">★ {tr('watching', lang)}</div>
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      {favorites.size === 0 && <p className="fav-empty">{tr('noFavsYet', lang)}</p>}

      <ul className="fav-list">
        {[...favorites].map((id) => {
          const team = t.teams[id]
          if (!team) return null
          return (
            <li key={id} className="fav-item">
              <button className="fav-main" onClick={() => onSelectTeam(id)}>
                <img src={team.logo} alt="" width={26} height={18} />
                <span className="fav-name">{team.name}</span>
                <span className="fav-status">{status(id)}</span>
                <span className="fav-call">{yourCall(id)}</span>
              </button>
              <button className="fav-star on" title={tr('favorite', lang)} onClick={() => onToggle(id)}>
                ★
              </button>
            </li>
          )
        })}
      </ul>

      <button className="fav-add-toggle" onClick={() => setAdding(!adding)}>
        {adding ? '−' : '+'} {tr('addTeam', lang)}
      </button>
      {adding && (
        <div className="fav-picker">
          {Object.entries(t.groups).map(([letter, ids]) => (
            <div key={letter} className="fav-picker-group">
              <span className="fav-picker-letter">{letter}</span>
              {ids.map((id) => {
                const team = t.teams[id]
                const on = favorites.has(id)
                return (
                  <button
                    key={id}
                    className={`fav-pick ${on ? 'on' : ''} ${team.advanced ? '' : 'eliminated'}`}
                    onClick={() => onToggle(id)}
                    title={team.name}
                  >
                    <img src={team.logo} alt="" width={18} height={13} />
                    {team.abbrev}
                    <span className="fav-pick-star">{on ? '★' : '☆'}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
