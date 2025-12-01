/**
 * Token Bucket Rate Limiter
 * Canvas API limit: ~3000 requests/hour with API token
 * This implements a conservative rate limiter to avoid hitting limits
 */

export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefill: number;

  /**
   * Create a rate limiter
   * @param maxTokens Maximum tokens in bucket (burst capacity)
   * @param refillRate Tokens added per second
   */
  constructor(maxTokens: number = 50, refillRate: number = 0.8) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate; // ~3000/hour = 0.83/second, using 0.8 for safety
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Try to acquire a token
   * @returns true if token acquired, false if rate limited
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Wait until a token is available, then acquire it
   * @param maxWait Maximum wait time in ms (default 30s)
   */
  async acquire(maxWait: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      if (this.tryAcquire()) {
        return true;
      }

      // Wait for estimated time until next token
      const waitTime = Math.min(
        (1 - this.tokens) / this.refillRate * 1000,
        1000 // Max 1 second wait between checks
      );

      await this.sleep(Math.max(100, waitTime));
    }

    return false;
  }

  /**
   * Get current token count (for debugging)
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Get time until next token in ms
   */
  getTimeUntilNextToken(): number {
    this.refill();

    if (this.tokens >= 1) {
      return 0;
    }

    return ((1 - this.tokens) / this.refillRate) * 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();
