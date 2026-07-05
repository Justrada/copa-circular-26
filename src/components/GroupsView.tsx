import { knownAsOf } from '../lib/data'
import type { DataBundle, Lang, Selection } from '../types'

interface Props {
  data: DataBundle
  asOf: Date | null
  onSelect: (sel: Selection) => void
  lang: Lang
}

export default function GroupsView({ data, asOf, onSelect, lang }: Props) {
  const t = data.tournament
  return (
    <div className="groups-grid">
      {Object.entries(t.groups).map(([letter, teamIds]) => (
        <div key={letter} className="group-card">
          <h3>
            {lang === 'es' ? 'Grupo' : 'Group'} {letter}
          </h3>
          <table>
            <tbody>
              {teamIds.map((id) => {
                const team = t.teams[id]
                return (
                  <tr
                    key={id}
                    className={team.advanced ? 'advanced' : ''}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect({ kind: 'team', id })
                    }}
                  >
                    <td className="pos">{team.groupRank}</td>
                    <td className="flag">
                      <img src={team.logo} alt="" width={22} height={15} loading="lazy" />
                    </td>
                    <td className="name">{team.shortName}</td>
                    <td className="rec">
                      {team.won}-{team.drawn}-{team.lost}
                    </td>
                    <td className="gd">{team.goalDiff > 0 ? `+${team.goalDiff}` : team.goalDiff}</td>
                    <td className="pts">{team.points}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="group-matches">
            {t.matches
              .filter((m) => m.stage === 'group' && m.homeId && t.teams[m.homeId].group === letter)
              .map((m) => (
                <button
                  key={m.id}
                  className="gm-row"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect({ kind: 'match', id: m.id })
                  }}
                >
                  <span>{m.homeId ? t.teams[m.homeId].abbrev : '?'}</span>
                  <span className="gm-score">
                    {knownAsOf(m, asOf) ? `${m.homeScore}–${m.awayScore}` : '·'}
                  </span>
                  <span>{m.awayId ? t.teams[m.awayId].abbrev : '?'}</span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
