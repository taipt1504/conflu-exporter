import pLimit from 'p-limit'

export interface RateLimiterOptions {
  concurrency?: number
}

export class RateLimiter {
  private limit: ReturnType<typeof pLimit>
  private concurrency: number

  constructor(options: RateLimiterOptions = {}) {
    this.concurrency = options.concurrency || 5
    this.limit = pLimit(this.concurrency)
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.limit(fn)
  }

  /**
   * Execute multiple functions with rate limiting
   */
  async executeAll<T>(fns: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(fns.map((fn) => this.limit(fn)))
  }

  /**
   * Get current concurrency limit
   */
  getConcurrency(): number {
    return this.concurrency
  }

  /**
   * Update concurrency limit
   */
  setConcurrency(concurrency: number): void {
    this.concurrency = concurrency
    this.limit = pLimit(concurrency)
  }

  /**
   * Get number of pending operations
   */
  getPendingCount(): number {
    return this.limit.pendingCount
  }

  /**
   * Get number of active operations
   */
  getActiveCount(): number {
    return this.limit.activeCount
  }

  /**
   * Clear all pending operations
   */
  clearQueue(): void {
    this.limit.clearQueue()
  }
}

export function createRateLimiter(options?: RateLimiterOptions): RateLimiter {
  return new RateLimiter(options)
}
