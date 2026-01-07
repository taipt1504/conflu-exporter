import { ConfluenceApiClient } from './api-client.js'
import { PaginationHandler, PaginatedResponse } from './pagination.js'
import { RateLimiter } from './rate-limiter.js'
import { ConfluencePage } from '../types.js'
import { getLogger } from '../cli/ui/logger.js'
import { NotFoundError } from '../errors/index.js'

/**
 * CRITICAL: Expand parameters to fetch BOTH storage and view formats
 * - body.storage: Contains macro source code (XML/XHTML)
 * - body.view: Contains rendered HTML
 * - body.export_view: HTML optimized for export (for PDF)
 * - version: For change detection and sync
 * - metadata.labels: Tags and categorization
 * - metadata.properties: Custom properties
 * - space: Space information
 * - ancestors: Parent pages for hierarchy
 */
const DEFAULT_EXPAND =
  'body.storage,body.view,body.export_view,version,metadata.labels,metadata.properties,space,ancestors'

export interface ContentFetcherOptions {
  apiClient: ConfluenceApiClient
  rateLimiter?: RateLimiter
  paginationHandler?: PaginationHandler
}

export interface ConfluenceApiPage {
  id: string
  type: string
  status: string
  title: string
  space: {
    key: string
    name: string
  }
  body?: {
    storage?: {
      value: string
      representation: string
    }
    view?: {
      value: string
      representation: string
    }
    export_view?: {
      value: string
      representation: string
    }
  }
  version?: {
    number: number
    when: string
    by: {
      email: string
      displayName: string
    }
  }
  metadata?: {
    labels?: {
      results: Array<{
        name: string
      }>
    }
    properties?: {
      results: any[]
    }
  }
  ancestors?: Array<{
    id: string
    title: string
  }>
  _links?: {
    webui?: string
    self?: string
  }
}

export class ContentFetcher {
  private apiClient: ConfluenceApiClient
  private rateLimiter: RateLimiter
  private paginationHandler: PaginationHandler

  constructor(options: ContentFetcherOptions) {
    this.apiClient = options.apiClient
    this.rateLimiter = options.rateLimiter || new RateLimiter({ concurrency: 5 })
    this.paginationHandler = options.paginationHandler || new PaginationHandler({ limit: 50 })
  }

  /**
   * Fetch a single page by ID with full content (storage + view)
   */
  async fetchPage(pageId: string): Promise<ConfluencePage> {
    const logger = getLogger()
    logger.info(`Fetching page ${pageId}...`)

    const response = await this.rateLimiter.execute(() =>
      this.apiClient.get<ConfluenceApiPage>(`/content/${pageId}`, {
        params: {
          expand: DEFAULT_EXPAND,
        },
      }),
    )

    return this.transformPage(response)
  }

  /**
   * Fetch all pages in a space
   */
  async fetchSpace(spaceKey: string): Promise<ConfluencePage[]> {
    const logger = getLogger()
    logger.info(`Fetching all pages from space ${spaceKey}...`)

    const fetchPageFn = async (
      start: number,
      limit: number,
    ): Promise<PaginatedResponse<ConfluenceApiPage>> => {
      return this.rateLimiter.execute(() =>
        this.apiClient.get<PaginatedResponse<ConfluenceApiPage>>(
          `/space/${spaceKey}/content/page`,
          {
            params: {
              start,
              limit,
              expand: DEFAULT_EXPAND,
            },
          },
        ),
      )
    }

    const apiPages = await this.paginationHandler.fetchAll(fetchPageFn)
    return apiPages.map((page) => this.transformPage(page))
  }

  /**
   * Fetch child pages of a parent page
   */
  async fetchPageChildren(pageId: string): Promise<ConfluencePage[]> {
    const logger = getLogger()
    logger.info(`Fetching children of page ${pageId}...`)

    const fetchPageFn = async (
      start: number,
      limit: number,
    ): Promise<PaginatedResponse<ConfluenceApiPage>> => {
      return this.rateLimiter.execute(() =>
        this.apiClient.get<PaginatedResponse<ConfluenceApiPage>>(
          `/content/${pageId}/child/page`,
          {
            params: {
              start,
              limit,
              expand: DEFAULT_EXPAND,
            },
          },
        ),
      )
    }

    const apiPages = await this.paginationHandler.fetchAll(fetchPageFn)
    return apiPages.map((page) => this.transformPage(page))
  }

