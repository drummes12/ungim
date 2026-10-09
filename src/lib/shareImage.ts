const FREEZE_CSS =
  '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'

function collectCss(): string {
  let text = ''
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) text += rule.cssText + '\n'
    } catch {
      // hojas cross-origin no se pueden leer; las propias sí
    }
  }
  return text
}

// Los <svg> con <mask> no resuelven url(#id) dentro de foreignObject;
// se serializan como <img> con su propio documento SVG, donde sí resuelven.
function rasterizeInnerSvgs(el: HTMLElement, clone: HTMLElement) {
  const sources = Array.from(el.querySelectorAll('svg'))
  const copies = Array.from(clone.querySelectorAll('svg'))
  const serializer = new XMLSerializer()
  sources.forEach((svg, index) => {
    const copy = copies[index]
    if (!copy) return
    const rect = svg.getBoundingClientRect()
    const img = document.createElement('img')
    img.width = Math.max(1, Math.round(rect.width))
    img.height = Math.max(1, Math.round(rect.height))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      serializer.serializeToString(svg)
    )}`
    copy.replaceWith(img)
  })
}

export async function elementToPngBlob(el: HTMLElement): Promise<Blob> {
  const { width, height } = el.getBoundingClientRect()
  const scale = 3
  const clone = el.cloneNode(true) as HTMLElement
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  rasterizeInnerSvgs(el, clone)
  // XMLSerializer emite XHTML bien formado (void elements cerrados), que
  // foreignObject exige; outerHTML produce HTML y rompe el parseo.
  const markup = new XMLSerializer().serializeToString(clone)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${collectCss()}${FREEZE_CSS}</style>${markup}</div></foreignObject></svg>`
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas no disponible')
  ctx.scale(scale, scale)
  ctx.drawImage(image, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG falló'))),
      'image/png'
    )
  })
}

export async function shareOrDownloadPng(
  el: HTMLElement,
  fileName: string
): Promise<'shared' | 'downloaded' | 'copied'> {
  const blob = await elementToPngBlob(el)
  const file = new File([blob], fileName, { type: 'image/png' })
  if (
    typeof navigator.share === 'function' &&
    (!navigator.canShare || navigator.canShare({ files: [file] }))
  ) {
    await navigator.share({ files: [file] })
    return 'shared'
  }
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ])
    return 'copied'
  } catch {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
    return 'downloaded'
  }
}
