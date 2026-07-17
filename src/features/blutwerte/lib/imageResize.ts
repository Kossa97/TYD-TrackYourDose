/** Längste Kante für die Vision-API — darüber bringt mehr Auflösung keinen Erkennungsgewinn. */
export const MAX_EDGE = 1568

export interface Size {
  width: number
  height: number
}

/** Skaliert proportional auf MAX_EDGE herunter; kleinere Bilder bleiben unverändert. */
export function targetSize(width: number, height: number): Size {
  const longest = Math.max(width, height)
  if (longest <= MAX_EDGE) return { width, height }
  const factor = MAX_EDGE / longest
  return { width: Math.round(width * factor), height: Math.round(height * factor) }
}

export interface PreparedFile {
  /** Base64 ohne data:-Präfix. */
  base64: string
  mimeType: string
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'))
    reader.readAsDataURL(file)
  })

const stripPrefix = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1)

const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
    img.src = dataUrl
  })

/**
 * PDFs unverändert, Bilder auf MAX_EDGE verkleinert und als JPEG kodiert
 * (spart Tokens und Upload-Zeit).
 */
export async function prepareFile(file: File): Promise<PreparedFile> {
  const dataUrl = await readAsDataUrl(file)

  if (file.type === 'application/pdf') {
    return { base64: stripPrefix(dataUrl), mimeType: 'application/pdf' }
  }

  const img = await loadImage(dataUrl)
  const size = targetSize(img.naturalWidth, img.naturalHeight)

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Bild konnte nicht verarbeitet werden')
  ctx.drawImage(img, 0, 0, size.width, size.height)

  return { base64: stripPrefix(canvas.toDataURL('image/jpeg', 0.9)), mimeType: 'image/jpeg' }
}
