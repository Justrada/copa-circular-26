import { useEffect, useMemo, useRef, useState } from 'react'
import { actualExitMatch, knownAsOf, matchById, slotHint, slotTeamId, teamPath, upsetInfo } from '../lib/data'
import { stageName, t as tr } from '../lib/i18n'
import {
  GROUP_LETTERS,
  GROUP_RING,
  IDENTITY_ORDER,
  NODE_SIZE,
  RINGS,
  computeKnockoutAngles,
  computeSectorOrder,
  feedLinkPath,
  matchAngle,
  matchPos,
  polar,
  ribbonPath,
  sectorPath,
} from '../lib/layout'
import type { Picks, Scorecard } from '../lib/picks'
import { isLocked, isPickable, predictedRoute, validPick } from '../lib/picks'
import type { DataBundle, Lang, Match, Selection } from '../types'
import SvgZoom from './SvgZoom'

interface Props {
  data: DataBundle
  asOf: Date | null
  selection: Selection | null
  onSelect: (sel: Selection | null) => void
  picks: Picks
  scorecard: Scorecard
  favorites: Set<string>
  untangle: boolean
  lang: Lang
}

export default function RadialBracket({
  data,
  asOf,
  selection,
  onSelect,
  picks,
  scorecard,
  favorites,
  untangle,
  lang,
}: Props) {
  const { tournament: t } = data
  const [zoomed, setZoomed] = useState(false)

  const koMatches = useMemo(() => t.matches.filter((m) => m.stage !== 'group'), [t])
  const angles = useMemo(() => computeKnockoutAngles(t), [t])
  const sectorOf = useMemo(() => (untangle ? computeSectorOrder(t, angles) : IDENTITY_ORDER), [t, angles, untangle])

  // Ribbons can't tween their path shape — fade them out while sectors rotate
  const [reordering, setReordering] = useState(false)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setReordering(true)
    const id = setTimeout(() => setReordering(false), 720)
    return () => clearTimeout(id)
  }, [untangle])

  const selectedTeam = selection?.kind === 'team' ? selection.id : null

  // Matches on the selected team's actual path
  const pathIds = useMemo(() => {
    if (!selectedTeam) return null
    return new Set(teamPath(t, selectedTeam).map((m) => m.id))
  }, [selectedTeam, t])

  // The route the user's picks send the selected team on
  const predicted = useMemo(
    () => (selectedTeam ? predictedRoute(t, picks, selectedTeam) : null),
    [selectedTeam, t, picks]
  )
  const actualExit = useMemo(
    () => (selectedTeam ? actualExitMatch(t, selectedTeam) : null),
    [selectedTeam, t]
  )

  // Actual-path match sets for every favorite (for always-lit paths + glow)
  const favPaths = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const id of favorites) map.set(id, new Set(teamPath(t, id).map((m) => m.id)))
    return map
  }, [favorites, t])

  // Faint predicted routes for favorites (capped to keep the spaghetti down)
  const favRoutes = useMemo(() => {
    const out: string[] = []
    let count = 0
    for (const id of favorites) {
      if (id === selectedTeam) continue
      if (++count > 6) break
      const p = predictedRoute(t, picks, id)
      for (let i = 0; i + 1 < p.route.length; i++) {
        const a = matchById(t, p.route[i])
        const b = matchById(t, p.route[i + 1])
        if (a && b) out.push(feedLinkPath(a, b, angles))
      }
    }
    return out
  }, [favorites, selectedTeam, t, picks, angles])

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
      <SvgZoom onScaleChange={(k) => setZoomed(k > 1.35)}>
        <svg id="bracket-svg" viewBox="-512 -512 1024 1024" className="radial-svg" role="img" aria-label="World Cup 2026 circular bracket">
          <RingBands lang={lang} />
          <GroupRing
            t={t}
            sectorOf={sectorOf}
            selection={selection}
            onSelect={onSelect}
            pathIds={pathIds}
            favorites={favorites}
          />
          <g className={`ribbons-wrap ${reordering ? 'fade' : ''}`}>
            <Ribbons t={t} angles={angles} sectorOf={sectorOf} selectedTeam={selectedTeam} favorites={favorites} />
          </g>
          <Links t={t} angles={angles} koMatches={koMatches} pathIds={pathIds} favPaths={favPaths} />
          {favRoutes.length > 0 && (
            <g className="predicted-layer">
              {favRoutes.map((d, i) => (
                <path key={i} d={d} className="plink faint" />
              ))}
            </g>
          )}
          <g className="nodes">
            {koMatches.map((m) => (
              <MatchNode
                key={m.id}
                data={data}
                m={m}
                angles={angles}
                asOf={asOf}
                picks={picks}
                scorecard={scorecard}
                upset={upsets.get(m.id)}
                onPath={!pathIds || pathIds.has(m.id) || !!(predicted && predicted.route.includes(m.id))}
                fav={!!(m.homeId && favorites.has(m.homeId)) || !!(m.awayId && favorites.has(m.awayId))}
                selected={selection?.kind === 'match' && selection.id === m.id}
                onSelect={onSelect}
                lang={lang}
              />
            ))}
          </g>
          {predicted && (
            <PredictedOverlay
              t={t}
              angles={angles}
              predicted={predicted}
              actualExitId={actualExit?.id ?? null}
              lang={lang}
            />
          )}
        </svg>
      </SvgZoom>
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

