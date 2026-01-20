/**
 * Bill Text Extraction Sync
 *
 * Extracts and stores PDF text for bill versions in the graph database
 */

import { readDatabase, writeDatabase, upsertNode } from './database/graph-writer';
import { extractPdfText, cleanPdfText } from './pdf/extractor';
import { chunkText, estimateTokens } from './pdf/chunker';
import { parseBillText } from './pdf/section-parser';
import { syncLogger as logger } from './utils/logger';

interface ExtractionStats {
  total: number;
  extracted: number;
  skipped: number;
  failed: number;
}

/**
 * Extract text for all bill versions that don't have extractedText
 */
export async function syncBillText(options: {
  forceRefresh?: boolean;
  billIds?: string[];
  maxBills?: number;
} = {}): Promise<ExtractionStats> {
  const stats: ExtractionStats = { total: 0, extracted: 0, skipped: 0, failed: 0 };

  logger.info('Starting bill text extraction sync', options);

  const db = await readDatabase();

  // Get all bill versions
  const versions = Object.entries(db.nodes.bill_versions || {});
  stats.total = versions.length;

  let processed = 0;
  const maxBills = options.maxBills || versions.length;

  for (const [versionId, version] of versions) {
    if (processed >= maxBills) break;

    const v = version as Record<string, unknown>;

    // Filter by billIds if specified
    if (options.billIds?.length) {
      if (!options.billIds.includes(v.billId as string)) {
        continue;
      }
    }

    // Skip if already has text (unless forceRefresh)
    if (v.extractedText && !options.forceRefresh) {
      stats.skipped++;
      continue;
    }

    // Need a PDF URL
    if (!v.pdfUrl) {
      stats.skipped++;
      continue;
    }

    processed++;

    try {
      logger.info(`Extracting text for ${versionId}`, { pdfUrl: v.pdfUrl });

      // Extract PDF text
      const extracted = await extractPdfText(v.pdfUrl as string);
      const cleanedText = cleanPdfText(extracted.text);

      // Chunk the text
      const chunks = chunkText(cleanedText, versionId, { maxTokens: 4000 });

      // Parse bill structure
      const billId = v.billId as string;
      const bill = db.nodes.bills[billId] as Record<string, unknown> | undefined;
      const parsed = parseBillText(cleanedText, billId);

      // Update the version node
      upsertNode(db, 'bill_versions', versionId, {
        ...v,
        extractedText: cleanedText,
        textHash: extracted.textHash,
        tokenCount: estimateTokens(cleanedText),
        chunks: chunks,
        parsedStructure: {
          title: parsed.title,
          sectionCount: parsed.sections.length,
          definitionCount: parsed.definitions.length,
          rsmoReferences: parsed.rsmoReferences,
          effectiveDate: parsed.effectiveDate,
        },
      });

      stats.extracted++;
      logger.info(`Extracted ${versionId}`, {
        textLength: cleanedText.length,
        tokenCount: estimateTokens(cleanedText),
        chunks: chunks.length,
      });

      // Rate limit: wait between extractions
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      stats.failed++;
      logger.error(`Failed to extract ${versionId}`, {
        error: (error as Error).message,
        pdfUrl: v.pdfUrl,
      });
    }
  }

  // Save database
  await writeDatabase(db);

  logger.info('Bill text extraction complete', stats);
  return stats;
}

/**
 * Extract text for a specific bill
 */
export async function extractBillText(billId: string): Promise<boolean> {
  const result = await syncBillText({ billIds: [billId] });
  return result.extracted > 0;
}

/**
 * Get extraction status
 */
export async function getExtractionStatus(): Promise<{
  total: number;
  withText: number;
  withoutText: number;
  percentage: number;
}> {
  const db = await readDatabase();
  const versions = Object.values(db.nodes.bill_versions || {});

  const withText = versions.filter(v => (v as Record<string, unknown>).extractedText).length;

  return {
    total: versions.length,
    withText,
    withoutText: versions.length - withText,
    percentage: versions.length > 0 ? Math.round((withText / versions.length) * 100) : 0,
  };
}

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'status') {
    getExtractionStatus().then(status => {
      console.log('Bill Text Extraction Status:');
      console.log(`  Total versions: ${status.total}`);
      console.log(`  With text: ${status.withText} (${status.percentage}%)`);
      console.log(`  Without text: ${status.withoutText}`);
    });
  } else {
    const maxBills = args[0] ? parseInt(args[0], 10) : undefined;
    syncBillText({ maxBills }).then(stats => {
      console.log('Extraction complete:', stats);
    });
  }
}

export default {
  syncBillText,
  extractBillText,
  getExtractionStatus,
};
