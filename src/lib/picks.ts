import type { DataBundle, Match, Tournament } from '../types'
import { knownAsOf, matchById } from './data'

export interface Picks {
  v: 1
  name: string
  winners: Record<string, string> // matchId -> teamId
  conf: Record<string, 1 | 2 | 3> // matchId -> confidence stars
  scores: Record<string, [number, number]> // matchId -> predicted regulation/ET score
  retro: boolean
}

export const emptyPicks = (retro: boolean): Picks => ({
  v: 1,
  name: '',
  winners: {},
  conf: {},
  scores: {},
  retro,
})

const KEY = (retro: boolean) => (retro ? 'cc26-picks-retro' : 'cc26-picks')

export function loadPicks(retro: boolean): Picks {
  try {
    const raw = localStorage.getItem(KEY(retro))
    if (raw) return { ...emptyPicks(retro), ...JSON.parse(raw), retro }
  } catch {
    /* fresh start */
  }
  return emptyPicks(retro)
}

export function savePicks(p: Picks): void {
  localStorage.setItem(KEY(p.retro), JSON.stringify(p))
}

// --- URL sharing ---------------------------------------------------------

function b64url(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function unb64url(s: string): string {
  return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))
}

export function encodePicks(p: Picks): string {
  const slim = {
    n: p.name || undefined,
    r: p.retro ? 1 : undefined,
    w: p.winners,
    c: Object.keys(p.conf).length ? p.conf : undefined,
    s: Object.keys(p.scores).length ? p.scores : undefined,
  }
  return b64url(JSON.stringify(slim))
}

export function decodePicks(encoded: string): Picks | null {
  try {
    const slim = JSON.parse(unb64url(encoded))
    // The payload is attacker-controlled (it arrives in shared URLs) — sanitize every field
    const winners: Record<string, string> = {}
    for (const [k, v] of Object.entries(slim.w ?? {})) {
      if (typeof v === 'string' && /^\d+$/.test(k)) winners[k] = v
    }
    const conf: Record<string, 1 | 2 | 3> = {}
    for (const [k, v] of Object.entries(slim.c ?? {})) {
      if (v === 1 || v === 2 || v === 3) conf[k] = v
    }
    const scores: Record<string, [number, number]> = {}
    for (const [k, v] of Object.entries(slim.s ?? {})) {
      if (Array.isArray(v) && v.length === 2 && v.every((x) => Number.isInteger(x) && x >= 0 && x <= 99)) {
        scores[k] = [v[0], v[1]]
      }
    }
    return {
      v: 1,
      name: typeof slim.n === 'string' ? slim.n.slice(0, 40) : '',
      retro: slim.r === 1,
      winners,
      conf,
      scores,
    }
  } catch {
    return null
  }
}

// --- pick propagation ----------------------------------------------------

/**
 * The two candidate teams for a knockout match under a pickset: the real
 * team once the feeder is decided (as of `asOf`, for time travel), otherwise
 * the user's pick propagated from the source match.
 */
export function candidates(
  t: Tournament,
  picks: Picks,
  m: Match,
  side: 'home' | 'away',
  asOf: Date | null = null
): string | null {
  const feed = m.feeds?.[side]
  if (!feed) return side === 'home' ? m.homeId : m.awayId
  const src = matchById(t, feed.matchId)
  if (!src) return null
  if (knownAsOf(src, asOf)) return feed.kind === 'winner' ? src.winnerId : src.loserId
  if (feed.kind === 'winner') return validPick(t, picks, src, asOf)
  // loser feed (third-place): the propagated loser is the source's non-picked side
  const picked = validPick(t, picks, src, asOf)
  if (!picked) return null
  const h = candidates(t, picks, src, 'home', asOf)
  const a = candidates(t, picks, src, 'away', asOf)
  return picked === h ? a : picked === a ? h : null
}

/** The user's pick for a match, voided if it no longer matches either slot. */
export function validPick(t: Tournament, picks: Picks, m: Match, asOf: Date | null = null): string | null {
  const pick = picks.winners[m.id]
  if (!pick) return null
  const h = candidates(t, picks, m, 'home', asOf)
  const a = candidates(t, picks, m, 'away', asOf)
  return pick === h || pick === a ? pick : null
}

