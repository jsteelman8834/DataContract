/**
 * Rate limiter for API requests
 * Implements queue-based throttling with configurable delays
 */

interface RateLimitConfig {
  minInterval: number;      // Minimum ms between requests
  maxConcurrent?: number;   // Max concurrent requests (default: 1)
  maxRetries?: number;      // Max retry attempts
  backoffBase?: number;     // Base backoff delay in ms
}

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retries: number;
}

export class RateLimiter {
  private config: Required<RateLimitConfig>;
  private queue: QueuedRequest<unknown>[] = [];
  private activeRequests = 0;
  private lastRequestTime = 0;
  private processing = false;

  constructor(config: RateLimitConfig) {
    this.config = {
      minInterval: config.minInterval,
      maxConcurrent: config.maxConcurrent ?? 1,
      maxRetries: config.maxRetries ?? 3,
      backoffBase: config.backoffBase ?? 1000,
    };
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute: fn,
        resolve: resolve as (value: unknown) => void,
        reject,
        retries: 0,
      });
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Wait if we've hit the concurrency limit
      if (this.activeRequests >= this.config.maxConcurrent) {
        await this.sleep(50);
        continue;
      }

      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < this.config.minInterval) {
        const delay = this.config.minInterval - timeSinceLastRequest;
        await this.sleep(delay);
      }

      const request = this.queue.shift();
      if (!request) break;

      this.activeRequests++;
      this.lastRequestTime = Date.now();

      // Execute without awaiting to allow concurrency
      this.executeRequest(request);
    }

    this.processing = false;
  }

  /**
   * Execute a single request with retry logic
   */
  private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      if (request.retries < this.config.maxRetries && this.isRetryable(error)) {
        // Exponential backoff
        const delay = this.config.backoffBase * Math.pow(2, request.retries);
        request.retries++;

        console.log(`Request failed, retrying in ${delay}ms (attempt ${request.retries}/${this.config.maxRetries})`);

        await this.sleep(delay);

        // Re-queue with updated retry count
        this.queue.unshift(request as QueuedRequest<unknown>);
      } else {
        request.reject(error as Error);
      }
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Retry on network errors and rate limits
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('enotfound') ||
        message.includes('429') ||
        message.includes('rate limit') ||
        message.includes('too many requests')
      );
    }
    return false;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue length
   */
  get queueLength(): number {
    return this.queue.length;
  }

  /**
   * Get active request count
   */
  get active(): number {
    return this.activeRequests;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    for (const request of this.queue) {
      request.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }
}

// Pre-configured rate limiters for each source
export const houseRateLimiter = new RateLimiter({
  minInterval: 30 * 60 * 1000, // 30 minutes between syncs
  maxConcurrent: 1,
  maxRetries: 4,
  backoffBase: 2000,
});

export const senateRateLimiter = new RateLimiter({
  minInterval: 2000, // 2 seconds between requests
  maxConcurrent: 2,
  maxRetries: 3,
  backoffBase: 1000,
});

// For individual bill fetches (more lenient)
export const billDetailRateLimiter = new RateLimiter({
  minInterval: 500, // 500ms between individual bill fetches
  maxConcurrent: 3,
  maxRetries: 3,
  backoffBase: 1000,
});

export default RateLimiter;
