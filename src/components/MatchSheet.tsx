import { useState } from 'react'
import { bestHighlight, knownAsOf, slotHint, upsetInfo } from '../lib/data'
import { fmtDate, stageName, t as tr } from '../lib/i18n'
import type { Picks } from '../lib/picks'
import { ROUND_WEIGHT, candidates, isLocked, isPickable, validPick } from '../lib/picks'
import type { DataBundle, Lang, Match, MatchStats, Quote, Tournament } from '../types'
import SocialEmbed from './SocialEmbed'

const STAT_LABELS: Record<string, { en: string; es: string }> = {
  possessionPct: { en: 'Possession', es: 'Posesión' },
  totalShots: { en: 'Shots', es: 'Tiros' },
  shotsOnTarget: { en: 'On target', es: 'Al arco' },
  wonCorners: { en: 'Corners', es: 'Córners' },
  foulsCommitted: { en: 'Fouls', es: 'Faltas' },
  offsides: { en: 'Offsides', es: 'Fueras de juego' },
  saves: { en: 'Saves', es: 'Atajadas' },
  accuratePasses: { en: 'Passes completed', es: 'Pases completados' },
  passPct: { en: 'Pass accuracy', es: 'Precisión de pase' },
  yellowCards: { en: 'Yellow cards', es: 'Amarillas' },
  redCards: { en: 'Red cards', es: 'Rojas' },
}
const STAT_ORDER = Object.keys(STAT_LABELS)

interface Props {
  data: DataBundle
  m: Match
  asOf: Date | null
  picks: Picks
  onPick: (matchId: string, teamId: string | null) => void
  onConf: (matchId: string, conf: 1 | 2 | 3) => void
  onScore: (matchId: string, score: [number, number] | null) => void
  onSelectTeam: (teamId: string) => void
  onClose: () => void
  lang: Lang
  favorites: Set<string>
  onToggleFav: (teamId: string) => void
  wizard?: { pos: number; total: number; onPrev: () => void; onNext: () => void }
}

