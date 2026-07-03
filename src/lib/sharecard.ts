// Rasterizes the live bracket SVG into a shareable PNG card.
const STYLE_PROPS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'font-size',
  'font-weight',
  'font-family',
  'font-style',
  'text-anchor',
  'letter-spacing',
  'dominant-baseline',
  'visibility',
  'display',
]

export interface CardText {
  title: string
  sub: string
  footer: string
}

export async function buildShareCard(svgEl: SVGSVGElement, text: CardText): Promise<Blob> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  // Class-driven styling won't survive standalone rasterization — inline it.
  const src = [svgEl, ...svgEl.querySelectorAll('*')]
  const dst = [clone, ...clone.querySelectorAll('*')]
  src.forEach((el, i) => {
    const cs = getComputedStyle(el as Element)
    let style = ''
    for (const p of STYLE_PROPS) style += `${p}:${cs.getPropertyValue(p)};`
    ;(dst[i] as SVGElement).setAttribute('style', style)
  })
  // External flag images taint the canvas — inline as data URIs, or drop them
  // (the abbreviation text still identifies every team).
  await Promise.all(
    [...clone.querySelectorAll('image')].map(async (img) => {
      const href = img.getAttribute('href')
      if (!href || href.startsWith('data:')) return
      try {
        const blob = await fetch(href, { mode: 'cors' }).then((r) => {
          if (!r.ok) throw new Error(String(r.status))
          return r.blob()
        })
        const uri = await new Promise<string>((res, rej) => {
          const fr = new FileReader()
          fr.onload = () => res(fr.result as string)
          fr.onerror = rej
          fr.readAsDataURL(blob)
        })
        img.setAttribute('href', uri)
      } catch {
        img.remove()
      }
    })
  )
  const SIZE = 1400
  clone.setAttribute('width', String(SIZE))
  clone.setAttribute('height', String(SIZE))
  const xml = new XMLSerializer().serializeToString(clone)
  const svgUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('SVG rasterization failed'))
      img.src = svgUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE + 220
    const ctx = canvas.getContext('2d')!
    const grad = ctx.createRadialGradient(SIZE / 2, 0, 100, SIZE / 2, 0, SIZE)
    grad.addColorStop(0, '#14213d')
    grad.addColorStop(1, '#0b1220')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#e8eefb'
    ctx.font = '800 52px system-ui, sans-serif'
    ctx.fillText(text.title, SIZE / 2, 78)
    ctx.fillStyle = '#ffd166'
    ctx.font = '600 32px system-ui, sans-serif'
    ctx.fillText(text.sub, SIZE / 2, 132)
    ctx.drawImage(img, 0, 160, SIZE, SIZE)
    ctx.fillStyle = '#8fa3c8'
    ctx.font = '400 26px system-ui, sans-serif'
    ctx.fillText(text.footer, SIZE / 2, canvas.height - 38)
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png')
    )
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

export async function shareOrDownload(blob: Blob, filename: string, shareText: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText })
      return
    } catch {
      /* user cancelled or unsupported — fall through to download */
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
