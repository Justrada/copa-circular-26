import { useMemo, useState } from 'react'
import { t as tr } from '../lib/i18n'
import type { Moment } from '../lib/moments'
import { buildMoments } from '../lib/moments'
import type { DataBundle, Lang, Selection } from '../types'
import SocialEmbed from './SocialEmbed'

interface Props {
  data: DataBundle
  onSelect: (sel: Selection) => void
  onClose: () => void
  lang: Lang
}

export default function MomentsFeed({ data, onSelect, onClose, lang }: Props) {
  const [showAll, setShowAll] = useState(false)
  const moments = useMemo(() => buildMoments(data, lang), [data, lang])
  const visible = showAll ? moments : moments.filter((m) => m.major)

  // group by calendar day, newest day first (moments are already sorted desc)
  const days = useMemo(() => {
    const out: { label: string; items: Moment[] }[] = []
    let cur: string | null = null
    for (const m of visible) {
      const label = new Date(m.ts).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
      if (label !== cur) {
        out.push({ label, items: [] })
        cur = label
      }
      out[out.length - 1].items.push(m)
    }
    return out
  }, [visible, lang])

  return (
    <aside className="moments-panel" onClick={(e) => e.stopPropagation()}>
      <header className="sheet-head">
        <div className="sheet-stage">📜 {tr('moments', lang)}</div>
        <button className="sheet-close" onClick={onClose} aria-label={tr('close', lang)}>
          ✕
        </button>
      </header>
      <div className="moments-toggle">
        <button className={!showAll ? 'on' : ''} onClick={() => setShowAll(false)}>
          {tr('majorOnly', lang)}
        </button>
        <button className={showAll ? 'on' : ''} onClick={() => setShowAll(true)}>
          {tr('showAllMoments', lang)}
        </button>
      </div>
      <div className="moments-scroll">
        {days.map((d) => (
          <section key={d.label}>
            <h4 className="moments-day">{d.label}</h4>
            {d.items.map((m) => (
              <MomentRow key={m.id} m={m} showAll={showAll} onSelect={onSelect} />
            ))}
          </section>
        ))}
      </div>
    </aside>
  )
}

function MomentRow({ m, showAll, onSelect }: { m: Moment; showAll: boolean; onSelect: Props['onSelect'] }) {
  // Major commentary posts embed inline — the spicy-call tweets ARE the moment.
  // In the everything-view, social posts stay compact cards to keep the scroll light.
  if (m.kind === 'social' && m.post && m.major && !showAll) {
    return (
      <div className={`moment kind-social major`}>
        <SocialEmbed post={m.post} />
        <button className="moment-jump" onClick={() => onSelect({ kind: 'match', id: m.matchId })}>
          {m.sub} →
        </button>
      </div>
    )
  }
  if (m.kind === 'social' && m.post) {
    return (
      <div className="moment kind-social">
        <a href={m.post.url} target="_blank" rel="noopener noreferrer" className="moment-row as-link">
          <span className="moment-icon">{m.icon}</span>
          <span className="moment-body">
            <span className="moment-title">{m.title}</span>
            {m.sub && <span className="moment-sub">{m.sub}</span>}
          </span>
        </a>
      </div>
    )
  }
  return (
    <div className={`moment kind-${m.kind} ${m.major ? 'major' : ''}`}>
      <button className="moment-row" onClick={() => onSelect({ kind: 'match', id: m.matchId })}>
        <span className="moment-icon">{m.icon}</span>
        <span className="moment-body">
          <span className="moment-title">{m.title}</span>
          {m.sub && <span className="moment-sub">{m.sub}</span>}
        </span>
      </button>
    </div>
  )
}
