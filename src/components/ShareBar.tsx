import { useState } from 'react'
import { t as tr } from '../lib/i18n'
import type { Picks, Scorecard } from '../lib/picks'
import { encodePicks, pickedChampion } from '../lib/picks'
import type { DataBundle, Lang } from '../types'

interface Props {
  data: DataBundle
  picks: Picks
  scorecard: Scorecard
  lang: Lang
  onCard: () => Promise<void>
}

export default function ShareBar({ data, picks, scorecard, lang, onCard }: Props) {
  const [copied, setCopied] = useState(false)
  const [rendering, setRendering] = useState(false)
  const t = data.tournament

  const url = () => {
    const base = `${location.origin}${location.pathname}`
    return `${base}#p=${encodePicks(picks)}`
  }

  const text = () => {
    const decided = scorecard.correct + scorecard.wrong
    const champId = pickedChampion(t, picks)
    const champ = champId ? t.teams[champId].name : null
    const bits =
      lang === 'es'
        ? [
            `Mi bracket del Mundial 2026${picks.retro ? ' (retro)' : ''}:`,
            decided ? `${scorecard.correct}/${decided} aciertos, ${scorecard.points} pts.` : '',
            champ ? `Mi campeón: ${champ}.` : '',
            '¿Puedes superarlo?',
          ]
        : [
            `My World Cup 2026 bracket${picks.retro ? ' (retro)' : ''}:`,
            decided ? `${scorecard.correct}/${decided} picks right, ${scorecard.points} pts.` : '',
            champ ? `My champion: ${champ}.` : '',
            'Think you can beat it?',
          ]
    return bits.filter(Boolean).join(' ')
  }

  const openIntent = (href: string) => window.open(href, '_blank', 'noopener,noreferrer,width=600,height=500')

  return (
    <div className="share-bar">
      <button
        className="share-btn x"
        onClick={() =>
          openIntent(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text())}&url=${encodeURIComponent(url())}`)
        }
      >
        𝕏 {tr('shareX', lang)}
      </button>
      <button
        className="share-btn wa"
        onClick={() => openIntent(`https://wa.me/?text=${encodeURIComponent(`${text()} ${url()}`)}`)}
      >
        {tr('shareWhatsApp', lang)}
      </button>
      <button
        className="share-btn rd"
        onClick={() =>
          openIntent(`https://www.reddit.com/submit?url=${encodeURIComponent(url())}&title=${encodeURIComponent(text())}`)
        }
      >
        {tr('shareReddit', lang)}
      </button>
      <button
        className="share-btn copy"
        onClick={async () => {
          await navigator.clipboard.writeText(url())
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? tr('copied', lang) : tr('copyLink', lang)}
      </button>
      <button
        className="share-btn card"
        disabled={rendering}
        onClick={async () => {
          setRendering(true)
          try {
            await onCard()
          } catch (err) {
            console.error('share card failed', err)
          } finally {
            setRendering(false)
          }
        }}
      >
        {rendering ? '…' : `📸 ${tr('shareCard', lang)}`}
      </button>
    </div>
  )
}
