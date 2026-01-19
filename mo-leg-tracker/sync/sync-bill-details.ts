/**
 * Optimized Bill Detail Sync
 *
 * Fetches bill details in parallel batches with:
 * - Concurrent requests (within rate limits)
 * - Skip bills that already have details
 * - Progress tracking
 */

import { config } from './config';
import { fetchBillDetail } from './sources/house-xml-parser';
import { fetchSenateBillDetail, fetchSenateBillActions } from './sources/senate-scraper';
import { readDatabase, writeDatabase, upsertNode, upsertEdge } from './database/graph-writer';

interface SyncOptions {
  chamber?: 'house' | 'senate' | 'both';
  forceRefresh?: boolean;  // Re-fetch even if details exist
  limit?: number;          // Max bills to process
  batchSize?: number;      // Bills per batch
}

async function syncBillDetails(options: SyncOptions = {}): Promise<void> {
  const {
    chamber = 'both',
    forceRefresh = false,
    limit,
    batchSize = 10,
  } = options;

  console.log('Starting bill detail sync...');
  console.log(`  Chamber: ${chamber}`);
  console.log(`  Force refresh: ${forceRefresh}`);
  console.log(`  Batch size: ${batchSize}`);
  if (limit) console.log(`  Limit: ${limit}`);

  const db = await readDatabase();
  const allBills = Object.values(db.nodes.bills) as Array<{
    id: string;
    billNumber: string;
    billPrefix: string;
    billSuffix: number;
    chamber: string;
    title?: string;
    senateBillId?: string;
  }>;

  // Filter bills that need details
  let billsToProcess = allBills.filter(bill => {
    // Filter by chamber
    if (chamber !== 'both' && bill.chamber !== chamber) return false;

    // Skip if already has details (unless force refresh)
    if (!forceRefresh && bill.title && bill.title.length > 0) return false;

    return true;
  });

  if (limit) {
    billsToProcess = billsToProcess.slice(0, limit);
  }

  console.log(`\nBills to process: ${billsToProcess.length}`);

  if (billsToProcess.length === 0) {
    console.log('No bills need processing.');
    return;
  }

  // Process in batches
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < billsToProcess.length; i += batchSize) {
    const batch = billsToProcess.slice(i, i + batchSize);

    console.log(`\nBatch ${Math.floor(i / batchSize) + 1}: Processing ${batch.length} bills...`);

    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map(async (bill) => {
        try {
          if (bill.chamber === 'house') {
            const detail = await fetchBillDetail(bill.billPrefix, bill.billSuffix);
            if (detail) {
              // Update bill node
              const existingBill = db.nodes.bills[bill.id] as Record<string, unknown> || {};
              upsertNode(db, 'bills', bill.id, {
                ...existingBill,
                title: detail.title,
                briefDescription: detail.briefDescription,
                lrNumber: detail.lrNumber,
                currentStatus: detail.currentStatus,
                effectiveDate: detail.effectiveDate,
                introducedDate: detail.introducedDate,
                lastActionDate: detail.lastActionDate,
              });

              // Add sponsor edges
              if (detail.sponsor?.memberId) {
                upsertEdge(db, 'SPONSORED_BY', bill.id, detail.sponsor.memberId, {
                  sponsorType: 'primary',
                });
              }

              // Add actions
              for (const action of detail.actions) {
                upsertNode(db, 'actions', action.id, action as unknown as Record<string, unknown>);
                upsertEdge(db, 'HAS_ACTION', bill.id, action.id);
              }

              return { success: true, billId: bill.id };
            }
          } else if (bill.chamber === 'senate') {
            const detail = await fetchSenateBillDetail(bill.billPrefix, bill.billSuffix);
            if (detail) {
              // Fetch actions if we have a senate bill ID
              if (detail.senateBillId) {
                const actions = await fetchSenateBillActions(bill.id, detail.senateBillId);
                detail.actions = actions;
              }

              // Update bill node
              const existingBill = db.nodes.bills[bill.id] as Record<string, unknown> || {};
              upsertNode(db, 'bills', bill.id, {
                ...existingBill,
                title: detail.title,
                briefDescription: detail.briefDescription,
                lrNumber: detail.lrNumber,
                currentStatus: detail.currentStatus,
                currentCommittee: detail.currentCommittee,
                effectiveDate: detail.effectiveDate,
                lastActionDate: detail.lastActionDate,
                senateBillId: detail.senateBillId,
              });

              // Add sponsor edges
              if (detail.sponsor?.memberId) {
                upsertEdge(db, 'SPONSORED_BY', bill.id, detail.sponsor.memberId, {
                  sponsorType: 'primary',
                });
              }

              // Add actions
              for (const action of detail.actions) {
                upsertNode(db, 'actions', action.id, action as unknown as Record<string, unknown>);
                upsertEdge(db, 'HAS_ACTION', bill.id, action.id);
              }

              return { success: true, billId: bill.id };
            }
          }

          return { success: false, billId: bill.id, reason: 'No detail returned' };
        } catch (error) {
          return { success: false, billId: bill.id, reason: (error as Error).message };
        }
      })
    );

    // Count results
    for (const result of results) {
      processed++;
      if (result.status === 'fulfilled' && result.value.success) {
        succeeded++;
      } else {
        failed++;
        if (result.status === 'rejected') {
          console.log(`  Failed: ${result.reason}`);
        } else if (!result.value.success) {
          // Only log if it's not a "no detail" failure
          if (result.value.reason !== 'No detail returned') {
            console.log(`  Failed ${result.value.billId}: ${result.value.reason}`);
          }
        }
      }
    }

    console.log(`  Progress: ${processed}/${billsToProcess.length} (${succeeded} succeeded, ${failed} failed)`);

    // Save periodically (every 5 batches)
    if ((i / batchSize + 1) % 5 === 0) {
      console.log('  Saving checkpoint...');
      await writeDatabase(db);
    }
  }

  // Final save
  console.log('\nSaving database...');
  db._meta.updated = new Date().toISOString();
  await writeDatabase(db);

  console.log('\n✓ Bill detail sync complete!');
  console.log(`  Processed: ${processed}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed: ${failed}`);
}

// Parse CLI arguments
const args = process.argv.slice(2);
const options: SyncOptions = {
  chamber: 'both',
  forceRefresh: false,
  batchSize: 10,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--house':
      options.chamber = 'house';
      break;
    case '--senate':
      options.chamber = 'senate';
      break;
    case '--force':
      options.forceRefresh = true;
      break;
    case '--limit':
      options.limit = parseInt(args[++i], 10);
      break;
    case '--batch':
      options.batchSize = parseInt(args[++i], 10);
      break;
    case '--help':
      console.log('Usage: ts-node sync-bill-details.ts [options]');
      console.log('');
      console.log('Options:');
      console.log('  --house      Only sync House bills');
      console.log('  --senate     Only sync Senate bills');
      console.log('  --force      Re-fetch even if details exist');
      console.log('  --limit N    Process max N bills');
      console.log('  --batch N    Process N bills per batch (default: 10)');
      process.exit(0);
  }
}

syncBillDetails(options);
