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
  const today = Date.now()
  const max = Math.floor((today - start) / DAY)
  const value = asOf ? Math.min(max, Math.round((asOf.getTime() - start) / DAY)) : max
  const current = new Date(start + value * DAY)

  return (
    <div className="time-slider">
      <span className="ts-label">
        {tr('asOf', lang)}{' '}
        <b>{current.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'long', day: 'numeric' })}</b>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value)
          onChange(v >= max ? null : new Date(start + v * DAY))
        }}
      />
      {asOf && (
        <button className="ts-reset" onClick={() => onChange(null)}>
          {tr('backToToday', lang)}
        </button>
      )}
    </div>
  )
}
