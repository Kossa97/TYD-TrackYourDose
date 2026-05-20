/* global Deno */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PubMedSearchRequest {
  query?: string
  maxResults?: number
}

interface PubMedAuthor {
  name?: string
}

interface PubMedSummary {
  uid: string
  title?: string
  fulljournalname?: string
  source?: string
  pubdate?: string
  authors?: PubMedAuthor[]
}

interface PubMedESearchResponse {
  esearchresult?: {
    idlist?: string[]
  }
}

interface PubMedESummaryResponse {
  result?: Record<string, PubMedSummary | string[]>
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getMaxResults(value: number | undefined) {
  if (!Number.isFinite(value)) return 8
  return Math.max(1, Math.min(Math.trunc(value), 20))
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = (await request.json().catch(() => ({}))) as PubMedSearchRequest
    const query = body.query?.trim()
    const maxResults = getMaxResults(body.maxResults)

    if (!query) {
      return jsonResponse({ error: 'Missing required field: query' }, 400)
    }

    const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi')
    searchUrl.searchParams.set('db', 'pubmed')
    searchUrl.searchParams.set('term', query)
    searchUrl.searchParams.set('retmode', 'json')
    searchUrl.searchParams.set('retmax', String(maxResults))
    searchUrl.searchParams.set('sort', 'relevance')

    const searchResponse = await fetch(searchUrl)
    if (!searchResponse.ok) {
      throw new Error(`PubMed search failed: ${searchResponse.status} ${searchResponse.statusText}`)
    }

    const searchData = (await searchResponse.json()) as PubMedESearchResponse
    const ids = searchData.esearchresult?.idlist ?? []

    if (ids.length === 0) {
      return jsonResponse({ query, results: [] })
    }

    const summaryUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi')
    summaryUrl.searchParams.set('db', 'pubmed')
    summaryUrl.searchParams.set('id', ids.join(','))
    summaryUrl.searchParams.set('retmode', 'json')

    const summaryResponse = await fetch(summaryUrl)
    if (!summaryResponse.ok) {
      throw new Error(`PubMed summary failed: ${summaryResponse.status} ${summaryResponse.statusText}`)
    }

    const summaryData = (await summaryResponse.json()) as PubMedESummaryResponse
    const summaries = summaryData.result ?? {}

    const results = ids.map((id) => {
      const summary = summaries[id]
      const article = typeof summary === 'object' && !Array.isArray(summary) ? summary : null

      return {
        uid: id,
        title: article?.title ?? 'Untitled PubMed article',
        source: article?.fulljournalname ?? article?.source ?? '',
        pubdate: article?.pubdate ?? '',
        authors: article?.authors?.map((author) => author.name).filter(Boolean) ?? [],
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      }
    })

    return jsonResponse({ query, results })
  } catch (error) {
    console.error('pubmed function error', error)
    const message = error instanceof Error ? error.message : 'Unexpected PubMed function error'
    return jsonResponse({ error: message }, 500)
  }
})
