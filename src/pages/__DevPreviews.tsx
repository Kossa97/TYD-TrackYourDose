import { useLocation } from 'react-router-dom'
import { VialPreview } from './__VialPreview'
import { PdfPreview } from './__PdfPreview'
import { BefundPreview } from './__BefundPreview'
import { PdfThemesPreview } from './__PdfThemesPreview'

/** Nur in der Entwicklung eingebunden (App.tsx): /__vialpreview, /__pdfpreview, … */
export function DevPreviews() {
  const preview = useLocation().pathname.replace(/^\/__/, '')
  if (preview === 'vialpreview') return <VialPreview />
  if (preview === 'pdfpreview') return <PdfPreview />
  if (preview === 'befundpreview') return <BefundPreview />
  if (preview === 'pdfthemes') return <PdfThemesPreview />
  return null
}
