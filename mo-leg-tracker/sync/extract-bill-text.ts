/**
 * Extract PDF text for watch list bills
 * Downloads bill PDFs and extracts text for chatbot context
 *
 * Run with: npx ts-node extract-bill-text.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// We'll use pdf-parse for text extraction
// Install with: npm install pdf-parse
import pdf from 'pdf-parse';

const GRAPH_PATH = path.join(__dirname, '../webapp/db/graph.json');

// Watch statuses - bills worth extracting text for
const WATCH_STATUSES = [
  'hearing_scheduled',
  'hearing_held',
  'committee_substitute',
  'reported_do_pass',
  'placed_on_calendar',
  'perfected',
  'third_read',
  'passed_origin',
  'passed_chamber',
  'received_other',
  'referred_other',
  'passed_other',
  'passed_second_chamber',
  'conference',
  'truly_agreed',
  'signed',
  'enacted',
];

// Also include bills in committee - the bulk of active legislation
const ACTIVE_STATUSES = [
  'in_committee',
  'referred',
];

interface GraphDatabase {
  nodes: {
    bills: Record<string, {
      id: string;
      billNumber: string;
      billPrefix: string;
      billSuffix: number;
      chamber: string;
      lrNumber: string;
      currentStatus: string;
      title: string;
    }>;
    bill_versions: Record<string, {
      id: string;
      billId: string;
      lrNumber: string;
      versionType: string;
      pdfUrl: string;
      extractedText?: string;
      textHash?: string;
      extractedAt?: string;
    }>;
  };
  edges: {
    HAS_VERSION: Array<{ from: string; to: string }>;
    SCHEDULED_FOR: Array<{ from: string; to: string }>;
  };
}

/**
 * Get bills that should have text extracted:
 * - Bills with upcoming hearings (SCHEDULED_FOR edges)
 * - Bills with watch/progressing statuses
 */
function getWatchBillIds(data: GraphDatabase): Set<string> {
  const watchBillIds = new Set<string>();

  // Add bills with scheduled hearings
  for (const edge of data.edges.SCHEDULED_FOR || []) {
    watchBillIds.add(edge.from);
  }

  // Add bills with watch statuses
  for (const bill of Object.values(data.nodes.bills)) {
    if (WATCH_STATUSES.includes(bill.currentStatus)) {
      watchBillIds.add(bill.id);
    }
  }

  return watchBillIds;
}

/**
 * Build PDF URL for a bill based on chamber and bill info
 */
function buildPdfUrl(chamber: string, lrNumber: string, billPrefix?: string, billSuffix?: number): string {
  if (chamber === 'house') {
    // House format: https://documents.house.mo.gov/billtracking/bills261/hlrbillspdf/3877H.01I.pdf
    return `https://documents.house.mo.gov/billtracking/bills261/hlrbillspdf/${lrNumber}.pdf`;
  } else {
    // Senate format: https://www.senate.mo.gov/26info/pdf-bill/intro/SB863.pdf
    // Uses bill number (SB863) not LR number
    const billNum = `${billPrefix}${billSuffix}`;
    return `https://www.senate.mo.gov/26info/pdf-bill/intro/${billNum}.pdf`;
  }
}

/**
 * Download PDF and extract text
 */
async function extractTextFromPdf(url: string): Promise<string | null> {
  try {
    console.log(`    Downloading: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`    Failed to download: HTTP ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`    Extracting text from ${buffer.length} bytes...`);
    const data = await pdf(buffer);

    // Clean up the text
    let text = data.text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log(`    Extracted ${text.length} characters`);
    return text;
  } catch (error) {
    console.error(`    Error extracting PDF:`, (error as Error).message);
    return null;
  }
}

/**
 * Generate a hash of the text for change detection
 */
function hashText(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

async function main() {
  console.log('Loading graph database...');
  const data: GraphDatabase = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));

  // Initialize bill_versions if not exists
  if (!data.nodes.bill_versions) {
    data.nodes.bill_versions = {};
  }
  if (!data.edges.HAS_VERSION) {
    data.edges.HAS_VERSION = [];
  }

  // Find watch bills (bills with hearings or watch statuses)
  const watchBillIds = getWatchBillIds(data);
  const watchBills = Object.values(data.nodes.bills).filter(
    bill => watchBillIds.has(bill.id) && bill.lrNumber
  );

  console.log(`Found ${watchBills.length} watch bills with LR numbers`);

  // Check which already have extracted text
  const existingVersions = new Map<string, string>();
  for (const edge of data.edges.HAS_VERSION) {
    const version = data.nodes.bill_versions[edge.to];
    if (version?.extractedText) {
      existingVersions.set(edge.from, version.textHash || '');
    }
  }

  const billsToProcess = watchBills.filter(b => !existingVersions.has(b.id));
  console.log(`${billsToProcess.length} bills need text extraction`);
  console.log(`${existingVersions.size} bills already have extracted text\n`);

  let extracted = 0;
  let failed = 0;

  for (let i = 0; i < billsToProcess.length; i++) {
    const bill = billsToProcess[i];
    console.log(`[${i + 1}/${billsToProcess.length}] ${bill.billNumber} (${bill.currentStatus})`);

    const pdfUrl = buildPdfUrl(bill.chamber, bill.lrNumber, bill.billPrefix, bill.billSuffix);
    const text = await extractTextFromPdf(pdfUrl);

    if (text && text.length > 100) {
      // Create or update version node
      const versionId = `version:${bill.lrNumber}`;
      const textHash = hashText(text);

      data.nodes.bill_versions[versionId] = {
        id: versionId,
        billId: bill.id,
        lrNumber: bill.lrNumber,
        versionType: 'introduced',
        pdfUrl,
        extractedText: text,
        textHash,
        extractedAt: new Date().toISOString(),
      };

      // Add edge if not exists
      const edgeExists = data.edges.HAS_VERSION.some(
        e => e.from === bill.id && e.to === versionId
      );
      if (!edgeExists) {
        data.edges.HAS_VERSION.push({
          from: bill.id,
          to: versionId,
        });
      }

      console.log(`    ✓ Stored ${text.length} chars\n`);
      extracted++;
    } else {
      console.log(`    ✗ No text extracted\n`);
      failed++;
    }

    // Rate limit - be nice to servers
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n--- Summary ---');
  console.log(`Extracted: ${extracted}`);
  console.log(`Failed: ${failed}`);
  console.log(`Already had text: ${existingVersions.size}`);
  console.log(`Total with text: ${extracted + existingVersions.size}`);

  if (extracted > 0) {
    console.log('\nSaving updated graph...');
    fs.writeFileSync(GRAPH_PATH, JSON.stringify(data, null, 2));
    console.log('Done!');
  }
}

main().catch(console.error);
