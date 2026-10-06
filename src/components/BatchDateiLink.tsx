import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { reportError } from '../lib/monitoring'
import { BATCH_LINK_SEKUNDEN, signiereBatchDateien } from '../lib/batchFiles'

/** Vor Ablauf des signierten Links einen neuen holen. */
const ERNEUERN_MS = (BATCH_LINK_SEKUNDEN - 10 * 60) * 1000

/**
 * Link zu einer Datei im privaten Speicher `batch-files`. Der Link wird
 * signiert, solange er zu sehen ist, und vor Ablauf erneuert. Bis dahin —
 * oder wenn es die Datei nicht mehr gibt — steht der Text ohne Link da.
 */
export function BatchDateiLink({ wert, className, children }: { wert: string; className?: string; children: ReactNode }) {
  const [link, setLink] = useState<{ wert: string; url: string } | null>(null)

  useEffect(() => {
    let aktuell = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const holen = () => {
      signiereBatchDateien(supabase as never, [wert]).then(
        links => {
          if (!aktuell) return
          const url = links.get(wert)
          setLink(url ? { wert, url } : null)
          timer = setTimeout(holen, ERNEUERN_MS)
        },
        error => reportError(error, 'batch-files.sign'),
      )
    }
    holen()
    return () => {
      aktuell = false
      clearTimeout(timer)
    }
  }, [wert])

  const url = link?.wert === wert ? link.url : null
  if (!url) return <span className={className} aria-disabled="true">{children}</span>
  return (
    <a className={className} href={url} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}
