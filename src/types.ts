export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'
export type MatchStatus = 'ft' | 'live' | 'scheduled'

export interface Team {
  id: string
  name: string
  shortName: string
  abbrev: string
  logo: string
  color: string | null
  alternateColor: string | null
  group: string
  groupRank: number
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  advanced: boolean
}

export interface Feed {
  matchId: string
  kind: 'winner' | 'loser'
}

export interface MatchEvent {
  kind: 'goal' | 'red'
  teamId: string
  player: string
  clock: string
  pen: boolean
  og: boolean
}

export interface Match {
  id: string
  stage: Stage
  bracketIndex: number
  date: string
  venue: string
  city: string
  status: MatchStatus
  statusDetail: string
  homeId: string | null
  awayId: string | null
  homePlaceholder: string | null
  awayPlaceholder: string | null
  homeScore: number | null
  awayScore: number | null
  homePens: number | null
  awayPens: number | null
  winnerId: string | null
  loserId: string | null
  headline: string | null
  attendance: number | null
  events?: MatchEvent[]
  feeds?: { home: Feed | null; away: Feed | null }
}

export interface Tournament {
  generatedAt: string
  season: string
  teams: Record<string, Team>
  groups: Record<string, string[]>
  matches: Match[]
}

export interface OddsEntry {
  home: number
  draw: number | null
  away: number
  source: string
  kind: 'market' | 'book' | 'estimate'
  note?: string
  capturedAt?: string
}

export interface MediaVideo {
  videoId: string
  title: string
}

export interface SocialPost {
  platform: 'x' | 'tiktok' | 'instagram' | 'youtube'
  url: string
  kind: 'highlight' | 'commentary' | 'bts'
  note: string
}

export interface Quote {
  speaker: string
  text: string
  sourceName: string
  sourceUrl: string
}

export interface FanPost {
  text: string
  author: string
  platform: string
  url: string
}

export interface MediaEntry {
  highlights?: { fox?: MediaVideo | null; fifa?: MediaVideo | null }
  social?: SocialPost[]
  quotes?: Quote[]
  recap?: { en: string; es: string }
  fans?: FanPost[]
}

export interface LineupPlayer {
  name: string
  jersey: string
  pos: string
  starter: boolean
  off: boolean
  on: boolean
}

export interface MatchStats {
  teams: { teamId: string; stats: Record<string, string> }[]
  lineups: { teamId: string; formation: string | null; players: LineupPlayer[] }[]
}

export interface TravelerPost {
  text: string
  author: string
  origin: string
  platform: string
  url: string
  comments?: { author: string; text: string }[]
}

export interface DataBundle {
  tournament: Tournament
  odds: Record<string, OddsEntry>
  media: Record<string, MediaEntry>
  champion: Record<string, number> | null
  stats: Record<string, MatchStats>
  travelers: TravelerPost[]
}

export type Lang = 'en' | 'es'
export type View = 'circle' | 'bracket' | 'groups'

export interface Selection {
  kind: 'match' | 'team'
  id: string
}

export interface UpsetInfo {
  kind: 'upset' | 'expected' | 'favDrew'
  magnitude: 'minor' | 'major' | 'shock'
  favId: string
  favProb: number
}
