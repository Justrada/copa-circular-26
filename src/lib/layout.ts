import type { Feed, Match, Stage, Tournament } from '../types'

// The SVG lives in viewBox "-500 -500 1000 1000", centered on the final.
export const RINGS: Record<string, number> = {
  r32: 342,
  r16: 260,
  qf: 184,
  sf: 114,
}
export const GROUP_RING = { inner: 400, outer: 500 }
export const SLOT_COUNT: Record<string, number> = { r32: 16, r16: 8, qf: 4, sf: 2 }

// Match-node card sizes per stage (width, height)
export const NODE_SIZE: Record<Stage, [number, number]> = {
  group: [0, 0],
  r32: [74, 40],
  r16: [84, 44],
  qf: [94, 46],
  sf: [104, 48],
  third: [118, 44],
  final: [166, 94],
}

export function deg2rad(d: number): number {
  return (d * Math.PI) / 180
}

export function polar(angleDeg: number, r: number): [number, number] {
  const a = deg2rad(angleDeg)
  return [r * Math.cos(a), r * Math.sin(a)]
}

/** Center angle (degrees) for a knockout slot. -90° is 12 o'clock; clockwise. */
export function slotAngle(stage: string, index: number): number {
  const n = SLOT_COUNT[stage]
  return ((index + 0.5) * 360) / n - 90
}

/**
 * Angular position per knockout match, derived from the bracket TREE rather
 * than schedule order: the final owns the full circle and each match splits
 * its arc between its two feeder matches. Every parent therefore sits exactly
 * midway between its children and links merge inward without ever crossing.
 */
export function computeKnockoutAngles(t: Tournament): Map<string, number> {
  const angles = new Map<string, number>()
  const byId = new Map(t.matches.map((m) => [m.id, m]))
  const final = t.matches.find((m) => m.stage === 'final')
  if (!final) return angles
  const assign = (m: Match, a0: number, a1: number) => {
    angles.set(m.id, (a0 + a1) / 2)
    const kids = [m.feeds?.home, m.feeds?.away]
      .filter((f): f is Feed => !!f && f.kind === 'winner')
      .map((f) => byId.get(f.matchId))
      .filter((x): x is Match => !!x)
    if (kids.length === 2) {
      const mid = (a0 + a1) / 2
      assign(kids[0], a0, mid)
      assign(kids[1], mid, a1)
    } else if (kids.length === 1) {
      assign(kids[0], a0, a1)
    }
  }
  assign(final, -90, 270)
  return angles
}

export function matchAngle(m: Match, angles: Map<string, number>): number {
  return angles.get(m.id) ?? slotAngle(m.stage, m.bracketIndex)
}

export function matchPos(m: Match, angles: Map<string, number>): [number, number] {
  if (m.stage === 'final') return [0, 0]
  if (m.stage === 'third') return [0, 168]
  return polar(matchAngle(m, angles), RINGS[m.stage])
}

/** Cubic bezier between two polar points, bowing through mid-radius — a soft radial link. */
export function radialLink(a0: number, r0: number, a1: number, r1: number): string {
  const [x0, y0] = polar(a0, r0)
  const [x1, y1] = polar(a1, r1)
  const rm = (r0 + r1) / 2
  const [cx0, cy0] = polar(a0, rm)
  const [cx1, cy1] = polar(a1, rm)
  return `M${x0.toFixed(1)},${y0.toFixed(1)} C${cx0.toFixed(1)},${cy0.toFixed(1)} ${cx1.toFixed(1)},${cy1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`
}

/** Link from a knockout match to the match it feeds. Endpoints sit on node edges. */
export function feedLinkPath(from: Match, to: Match, angles: Map<string, number>): string {
  if (to.stage === 'final' || to.stage === 'third') {
    const [x0, y0] = matchPos(from, angles)
    const [x1, y1] = matchPos(to, angles)
    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2
    return `M${x0},${y0} Q${mx},${my} ${x1},${y1}`
  }
  return radialLink(matchAngle(from, angles), RINGS[from.stage] - 14, matchAngle(to, angles), RINGS[to.stage] + 14)
}

