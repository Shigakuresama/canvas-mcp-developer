/**
 * Canvas API Pagination Helper
 * Canvas uses Link headers for pagination
 * Format: <url>; rel="current", <url>; rel="next", <url>; rel="prev", <url>; rel="first", <url>; rel="last"
 */

export interface PaginationLinks {
  current?: string;
  next?: string;
  prev?: string;
  first?: string;
  last?: string;
}

/**
 * Parse Link header into pagination URLs
 */
export function parseLinkHeader(linkHeader: string | null): PaginationLinks {
  if (!linkHeader) {
    return {};
  }

  const links: PaginationLinks = {};
  const parts = linkHeader.split(',');

  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      const [, url, rel] = match;
      switch (rel) {
        case 'current':
          links.current = url;
          break;
        case 'next':
          links.next = url;
          break;
        case 'prev':
          links.prev = url;
          break;
        case 'first':
          links.first = url;
          break;
        case 'last':
          links.last = url;
          break;
      }
    }
  }

  return links;
}

/**
 * Check if there are more pages
 */
export function hasNextPage(linkHeader: string | null): boolean {
  const links = parseLinkHeader(linkHeader);
  return !!links.next;
}

/**
 * Get the next page URL
 */
export function getNextPageUrl(linkHeader: string | null): string | undefined {
  const links = parseLinkHeader(linkHeader);
  return links.next;
}

/**
 * Build URL with pagination params
 */
export function buildPaginatedUrl(
  baseUrl: string,
  page: number = 1,
  perPage: number = 100
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('page', page.toString());
  url.searchParams.set('per_page', perPage.toString());
  return url.toString();
}

/**
 * Extract page number from URL
 */
export function getPageFromUrl(url: string): number {
  try {
    const urlObj = new URL(url);
    const page = urlObj.searchParams.get('page');
    return page ? parseInt(page, 10) : 1;
  } catch {
    return 1;
  }
}
