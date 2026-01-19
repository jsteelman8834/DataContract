/**
 * Fiscal Note Sync
 *
 * Checks for fiscal note PDFs for bills that are progressing through the legislature.
 * Only syncs fiscal notes for bills past committee stage (reported_do_pass or later).
 */

import { config, buildHousePdfUrl } from './config';
import { readDatabase, writeDatabase, upsertNode, upsertEdge } from './database/graph-writer';

// Statuses that indicate a bill has progressed past committee
const PROGRESSING_STATUSES = [
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
  'sent_to_governor',
  'signed',
  'enacted',
  'vetoed',
  'veto_overridden',
];

// Statuses worth watching (in committee but showing movement)
const WATCH_STATUSES = [
  'hearing_scheduled',
  'hearing_held',
  'committee_substitute',
  ...PROGRESSING_STATUSES,
];

interface FiscalNoteCheck {
  billId: string;
  billNumber: string;
  lrNumber: string;
  chamber: 'house' | 'senate';
  pdfUrl: string;
  exists: boolean;
}

/**
 * Build fiscal note PDF URL based on chamber and LR number
 */
function buildFiscalNoteUrl(chamber: 'house' | 'senate', lrNumber: string): string {
  if (chamber === 'house') {
    return buildHousePdfUrl('fiscalNote', { LR: lrNumber });
  } else {
    // Senate fiscal notes: https://senate.mo.gov/FiscalNotes/2026-1/{LR}.ORG.pdf
    const year = config.session.year;
    return `https://senate.mo.gov/FiscalNotes/${year}-1/${lrNumber}.ORG.pdf`;
  }
}

/**
 * Check if a fiscal note PDF exists at the given URL
 */
async function checkFiscalNoteExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'MO-Leg-Tracker/1.0 (fiscal-sync)',
      },
    });
    return response.ok && (response.headers.get('content-type')?.includes('pdf') ?? false);
  } catch {
    return false;
  }
}

/**
 * Generate a fiscal note ID from LR number
 */
function generateFiscalNoteId(lrNumber: string, noteType: string = 'ORG'): string {
  return `fiscal:${lrNumber}:${noteType}`;
}

interface SyncOptions {
  includeWatch?: boolean;  // Include watch-status bills (not just progressing)
  forceCheck?: boolean;    // Re-check even if fiscal note exists in DB
  limit?: number;          // Max bills to check
}

async function syncFiscalNotes(options: SyncOptions = {}): Promise<void> {
  const {
    includeWatch = false,
    forceCheck = false,
    limit,
  } = options;

  console.log('Starting fiscal note sync...');
  console.log(`  Include watch-status bills: ${includeWatch}`);
  console.log(`  Force re-check: ${forceCheck}`);
  if (limit) console.log(`  Limit: ${limit}`);

  const db = await readDatabase();

  const targetStatuses = includeWatch ? WATCH_STATUSES : PROGRESSING_STATUSES;

  // Find bills that are progressing and have LR numbers
  const allBills = Object.values(db.nodes.bills) as Array<{
    id: string;
    billNumber: string;
    lrNumber?: string;
    chamber: string;
    currentStatus: string;
  }>;

  let billsToCheck = allBills.filter(bill => {
    // Must have an LR number to look up fiscal note
    if (!bill.lrNumber) return false;

    // Must be in a progressing status
    if (!targetStatuses.includes(bill.currentStatus)) return false;

    // Skip if already has fiscal note (unless force)
    if (!forceCheck) {
      const existingEdge = db.edges.HAS_FISCAL_NOTE?.find(e => e.from === bill.id);
      if (existingEdge) return false;
    }

    return true;
  });

  if (limit) {
    billsToCheck = billsToCheck.slice(0, limit);
  }

  console.log(`\nBills to check: ${billsToCheck.length}`);

  if (billsToCheck.length === 0) {
    console.log('No bills need fiscal note checking.');

    // Show current status breakdown
    const statusCounts: Record<string, number> = {};
    allBills.forEach(b => {
      statusCounts[b.currentStatus] = (statusCounts[b.currentStatus] || 0) + 1;
    });
    console.log('\nCurrent bill status distribution:');
    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([status, count]) => {
        const isTarget = targetStatuses.includes(status);
        console.log(`  ${status}: ${count}${isTarget ? ' *' : ''}`);
      });
    console.log('\n* = Target status for fiscal note sync');
    return;
  }

  // Check each bill for fiscal notes
  let found = 0;
  let notFound = 0;

  for (const bill of billsToCheck) {
    const pdfUrl = buildFiscalNoteUrl(
      bill.chamber as 'house' | 'senate',
      bill.lrNumber!
    );

    process.stdout.write(`Checking ${bill.billNumber}... `);

    const exists = await checkFiscalNoteExists(pdfUrl);

    if (exists) {
      console.log('FOUND');
      found++;

      // Create fiscal note record
      const fiscalNoteId = generateFiscalNoteId(bill.lrNumber!);
      const now = new Date().toISOString();

      upsertNode(db, 'fiscal_notes', fiscalNoteId, {
        id: fiscalNoteId,
        billId: bill.id,
        versionId: null,
        noteType: 'original',

        // These would need PDF parsing to populate accurately
        fiscalYears: [config.session.year, config.session.year + 1],
        estimatedCost: null,
        estimatedRevenue: null,
        netImpact: 0,

        fundImpacts: {
          generalRevenue: 0,
          federalFunds: 0,
          otherFunds: 0,
          localGovernment: 0,
        },

        yearByYearImpact: [],
        uncertaintyRange: null,
        assumptions: [],

        issuingAgency: bill.chamber === 'house' ? 'House Budget Office' : 'Senate Appropriations',
        analystName: null,
        summary: 'Fiscal note available - see PDF for details',
        pdfUrl,
        publishedDate: now.split('T')[0],
        createdAt: now,
        updatedAt: now,
      });

      // Create edge linking bill to fiscal note
      upsertEdge(db, 'HAS_FISCAL_NOTE', bill.id, fiscalNoteId);

    } else {
      console.log('not found');
      notFound++;
    }

    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Save if we found any
  if (found > 0) {
    console.log('\nSaving database...');
    db._meta.updated = new Date().toISOString();
    await writeDatabase(db);
  }

  console.log('\n--- Fiscal Note Sync Complete ---');
  console.log(`  Checked: ${billsToCheck.length}`);
  console.log(`  Found: ${found}`);
  console.log(`  Not found: ${notFound}`);
}

// Parse CLI arguments
const args = process.argv.slice(2);
const options: SyncOptions = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--watch':
      options.includeWatch = true;
      break;
    case '--force':
      options.forceCheck = true;
      break;
    case '--limit':
      options.limit = parseInt(args[++i], 10);
      break;
    case '--help':
      console.log('Usage: ts-node sync-fiscal-notes.ts [options]');
      console.log('');
      console.log('Options:');
      console.log('  --watch    Include bills in watch statuses (hearing_scheduled, etc.)');
      console.log('  --force    Re-check bills that already have fiscal notes');
      console.log('  --limit N  Only check first N bills');
      console.log('');
      console.log('Target statuses (progressing):');
      PROGRESSING_STATUSES.forEach(s => console.log(`  - ${s}`));
      console.log('');
      console.log('Additional watch statuses (with --watch):');
      console.log('  - hearing_scheduled');
      console.log('  - hearing_held');
      console.log('  - committee_substitute');
      process.exit(0);
  }
}

syncFiscalNotes(options);
