import { useState } from 'react'
import { t as tr } from '../lib/i18n'
import type { Lang, TravelerPost } from '../types'

interface Props {
  posts: TravelerPost[]
  lang: Lang
}

/** Bottom marquee: fans from abroad discovering North America, refreshed nightly. */
export default function Ticker({ posts, lang }: Props) {
  const [sel, setSel] = useState<TravelerPost | null>(null)
  if (!posts.length) return null
  const items = posts.slice(0, 100)
  const duration = Math.max(80, items.length * 9)
  return (
    <div className="ticker" onClick={(e) => e.stopPropagation()}>
      <span className="ticker-label">🧳 {tr('fansOnTour', lang)}</span>
      <div className="ticker-viewport">
        <div className="ticker-track" style={{ animationDuration: `${duration}s` }}>
          {[0, 1].map((dup) => (
            <span key={dup} className="ticker-seg" aria-hidden={dup === 1}>
              {items.map((p, i) => (
                <button key={i} className="ticker-item" onClick={() => setSel(sel === p ? null : p)}>
                  <b>{p.origin}</b> {p.text}
                </button>
              ))}
            </span>
          ))}
        </div>
      </div>
      {sel && (
        <div className="ticker-pop">
          <button className="sheet-close" onClick={() => setSel(null)} aria-label={tr('close', lang)}>
            ✕
          </button>
          <p className="tp-text">“{sel.text}”</p>
          <p className="tp-meta">
            — {sel.author} · {sel.origin} · {sel.platform}
          </p>
          {sel.comments?.map((c, i) => (
            <p key={i} className="tp-comment">
              ↳ <b>{c.author}</b> {c.text}
            </p>
          ))}
          <a href={sel.url} target="_blank" rel="noopener noreferrer">
            {tr('viewPost', lang)} ↗
          </a>
        </div>
      )}
    </div>
  )
}
