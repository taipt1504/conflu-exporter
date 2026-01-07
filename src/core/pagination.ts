import { getLogger } from '../cli/ui/logger.js'

export interface PaginatedResponse<T> {
  results: T[]
  start: number
  limit: number
  size: number
  _links?: {
    next?: string
    base?: string
  }
}

export interface PaginationOptions {
  limit?: number
  maxResults?: number
}

export class PaginationHandler {
  private defaultLimit: number = 50

  constructor(private options: PaginationOptions = {}) {
    if (options.limit) {
      this.defaultLimit = Math.min(options.limit, 100) // Confluence max is 100
    }
  }

  /**
   * Fetch all pages of results
   */
  async fetchAll<T>(
    fetchPage: (start: number, limit: number) => Promise<PaginatedResponse<T>>,
  ): Promise<T[]> {
    const logger = getLogger()
    const allResults: T[] = []
    let start = 0
    let hasMore = true
    const maxResults = this.options.maxResults || Infinity

    while (hasMore && allResults.length < maxResults) {
      logger.debug(
        `Fetching page: start=${start}, limit=${this.defaultLimit}, total so far=${allResults.length}`,
      )

      const response = await fetchPage(start, this.defaultLimit)

      allResults.push(...response.results)

      // Check if there are more results
      const totalFetched = start + response.size
      hasMore = response.size === this.defaultLimit && totalFetched < maxResults

      if (hasMore) {
        start += response.size
      }

      logger.debug(
        `Page fetched: ${response.size} results, total=${allResults.length}, hasMore=${hasMore}`,
      )
    }

    // Trim to maxResults if we exceeded it
    if (allResults.length > maxResults) {
      return allResults.slice(0, maxResults)
    }

    logger.info(`Pagination complete: ${allResults.length} total results fetched`)
    return allResults
  }

  /**
   * Fetch pages with a callback for each page
   */
  async fetchAllWithCallback<T>(
    fetchPage: (start: number, limit: number) => Promise<PaginatedResponse<T>>,
    onPage: (results: T[], pageNum: number, totalSoFar: number) => void | Promise<void>,
  ): Promise<void> {
    const logger = getLogger()
    let start = 0
    let hasMore = true
    let pageNum = 0
    let totalResults = 0
    const maxResults = this.options.maxResults || Infinity

    while (hasMore && totalResults < maxResults) {
      logger.debug(`Fetching page ${pageNum + 1}: start=${start}, limit=${this.defaultLimit}`)

      const response = await fetchPage(start, this.defaultLimit)
      pageNum++
      totalResults += response.size

      await onPage(response.results, pageNum, totalResults)

      // Check if there are more results
      const totalFetched = start + response.size
      hasMore = response.size === this.defaultLimit && totalFetched < maxResults

      if (hasMore) {
        start += response.size
      }

      logger.debug(`Page ${pageNum} processed: ${response.size} results`)
    }

    logger.info(`Pagination complete: ${totalResults} total results processed`)
  }

  /**
   * Get default page limit
   */
  getDefaultLimit(): number {
    return this.defaultLimit
  }

  /**
   * Set default page limit
   */
  setDefaultLimit(limit: number): void {
    this.defaultLimit = Math.min(limit, 100)
  }
}

export function createPaginationHandler(options?: PaginationOptions): PaginationHandler {
  return new PaginationHandler(options)
}
