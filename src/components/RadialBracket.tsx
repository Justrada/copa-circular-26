import { useMemo, useState } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { knownAsOf, matchById, slotHint, slotTeamId, teamPath, upsetInfo } from '../lib/data'
import { stageName, t as tr } from '../lib/i18n'
import {
  GROUP_LETTERS,
  GROUP_RING,
  NODE_SIZE,
  RINGS,
  chipTransform,
  feedLinkPath,
  groupSector,
  matchPos,
  polar,
  ribbonPath,
  sectorPath,
} from '../lib/layout'
import type { Picks, Scorecard } from '../lib/picks'
import { validPick } from '../lib/picks'
import type { DataBundle, Lang, Match, Selection } from '../types'

interface Props {
  data: DataBundle
  asOf: Date | null
  selection: Selection | null
  onSelect: (sel: Selection | null) => void
  picks: Picks
  scorecard: Scorecard
  lang: Lang
}

export default function RadialBracket({ data, asOf, selection, onSelect, picks, scorecard, lang }: Props) {
  const { tournament: t } = data
  const [zoomed, setZoomed] = useState(false)

  const koMatches = useMemo(() => t.matches.filter((m) => m.stage !== 'group'), [t])

  // Matches on the selected team's path (played + future slots they'd occupy via reality)
  const pathIds = useMemo(() => {
    if (selection?.kind !== 'team') return null
    const ids = new Set(teamPath(t, selection.id).map((m) => m.id))
    return ids
  }, [selection, t])

  const upsets = useMemo(() => {
    const map = new Map<string, NonNullable<ReturnType<typeof upsetInfo>>>()
    for (const m of t.matches) {
      if (!knownAsOf(m, asOf)) continue
      const u = upsetInfo(m, data.odds)
      if (u && u.kind !== 'expected') map.set(m.id, u)
    }
    return map
  }, [t, data.odds, asOf])

  return (
    <div className={`radial-wrap ${pathIds ? 'has-path' : ''} ${zoomed ? 'zoomed' : ''}`}>
      <TransformWrapper
        minScale={0.5}
        maxScale={6}
        limitToBounds={false}
        doubleClick={{ mode: 'zoomIn' }}
        onTransformed={(_, s) => setZoomed(s.scale > 1.7)}
      >
        <TransformComponent wrapperClass="radial-viewport" contentClass="radial-content">
          <svg viewBox="-500 -500 1000 1000" className="radial-svg" role="img" aria-label="World Cup 2026 circular bracket">
            <RingBands lang={lang} />
            <GroupRing t={t} selection={selection} onSelect={onSelect} pathIds={pathIds} />
            <Ribbons t={t} selection={selection} />
            <Links t={t} koMatches={koMatches} pathIds={pathIds} />
            <g className="nodes">
              {koMatches.map((m) => (
                <MatchNode
                  key={m.id}
                  data={data}
                  m={m}
                  asOf={asOf}
                  picks={picks}
                  scorecard={scorecard}
                  upset={upsets.get(m.id)}
                  onPath={!pathIds || pathIds.has(m.id)}
                  selected={selection?.kind === 'match' && selection.id === m.id}
                  onSelect={onSelect}
                  lang={lang}
                />
              ))}
            </g>
          </svg>
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}

function RingBands({ lang }: { lang: Lang }) {
  const stages = ['r32', 'r16', 'qf', 'sf'] as const
  return (
    <g className="ring-bands">
      <circle r={GROUP_RING.inner - 30} className="band-line" />
      {stages.map((s) => (
        <g key={s}>
          <circle r={RINGS[s]} className="band-line" />
          <text x={0} y={-(RINGS[s] + 22)} className="ring-label">
            {stageName(s, lang)}
          </text>
        </g>
      ))}
      <text x={0} y={168 + 34} className="ring-label">
        {tr('thirdPlace', lang)}
      </text>
    </g>
  )
}

function GroupRing({
  t,
  selection,
  onSelect,
  pathIds,
}: {
  t: Props['data']['tournament']
  selection: Selection | null
  onSelect: Props['onSelect']
  pathIds: Set<string> | null
}) {
  return (
    <g className="group-ring">
      {GROUP_LETTERS.map((letter, gi) => {
        const { mid } = groupSector(gi)
        const [lx, ly] = polar(mid, GROUP_RING.outer + 14)
        return (
          <g key={letter}>
            <path d={sectorPath(gi, GROUP_RING.inner, GROUP_RING.outer)} className={`sector sector-${gi % 2}`} />
            <text x={lx} y={ly} className="group-letter" dominantBaseline="middle">
              {letter}
            </text>
            {(t.groups[letter] ?? []).map((teamId) => {
              const team = t.teams[teamId]
              const isSel = selection?.kind === 'team' && selection.id === teamId
              const dimmed = pathIds && !isSel
              return (
                <g
                  key={teamId}
                  transform={chipTransform(gi, team.groupRank)}
                  className={`chip ${team.advanced ? 'advanced' : 'eliminated'} ${isSel ? 'selected' : ''} ${dimmed ? 'dim' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(isSel ? null : { kind: 'team', id: teamId })
                  }}
                >
                  <rect x={-34} y={-9} width={68} height={18} rx={4} className="chip-bg" />
                  <image href={team.logo} x={-31} y={-6} width={16} height={12} preserveAspectRatio="xMidYMid slice" />
                  <text x={-11} y={3.5} className="chip-abbrev">
                    {team.abbrev}
                  </text>
                  <text x={30} y={3.5} className="chip-pts" textAnchor="end">
                    {team.points}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}
    </g>
  )
}

function Ribbons({ t, selection }: { t: Props['data']['tournament']; selection: Selection | null }) {
  const ribbons = useMemo(() => {
    const out: { teamId: string; d: string }[] = []
    for (const m of t.matches) {
      if (m.stage !== 'r32') continue
      for (const side of ['home', 'away'] as const) {
        const id = side === 'home' ? m.homeId : m.awayId
        if (!id) continue
        const team = t.teams[id]
        const gi = GROUP_LETTERS.indexOf(team.group)
        out.push({ teamId: id, d: ribbonPath(gi, team.groupRank, m.bracketIndex) })
      }
    }
    return out
  }, [t])
  return (
    <g className="ribbons">
      {ribbons.map((r) => (
        <path
          key={r.teamId}
          d={r.d}
          className={`ribbon ${selection?.kind === 'team' && selection.id === r.teamId ? 'lit' : ''}`}
        />
      ))}
    </g>
  )
}

function Links({
  t,
  koMatches,
  pathIds,
}: {
  t: Props['data']['tournament']
  koMatches: Match[]
  pathIds: Set<string> | null
}) {
  const links = useMemo(() => {
    const out: { key: string; d: string; from: string; to: string }[] = []
    for (const m of koMatches) {
      if (!m.feeds) continue
      for (const side of ['home', 'away'] as const) {
        const feed = m.feeds[side]
        if (!feed || feed.kind === 'loser') continue
        const src = matchById(t, feed.matchId)
        if (src) out.push({ key: `${m.id}-${side}`, d: feedLinkPath(src, m), from: src.id, to: m.id })
      }
    }
    return out
  }, [t, koMatches])
  return (
    <g className="links">
      {links.map((l) => (
        <path key={l.key} d={l.d} className={`link ${pathIds && pathIds.has(l.from) && pathIds.has(l.to) ? 'lit' : ''}`} />
      ))}
    </g>
  )
}

const UPSET_LABEL = { minor: 'upset', major: 'bigUpset', shock: 'shockUpset' } as const

function MatchNode({
  data,
  m,
  asOf,
  picks,
  scorecard,
  upset,
  onPath,
  selected,
  onSelect,
  lang,
}: {
  data: DataBundle
  m: Match
  asOf: Date | null
  picks: Picks
  scorecard: Scorecard
  upset?: NonNullable<ReturnType<typeof upsetInfo>>
  onPath: boolean
  selected: boolean
  onSelect: Props['onSelect']
  lang: Lang
}) {
  const t = data.tournament
  const [x, y] = matchPos(m)
  const [w, h] = NODE_SIZE[m.stage]
  const known = knownAsOf(m, asOf)
  const homeId = slotTeamId(t, m, 'home', asOf)
  const awayId = slotTeamId(t, m, 'away', asOf)
  const pick = validPick(t, picks, m)
  const result = scorecard.results[m.id]
  const isFinal = m.stage === 'final'

  const row = (side: 'home' | 'away', rowY: number) => {
    const id = side === 'home' ? homeId : awayId
    const team = id ? t.teams[id] : null
    const score = known ? (side === 'home' ? m.homeScore : m.awayScore) : null
    const pen = known ? (side === 'home' ? m.homePens : m.awayPens) : null
    const winner = known && m.winnerId != null && m.winnerId === id
    const fs = isFinal ? 13 : m.stage === 'sf' ? 10.5 : 9.5
    return (
      <g className={`node-row ${winner ? 'winner' : known ? 'loser' : ''}`} key={side}>
        {team ? (
          <>
            <image href={team.logo} x={-w / 2 + 4} y={rowY - fs * 0.62} width={fs * 1.3} height={fs * 0.95} preserveAspectRatio="xMidYMid slice" />
            <text x={-w / 2 + 7 + fs * 1.3} y={rowY} fontSize={fs} className="node-abbrev">
              {isFinal ? team.shortName : team.abbrev}
            </text>
          </>
        ) : (
          <text x={-w / 2 + 5} y={rowY} fontSize={fs - 1} className="node-tbd">
            {slotHint(t, m, side)}
          </text>
        )}
        {score != null && (
          <text x={w / 2 - 5} y={rowY} fontSize={fs} textAnchor="end" className="node-score">
            {score}
            {pen != null ? ` (${pen})` : ''}
          </text>
        )}
        {!known && pick && id === pick && (
          <text x={w / 2 - 5} y={rowY} fontSize={fs - 2} textAnchor="end" className="node-pickmark">
            ★
          </text>
        )}
      </g>
    )
  }

  const rowGap = isFinal ? 17 : h * 0.24
  return (
    <g
      transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
      className={`node stage-${m.stage} ${onPath ? 'on-path' : ''} ${selected ? 'selected' : ''} ${m.status === 'live' ? 'live' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onSelect({ kind: 'match', id: m.id })
      }}
    >
      <rect x={-w / 2 - 8} y={-h / 2 - 7} width={w + 16} height={h + 14} className="hit" />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={isFinal ? 10 : 6} className="node-bg" />
      {isFinal && (
        <text x={0} y={-h / 2 + 15} textAnchor="middle" className="final-title">
          🏆 {tr('final', lang)}
        </text>
      )}
      {row('home', isFinal ? 0 : -rowGap + 3)}
      {row('away', isFinal ? rowGap : rowGap + 3)}
      {!known && (
        <text x={0} y={h / 2 - 3} textAnchor="middle" className="node-date lbl">
          {new Date(m.date).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric' })}
        </text>
      )}
      {upset && (
        <g transform={`translate(${w / 2 - 2},${-h / 2 + 2})`} className={`upset-badge ${upset.magnitude}`}>
          <circle r={6.5} />
          <text y={2.6} textAnchor="middle" fontSize={8}>
            ⚡
          </text>
          <title>{tr(UPSET_LABEL[upset.magnitude], lang)}</title>
        </g>
      )}
      {result && result.outcome !== 'pending' && result.outcome !== 'void' && (
        <circle cx={-w / 2 + 2} cy={-h / 2 + 2} r={4} className={`pick-dot ${result.outcome}`} />
      )}
      {m.status === 'live' && <circle cx={0} cy={-h / 2} r={3.5} className="live-dot" />}
    </g>
  )
}
