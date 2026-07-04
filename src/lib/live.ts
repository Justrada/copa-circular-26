import type { Match, MatchEvent, Tournament } from '../types'

const LIVE_WINDOW_MS = 150 * 60_000 // kickoff + ~2.5h covers ET + pens
const SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=50&dates='

/** True while any match is plausibly in progress — gates the polling. */
export function inLiveWindow(t: Tournament, now = Date.now()): boolean {
  return t.matches.some((m) => {
    if (m.status === 'live') return true
    if (m.status !== 'scheduled') return false
    const k = new Date(m.date).getTime()
    return now >= k && now <= k + LIVE_WINDOW_MS
  })
}

/**
 * Fetch today's (UTC yesterday–today, since late kickoffs cross midnight)
 * scores straight from ESPN and merge into a fresh Tournament. Returns null
 * when nothing changed or the fetch failed (CORS/offline) — callers no-op.
 */
export async function refreshLiveScores(t: Tournament): Promise<Tournament | null> {
  try {
    const fmt = (x: Date) => x.toISOString().slice(0, 10).replaceAll('-', '')
    const now = new Date()
    const url = `${SCOREBOARD}${fmt(new Date(now.getTime() - 86400000))}-${fmt(now)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const sb = await res.json()
    let changed = false
    const patched = new Map<string, Partial<Match>>()
    for (const e of sb.events ?? []) {
      const c = e.competitions?.[0]
      if (!c) continue
      const cur = t.matches.find((m) => m.id === e.id)
      if (!cur) continue
      const finished = c.status?.type?.completed === true
      const live = c.status?.type?.state === 'in'
      // Transient ESPN states (post-match confirmation lag) must never downgrade
      // a match below what the committed data already says
      if (!finished && !live) continue
      const home = c.competitors?.find((x: { homeAway: string }) => x.homeAway === 'home')
      const away = c.competitors?.find((x: { homeAway: string }) => x.homeAway === 'away')
      if (!home || !away) continue
      // A KO match reported completed without winner flags would void dependent
      // picks until the next clean poll — wait for the flags instead
      if (finished && cur.stage !== 'group' && !home.winner && !away.winner) continue
      const status = finished ? 'ft' : 'live'
      const score = (side: { score?: string }) => (finished || live ? Number(side.score ?? 0) : null)
      const pens = (side: { shootoutScore?: number }) => (side.shootoutScore != null ? Number(side.shootoutScore) : null)
      const winnerId = finished ? (home.winner ? String(home.team.id) : away.winner ? String(away.team.id) : null) : null
      const events: MatchEvent[] = (c.details ?? [])
        .filter((d: { scoringPlay?: boolean; shootout?: boolean; redCard?: boolean }) => (d.scoringPlay && !d.shootout) || d.redCard)
        .map((d: { redCard?: boolean; team?: { id?: string }; athletesInvolved?: { shortName?: string; displayName?: string }[]; clock?: { displayValue?: string }; penaltyKick?: boolean; ownGoal?: boolean }) => ({
          kind: d.redCard ? ('red' as const) : ('goal' as const),
          teamId: String(d.team?.id ?? ''),
          player: d.athletesInvolved?.[0]?.shortName ?? d.athletesInvolved?.[0]?.displayName ?? '',
          clock: d.clock?.displayValue ?? '',
          pen: !!d.penaltyKick,
          og: !!d.ownGoal,
        }))
      const next: Partial<Match> = {
        status,
        statusDetail: c.status?.type?.shortDetail ?? cur.statusDetail,
        homeScore: score(home),
        awayScore: score(away),
        homePens: pens(home),
        awayPens: pens(away),
        winnerId: winnerId && t.teams[winnerId] ? winnerId : cur.winnerId,
        events: events.length ? events : cur.events,
      }
      if (
        next.status !== cur.status ||
        next.homeScore !== cur.homeScore ||
        next.awayScore !== cur.awayScore ||
        next.homePens !== cur.homePens ||
        next.awayPens !== cur.awayPens ||
        next.statusDetail !== cur.statusDetail ||
        (next.events?.length ?? 0) !== (cur.events?.length ?? 0)
      ) {
        patched.set(e.id, next)
        changed = true
      }
    }
    if (!changed) return null
    const matches = t.matches.map((m) => {
      const p = patched.get(m.id)
      if (!p) return m
      const merged = { ...m, ...p }
      merged.loserId = merged.winnerId ? (merged.winnerId === m.homeId ? m.awayId : m.homeId) : null
      return merged
    })
    return { ...t, matches }
  } catch {
    return null
  }
}