/** Tween an angle toward its target along the shortest arc (attribute transforms
 *  rotate around the SVG user-space origin — the circle center — reliably). */
function useAnimatedAngle(target: number): number {
  const [angle, setAngle] = useState(target)
  const cur = useRef(target)
  useEffect(() => {
    const from = cur.current
    const delta = ((((target - from) % 360) + 540) % 360) - 180
    if (Math.abs(delta) < 0.01) {
      cur.current = target
      setAngle(target)
      return
    }
    const start = performance.now()
    const DURATION = 700
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION)
      const eased = 1 - Math.pow(1 - p, 3)
      const a = from + delta * eased
      cur.current = a
      setAngle(a)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return angle
}

function GroupRing({
  t,
  sectorOf,
  selection,
  onSelect,
  pathIds,
  favorites,
}: {
  t: Props['data']['tournament']
  sectorOf: Record<string, number>
  selection: Selection | null
  onSelect: Props['onSelect']
  pathIds: Set<string> | null
  favorites: Set<string>
}) {
  return (
    <g className="group-ring">
      {GROUP_LETTERS.map((letter) => (
        <Sector
          key={letter}
          t={t}
          letter={letter}
          gi={sectorOf[letter]}
          selection={selection}
          onSelect={onSelect}
          pathIds={pathIds}
          favorites={favorites}
        />
      ))}
    </g>
  )
}

function Sector({
  t,
  letter,
  gi,
  selection,
  onSelect,
  pathIds,
  favorites,
}: {
  t: Props['data']['tournament']
  letter: string
  gi: number
  selection: Selection | null
  onSelect: Props['onSelect']
  pathIds: Set<string> | null
  favorites: Set<string>
}) {
  const R = useAnimatedAngle(gi * 30)
  // Group content is drawn in the canonical sector-0 wedge (-90°..-60°) and rotated into place
  const sector0 = sectorPath(0, GROUP_RING.inner, GROUP_RING.outer)
  const [lx0, ly0] = polar(-75, GROUP_RING.outer + 14)
  const finalMid = (((gi * 30 - 75) % 360) + 360) % 360
  const flip = finalMid > 0 && finalMid < 180
  const chipLocalRot = flip ? -165 : 15
  return (
    <g transform={`rotate(${R.toFixed(2)})`}>
      <path d={sector0} className={`sector sector-${gi % 2}`} />
      <g transform={`translate(${lx0.toFixed(1)},${ly0.toFixed(1)})`}>
        <text className="group-letter" transform={`rotate(${(-R).toFixed(2)})`} dominantBaseline="middle">
          {letter}
        </text>
      </g>
            {(t.groups[letter] ?? []).map((teamId) => {
              const team = t.teams[teamId]
              const isSel = selection?.kind === 'team' && selection.id === teamId
              const dimmed = pathIds && !isSel
              const r = GROUP_RING.outer - 15 - (team.groupRank - 1) * 23
              const [cx, cy] = polar(-75, r)
              return (
                <g
                  key={teamId}
                  transform={`translate(${cx.toFixed(1)},${cy.toFixed(1)}) rotate(${chipLocalRot})`}
                  className={`chip ${team.advanced ? 'advanced' : 'eliminated'} ${isSel ? 'selected' : ''} ${dimmed ? 'dim' : ''} ${favorites.has(teamId) ? 'fav' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(isSel ? null : { kind: 'team', id: teamId })
                  }}
                >
                  <rect x={-38} y={-10} width={76} height={20} rx={5} className="chip-bg" />
                  <image href={team.logo} x={-34} y={-7} width={18} height={14} preserveAspectRatio="xMidYMid slice" />
                  <text x={-12} y={4} className="chip-abbrev">
                    {team.abbrev}
                  </text>
                  <text x={34} y={4} className="chip-pts" textAnchor="end">
                    {team.points}
                  </text>
                </g>
              )
            })}
    </g>
  )
}

function Ribbons({
  t,
  angles,
  sectorOf,
  selectedTeam,
  favorites,
}: {
  t: Props['data']['tournament']
  angles: Map<string, number>
  sectorOf: Record<string, number>
  selectedTeam: string | null
  favorites: Set<string>
}) {
  const ribbons = useMemo(() => {
    const out: { teamId: string; d: string }[] = []
    for (const m of t.matches) {
      if (m.stage !== 'r32') continue
      for (const side of ['home', 'away'] as const) {
        const id = side === 'home' ? m.homeId : m.awayId
        if (!id) continue
        const team = t.teams[id]
        out.push({ teamId: id, d: ribbonPath(sectorOf[team.group], team.groupRank, matchAngle(m, angles)) })
      }
    }
    return out
  }, [t, angles, sectorOf])
  return (
    <g className="ribbons">
      {ribbons.map((r) => (
        <path
          key={r.teamId}
          d={r.d}
          className={`ribbon ${selectedTeam === r.teamId ? 'lit' : ''} ${favorites.has(r.teamId) ? 'fav' : ''}`}
        />
      ))}
    </g>
  )
}

function Links({
  t,
  angles,
  koMatches,
  pathIds,
  favPaths,
}: {
  t: Props['data']['tournament']
  angles: Map<string, number>
  koMatches: Match[]
  pathIds: Set<string> | null
  favPaths: Map<string, Set<string>>
}) {
  const links = useMemo(() => {
    const out: { key: string; d: string; from: string; to: string }[] = []
    for (const m of koMatches) {
      if (!m.feeds) continue
      for (const side of ['home', 'away'] as const) {
        const feed = m.feeds[side]
        if (!feed || feed.kind === 'loser') continue
        const src = matchById(t, feed.matchId)
        if (src) out.push({ key: `${m.id}-${side}`, d: feedLinkPath(src, m, angles), from: src.id, to: m.id })
      }
    }
    return out
  }, [t, angles, koMatches])
  const isFav = (from: string, to: string) => {
    for (const set of favPaths.values()) if (set.has(from) && set.has(to)) return true
    return false
  }
  return (
    <g className="links">
      {links.map((l) => (
        <path
          key={l.key}
          d={l.d}
          className={`link ${pathIds && pathIds.has(l.from) && pathIds.has(l.to) ? 'lit' : ''} ${isFav(l.from, l.to) ? 'fav' : ''}`}
        />
      ))}
    </g>
  )
}

/** Dashed predicted route + divergence markers, drawn above everything. */
function PredictedOverlay({
  t,
  angles,
  predicted,
  actualExitId,
  lang,
}: {
  t: Props['data']['tournament']
  angles: Map<string, number>
  predicted: NonNullable<ReturnType<typeof predictedRoute>>
  actualExitId: string | null
  lang: Lang
}) {
  const segs: string[] = []
  for (let i = 0; i + 1 < predicted.route.length; i++) {
    const a = matchById(t, predicted.route[i])
    const b = matchById(t, predicted.route[i + 1])
    if (a && b) segs.push(feedLinkPath(a, b, angles))
  }
  const marker = (matchId: string, kind: 'predicted' | 'actual') => {
    const m = matchById(t, matchId)
    if (!m) return null
    const [x, y] = matchPos(m, angles)
    const [, h] = NODE_SIZE[m.stage]
    const above = kind === 'actual'
    const my = above ? y - h / 2 - 13 : y + h / 2 + 13
    return (
      <g key={`${kind}-${matchId}`} transform={`translate(${x},${my})`} className={`exit-marker ${kind}`}>
        <circle r={9} />
        <text y={3.5} textAnchor="middle">
          {kind === 'actual' ? '✕' : '⭘'}
        </text>
        <title>{tr(kind === 'actual' ? 'actualOut' : 'predictedOut', lang)}</title>
      </g>
    )
  }
  const finalM = t.matches.find((m) => m.stage === 'final')
  return (
    <g className="predicted-layer">
      {segs.map((d, i) => (
        <path key={i} d={d} className="plink" />
      ))}
      {predicted.exitId && marker(predicted.exitId, 'predicted')}
      {actualExitId && marker(actualExitId, 'actual')}
      {predicted.champion && finalM && (
        <text x={0} y={-NODE_SIZE.final[1] / 2 - 14} textAnchor="middle" className="crown">
          👑
        </text>
      )}
    </g>
  )
}

const UPSET_LABEL = { minor: 'upset', major: 'bigUpset', shock: 'shockUpset' } as const

function MatchNode({
  data,
  m,
  angles,
  asOf,
  picks,
  scorecard,
  upset,
  onPath,
  fav,
  selected,
  onSelect,
  lang,
}: {
  data: DataBundle
  m: Match
  angles: Map<string, number>
  asOf: Date | null
  picks: Picks
  scorecard: Scorecard
  upset?: NonNullable<ReturnType<typeof upsetInfo>>
  onPath: boolean
  fav: boolean
  selected: boolean
  onSelect: Props['onSelect']
  lang: Lang
}) {
  const t = data.tournament
  const [x, y] = matchPos(m, angles)
  const [w, h] = NODE_SIZE[m.stage]
  const known = knownAsOf(m, asOf)
  const homeId = slotTeamId(t, m, 'home', asOf)
  const awayId = slotTeamId(t, m, 'away', asOf)
  const pick = validPick(t, picks, m)
  const result = scorecard.results[m.id]
  const isFinal = m.stage === 'final'
  const needsPick = isPickable(m) && m.status === 'scheduled' && !pick && !isLocked(m, picks.retro)

  const FS: Record<string, number> = { r32: 11, r16: 11.5, qf: 12, sf: 12.5, third: 12, final: 14 }
  const row = (side: 'home' | 'away', rowY: number) => {
    const id = side === 'home' ? homeId : awayId
    const team = id ? t.teams[id] : null
    const score = known ? (side === 'home' ? m.homeScore : m.awayScore) : null
    const pen = known ? (side === 'home' ? m.homePens : m.awayPens) : null
    const winner = known && m.winnerId != null && m.winnerId === id
    const fs = FS[m.stage]
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

  const rowGap = isFinal ? 18 : h * 0.24
  return (
    <g
      transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
      className={`node stage-${m.stage} ${onPath ? 'on-path' : ''} ${selected ? 'selected' : ''} ${m.status === 'live' ? 'live' : ''} ${needsPick ? 'needs-pick' : ''} ${fav ? 'fav' : ''}`}
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
