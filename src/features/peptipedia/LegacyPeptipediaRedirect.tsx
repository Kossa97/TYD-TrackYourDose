import { Navigate, useParams } from 'react-router-dom'
import { legacySlug, peptipediaDetailPath, peptipediaListPath } from './routing'

export function LegacyPeptipediaRedirect() {
  const { slug } = useParams()
  return <Navigate replace to={slug ? peptipediaDetailPath('de', legacySlug(slug)) : peptipediaListPath('de')} />
}
