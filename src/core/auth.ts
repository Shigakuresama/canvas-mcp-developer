/**
 * Canvas Authentication
 * API Token = PRIMARY (all API calls)
 * Cookies = SECONDARY (file downloads only)
 */

import { readFileSync, existsSync } from 'fs';

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface AuthResult {
  isValid: boolean;
  method: 'token' | 'cookies' | 'none';
  userId?: number;
  userName?: string;
  cookieAgeHours?: number;
  warning?: string;
}

/**
 * Load API token from environment
 */
export function getApiToken(): string | undefined {
  return process.env.CANVAS_API_TOKEN;
}

/**
 * Get authorization headers for API requests
 */
export function getAuthHeaders(): Record<string, string> {
  const token = getApiToken();
  if (!token) {
    throw new Error('CANVAS_API_TOKEN environment variable not set');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Load cookies from Netscape format file (cookies.txt)
 * Format: domain\tsubdomain\tpath\tsecure\texpires\tname\tvalue
 */
export function loadNetscapeCookies(path: string): Cookie[] {
  if (!existsSync(path)) {
    return [];
  }

  const content = readFileSync(path, 'utf-8');
  const cookies: Cookie[] = [];

  for (const line of content.split('\n')) {
    // Skip comments and empty lines
    if (line.startsWith('#') || line.trim() === '') {
      continue;
    }

    const parts = line.split('\t');
    if (parts.length >= 7) {
      cookies.push({
        domain: parts[0],
        path: parts[2],
        secure: parts[3] === 'TRUE',
        expires: parseInt(parts[4], 10),
        name: parts[5],
        value: parts[6].trim(),
      });
    }
  }

  return cookies;
}

/**
 * Load cookies from JSON format (EditThisCookie export)
 */
export function loadJsonCookies(path: string): Cookie[] {
  if (!existsSync(path)) {
    return [];
  }

  const content = readFileSync(path, 'utf-8');
  try {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      return data.map((c: any) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expirationDate,
        httpOnly: c.httpOnly,
        secure: c.secure,
      }));
    }
  } catch {
    // Invalid JSON
  }
  return [];
}

/**
 * Load cookies from file (auto-detect format)
 */
export function loadCookies(path: string): Cookie[] {
  if (!existsSync(path)) {
    return [];
  }

  // Try JSON first
  if (path.endsWith('.json')) {
    return loadJsonCookies(path);
  }

  // Check if content looks like JSON
  const content = readFileSync(path, 'utf-8').trim();
  if (content.startsWith('[') || content.startsWith('{')) {
    return loadJsonCookies(path);
  }

  // Default to Netscape format
  return loadNetscapeCookies(path);
}

/**
 * Get cookie age in hours (based on earliest expiring session cookie)
 */
export function getCookieAge(cookies: Cookie[]): number | undefined {
  const sessionCookies = cookies.filter(
    c => c.name === 'canvas_session' || c.name === '_csrf_token'
  );

  if (sessionCookies.length === 0) {
    return undefined;
  }

  // Find the cookie with earliest expiration
  const now = Date.now() / 1000;
  let minAge = Infinity;

  for (const cookie of sessionCookies) {
    if (cookie.expires && cookie.expires > 0) {
      const age = (now - (cookie.expires - 86400)) / 3600; // Estimate age assuming 24h validity
      if (age < minAge) {
        minAge = age;
      }
    }
  }

  return minAge === Infinity ? undefined : Math.max(0, minAge);
}

/**
 * Convert cookies to Cookie header string
 */
export function cookiesToHeader(cookies: Cookie[], domain: string): string {
  return cookies
    .filter(c => domain.includes(c.domain.replace(/^\./, '')))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}

/**
 * Check if cookies are valid (have required session cookies)
 */
export function hasValidCookies(cookies: Cookie[]): boolean {
  const hasSession = cookies.some(c => c.name === 'canvas_session');
  const hasCsrf = cookies.some(c => c.name === '_csrf_token');
  return hasSession && hasCsrf;
}

/**
 * CookieAuth class for file downloads
 */
export class CookieAuth {
  private cookies: Cookie[] = [];
  private cookiePath?: string;

  constructor(cookiePath?: string) {
    this.cookiePath = cookiePath || process.env.CANVAS_COOKIE_PATH;
    if (this.cookiePath) {
      this.cookies = loadCookies(this.cookiePath);
    }
  }

  isAvailable(): boolean {
    return hasValidCookies(this.cookies);
  }

  getCookieHeader(domain: string): string {
    return cookiesToHeader(this.cookies, domain);
  }

  getAge(): number | undefined {
    return getCookieAge(this.cookies);
  }

  getWarning(): string | undefined {
    if (!this.isAvailable()) {
      return 'Cookies not available. File downloads will fail. Export cookies from browser.';
    }

    const age = this.getAge();
    if (age !== undefined && age > 16) {
      return `Cookies are ${Math.round(age)} hours old. They may expire soon. Consider refreshing.`;
    }

    return undefined;
  }
}
