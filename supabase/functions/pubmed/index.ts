/* global Deno */

type PubMedArticle = {
  uid: string;
  id: string;
  title: string;
  authors: string[];
  journal: string;
  source: string;
  pubdate: string;
  abstract: string;
  link: string;
  url: string;
  pubmedUrl: string;
};

type PubMedSearchRequest = {
  query?: string;
  maxResults?: number;
};

type ESearchResponse = {
  esearchresult?: {
    idlist?: string[];
  };
};

type ESummaryArticle = {
  uid?: string;
  title?: string;
  authors?: Array<{ name?: string }>;
  fulljournalname?: string;
  source?: string;
  pubdate?: string;
};

type ESummaryResult = {
  uids?: string[];
} & Record<string, ESummaryArticle | string[] | undefined>;

type ESummaryResponse = {
  result?: ESummaryResult;
};

const EUTILS_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const PUBMED_ARTICLE_BASE_URL = "https://pubmed.ncbi.nlm.nih.gov";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as PubMedSearchRequest;
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const maxResults = getMaxResults(body.maxResults);

    if (!query) {
      return jsonResponse({ error: "A non-empty query string is required" }, 400);
    }

    const ids = await searchPubMedIds(query, maxResults);

    if (ids.length === 0) {
      return jsonResponse({ query, results: [] });
    }

    const [summaries, abstracts] = await Promise.all([
      fetchPubMedSummaries(ids),
      fetchPubMedAbstracts(ids),
    ]);

    const articles = ids.map((uid) => {
      const summary = summaries.get(uid);
      const journal = summary?.fulljournalname ?? summary?.source ?? "";
      const pubmedUrl = `${PUBMED_ARTICLE_BASE_URL}/${uid}/`;

      return {
        uid,
        id: uid,
        title: summary?.title ?? "",
        authors: extractAuthorNames(summary),
        journal,
        source: journal,
        pubdate: summary?.pubdate ?? "",
        abstract: abstracts.get(uid) ?? "",
        link: pubmedUrl,
        url: pubmedUrl,
        pubmedUrl,
      } satisfies PubMedArticle;
    });

    return jsonResponse({ query, results: articles });
  } catch (error) {
    console.error("PubMed function error:", error);

    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    );
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getMaxResults(value: number | undefined): number {
  if (!Number.isFinite(value)) return 8;
  return Math.max(1, Math.min(Math.trunc(value), 20));
}

async function searchPubMedIds(query: string, maxResults: number): Promise<string[]> {
  const url = buildEutilsUrl("esearch.fcgi", {
    db: "pubmed",
    term: query,
    retmax: String(maxResults),
    retmode: "json",
    sort: "relevance",
  });

  const data = await fetchJson<ESearchResponse>(url);

  return data.esearchresult?.idlist ?? [];
}

async function fetchPubMedSummaries(
  ids: string[],
): Promise<Map<string, ESummaryArticle>> {
  const url = buildEutilsUrl("esummary.fcgi", {
    db: "pubmed",
    id: ids.join(","),
    retmode: "json",
  });

  const data = await fetchJson<ESummaryResponse>(url);
  const summaries = new Map<string, ESummaryArticle>();

  for (const id of ids) {
    const summary = data.result?.[id];

    if (summary && !Array.isArray(summary)) {
      summaries.set(id, summary);
    }
  }

  return summaries;
}

async function fetchPubMedAbstracts(ids: string[]): Promise<Map<string, string>> {
  const url = buildEutilsUrl("efetch.fcgi", {
    db: "pubmed",
    id: ids.join(","),
    retmode: "xml",
  });

  const response = await fetch(url, {
    headers: { Accept: "application/xml" },
  });

  if (!response.ok) {
    throw new Error(
      `PubMed efetch request failed with status ${response.status}`,
    );
  }

  const xml = await response.text();
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const abstracts = new Map<string, string>();

  for (const article of document.querySelectorAll("PubmedArticle")) {
    const uid = article.querySelector("PMID")?.textContent?.trim();

    if (!uid) {
      continue;
    }

    const abstractParts = Array.from(article.querySelectorAll("AbstractText"))
      .map((node) => {
        const text = node.textContent?.replace(/\s+/g, " ").trim();

        if (!text) {
          return "";
        }

        const label = node.getAttribute("Label")?.trim();

        return label ? `${label}: ${text}` : text;
      })
      .filter(Boolean);

    abstracts.set(uid, abstractParts.join("\n\n"));
  }

  return abstracts;
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`PubMed request failed with status ${response.status}`);
  }

  return await response.json() as T;
}

function buildEutilsUrl(path: string, params: Record<string, string>): URL {
  const url = new URL(`${EUTILS_BASE_URL}/${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const apiKey = Deno.env.get("NCBI_API_KEY");

  if (apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  return url;
}

function extractAuthorNames(summary?: ESummaryArticle): string[] {
  return summary?.authors
    ?.map((author) => author.name?.trim() ?? "")
    .filter(Boolean) ?? [];
}