  /**
   * Fetch pages recursively (parent + all descendants)
   */
  async fetchPageHierarchy(pageId: string): Promise<ConfluencePage[]> {
    const logger = getLogger()
    const allPages: ConfluencePage[] = []
    const visited = new Set<string>()

    const fetchRecursive = async (id: string): Promise<void> => {
      if (visited.has(id)) return
      visited.add(id)

      // Fetch the page itself
      const page = await this.fetchPage(id)
      allPages.push(page)

      // Fetch and process children
      const children = await this.fetchPageChildren(id)
      for (const child of children) {
        await fetchRecursive(child.id)
      }
    }

    await fetchRecursive(pageId)

    logger.info(`Fetched page hierarchy: ${allPages.length} pages total`)
    return allPages
  }

  /**
   * Search pages using CQL (Confluence Query Language)
   */
  async searchPages(cql: string, limit?: number): Promise<ConfluencePage[]> {
    const logger = getLogger()
    logger.info(`Searching pages with CQL: ${cql}`)

    const paginationHandler = new PaginationHandler({ limit: limit || 50 })

    const fetchPageFn = async (
      start: number,
      pageLimit: number,
    ): Promise<PaginatedResponse<ConfluenceApiPage>> => {
      return this.rateLimiter.execute(() =>
        this.apiClient.get<PaginatedResponse<ConfluenceApiPage>>('/content/search', {
          params: {
            cql,
            start,
            limit: pageLimit,
            expand: DEFAULT_EXPAND,
          },
        }),
      )
    }

    const apiPages = await paginationHandler.fetchAll(fetchPageFn)
    return apiPages.map((page) => this.transformPage(page))
  }

  /**
   * Transform Confluence API response to our ConfluencePage format
   * CRITICAL: Preserves BOTH storage and view formats for macro extraction
   */
  private transformPage(apiPage: ConfluenceApiPage): ConfluencePage {
    if (!apiPage.body?.storage || !apiPage.body?.view) {
      throw new NotFoundError(
        'Page body not found. Both storage and view formats are required.',
        {
          pageId: apiPage.id,
          hasStorage: !!apiPage.body?.storage,
          hasView: !!apiPage.body?.view,
        },
      )
    }

    const baseUrl = this.apiClient.getBaseUrl()
    const pageUrl = apiPage._links?.webui
      ? `${baseUrl}/wiki${apiPage._links.webui}`
      : `${baseUrl}/wiki/spaces/${apiPage.space.key}/pages/${apiPage.id}`

    return {
      id: apiPage.id,
      title: apiPage.title,
      content: {
        storage: apiPage.body.storage.value,
        view: apiPage.body.view.value,
        exportView: apiPage.body.export_view?.value,
      },
      spaceKey: apiPage.space.key,
      version: apiPage.version?.number,
      metadata: {
        labels: apiPage.metadata?.labels?.results?.map((label) => label.name) || [],
        createdBy: apiPage.version?.by?.email,
        createdAt: apiPage.version?.when ? new Date(apiPage.version.when) : undefined,
        updatedAt: apiPage.version?.when ? new Date(apiPage.version.when) : undefined,
        url: pageUrl,
        parentId: apiPage.ancestors?.[apiPage.ancestors.length - 1]?.id,
        properties: apiPage.metadata?.properties?.results || [],
      },
      // Legacy fields for backward compatibility
      createdAt: apiPage.version?.when ? new Date(apiPage.version.when) : undefined,
      updatedAt: apiPage.version?.when ? new Date(apiPage.version.when) : undefined,
    }
  }

  /**
   * Get API client instance
   */
  getApiClient(): ConfluenceApiClient {
    return this.apiClient
  }

  /**
   * Get rate limiter instance
   */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter
  }
}

export function createContentFetcher(options: ContentFetcherOptions): ContentFetcher {
  return new ContentFetcher(options)
}
