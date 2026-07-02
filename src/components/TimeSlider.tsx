import { useEffect, useState } from 'react'
import { TOURNAMENT_START } from '../lib/data'
import { t as tr } from '../lib/i18n'
import type { Lang } from '../types'

interface Props {
  asOf: Date | null
  onChange: (d: Date | null) => void
  lang: Lang
}

const DAY = 86400000
const start = new Date(`${TOURNAMENT_START}T23:59:59Z`).getTime()

export default function TimeSlider({ asOf, onChange, lang }: Props) {
  const [playing, setPlaying] = useState(false)
  const max = Math.floor((Date.now() - start) / DAY)
  const value = asOf ? Math.min(max, Math.round((asOf.getTime() - start) / DAY)) : max
  const atEnd = value >= max

  useEffect(() => {
    if (!playing) return
    if (atEnd) {
      setPlaying(false)
      onChange(null)
      return
    }
    const id = setTimeout(() => {
      const next = value + 1
      onChange(next >= max ? null : new Date(start + next * DAY))
    }, 650)
    return () => clearTimeout(id)
  }, [playing, value, atEnd, max, onChange])

  const label = atEnd
    ? lang === 'es'
      ? 'Hoy — torneo en vivo'
      : 'Today — tournament live'
    : `${tr('asOf', lang)} ${new Date(start + value * DAY).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
        month: 'long',
        day: 'numeric',
      })}`

  return (
    <div className="time-slider">
      <button
        className="ts-play"
        title={playing ? 'Pause' : 'Replay the tournament'}
        onClick={() => {
          if (playing) {
            setPlaying(false)
          } else {
            if (atEnd) onChange(new Date(start)) // restart the replay from opening day
            setPlaying(true)
          }
        }}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <span className="ts-label">{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          setPlaying(false)
          const v = Number(e.target.value)
          onChange(v >= max ? null : new Date(start + v * DAY))
        }}
      />
      <button className="ts-reset" style={{ visibility: asOf ? 'visible' : 'hidden' }} onClick={() => { setPlaying(false); onChange(null) }}>
        {tr('backToToday', lang)}
      </button>
    </div>
  )
}
