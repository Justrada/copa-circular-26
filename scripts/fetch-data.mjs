#!/usr/bin/env node
// Fetches ESPN World Cup 2026 data and writes the normalized JSON the site consumes.
// Run nightly and ad hoc: node scripts/fetch-data.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'data')
mkdirSync(outDir, { recursive: true })

const SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300'
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings?season=2026'

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'CopaCircular26/1.0 (non-commercial fan site)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.json()
}

const STAGE_BY_SLUG = {
  'group-stage': 'group',
  'round-of-32': 'r32',
  'round-of-16': 'r16',
  quarterfinals: 'qf',
  semifinals: 'sf',
  '3rd-place-match': 'third',
  final: 'final',
}
const PREV_STAGE = { r16: 'r32', qf: 'r16', sf: 'qf', third: 'sf', final: 'sf' }

const [sb, st] = await Promise.all([getJson(SCOREBOARD), getJson(STANDINGS)])

// ---- teams and groups (from standings) ----
const teams = {}
const groups = {}
for (const child of st.children) {
  const letter = child.name.replace(/^Group\s+/i, '')
  const entries = []
  for (const entry of child.standings.entries) {
    const t = entry.team
    const stat = (ab) => entry.stats.find((s) => s.abbreviation === ab)?.value ?? 0
    teams[t.id] = {
      id: t.id,
      name: t.displayName,
      shortName: t.shortDisplayName,
      abbrev: t.abbreviation ?? '',
      logo: t.logos?.[0]?.href ?? '',
      color: null,
      alternateColor: null,
      group: letter,
      groupRank: entry.note?.rank ?? stat('R') ?? 0,
      played: stat('GP'),
      won: stat('W'),
      drawn: stat('D'),
      lost: stat('L'),
      goalsFor: stat('F'),
      goalsAgainst: stat('A'),
      goalDiff: stat('GD'),
      points: stat('P'),
      advanced: /advance/i.test(entry.note?.description ?? ''),
    }
    entries.push(t.id)
  }
  entries.sort((a, b) => teams[a].groupRank - teams[b].groupRank)
  groups[letter] = entries
}

// ---- matches (scoreboard event-id order == FIFA bracket-slot order within each round) ----
const events = [...sb.events].sort((a, b) => Number(a.id) - Number(b.id))
const matches = []
const byStage = {}
for (const e of events) {
  const c = e.competitions[0]
  const stage = STAGE_BY_SLUG[e.season?.slug]
  if (!stage) throw new Error(`Unknown stage slug "${e.season?.slug}" on event ${e.id}`)
  const home = c.competitors.find((x) => x.homeAway === 'home')
  const away = c.competitors.find((x) => x.homeAway === 'away')
  // enrich team visuals from scoreboard (standings lacks logo/colors on some teams)
  for (const side of [home, away]) {
    const t = teams[side.team.id]
    if (t) {
      if (!t.logo) t.logo = side.team.logo ?? ''
      if (!t.abbrev) t.abbrev = side.team.abbreviation ?? ''
      t.color ??= side.team.color ?? null
      t.alternateColor ??= side.team.alternateColor ?? null
    }
  }
  const finished = c.status?.type?.completed === true
  const live = c.status?.type?.state === 'in'
  const real = (side) => (teams[side.team.id] ? side.team.id : null)
  const score = (side) => (finished || live ? Number(side.score ?? 0) : null)
  const pens = (side) => (side.shootoutScore != null ? Number(side.shootoutScore) : null)
  const timeline = (c.details ?? [])
    .filter((d) => (d.scoringPlay && !d.shootout) || d.redCard)
    .map((d) => ({
      kind: d.redCard ? 'red' : 'goal',
      teamId: String(d.team?.id ?? ''),
      player: d.athletesInvolved?.[0]?.shortName ?? d.athletesInvolved?.[0]?.displayName ?? '',
      clock: d.clock?.displayValue ?? '',
      pen: !!d.penaltyKick,
      og: !!d.ownGoal,
    }))
  const m = {
    id: e.id,
    stage,
    bracketIndex: 0,
    date: e.date,
    venue: c.venue?.fullName ?? '',
    city: [c.venue?.address?.city, c.venue?.address?.state].filter(Boolean).join(', '),
    status: finished ? 'ft' : live ? 'live' : 'scheduled',
    statusDetail: c.status?.type?.shortDetail ?? '',
    homeId: real(home),
    awayId: real(away),
    homePlaceholder: real(home) ? null : home.team.displayName,
    awayPlaceholder: real(away) ? null : away.team.displayName,
    homeScore: score(home),
    awayScore: score(away),
    homePens: pens(home),
    awayPens: pens(away),
    winnerId: finished ? (home.winner ? real(home) : away.winner ? real(away) : null) : null,
    headline: c.headlines?.[0]?.shortLinkText ?? null,
    attendance: c.attendance || null,
    events: timeline.length ? timeline : undefined,
  }
  m.loserId = m.winnerId ? (m.winnerId === m.homeId ? m.awayId : m.homeId) : null
  matches.push(m)
  ;(byStage[stage] ??= []).push(m)
}
for (const arr of Object.values(byStage)) arr.forEach((m, i) => (m.bracketIndex = i))