export const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

/** Angular span of a group's 30° sector. */
export function groupSector(gi: number): { start: number; end: number; mid: number } {
  const start = gi * 30 - 90
  return { start, end: start + 30, mid: start + 15 }
}

/** Position + tangential rotation for a team chip inside its group sector (rank 1 outermost). */
export function chipTransform(gi: number, rank: number): string {
  const { mid } = groupSector(gi)
  const r = GROUP_RING.outer - 15 - (rank - 1) * 23
  const [x, y] = polar(mid, r)
  // Tangential text, flipped on the lower half so nothing reads upside down
  let rot = mid + 90
  if (mid > 0 && mid < 180) rot = mid - 90
  return `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${rot.toFixed(1)})`
}

/** SVG arc path for a group sector band (annulus segment). */
export function sectorPath(gi: number, rInner: number, rOuter: number): string {
  const { start, end } = groupSector(gi)
  const pad = 0.8
  const [x0, y0] = polar(start + pad, rOuter)
  const [x1, y1] = polar(end - pad, rOuter)
  const [x2, y2] = polar(end - pad, rInner)
  const [x3, y3] = polar(start + pad, rInner)
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${rOuter},${rOuter} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} A${rInner},${rInner} 0 0 0 ${x3.toFixed(1)},${y3.toFixed(1)} Z`
}

/** Ribbon from a team's group chip down to its R32 slot. */
export function ribbonPath(gi: number, rank: number, r32Angle: number): string {
  const { mid } = groupSector(gi)
  const chipR = GROUP_RING.outer - 15 - (rank - 1) * 23
  return radialLink(mid, chipR - 11, r32Angle, RINGS.r32 + 22)
}

/** Anchor for the round label rings (12 o'clock). */
export function ringLabelPos(stage: string): [number, number] {
  return [0, -(RINGS[stage] + 34)]
}

export const IDENTITY_ORDER: Record<string, number> = Object.fromEntries(GROUP_LETTERS.map((l, i) => [l, i]))

/**
 * Assign groups to sectors so qualification ribbons take the shortest angular
 * route to their Round-of-32 slots: greedy assignment on a 12×12 cost matrix,
 * then pairwise-swap hill climbing (converges instantly at this size).
 */
export function computeSectorOrder(t: Tournament, angles: Map<string, number>): Record<string, number> {
  const slotAngleByTeam = new Map<string, number>()
  for (const m of t.matches) {
    if (m.stage !== 'r32') continue
    for (const id of [m.homeId, m.awayId]) {
      if (id) slotAngleByTeam.set(id, matchAngle(m, angles))
    }
  }
  const angDist = (a: number, b: number) => {
    const d = Math.abs(a - b) % 360
    return d > 180 ? 360 - d : d
  }
  const cost = (letter: string, sector: number) => {
    const mid = sector * 30 - 75 // groupSector(sector).mid
    let c = 0
    for (const id of t.groups[letter] ?? []) {
      const a = slotAngleByTeam.get(id)
      if (a != null) c += angDist(mid, a)
    }
    return c
  }
  const pairs: [string, number, number][] = []
  for (const l of GROUP_LETTERS) for (let s = 0; s < 12; s++) pairs.push([l, s, cost(l, s)])
  pairs.sort((a, b) => a[2] - b[2])
  const order: Record<string, number> = {}
  const taken = new Set<number>()
  for (const [l, s] of pairs) {
    if (order[l] === undefined && !taken.has(s)) {
      order[l] = s
      taken.add(s)
    }
  }
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < GROUP_LETTERS.length; i++) {
      for (let j = i + 1; j < GROUP_LETTERS.length; j++) {
        const a = GROUP_LETTERS[i]
        const b = GROUP_LETTERS[j]
        if (cost(a, order[b]) + cost(b, order[a]) + 1e-9 < cost(a, order[a]) + cost(b, order[b])) {
          const tmp = order[a]
          order[a] = order[b]
          order[b] = tmp
          improved = true
        }
      }
    }
  }
  return order
}
