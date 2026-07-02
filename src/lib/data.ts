import type { DataBundle, Match, OddsEntry, Team, Tournament, UpsetInfo } from '../types'

export async function loadData(): Promise<DataBundle> {
  const get = (f: string) => fetch(`data/${f}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  const [tournament, odds, media, markets] = await Promise.all([
    get('tournament.json'),
    get('odds.json').catch(() => ({})),
    get('media.json').catch(() => ({})),
    get('markets.json').catch(() => null),
  ])
  return { tournament, odds, media, champion: markets?.champion ?? null }
}

const matchMaps = new WeakMap<Tournament, Map<string, Match>>()
export function matchById(t: Tournament, id: string): Match | undefined {
  let map = matchMaps.get(t)
  if (!map) {
    map = new Map(t.matches.map((m) => [m.id, m]))
    matchMaps.set(t, map)
  }
  return map.get(id)
}

/** End-of-day cutoff for the time-travel slider. */
export function knownAsOf(m: Match, asOf: Date | null): boolean {
  if (m.status !== 'ft') return false
  return !asOf || new Date(m.date) <= asOf
}

/**
 * The team occupying one side of a match, as of a moment in time.
 * KO slots resolve through their feed; group/R32 slots are fixed in the data.
 */
export function slotTeamId(t: Tournament, m: Match, side: 'home' | 'away', asOf: Date | null): string | null {
  const direct = side === 'home' ? m.homeId : m.awayId
  const feed = m.feeds?.[side]
  if (!feed) return direct
  const src = matchById(t, feed.matchId)
  if (!src || !knownAsOf(src, asOf)) return null
  return feed.kind === 'winner' ? src.winnerId : src.loserId
}

/** All matches a team actually played (their path through the tournament), chronological. */
export function teamPath(t: Tournament, teamId: string): Match[] {
  return t.matches
    .filter((m) => m.homeId === teamId || m.awayId === teamId)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Upset classification for a finished match with pre-match odds. */
export function upsetInfo(m: Match, odds: Record<string, OddsEntry>): UpsetInfo | null {
  if (m.status !== 'ft') return null
  const o = odds[m.id]
  if (!o || !m.homeId || !m.awayId) return null
  const favSide = o.home >= o.away ? 'home' : 'away'
  const favId = favSide === 'home' ? m.homeId : m.awayId
  const favProb = Math.max(o.home, o.away)
  const magnitude: UpsetInfo['magnitude'] = favProb >= 0.75 ? 'shock' : favProb >= 0.6 ? 'major' : 'minor'
  if (!m.winnerId) {
    // Draw: only notable when a clear favorite failed to win
    return favProb >= 0.55 ? { kind: 'favDrew', magnitude, favId, favProb } : null
  }
  if (m.winnerId === favId) return { kind: 'expected', magnitude, favId, favProb }
  return { kind: 'upset', magnitude, favId, favProb }
}

export function teamName(t: Tournament, id: string | null): string | null {
  return id ? (t.teams[id]?.name ?? null) : null
}

export function team(t: Tournament, id: string | null): Team | null {
  return id ? (t.teams[id] ?? null) : null
}

/** Best available highlight video for a match: FOX extended first, FIFA fallback. */
export function bestHighlight(media: DataBundle['media'], matchId: string) {
  const h = media[matchId]?.highlights
  if (h?.fox) return { ...h.fox, channel: 'FOX Sports' }
  if (h?.fifa) return { ...h.fifa, channel: 'FIFA' }
  return null
}

export const TOURNAMENT_START = '2026-06-11'
export const TOURNAMENT_END = '2026-07-19'

/** Short label for an unresolved slot, e.g. the group or source-match hint. */
export function slotHint(t: Tournament, m: Match, side: 'home' | 'away'): string {
  const feed = m.feeds?.[side]
  if (feed) {
    const src = matchById(t, feed.matchId)
    if (src) {
      const h = src.homeId ? t.teams[src.homeId].abbrev : '?'
      const a = src.awayId ? t.teams[src.awayId].abbrev : '?'
      if (src.homeId || src.awayId) return `${h}/${a}`
    }
  }
  const ph = side === 'home' ? m.homePlaceholder : m.awayPlaceholder
  if (!ph) return '?'
  const mm = ph.match(/(\d+)\s+(Winner|Loser)/)
  return mm ? `${mm[2] === 'Winner' ? 'W' : 'L'}${mm[1]}` : '?'
}