export default function MatchSheet({ data, m, asOf, picks, onPick, onConf, onScore, onSelectTeam, onClose, lang, favorites, onToggleFav, wizard }: Props) {
  const t = data.tournament
  const known = knownAsOf(m, asOf)
  const media = data.media[m.id]
  const odds = data.odds[m.id]
  const upset = known ? upsetInfo(m, data.odds) : null
  const home = m.homeId ? t.teams[m.homeId] : null
  const away = m.awayId ? t.teams[m.awayId] : null
  const highlight = known ? bestHighlight(data.media, m.id) : null
  const [playing, setPlaying] = useState(false)

  const showScore = (known || m.status === 'live') && m.homeScore != null
  const scoreline = showScore
    ? `${m.homeScore} – ${m.awayScore}${m.homePens != null ? `  (${m.homePens}–${m.awayPens} ${tr('pens', lang)})` : ''}`
    : fmtDate(m.date, lang)

  return (
    <aside className="sheet" onClick={(e) => e.stopPropagation()}>
      <header className="sheet-head">
        <div className="sheet-stage">
          {stageName(m.stage, lang)}
          {m.stage === 'group' && home ? ` · ${tr('groups', lang).slice(0, 5)} ${home.group}` : ''}
        </div>
        <button className="sheet-close" onClick={onClose} aria-label={tr('close', lang)}>
          ✕
        </button>
      </header>

      {wizard && (
        <div className="wizard-nav">
          <button onClick={wizard.onPrev} disabled={wizard.pos <= 1}>
            ◂
          </button>
          <span>
            {tr('pickWinner', lang)} · {wizard.pos} / {wizard.total}
          </span>
          <button onClick={wizard.onNext} disabled={wizard.pos >= wizard.total}>
            ▸
          </button>
        </div>
      )}

      <div className="sheet-score">
        <SheetTeam
          team={home}
          hint={slotHint(t, m, 'home')}
          winner={known && m.winnerId === m.homeId}
          fav={!!m.homeId && favorites.has(m.homeId)}
          onClick={onSelectTeam}
          onFav={onToggleFav}
          lang={lang}
        />
        <div className="sheet-mid">
          <div className="scoreline">{scoreline}</div>
          {m.status === 'live' && <div className="live-tag">● {m.statusDetail}</div>}
          {upset && upset.kind !== 'expected' && (
            <div className={`upset-tag ${upset.magnitude}`}>
              ⚡{' '}
              {tr(upset.kind === 'favDrew' ? 'favDrew' : upset.magnitude === 'shock' ? 'shockUpset' : upset.magnitude === 'major' ? 'bigUpset' : 'upset', lang)}
            </div>
          )}
          {upset && upset.kind === 'expected' && <div className="expected-tag">✓ {tr('expectedWin', lang)}</div>}
        </div>
        <SheetTeam
          team={away}
          hint={slotHint(t, m, 'away')}
          winner={known && m.winnerId === m.awayId}
          fav={!!m.awayId && favorites.has(m.awayId)}
          onClick={onSelectTeam}
          onFav={onToggleFav}
          lang={lang}
        />
      </div>

      <div className="sheet-venue">
        {m.venue}
        {m.city ? ` · ${m.city}` : ''}
        {m.attendance ? ` · ${tr('attendance', lang)} ${m.attendance.toLocaleString()}` : ''}
      </div>

      {(known || m.status === 'live') && !!m.events?.length && (
        <div className="timeline">
          <div className="tl-col tl-home">
            {m.events
              .filter((ev) => ev.teamId === m.homeId)
              .map((ev, i) => (
                <span key={i} className={`tl-ev ${ev.kind}`}>
                  {ev.kind === 'red' ? '🟥' : '⚽'} {ev.clock} {ev.player}
                  {ev.pen ? ' (p)' : ''}
                  {ev.og ? (lang === 'es' ? ' (a.g.)' : ' (og)') : ''}
                </span>
              ))}
          </div>
          <div className="tl-col tl-away">
            {m.events
              .filter((ev) => ev.teamId === m.awayId)
              .map((ev, i) => (
                <span key={i} className={`tl-ev ${ev.kind}`}>
                  {ev.player}
                  {ev.pen ? ' (p)' : ''}
                  {ev.og ? (lang === 'es' ? ' (a.g.)' : ' (og)') : ''} {ev.clock} {ev.kind === 'red' ? '🟥' : '⚽'}
                </span>
              ))}
          </div>
        </div>
      )}

      {odds && home && away && (
        <section className="odds-bar-wrap">
          <div className="section-title">{tr(known ? 'marketOdds' : 'currentOdds', lang)}</div>
          <div className="odds-bar">
            <span className="odds-home" style={{ flexGrow: odds.home }}>
              {home.abbrev} {Math.round(odds.home * 100)}%
            </span>
            {odds.draw != null && odds.draw > 0.02 && (
              <span className="odds-draw" style={{ flexGrow: odds.draw }}>
                {Math.round(odds.draw * 100)}%
              </span>
            )}
            <span className="odds-away" style={{ flexGrow: odds.away }}>
              {away.abbrev} {Math.round(odds.away * 100)}%
            </span>
          </div>
          <div className="odds-source">
            {tr('source', lang)}: {odds.source}
            {odds.note ? ` — ${odds.note}` : ''}
          </div>
        </section>
      )}

      {isPickable(m) && <PickControls data={data} m={m} picks={picks} onPick={onPick} onConf={onConf} onScore={onScore} lang={lang} />}

      {media?.recap && <p className="recap">{media.recap[lang] || media.recap.en}</p>}
      {m.headline && !media?.recap && <p className="recap">{m.headline}</p>}

      {known && data.stats[m.id] && <StatsSection t={t} m={m} stats={data.stats[m.id]} lang={lang} />}

      {highlight && (
        <section>
          <div className="section-title">
            {tr('extendedHighlights', lang)} · {highlight.channel}
          </div>
          {playing ? (
            <div className="video-box">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${highlight.videoId}?autoplay=1`}
                title={highlight.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <button className="video-thumb" onClick={() => setPlaying(true)}>
              <img src={`https://i.ytimg.com/vi/${highlight.videoId}/hqdefault.jpg`} alt={highlight.title} loading="lazy" />
              <span className="play-btn">▶</span>
            </button>
          )}
          <a
            className="yt-link"
            href={`https://www.youtube.com/watch?v=${highlight.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {tr('watchOnYouTube', lang)} ↗
          </a>
        </section>
      )}

      {known && !!media?.social?.length && (
        <section>
          <div className="section-title">{tr('socialClips', lang)}</div>
          <ul className="social-list">
            {media.social.map((s, i) => (
              <li key={i}>
                <SocialEmbed post={s} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {known && !!media?.quotes?.length && (
        <section>
          <div className="section-title">{tr('quotes', lang)}</div>
          {media.quotes.map((q: Quote, i: number) => (
            <blockquote key={i} className="quote">
              “{q.text}”
              <footer>
                — {q.speaker} ·{' '}
                <a href={q.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {q.sourceName}
                </a>
              </footer>
            </blockquote>
          ))}
        </section>
      )}

      {known && !!media?.fans?.length && (
        <section>
          <div className="section-title">🗣️ {tr('fanZone', lang)}</div>
          {media.fans.map((f, i) => (
            <a key={i} className="fan-bubble" href={f.url} target="_blank" rel="noopener noreferrer">
              “{f.text}”
              <span className="fan-author">
                — {f.author} · {f.platform} ↗
              </span>
            </a>
          ))}
        </section>
      )}

      {known && !highlight && !media?.social?.length && !media?.quotes?.length && (
        <p className="no-media">{tr('noMediaYet', lang)}</p>
      )}
    </aside>
  )
}

function StatsSection({ t, m, stats, lang }: { t: Tournament; m: Match; stats: MatchStats; lang: Lang }) {
  const byTeam = new Map(stats.teams.map((x) => [x.teamId, x.stats]))
  const hs = m.homeId ? byTeam.get(m.homeId) : undefined
  const as = m.awayId ? byTeam.get(m.awayId) : undefined
  if (!hs || !as || !m.homeId || !m.awayId) return null
  const fmt = (key: string, v: string | undefined) => {
    if (v == null) return '–'
    if (key === 'passPct') return `${Math.round(parseFloat(v) * 100)}%`
    if (key === 'possessionPct') return `${v}%`
    return v
  }
  const poss = [parseFloat(hs.possessionPct ?? '50'), parseFloat(as.possessionPct ?? '50')]
  const home = t.teams[m.homeId]
  const away = t.teams[m.awayId]
  const lineupFor = (teamId: string) => stats.lineups.find((l) => l.teamId === teamId)
  const renderLineup = (teamId: string) => {
    const l = lineupFor(teamId)
    if (!l) return null
    const starters = l.players.filter((p) => p.starter)
    const cameOn = l.players.filter((p) => p.on)
    return (
      <div className="lineup-col">
        <div className="lineup-head">
          {t.teams[teamId].abbrev}
          {l.formation ? ` · ${l.formation}` : ''}
        </div>
        {starters.map((p) => (
          <div key={p.jersey + p.name} className="lineup-row">
            <span className="lp-num">{p.jersey}</span> {p.name}
            {p.off && <span className="lp-sub off"> ↓</span>}
          </div>
        ))}
        {cameOn.length > 0 && <div className="lineup-sub-head">{tr('cameOn', lang)}</div>}
        {cameOn.map((p) => (
          <div key={p.jersey + p.name} className="lineup-row sub">
            <span className="lp-num">{p.jersey}</span> {p.name}
            <span className="lp-sub on"> ↑</span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <section>
      <div className="section-title">{tr('matchStats', lang)}</div>
      <div className="poss-bar">
        <span className="poss-home" style={{ flexGrow: poss[0] }}>
          {home.abbrev} {poss[0]}%
        </span>
        <span className="poss-away" style={{ flexGrow: poss[1] }}>
          {poss[1]}% {away.abbrev}
        </span>
      </div>
      <table className="stats-table">
        <tbody>
          {STAT_ORDER.filter((k) => k !== 'possessionPct' && (hs[k] != null || as[k] != null)).map((k) => (
            <tr key={k}>
              <td className="sv">{fmt(k, hs[k])}</td>
              <td className="sl">{STAT_LABELS[k][lang]}</td>
              <td className="sv">{fmt(k, as[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {stats.lineups.length === 2 && (
        <details className="lineups">
          <summary>{tr('lineups', lang)}</summary>
          <div className="lineup-grid">
            {renderLineup(m.homeId)}
            {renderLineup(m.awayId)}
          </div>
        </details>
      )}
    </section>
  )
}

function SheetTeam({
  team,
  hint,
  winner,
  fav,
  onClick,
  onFav,
  lang,
}: {
  team: { id: string; name: string; logo: string } | null
  hint: string
  winner: boolean
  fav: boolean
  onClick: (teamId: string) => void
  onFav: (teamId: string) => void
  lang: Lang
}) {
  if (!team) return <div className="sheet-team tbd">{hint}</div>
  return (
    <div className="sheet-team-wrap">
      <button className={`sheet-team ${winner ? 'winner' : ''}`} onClick={() => onClick(team.id)}>
        <img src={team.logo} alt="" width={42} height={30} />
        <span>{team.name}</span>
      </button>
      <button
        className={`fav-star ${fav ? 'on' : ''}`}
        title={tr('favorite', lang)}
        onClick={(e) => {
          e.stopPropagation()
          onFav(team.id)
        }}
      >
        {fav ? '★' : '☆'}
      </button>
    </div>
  )
}

function PickControls({
  data,
  m,
  picks,
  onPick,
  onConf,
  onScore,
  lang,
}: {
  data: DataBundle
  m: Match
  picks: Picks
  onPick: Props['onPick']
  onConf: Props['onConf']
  onScore: Props['onScore']
  lang: Lang
}) {
  const t = data.tournament
  const locked = isLocked(m, picks.retro)
  const h = candidates(t, picks, m, 'home')
  const a = candidates(t, picks, m, 'away')
  const pick = validPick(t, picks, m)
  const conf = picks.conf[m.id] ?? 1
  const score = picks.scores[m.id]
  // Buffer raw text so clearing one field doesn't wipe the other; commit only
  // when both sides parse (the sheet is keyed by match id, so this resets per match)
  const [raw, setRaw] = useState<[string, string]>(score ? [String(score[0]), String(score[1])] : ['', ''])
  const commitScore = (next: [string, string]) => {
    setRaw(next)
    const nums = next.map((s) => (s === '' ? null : Math.min(9, Math.max(0, Number(s)))))
    if (nums[0] != null && nums[1] != null && nums.every((n) => Number.isFinite(n))) {
      onScore(m.id, [nums[0], nums[1]] as [number, number])
    } else {
      onScore(m.id, null)
    }
  }

  if (locked && !pick) return null
  if (!h && !a) return <p className="pick-hint">{tr('pickEarlier', lang)}</p>

  return (
    <section className={`pick-controls ${locked ? 'locked' : ''}`}>
      <div className="section-title">
        {locked ? `${tr('yourPick', lang)} · ${tr('locked', lang)}` : tr('pickWinner', lang)}
        <span className="weight-tag">×{ROUND_WEIGHT[m.stage]}</span>
      </div>
      <div className="pick-buttons">
        {[h, a].map((id, i) =>
          id ? (
            <button
              key={id}
              className={`pick-btn ${pick === id ? 'picked' : ''}`}
              disabled={locked}
              onClick={() => onPick(m.id, pick === id ? null : id)}
            >
              <img src={t.teams[id].logo} alt="" width={22} height={16} />
              {t.teams[id].abbrev}
            </button>
          ) : (
            <button key={`tbd${i}`} className="pick-btn" disabled>
              {tr('tbd', lang)}
            </button>
          )
        )}
      </div>
      {pick && !locked && (
        <>
          <div className="conf-row">
            <span>{tr('confidence', lang)}</span>
            {([1, 2, 3] as const).map((c) => (
              <button key={c} className={`star ${conf >= c ? 'on' : ''}`} onClick={() => onConf(m.id, c)}>
                ★
              </button>
            ))}
          </div>
          <div className="score-row">
            <span>{tr('exactScore', lang)}</span>
            <input
              type="number"
              min={0}
              max={9}
              value={raw[0]}
              placeholder="-"
              onChange={(e) => commitScore([e.target.value, raw[1]])}
            />
            :
            <input
              type="number"
              min={0}
              max={9}
              value={raw[1]}
              placeholder="-"
              onChange={(e) => commitScore([raw[0], e.target.value])}
            />
          </div>
        </>
      )}
    </section>
  )
}
