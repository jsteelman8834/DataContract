/**
 * PDF Text Extractor
 *
 * Extracts and processes text from bill PDFs
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { syncLogger as logger } from '../utils/logger';

// PDF cache directory
const PDF_CACHE_DIR = path.resolve(__dirname, '../../cache/pdf');

interface ExtractedPdf {
  url: string;
  text: string;
  textHash: string;
  pageCount: number;
  extractedAt: string;
  tokenCount?: number;
}

interface PdfCache {
  entries: Record<string, ExtractedPdf>;
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(PDF_CACHE_DIR)) {
    fs.mkdirSync(PDF_CACHE_DIR, { recursive: true });
  }
}

/**
 * Get cache file path for a URL
 */
function getCachePath(url: string): string {
  const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
  return path.join(PDF_CACHE_DIR, `${hash}.json`);
}

/**
 * Check if PDF is cached
 */
export function isCached(url: string): boolean {
  return fs.existsSync(getCachePath(url));
}

/**
 * Get cached PDF text
 */
export function getCachedPdf(url: string): ExtractedPdf | null {
  const cachePath = getCachePath(url);

  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(cachePath, 'utf-8');
    return JSON.parse(data) as ExtractedPdf;
  } catch (error) {
    return null;
  }
}

/**
 * Cache extracted PDF
 */
function cachePdf(extracted: ExtractedPdf): void {
  ensureCacheDir();
  const cachePath = getCachePath(extracted.url);
  fs.writeFileSync(cachePath, JSON.stringify(extracted, null, 2));
}

/**
 * Download PDF and extract text
 */
export async function extractPdfText(url: string): Promise<ExtractedPdf> {
  // Check cache first
  const cached = getCachedPdf(url);
  if (cached) {
    logger.info(`Using cached PDF text for ${url}`);
    return cached;
  }

  logger.info(`Extracting PDF from ${url}`);

  try {
    // Download PDF
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();

    // Import pdf-parse dynamically
    let pdfParse: typeof import('pdf-parse');
    try {
      pdfParse = await import('pdf-parse');
    } catch {
      throw new Error('pdf-parse module not available');
    }

    // Extract text
    const data = await pdfParse.default(Buffer.from(buffer));

    const text = data.text;
    const textHash = crypto.createHash('sha256').update(text).digest('hex');

    const extracted: ExtractedPdf = {
      url,
      text,
      textHash,
      pageCount: data.numpages,
      extractedAt: new Date().toISOString(),
    };

    // Cache the result
    cachePdf(extracted);

    logger.info(`Extracted ${data.numpages} pages from PDF`, {
      url,
      textLength: text.length,
    });

    return extracted;
  } catch (error) {
    logger.error('PDF extraction failed', {
      url,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Extract text from local PDF buffer
 */
export async function extractPdfFromBuffer(
  buffer: Buffer,
  sourceUrl?: string
): Promise<ExtractedPdf> {
  try {
    let pdfParse: typeof import('pdf-parse');
    try {
      pdfParse = await import('pdf-parse');
    } catch {
      throw new Error('pdf-parse module not available');
    }

    const data = await pdfParse.default(buffer);

    const text = data.text;
    const textHash = crypto.createHash('sha256').update(text).digest('hex');

    return {
      url: sourceUrl || 'buffer',
      text,
      textHash,
      pageCount: data.numpages,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('PDF buffer extraction failed', {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Clean text from PDF artifacts
 */
export function cleanPdfText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove page numbers
    .replace(/\n\d+\n/g, '\n')
    // Remove form feed characters
    .replace(/\f/g, '\n\n')
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Clear PDF cache
 */
export function clearCache(): number {
  ensureCacheDir();

  const files = fs.readdirSync(PDF_CACHE_DIR);
  let removed = 0;

  for (const file of files) {
    if (file.endsWith('.json')) {
      fs.unlinkSync(path.join(PDF_CACHE_DIR, file));
      removed++;
    }
  }

  logger.info(`Cleared ${removed} cached PDFs`);
  return removed;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  cachedCount: number;
  totalSize: number;
  oldestCache: string | null;
} {
  ensureCacheDir();

  const files = fs.readdirSync(PDF_CACHE_DIR).filter(f => f.endsWith('.json'));
  let totalSize = 0;
  let oldestTime: number | null = null;
  let oldestFile: string | null = null;

  for (const file of files) {
    const filePath = path.join(PDF_CACHE_DIR, file);
    const stats = fs.statSync(filePath);
    totalSize += stats.size;

    if (oldestTime === null || stats.mtimeMs < oldestTime) {
      oldestTime = stats.mtimeMs;
      oldestFile = filePath;
    }
  }

  return {
    cachedCount: files.length,
    totalSize,
    oldestCache: oldestFile
      ? new Date(fs.statSync(oldestFile).mtime).toISOString()
      : null,
  };
}

export default {
  extractPdfText,
  extractPdfFromBuffer,
  cleanPdfText,
  isCached,
  getCachedPdf,
  clearCache,
  getCacheStats,
};
