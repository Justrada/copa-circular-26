import { useState } from 'react'
import { bestHighlight, knownAsOf, slotHint, upsetInfo } from '../lib/data'
import { fmtDate, stageName, t as tr } from '../lib/i18n'
import type { Picks } from '../lib/picks'
import { ROUND_WEIGHT, candidates, isLocked, isPickable, validPick } from '../lib/picks'
import type { DataBundle, Lang, Match, Quote, SocialPost } from '../types'

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
}

const PLATFORM_ICON: Record<SocialPost['platform'], string> = {
  x: '𝕏',
  tiktok: '♪',
  instagram: '◎',
  youtube: '▶',
}

export default function MatchSheet({ data, m, asOf, picks, onPick, onConf, onScore, onSelectTeam, onClose, lang }: Props) {
  const t = data.tournament
  const known = knownAsOf(m, asOf)
  const media = data.media[m.id]
  const odds = data.odds[m.id]
  const upset = known ? upsetInfo(m, data.odds) : null
  const home = m.homeId ? t.teams[m.homeId] : null
  const away = m.awayId ? t.teams[m.awayId] : null
  const highlight = known ? bestHighlight(data.media, m.id) : null
  const [playing, setPlaying] = useState(false)

  const scoreline =
    known && m.homeScore != null
      ? `${m.homeScore} – ${m.awayScore}${m.homePens != null ? `  (${m.homePens}–${m.awayPens} ${tr('pens', lang)})` : ''}`
      : fmtDate(m.date, lang)

  return (
    <aside className="sheet" onClick={(e) => e.stopPropagation()}>
      <header className="sheet-head">
        <div className="sheet-stage">
          {stageName(m.stage, lang)}
          {m.stage === 'group' && home ? ` · ${tr('groups', lang).slice(0, 5)} ${home.group}` : ''}
        </div>
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div className="sheet-score">
        <SheetTeam team={home} hint={slotHint(t, m, 'home')} winner={known && m.winnerId === m.homeId} onClick={onSelectTeam} />
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
        <SheetTeam team={away} hint={slotHint(t, m, 'away')} winner={known && m.winnerId === m.awayId} onClick={onSelectTeam} />
      </div>

      <div className="sheet-venue">
        {m.venue}
        {m.city ? ` · ${m.city}` : ''}
        {m.attendance ? ` · ${tr('attendance', lang)} ${m.attendance.toLocaleString()}` : ''}
      </div>

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
                <a href={s.url} target="_blank" rel="noopener noreferrer" className={`social-card ${s.platform}`}>
                  <span className="social-icon">{PLATFORM_ICON[s.platform]}</span>
                  <span className="social-note">{s.note}</span>
                  <span className={`social-kind kind-${s.kind}`}>{s.kind}</span>
                </a>
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

      {known && !highlight && !media?.social?.length && !media?.quotes?.length && (
        <p className="no-media">{tr('noMediaYet', lang)}</p>
      )}
    </aside>
  )
}

function SheetTeam({
  team,
  hint,
  winner,
  onClick,
}: {
  team: { id: string; name: string; logo: string } | null
  hint: string
  winner: boolean
  onClick: (teamId: string) => void
}) {
  if (!team) return <div className="sheet-team tbd">{hint}</div>
  return (
    <button className={`sheet-team ${winner ? 'winner' : ''}`} onClick={() => onClick(team.id)}>
      <img src={team.logo} alt="" width={42} height={30} />
      <span>{team.name}</span>
    </button>
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
              value={score?.[0] ?? ''}
              placeholder="-"
              onChange={(e) => {
                const v = e.target.value === '' ? null : ([Number(e.target.value), score?.[1] ?? 0] as [number, number])
                onScore(m.id, v)
              }}
            />
            :
            <input
              type="number"
              min={0}
              max={9}
              value={score?.[1] ?? ''}
              placeholder="-"
              onChange={(e) => {
                const v = e.target.value === '' ? null : ([score?.[0] ?? 0, Number(e.target.value)] as [number, number])
                onScore(m.id, v)
              }}
            />
          </div>
        </>
      )}
    </section>
  )
}
