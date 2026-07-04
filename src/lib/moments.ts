import type { DataBundle, Lang, Quote, SocialPost } from '../types'
import { upsetInfo } from './data'
import { stageName } from './i18n'

export interface Moment {
  id: string
  ts: number
  matchId: string
  major: boolean
  kind: 'result' | 'upset' | 'pens' | 'red' | 'hattrick' | 'social' | 'quote'
  icon: string
  title: string
  sub?: string
  post?: SocialPost
  quote?: Quote
}

const PLATFORM_ICON: Record<SocialPost['platform'], string> = { x: '𝕏', tiktok: '♪', instagram: '◎', youtube: '▶' }

/**
 * The tournament's story, derived from what we already know per match:
 * results, market-implied upsets, shootouts, reds, hat-tricks, curated
 * social posts and quotes. Major tier = the headline reel; everything
 * else fills in when the feed is expanded.
 */
export function buildMoments(data: DataBundle, lang: Lang): Moment[] {
  const t = data.tournament
  const es = lang === 'es'
  const out: Moment[] = []
  for (const m of t.matches) {
    if (m.status !== 'ft' || !m.homeId || !m.awayId) continue
    const home = t.teams[m.homeId]
    const away = t.teams[m.awayId]
    const ts = new Date(m.date).getTime()
    const score = `${m.homeScore}–${m.awayScore}${m.homePens != null ? ` (${m.homePens}–${m.awayPens} p)` : ''}`
    const media = data.media[m.id]
    const bigStage = m.stage === 'sf' || m.stage === 'final' || m.stage === 'third'

    out.push({
      id: `${m.id}-res`,
      ts,
      matchId: m.id,
      major: bigStage,
      kind: 'result',
      icon: '⚽',
      title: `${home.name} ${score} ${away.name}`,
      sub: media?.recap?.[lang] || m.headline || stageName(m.stage, lang),
    })

    const u = upsetInfo(m, data.odds)
    if (u && u.kind !== 'expected') {
      const fav = t.teams[u.favId]
      const dog = u.favId === m.homeId ? away : home
      const pct = Math.round(u.favProb * 100)
      const major = u.kind === 'upset' ? u.magnitude !== 'minor' : u.favProb >= 0.7
      out.push({
        id: `${m.id}-ups`,
        ts: ts + 1,
        matchId: m.id,
        major,
        kind: 'upset',
        icon: '⚡',
        title:
          u.kind === 'favDrew'
            ? es
              ? `${fav.name} (favorito al ${pct}%) no pudo con ${dog.name}`
              : `${fav.name} (${pct}% favorites) held by ${dog.name}`
            : es
              ? `${dog.name} sorprende a ${fav.name}`
              : `${dog.name} stun ${fav.name}`,
        sub: es ? `El mercado daba ${pct}% a ${fav.name}` : `Market had ${fav.name} at ${pct}%`,
      })
    }

    if (m.homePens != null && m.winnerId) {
      out.push({
        id: `${m.id}-pen`,
        ts: ts + 2,
        matchId: m.id,
        major: true,
        kind: 'pens',
        icon: '🥅',
        title: es
          ? `${t.teams[m.winnerId].name} avanza en penales (${m.homePens}–${m.awayPens})`
          : `${t.teams[m.winnerId].name} survive the shootout (${m.homePens}–${m.awayPens})`,
        sub: `${home.name} ${m.homeScore}–${m.awayScore} ${away.name}`,
      })
    }

    const goalsByPlayer = new Map<string, number>()
    for (const ev of m.events ?? []) {
      if (ev.kind === 'red') {
        out.push({
          id: `${m.id}-red-${ev.player}-${ev.clock}`,
          ts: ts + 3,
          matchId: m.id,
          major: m.stage !== 'group',
          kind: 'red',
          icon: '🟥',
          title: es ? `${ev.player} expulsado (${ev.clock})` : `${ev.player} sent off (${ev.clock})`,
          sub: `${home.abbrev} ${score} ${away.abbrev}`,
        })
      } else if (ev.player && !ev.og) {
        goalsByPlayer.set(ev.player, (goalsByPlayer.get(ev.player) ?? 0) + 1)
      }
    }
    for (const [player, n] of goalsByPlayer) {
      if (n >= 3) {
        out.push({
          id: `${m.id}-hat-${player}`,
          ts: ts + 4,
          matchId: m.id,
          major: true,
          kind: 'hattrick',
          icon: '🎩',
          title: es ? `Triplete de ${player}` : `${player} hat-trick`,
          sub: `${home.name} ${score} ${away.name}`,
        })
      }
    }

    for (const [i, q] of (media?.quotes ?? []).entries()) {
      out.push({
        id: `${m.id}-q-${i}`,
        ts: ts + 5,
        matchId: m.id,
        major: false,
        kind: 'quote',
        icon: '💬',
        title: `“${q.text}”`,
        sub: `— ${q.speaker} · ${home.abbrev}–${away.abbrev}`,
        quote: q,
      })
    }

    // A tweet only makes the headline reel when its match actually had drama —
    // otherwise every curated post floods the major view with heavy embeds.
    const drama =
      bigStage ||
      m.homePens != null ||
      (u && u.kind !== 'expected' && (u.kind === 'upset' ? u.magnitude !== 'minor' : u.favProb >= 0.7)) ||
      (m.events ?? []).some((ev) => ev.kind === 'red' && m.stage !== 'group') ||
      [...goalsByPlayer.values()].some((n) => n >= 3)
    for (const [i, p] of (media?.social ?? []).entries()) {
      out.push({
        id: `${m.id}-soc-${i}`,
        ts: ts + 6 + i,
        matchId: m.id,
        major: !!drama && p.kind === 'commentary',
        kind: 'social',
        icon: PLATFORM_ICON[p.platform] ?? '▶',
        title: p.note,
        sub: `${home.abbrev}–${away.abbrev}`,
        post: p,
      })
    }
  }
  return out.sort((a, b) => b.ts - a.ts)
}