// ---- knockout linkage: which earlier match feeds each slot ----
// Resolved slots derive from actual winners/losers (self-correcting as results land);
// unresolved slots parse ESPN placeholder names like "Round of 32 11 Winner".
const wonAt = {}
const lostAt = {}
for (const m of matches) {
  if (m.status !== 'ft') continue
  if (m.winnerId) (wonAt[m.winnerId] ??= {})[m.stage] = m.id
  if (m.loserId) (lostAt[m.loserId] ??= {})[m.stage] = m.id
}
const ROUND_WORDS = {
  'round of 32': 'r32',
  'round of 16': 'r16',
  quarterfinal: 'qf',
  semifinal: 'sf',
}
function sourceFor(m, side) {
  const prev = PREV_STAGE[m.stage]
  if (!prev) return null
  const teamId = side === 'home' ? m.homeId : m.awayId
  const wantKind = m.stage === 'third' ? 'loser' : 'winner'
  if (teamId) {
    const src = (wantKind === 'winner' ? wonAt : lostAt)[teamId]?.[prev]
    if (src) return { matchId: src, kind: wantKind }
  }
  const ph = side === 'home' ? m.homePlaceholder : m.awayPlaceholder
  const mm = ph?.match(/(Round of 32|Round of 16|Quarterfinal|Semifinal)\s+(\d+)\s+(Winner|Loser)/i)
  if (mm) {
    const src = byStage[ROUND_WORDS[mm[1].toLowerCase()]]?.[Number(mm[2]) - 1]
    if (src) return { matchId: src.id, kind: mm[3].toLowerCase() }
  }
  return null
}
// ESPN's "Round of 32 N Winner" numbering diverges from the official FIFA bracket
// for the two July 7 R16 games (verified against FOX/Sky bracket coverage, July 2026):
// Atlanta (760509) pairs Argentina/Cape Verde winner with Australia/Egypt winner;
// Vancouver (760508) pairs Switzerland/Algeria winner with Colombia/Ghana winner.
// Overrides apply only while the slot is placeholder-derived; real teams win once results land.
const FEED_OVERRIDES = {
  '760508': { home: { matchId: '760498', kind: 'winner' }, away: { matchId: '760501', kind: 'winner' } },
  '760509': { home: { matchId: '760500', kind: 'winner' }, away: { matchId: '760499', kind: 'winner' } },
}
for (const m of matches) {
  if (!PREV_STAGE[m.stage]) continue
  m.feeds = { home: sourceFor(m, 'home'), away: sourceFor(m, 'away') }
  const ov = FEED_OVERRIDES[m.id]
  if (ov) {
    if (!m.homeId) m.feeds.home = ov.home
    if (!m.awayId) m.feeds.away = ov.away
  }
}

