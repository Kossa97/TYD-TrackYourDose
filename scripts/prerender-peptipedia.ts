import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Routes } from 'react-router-dom'
import { loadEnv } from 'vite'
import { publicPeptipediaRoutes } from '../src/features/peptipedia/publicRoutes'
import { buildPeptipediaMeta, peptipediaRouteManifest } from '../src/features/peptipedia/seo'

function escape(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export async function prerenderPeptipedia({ distDir, origin }: { distDir: string; origin: string }) {
  const template = await readFile(join(distDir, 'index.html'), 'utf8')
  if (!template.includes('<div id="root"></div>')) throw new Error('Missing root marker in Vite template')
  if (!template.includes('</head>') || !/<html\b/.test(template) || !/<title>.*?<\/title>/.test(template)) throw new Error('Missing head or title in Vite template')
  const manifest = peptipediaRouteManifest()
  const urls: string[] = []
  for (const route of manifest) {
    const meta = buildPeptipediaMeta(origin, route.locale, route.slug)
    const markup = renderToString(createElement(MemoryRouter, { initialEntries: [route.path] }, createElement(Routes, null, publicPeptipediaRoutes())))
    const head = [
      `<meta data-peptipedia name="description" content="${escape(meta.description)}">`,
      `<link data-peptipedia rel="canonical" href="${escape(meta.canonical)}">`,
      ...(['de', 'en'] as const).map(locale => `<link data-peptipedia rel="alternate" hreflang="${locale}" href="${escape(meta.alternates[locale])}">`),
      ...Object.entries(meta.openGraph).map(([key, value]) => `<meta data-peptipedia property="og:${key}" content="${escape(value)}">`),
    ].join('\n')
    const html = template
      .replace(/<html\b[^>]*>/, `<html lang="${route.locale}" dir="ltr">`)
      .replace(/<title>.*?<\/title>/, `<title>${escape(meta.title)}</title>`)
      .replace(/<meta\b[^>]*name=["']description["'][^>]*>/gi, '')
      .replace('</head>', `${head}\n</head>`)
      .replace('<div id="root"></div>', `<div id="root" data-peptipedia-origin="${escape(new URL(origin).origin)}">${markup}</div>`)
    const directory = join(distDir, route.path.slice(1))
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'index.html'), html)
    urls.push(meta.canonical)
  }
  await writeFile(join(distDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${escape(url)}</loc></url>`).join('')}</urlset>`)
  await writeFile(join(distDir, 'robots.txt'), `User-agent: *\nAllow: /peptipedia\nAllow: /en/peptipedia\nSitemap: ${new URL('/sitemap.xml', origin).href}\n`)
  return urls.length
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const env = { ...loadEnv('production', process.cwd(), ''), ...process.env }
  const host = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
  const origin = env.VITE_PUBLIC_SITE_URL || (host ? `https://${host}` : env.VERCEL ? '' : 'http://localhost:4173')
  if (!origin) throw new Error('Public site origin is required on Vercel')
  const count = await prerenderPeptipedia({ distDir: resolve('dist'), origin })
  console.log(`Pre-rendered ${count} public Peptipedia pages.`)
}
