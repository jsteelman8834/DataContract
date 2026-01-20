/**
 * ETag Cache
 *
 * Caches HTTP ETag/Last-Modified headers for efficient differential syncing
 */

import * as fs from 'fs';
import * as path from 'path';
import { syncLogger as logger } from '../utils/logger';

const ETAG_CACHE_PATH = path.resolve(__dirname, '../../db/etag-cache.json');

interface CacheEntry {
  url: string;
  etag?: string;
  lastModified?: string;
  contentHash?: string;
  lastChecked: string;
  hitCount: number;
}

interface ETagCache {
  entries: Record<string, CacheEntry>;
  lastCleanup: string;
}

/**
 * Ensure cache file exists
 */
function ensureCache(): void {
  const dir = path.dirname(ETAG_CACHE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(ETAG_CACHE_PATH)) {
    const emptyCache: ETagCache = {
      entries: {},
      lastCleanup: new Date().toISOString(),
    };
    fs.writeFileSync(ETAG_CACHE_PATH, JSON.stringify(emptyCache, null, 2));
  }
}

/**
 * Read cache
 */
function readCache(): ETagCache {
  ensureCache();
  try {
    const data = fs.readFileSync(ETAG_CACHE_PATH, 'utf-8');
    return JSON.parse(data) as ETagCache;
  } catch (error) {
    return { entries: {}, lastCleanup: new Date().toISOString() };
  }
}

/**
 * Write cache
 */
function writeCache(cache: ETagCache): void {
  ensureCache();
  fs.writeFileSync(ETAG_CACHE_PATH, JSON.stringify(cache, null, 2));
}

/**
 * Generate cache key from URL
 */
function getCacheKey(url: string): string {
  return url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100);
}

/**
 * Get cached headers for a URL
 */
export function getCachedHeaders(url: string): { etag?: string; lastModified?: string } | null {
  const cache = readCache();
  const key = getCacheKey(url);
  const entry = cache.entries[key];

  if (!entry) return null;

  return {
    etag: entry.etag,
    lastModified: entry.lastModified,
  };
}

/**
 * Update cache entry
 */
export function updateCache(
  url: string,
  headers: { etag?: string; lastModified?: string; contentHash?: string }
): void {
  const cache = readCache();
  const key = getCacheKey(url);

  const existing = cache.entries[key];

  cache.entries[key] = {
    url,
    etag: headers.etag || existing?.etag,
    lastModified: headers.lastModified || existing?.lastModified,
    contentHash: headers.contentHash || existing?.contentHash,
    lastChecked: new Date().toISOString(),
    hitCount: (existing?.hitCount || 0) + 1,
  };

  writeCache(cache);
}

/**
 * Check if content has changed using conditional request
 */
export async function hasContentChanged(url: string): Promise<{
  changed: boolean;
  newHeaders?: { etag?: string; lastModified?: string };
}> {
  const cached = getCachedHeaders(url);

  if (!cached) {
    return { changed: true };
  }

  const headers: Record<string, string> = {};

  if (cached.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  if (cached.lastModified) {
    headers['If-Modified-Since'] = cached.lastModified;
  }

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers,
    });

    if (response.status === 304) {
      // Not modified
      logger.info(`Cache hit for ${url}`);
      return { changed: false };
    }

    // Content has changed
    const newHeaders = {
      etag: response.headers.get('ETag') || undefined,
      lastModified: response.headers.get('Last-Modified') || undefined,
    };

    return { changed: true, newHeaders };
  } catch (error) {
    logger.warn(`Failed to check content change for ${url}`, {
      error: (error as Error).message,
    });
    // Assume changed on error
    return { changed: true };
  }
}

/**
 * Fetch with ETag caching
 */
export async function fetchWithCache(url: string): Promise<{
  data: string | null;
  fromCache: boolean;
}> {
  const cached = getCachedHeaders(url);

  const headers: Record<string, string> = {};

  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  if (cached?.lastModified) {
    headers['If-Modified-Since'] = cached.lastModified;
  }

  try {
    const response = await fetch(url, { headers });

    if (response.status === 304) {
      logger.info(`Using cached content for ${url}`);
      return { data: null, fromCache: true };
    }

    const data = await response.text();

    // Update cache with new headers
    updateCache(url, {
      etag: response.headers.get('ETag') || undefined,
      lastModified: response.headers.get('Last-Modified') || undefined,
    });

    return { data, fromCache: false };
  } catch (error) {
    logger.error(`Failed to fetch ${url}`, { error: (error as Error).message });
    throw error;
  }
}

/**
 * Clear old cache entries
 */
export function cleanupCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): number {
  const cache = readCache();
  const now = Date.now();
  let removed = 0;

  for (const [key, entry] of Object.entries(cache.entries)) {
    const lastChecked = new Date(entry.lastChecked).getTime();
    if (now - lastChecked > maxAge) {
      delete cache.entries[key];
      removed++;
    }
  }

  cache.lastCleanup = new Date().toISOString();
  writeCache(cache);

  if (removed > 0) {
    logger.info(`Cleaned up ${removed} stale cache entries`);
  }

  return removed;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalEntries: number;
  totalHits: number;
  oldestEntry: string | null;
} {
  const cache = readCache();
  const entries = Object.values(cache.entries);

  return {
    totalEntries: entries.length,
    totalHits: entries.reduce((sum, e) => sum + e.hitCount, 0),
    oldestEntry: entries.length > 0
      ? entries.reduce((oldest, e) =>
          new Date(e.lastChecked) < new Date(oldest.lastChecked) ? e : oldest
        ).lastChecked
      : null,
  };
}

export default {
  getCachedHeaders,
  updateCache,
  hasContentChanged,
  fetchWithCache,
  cleanupCache,
  getCacheStats,
};