// ---- odds snapshot ----
// ESPN strips odds once a match is played, so an entry is never overwritten after kickoff:
// the pre-match closing line captured the night before is the record we keep.
const oddsPath = join(outDir, 'odds.json')
const odds = existsSync(oddsPath) ? JSON.parse(readFileSync(oddsPath, 'utf8')) : {}
const impliedProb = (american) => {
  const ml = Number(american)
  if (!Number.isFinite(ml) || ml === 0) return null
  return ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100)
}
for (const e of events) {
  const c = e.competitions[0]
  const o = (c.odds ?? []).find((x) => x && x.provider)
  if (!o?.moneyline) continue
  const m = matches.find((x) => x.id === e.id)
  // never overwrite once kicked off — check the clock too, since ESPN's status
  // can lag a few minutes behind the actual kickoff
  if (odds[e.id] && (m.status !== 'scheduled' || Date.parse(m.date) <= Date.now())) continue
  const h = impliedProb(o.moneyline.home?.close?.odds ?? o.moneyline.home?.open?.odds)
  const a = impliedProb(o.moneyline.away?.close?.odds ?? o.moneyline.away?.open?.odds)
  const d = impliedProb(o.drawOdds?.moneyLine)
  if (h == null || a == null) continue
  const total = h + a + (d ?? 0)
  odds[e.id] = {
    home: +(h / total).toFixed(3),
    draw: d == null ? null : +(d / total).toFixed(3),
    away: +(a / total).toFixed(3),
    source: `${o.provider.name} closing line`,
    kind: 'book',
    capturedAt: new Date().toISOString(),
  }
}

// ---- match stats & lineups (fetched once per finished match) ----
const STAT_KEYS = [
  'possessionPct',
  'totalShots',
  'shotsOnTarget',
  'wonCorners',
  'foulsCommitted',
  'offsides',
  'saves',
  'accuratePasses',
  'passPct',
  'yellowCards',
  'redCards',
]
const statsPath = join(outDir, 'stats.json')
const statsAll = existsSync(statsPath) ? JSON.parse(readFileSync(statsPath, 'utf8')) : {}
const needStats = matches.filter((m) => m.status === 'ft' && !statsAll[m.id])
for (const m of needStats) {
  try {
    const s = await getJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${m.id}`)
    const teams = (s.boxscore?.teams ?? []).map((bt) => ({
      teamId: String(bt.team?.id ?? ''),
      stats: Object.fromEntries(
        (bt.statistics ?? []).filter((x) => STAT_KEYS.includes(x.name)).map((x) => [x.name, x.displayValue])
      ),
    }))
    const lineups = (s.rosters ?? []).map((r) => ({
      teamId: String(r.team?.id ?? ''),
      formation: r.formation ?? null,
      players: (r.roster ?? [])
        .filter((p) => p.starter || p.subbedIn)
        .map((p) => ({
          name: p.athlete?.shortName ?? p.athlete?.displayName ?? '',
          jersey: String(p.jersey ?? ''),
          pos: p.position?.abbreviation ?? '',
          starter: !!p.starter,
          off: !!p.subbedOut,
          on: !!p.subbedIn && !p.starter,
        })),
    }))
    if (teams.length === 2) statsAll[m.id] = { teams, lineups }
    await new Promise((r) => setTimeout(r, 250))
  } catch (err) {
    console.warn(`stats fetch failed for ${m.id}: ${err.message}`)
  }
}
writeFileSync(statsPath, JSON.stringify(statsAll, null, 1))

// ---- sanity checks, then write ----
const nTeams = Object.keys(teams).length
if (nTeams !== 48) throw new Error(`Expected 48 teams, got ${nTeams}`)
if (matches.length !== 104) throw new Error(`Expected 104 matches, got ${matches.length}`)
if (Object.keys(groups).length !== 12) throw new Error(`Expected 12 groups, got ${Object.keys(groups).length}`)

writeFileSync(
  join(outDir, 'tournament.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      season: sb.leagues?.[0]?.season?.displayName ?? '2026 FIFA World Cup',
      teams,
      groups,
      matches,
    },
    null,
    1
  )
)
writeFileSync(oddsPath, JSON.stringify(odds, null, 1))
if (!existsSync(join(outDir, 'media.json'))) writeFileSync(join(outDir, 'media.json'), '{}\n')

const played = matches.filter((m) => m.status === 'ft').length
console.log(
  `tournament.json: ${nTeams} teams, ${matches.length} matches (${played} played) | odds.json: ${Object.keys(odds).length} entries | stats.json: ${Object.keys(statsAll).length} matches (+${needStats.length} new)`
)