export function isLocked(m: Match, retro: boolean): boolean {
  if (retro) return false
  return new Date(m.date).getTime() <= Date.now()
}

export function isPickable(m: Match): boolean {
  return m.stage !== 'group'
}

// --- scoring -------------------------------------------------------------

export const ROUND_WEIGHT: Record<string, number> = {
  r32: 1,
  r16: 2,
  qf: 3,
  sf: 4,
  third: 2,
  final: 5,
}

export interface MatchResult {
  matchId: string
  outcome: 'correct' | 'wrong' | 'pending' | 'void'
  points: number
  exact: boolean
}

export interface Scorecard {
  results: Record<string, MatchResult>
  points: number
  correct: number
  wrong: number
  pending: number
  exact: number
}

/**
 * Points: correct = round weight + 2×(confidence−1); wrong = −(confidence−1).
 * Exact regulation scoreline adds a flat +2.
 */
export function scorePicks(data: DataBundle, picks: Picks, asOf: Date | null): Scorecard {
  const t = data.tournament
  const card: Scorecard = { results: {}, points: 0, correct: 0, wrong: 0, pending: 0, exact: 0 }
  for (const m of t.matches) {
    if (m.stage === 'group') continue
    const pick = picks.winners[m.id]
    if (!pick) continue
    const valid = validPick(t, picks, m, asOf)
    if (!valid) {
      card.results[m.id] = { matchId: m.id, outcome: 'void', points: 0, exact: false }
      continue
    }
    if (!knownAsOf(m, asOf)) {
      card.results[m.id] = { matchId: m.id, outcome: 'pending', points: 0, exact: false }
      card.pending++
      continue
    }
    const conf = picks.conf[m.id] ?? 1
    const correct = m.winnerId === valid
    let points = correct ? ROUND_WEIGHT[m.stage] + 2 * (conf - 1) : -(conf - 1)
    let exact = false
    const s = picks.scores[m.id]
    if (correct && s && s[0] === m.homeScore && s[1] === m.awayScore) {
      points += 2
      exact = true
      card.exact++
    }
    card.results[m.id] = { matchId: m.id, outcome: correct ? 'correct' : 'wrong', points, exact }
    card.points += points
    if (correct) card.correct++
    else card.wrong++
  }
  return card
}

/** The team the pickset sends all the way to the title. */
export function pickedChampion(t: Tournament, picks: Picks): string | null {
  const final = t.matches.find((m) => m.stage === 'final')
  return final ? validPick(t, picks, final) : null
}

export interface PredictedRoute {
  route: string[] // ordered KO match ids along the picked route (last = predicted exit, if any)
  winIds: Set<string> // matches the user picked this team to win
  exitId: string | null // match where the user picked the opponent
  champion: boolean
}

/**
 * The route the USER's picks send a team on. Picks are read raw (not
 * validity-checked) so a busted prediction stays visible — that divergence
 * is the point. Matches that finished WITHOUT a pick (locked before the
 * user arrived) follow reality forward: an unpicked win still advances the
 * route so later-round picks are reachable.
 */
export function predictedRoute(t: Tournament, picks: Picks, teamId: string): PredictedRoute {
  const out: PredictedRoute = { route: [], winIds: new Set(), exitId: null, champion: false }
  const start = t.matches.find((m) => m.stage === 'r32' && (m.homeId === teamId || m.awayId === teamId))
  if (!start) return out
  const nextByWinnerFeed = new Map<string, string>()
  for (const m of t.matches) {
    for (const side of ['home', 'away'] as const) {
      const f = m.feeds?.[side]
      if (f?.kind === 'winner') nextByWinnerFeed.set(f.matchId, m.id)
    }
  }
  let cur: string | undefined = start.id
  while (cur) {
    out.route.push(cur)
    const m = matchById(t, cur)
    const pick = picks.winners[cur]
    let advances = false
    if (pick) {
      if (pick !== teamId) {
        out.exitId = cur
        break
      }
      out.winIds.add(cur)
      advances = true
    } else if (m?.status === 'ft' && m.winnerId === teamId) {
      advances = true // no call made, but reality carried them through
    }
    if (!advances) break
    const next = nextByWinnerFeed.get(cur)
    if (!next) {
      out.champion = true
      break
    }
    cur = next
  }
  return out
}
