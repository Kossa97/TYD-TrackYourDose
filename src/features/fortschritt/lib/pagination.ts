const DEFAULT_PAGE_SIZE = 1000

interface PageResult<T, E> {
  data: T[] | null
  error: E | null
}

export async function collectPagedRows<T, E>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T, E>>,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<PageResult<T, E>> {
  const rows: T[] = []

  for (let from = 0; ; from += pageSize) {
    const page = await loadPage(from, from + pageSize - 1)
    if (page.error) return { data: null, error: page.error }

    const pageRows = page.data ?? []
    rows.push(...pageRows)
    if (pageRows.length < pageSize) return { data: rows, error: null }
  }
}
