import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { prerenderPeptipedia } from './prerender-peptipedia'

let directory: string
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }) })
it('writes localized searchable HTML and sitemap without a database', async () => {
  directory = await mkdtemp(join(tmpdir(), 'peptipedia-test-'))
  await writeFile(join(directory, 'index.html'), '<!doctype html><html lang="de"><head><title>App</title><meta name="description" content="Old"></head><body><div id="root"></div></body></html>')
  await prerenderPeptipedia({ distDir: directory, origin: 'https://example.test' })
  const html = await readFile(join(directory, 'peptipedia/bpc-157/index.html'), 'utf8')
  expect(html).toContain('BPC-157')
  expect(html).toContain('Sicherheit')
  expect(html).toContain('Tierstudie')
  expect(html).toContain('rel="canonical" href="https://example.test/peptipedia/bpc-157"')
  expect(html).toContain('hreflang="en"')
  expect(html).not.toContain('content="Old"')
  const english = await readFile(join(directory, 'en/peptipedia/bpc-157/index.html'), 'utf8')
  expect(english).toContain('lang="en"')
  expect(english).toContain('Study protocols')
  const sitemap = await readFile(join(directory, 'sitemap.xml'), 'utf8')
  expect(sitemap.match(/<loc>/g)).toHaveLength(134)
  const blend = await readFile(join(directory, 'en/peptipedia/glow/index.html'), 'utf8')
  expect(blend).toContain('GHK-Cu')
  expect(blend).toContain('href="/en/peptipedia/ghk-cu"')
  expect(await readFile(join(directory, 'robots.txt'), 'utf8')).toContain('https://example.test/sitemap.xml')
})
it('fails on a template without its root marker', async () => {
  directory = await mkdtemp(join(tmpdir(), 'peptipedia-test-'))
  await writeFile(join(directory, 'index.html'), '<html><head></head><body></body></html>')
  await expect(prerenderPeptipedia({ distDir: directory, origin: 'https://example.test' })).rejects.toThrow('root')
})
