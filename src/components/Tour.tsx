import { useLayoutEffect, useRef, useState } from 'react'
import type { StringKey } from '../lib/i18n'
import { t as tr } from '../lib/i18n'
import type { Lang } from '../types'

interface Step {
  anchor: string | null
  title: StringKey
  body: StringKey
}

const STEPS: Step[] = [
  { anchor: null, title: 'tourT1', body: 'tourB1' },
  { anchor: 'main', title: 'tourT2', body: 'tourB2' },
  { anchor: '.pick-fab', title: 'tourT3', body: 'tourB3' },
  { anchor: '.score-chips', title: 'tourT4', body: 'tourB4' },
  { anchor: '.today-strip', title: 'tourT5', body: 'tourB5' },
  { anchor: '.controls', title: 'tourT6', body: 'tourB6' },
  { anchor: '[data-tour="watching"]', title: 'tourT7', body: 'tourB7' },
  { anchor: '[data-tour="moments"]', title: 'tourT8', body: 'tourB8' },
  { anchor: '.share-bar', title: 'tourT9', body: 'tourB9' },
  { anchor: '.ticker', title: 'tourT10', body: 'tourB10' },
]

export default function Tour({ onClose, lang }: { onClose: () => void; lang: Lang }) {
  const [idx, setIdx] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const step = STEPS[idx]

  useLayoutEffect(() => {
    const el = step.anchor ? document.querySelector(step.anchor) : null
    el?.classList.add('tour-glow')
    const place = () => {
      const cw = cardRef.current?.offsetWidth ?? 350
      const ch = cardRef.current?.offsetHeight ?? 190
      if (!el) {
        setPos({ top: window.innerHeight / 2 - ch / 2, left: window.innerWidth / 2 - cw / 2 })
        return
      }
      const r = el.getBoundingClientRect()
      let top = r.bottom + 12
      if (top + ch > window.innerHeight - 12) top = Math.max(12, r.top - ch - 12)
      const left = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), window.innerWidth - cw - 12)
      setPos({ top, left })
    }
    place()
    const t = setTimeout(place, 60) // re-place once the card has its real size
    window.addEventListener('resize', place)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', place)
      el?.classList.remove('tour-glow')
    }
  }, [idx, step.anchor])

  const finish = () => {
    localStorage.setItem('cc26-tour', '1')
    onClose()
  }
  // Steps whose anchor isn't on screen (e.g. the pick button when every pick is in) get skipped
  const move = (dir: 1 | -1) => {
    let i = idx + dir
    while (i > 0 && i < STEPS.length && STEPS[i].anchor && !document.querySelector(STEPS[i].anchor!)) i += dir
    if (i < 0) i = 0
    if (i >= STEPS.length) {
      finish()
      return
    }
    setIdx(i)
  }

  return (
    <div ref={cardRef} className="tour-card" style={pos ?? undefined} onClick={(e) => e.stopPropagation()}>
      <div className="tour-title">{tr(step.title, lang)}</div>
      <p className="tour-body">{tr(step.body, lang)}</p>
      <div className="tour-foot">
        <button className="tour-skip" onClick={finish}>
          {tr('tourSkip', lang)}
        </button>
        <span className="tour-dots">
          {STEPS.map((_, i) => (
            <i key={i} className={i === idx ? 'on' : ''} />
          ))}
        </span>
        <span className="tour-btns">
          {idx > 0 && (
            <button className="tour-nav" onClick={() => move(-1)}>
              ‹
            </button>
          )}
          <button className="tour-next" onClick={() => move(1)}>
            {idx === STEPS.length - 1 ? tr('tourDone', lang) : tr('tourNext', lang)}
          </button>
        </span>
      </div>
    </div>
  )
}
