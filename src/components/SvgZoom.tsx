import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  onScaleChange?: (k: number) => void
}

/**
 * Minimal pan/zoom surface for the radial SVG. Hand-rolled so that taps on
 * child nodes fire normally — a click only gets suppressed when the pointer
 * actually dragged (>5px), via stopPropagation in the capture phase.
 */
export default function SvgZoom({ children, onScaleChange }: Props) {
  const [t, setT] = useState({ x: 0, y: 0, k: 1 })
  const box = useRef<HTMLDivElement>(null)
  const ptrs = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; k: number } | null>(null)
  const dragged = useRef(false)

  const clampK = (k: number) => Math.min(8, Math.max(0.5, k))

  const zoomAt = (cx: number, cy: number, factor: number) => {
    setT((prev) => {
      const k = clampK(prev.k * factor)
      const f = k / prev.k
      return { k, x: cx - (cx - prev.x) * f, y: cy - (cy - prev.y) * f }
    })
  }

  useEffect(() => onScaleChange?.(t.k), [t.k, onScaleChange])

  // Wheel needs a non-passive listener to preventDefault page scroll
  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.clientX - r.x, e.clientY - r.y, Math.exp(-e.deltaY * 0.0016))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    // No pointer capture here: capturing retargets pointerup AND the synthesized
    // click to this container, which would swallow taps on match nodes. We only
    // capture once a real drag begins (see onPointerMove).
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ptrs.current.size === 1) dragged.current = false
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: t.k }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    ptrs.current.set(e.pointerId, cur)
    if (ptrs.current.size === 1) {
      const dx = cur.x - prev.x
      const dy = cur.y - prev.y
      if (Math.abs(dx) + Math.abs(dy) > 0) {
        setT((p) => ({ ...p, x: p.x + dx, y: p.y + dy }))
        if (!dragged.current && Math.hypot(dx, dy) > 2) {
          dragged.current = true
          box.current?.setPointerCapture(e.pointerId) // safe now: the tap case never captures
        }
      }
    } else if (ptrs.current.size === 2 && pinch.current && box.current) {
      dragged.current = true
      const [a, b] = [...ptrs.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const r = box.current.getBoundingClientRect()
      const mx = (a.x + b.x) / 2 - r.x
      const my = (a.y + b.y) / 2 - r.y
      const target = clampK(pinch.current.k * (dist / pinch.current.dist))
      setT((p) => {
        const f = target / p.k
        return { k: target, x: mx - (mx - p.x) * f, y: my - (my - p.y) * f }
      })
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId)
    if (ptrs.current.size < 2) pinch.current = null
  }

  return (
    <div
      ref={box}
      className="zoom-box"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        const r = box.current!.getBoundingClientRect()
        zoomAt(e.clientX - r.x, e.clientY - r.y, 1.7)
      }}
      onClickCapture={(e) => {
        if (dragged.current) {
          e.stopPropagation()
          dragged.current = false
        }
      }}
    >
      <div
        className="zoom-content"
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`, transformOrigin: '0 0' }}
      >
        {children}
      </div>
      {(t.k !== 1 || t.x !== 0 || t.y !== 0) && (
        <button className="zoom-reset" onClick={() => setT({ x: 0, y: 0, k: 1 })} title="Reset view">
          ⤾
        </button>
      )}
    </div>
  )
}
