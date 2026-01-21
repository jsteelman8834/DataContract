/**
 * Missouri Legislative Data Sync Orchestrator
 *
 * Main entry point for synchronizing data from official sources
 */

import { config } from './config';
import {
  fetchBillList,
  fetchBillDetail,
  fetchMemberList,
  fetchCommitteeList,
  fetchHearingList,
  type ParsedBill,
  type ParsedMember,
  type ParsedCommittee,
  type ParsedAction,
} from './sources/house-xml-parser';
import {
  fetchSenateBillList,
  fetchSenateBillDetail,
  fetchSenateBillActions,
  fetchSenatorList,
  fetchSenateCommitteeList,
  type ParsedSenateBill,
  type ParsedSenator,
  type ParsedSenateCommittee,
} from './sources/senate-scraper';
import {
  readDatabase,
  writeDatabase,
  upsertNode,
  upsertEdge,
  hasChanged,
  type GraphDatabase,
} from './database/graph-writer';
import { syncLogger as logger } from './utils/logger';

// Sync statistics
interface SyncStats {
  startTime: number;
  houseBills: { total: number; created: number; updated: number; failed: number };
  senateBills: { total: number; created: number; updated: number; failed: number };
  members: { total: number; created: number; updated: number };
  committees: { total: number; created: number; updated: number };
  actions: { total: number; created: number; updated: number };
  hearings: { total: number; created: number; updated: number };
}

function createStats(): SyncStats {
  return {
    startTime: Date.now(),
    houseBills: { total: 0, created: 0, updated: 0, failed: 0 },
    senateBills: { total: 0, created: 0, updated: 0, failed: 0 },
    members: { total: 0, created: 0, updated: 0 },
    committees: { total: 0, created: 0, updated: 0 },
    actions: { total: 0, created: 0, updated: 0 },
    hearings: { total: 0, created: 0, updated: 0 },
  };
}

/**
 * Find a member by name in the database
 * Searches by lastName match (case-insensitive) within a specific chamber
 */
function findMemberByName(db: GraphDatabase, name: string, chamber: 'house' | 'senate'): string | null {
  if (!name) return null;

  const normalizedName = name.toLowerCase().trim();
  const members = Object.values(db.nodes.members || {}) as Array<{
    id: string;
    chamber: string;
    lastName: string;
    fullName: string;
  }>;

  // First try exact lastName match
  for (const member of members) {
    if (member.chamber === chamber && member.lastName.toLowerCase() === normalizedName) {
      return member.id;
    }
  }

  // Try matching last word of the sponsor name with lastName
  const nameParts = normalizedName.split(/\s+/);
  const lastName = nameParts[nameParts.length - 1];
  for (const member of members) {
    if (member.chamber === chamber && member.lastName.toLowerCase() === lastName) {
      return member.id;
    }
  }

  // Try fullName contains match as last resort
  for (const member of members) {
    if (member.chamber === chamber && member.fullName.toLowerCase().includes(normalizedName)) {
      return member.id;
    }
  }

  return null;
}

/**
 * Full sync - fetch all data from both chambers
 */
export async function fullSync(): Promise<SyncStats> {
  const stats = createStats();
  logger.syncStart('full sync');

  try {
    // Load existing database
    const db = await readDatabase();

    // Ensure session node exists
    upsertNode(db, 'sessions', `session:${config.session.code}`, {
      sessionCode: config.session.code,
      year: config.session.year,
      type: config.session.type,
      label: config.session.label,
      assemblyNumber: config.session.assemblyNumber,
      startDate: '2026-01-08',
      endDate: null,
      active: true,
    });

    // Sync committees first (referenced by bills)
    logger.info('Syncing committees...');
    await syncHouseCommittees(db, stats);
    await syncSenateCommittees(db, stats);

    // Sync members (referenced by bills)
    logger.info('Syncing members...');
    await syncHouseMembers(db, stats);
    await syncSenateMembers(db, stats);

    // Sync bills from both chambers
    logger.info('Syncing House bills...');
    await syncHouseBills(db, stats, true); // true = fetch details

    logger.info('Syncing Senate bills...');
    await syncSenateBills(db, stats, true);

    // Sync hearings
    logger.info('Syncing hearings...');
    await syncHearings(db, stats);

    // Update sync metadata
    db._meta.syncState = {
      lastFullSync: new Date().toISOString(),
      lastIncrementalSync: db._meta.syncState?.lastIncrementalSync ?? null,
      lastSyncDuration: Date.now() - stats.startTime,
      totalBills: Object.keys(db.nodes.bills).length,
      totalMembers: Object.keys(db.nodes.members).length,
      totalActions: Object.keys(db.nodes.actions).length,
    };

    // Write database
    await writeDatabase(db);

    const duration = Date.now() - stats.startTime;
    logger.syncComplete('full sync', {
      houseBills: stats.houseBills.total,
      senateBills: stats.senateBills.total,
      members: stats.members.total,
      committees: stats.committees.total,
      actions: stats.actions.total,
    }, duration);

    return stats;
  } catch (error) {
    logger.syncFailed('full sync', error as Error);
    throw error;
  }
}

/**
 * Incremental sync - only fetch changes since last sync
 */
export async function incrementalSync(): Promise<SyncStats> {
  const stats = createStats();
  logger.syncStart('incremental sync');

  try {
    const db = await readDatabase();

    // Sync bill lists (lightweight)
    logger.info('Checking for House bill changes...');
    await syncHouseBills(db, stats, false); // false = skip details for unchanged

    logger.info('Checking for Senate bill changes...');
    await syncSenateBills(db, stats, false);

    // Sync hearings (usually change frequently)
    logger.info('Syncing hearings...');
    await syncHearings(db, stats);

    // Update sync metadata
    db._meta.syncState = {
      lastFullSync: db._meta.syncState?.lastFullSync ?? null,
      lastIncrementalSync: new Date().toISOString(),
      lastSyncDuration: Date.now() - stats.startTime,
      totalBills: Object.keys(db.nodes.bills).length,
      totalMembers: Object.keys(db.nodes.members).length,
      totalActions: Object.keys(db.nodes.actions).length,
    };

    await writeDatabase(db);

    const duration = Date.now() - stats.startTime;
    logger.syncComplete('incremental sync', {
      houseBillsUpdated: stats.houseBills.updated,
      senateBillsUpdated: stats.senateBills.updated,
      hearingsUpdated: stats.hearings.updated,
    }, duration);

    return stats;
  } catch (error) {
    logger.syncFailed('incremental sync', error as Error);
    throw error;
  }
}

/**
 * Sync specific bills by number
 */
export async function syncBills(billNumbers: string[]): Promise<SyncStats> {
  const stats = createStats();
  logger.syncStart('targeted sync', { bills: billNumbers });

  try {
    const db = await readDatabase();

    for (const billNum of billNumbers) {
      const match = billNum.toUpperCase().match(/([A-Z]+)\s*(\d+)/);
      if (!match) {
        logger.warn(`Invalid bill number: ${billNum}`);
        continue;
      }

      const prefix = match[1];
      const number = parseInt(match[2], 10);

      if (prefix.startsWith('H')) {
        const bill = await fetchBillDetail(prefix, number);
        if (bill) {
          await processBill(db, bill, stats.houseBills);
          stats.houseBills.total++;
        }
      } else if (prefix.startsWith('S')) {
        const bill = await fetchSenateBillDetail(prefix, number);
        if (bill) {
          await processSenateBill(db, bill, stats.senateBills);
          stats.senateBills.total++;
        }
      }
    }

    await writeDatabase(db);

    const duration = Date.now() - stats.startTime;
    logger.syncComplete('targeted sync', {
      billsSynced: stats.houseBills.total + stats.senateBills.total,
    }, duration);

    return stats;
  } catch (error) {
    logger.syncFailed('targeted sync', error as Error);
    throw error;
  }
}

// Internal sync functions

async function syncHouseBills(
  db: GraphDatabase,
  stats: SyncStats,
  fetchDetails: boolean
): Promise<void> {
  try {
    const bills = await fetchBillList();
    stats.houseBills.total = bills.length;

    let processed = 0;
    for (const bill of bills) {
      try {
        // Check if bill needs update
        if (fetchDetails || hasChanged(db, 'bills', bill.id, billToNode(bill))) {
          // Fetch detailed info if requested
          let detailedBill = bill;
          if (fetchDetails && bill.billPrefix.startsWith('H')) {
            const detail = await fetchBillDetail(bill.billPrefix, bill.billSuffix);
            if (detail) {
              detailedBill = detail;
            }
          }
          await processBill(db, detailedBill, stats.houseBills);
        }
        processed++;
        // Log progress every 50 bills
        if (processed % 50 === 0) {
          logger.info(`House bills progress: ${processed}/${bills.length}`);
        }
      } catch (error) {
        stats.houseBills.failed++;
        logger.error(`Failed to process House bill ${bill.billNumber}`, {
          error: (error as Error).message,
        });
      }
    }
    logger.info(`House bills complete: ${processed}/${bills.length}`);
  } catch (error) {
    logger.error('Failed to sync House bills', { error: (error as Error).message });
    throw error;
  }
}

async function syncSenateBills(
  db: GraphDatabase,
  stats: SyncStats,
  fetchDetails: boolean
): Promise<void> {
  try {
    const bills = await fetchSenateBillList();
    stats.senateBills.total = bills.length;

    for (const bill of bills) {
      try {
        if (fetchDetails || hasChanged(db, 'bills', bill.id, senateBillToNode(bill))) {
          let detailedBill = bill;

          if (fetchDetails && bill.senateBillId) {
            const detail = await fetchSenateBillDetail(bill.billPrefix, bill.billSuffix);
            if (detail) {
              detailedBill = detail;

              // Fetch actions
              const actions = await fetchSenateBillActions(bill.id, bill.senateBillId);
              detailedBill.actions = actions;
            }
          }

          await processSenateBill(db, detailedBill, stats.senateBills);
        }
      } catch (error) {
        stats.senateBills.failed++;
        logger.error(`Failed to process Senate bill ${bill.billNumber}`, {
          error: (error as Error).message,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to sync Senate bills', { error: (error as Error).message });
    throw error;
  }
}

async function syncHouseMembers(db: GraphDatabase, stats: SyncStats): Promise<void> {
  try {
    const members = await fetchMemberList();
    stats.members.total += members.length;

    for (const member of members) {
      const result = upsertNode(db, 'members', member.id, memberToNode(member));
      if (result.action === 'created') {
        stats.members.created++;
      } else {
        stats.members.updated++;
      }
    }
  } catch (error) {
    logger.error('Failed to sync House members', { error: (error as Error).message });
  }
}

async function syncSenateMembers(db: GraphDatabase, stats: SyncStats): Promise<void> {
  try {
    const senators = await fetchSenatorList();
    stats.members.total += senators.length;

    for (const senator of senators) {
      const result = upsertNode(db, 'members', senator.id, senatorToNode(senator));
      if (result.action === 'created') {
        stats.members.created++;
      } else {
        stats.members.updated++;
      }
    }
  } catch (error) {
    logger.error('Failed to sync Senate members', { error: (error as Error).message });
  }
}

async function syncHouseCommittees(db: GraphDatabase, stats: SyncStats): Promise<void> {
  try {
    const committees = await fetchCommitteeList();
    stats.committees.total += committees.length;

    for (const committee of committees) {
      const result = upsertNode(db, 'committees', committee.id, committeeToNode(committee));
      if (result.action === 'created') {
        stats.committees.created++;
      } else {
        stats.committees.updated++;
      }
    }
  } catch (error) {
    logger.error('Failed to sync House committees', { error: (error as Error).message });
  }
}

async function syncSenateCommittees(db: GraphDatabase, stats: SyncStats): Promise<void> {
  try {
    const committees = await fetchSenateCommitteeList();
    stats.committees.total += committees.length;

    for (const committee of committees) {
      const result = upsertNode(db, 'committees', committee.id, senateCommitteeToNode(committee));
      if (result.action === 'created') {
        stats.committees.created++;
      } else {
        stats.committees.updated++;
      }
    }
  } catch (error) {
    logger.error('Failed to sync Senate committees', { error: (error as Error).message });
  }
}

async function syncHearings(db: GraphDatabase, stats: SyncStats): Promise<void> {
  try {
    const hearings = await fetchHearingList();
    stats.hearings.total = hearings.length;

    for (const hearing of hearings) {
      const result = upsertNode(db, 'hearings', hearing.id, {
        committeeId: hearing.committeeId,
        hearingDate: hearing.hearingDate,
        hearingTime: hearing.hearingTime,
        room: hearing.room,
        type: 'public',
        status: 'scheduled',
      });

      if (result.action === 'created') {
        stats.hearings.created++;
      } else {
        stats.hearings.updated++;
      }

      // Create edges for scheduled bills
      for (const billId of hearing.billIds) {
        upsertEdge(db, 'SCHEDULED_FOR', billId, hearing.id);
      }
    }
  } catch (error) {
    logger.error('Failed to sync hearings', { error: (error as Error).message });
  }
}

// Process a single bill
async function processBill(
  db: GraphDatabase,
  bill: ParsedBill,
  stats: { created: number; updated: number }
): Promise<void> {
  // Upsert bill node
  const result = upsertNode(db, 'bills', bill.id, billToNode(bill));

  if (result.action === 'created') {
    stats.created++;
    logger.recordProcessed('bill', bill.id, 'created');
  } else {
    stats.updated++;
    logger.recordProcessed('bill', bill.id, 'updated');
  }

  // Create session edge
  upsertEdge(db, 'IN_SESSION', bill.id, `session:${config.session.code}`);

  // Create sponsor edge
  if (bill.sponsor?.memberId) {
    upsertEdge(db, 'SPONSORED_BY', bill.id, bill.sponsor.memberId, {
      sponsorType: 'primary',
    });
  }

  // Create co-sponsor edges
  for (const coSponsor of bill.coSponsors) {
    if (coSponsor.memberId) {
      upsertEdge(db, 'CO_SPONSORED_BY', bill.id, coSponsor.memberId, {
        addedDate: bill.introducedDate,
      });
    }
  }

  // Create committee assignment edge
  if (bill.currentCommittee) {
    upsertEdge(db, 'ASSIGNED_TO', bill.id, bill.currentCommittee, {
      status: 'pending',
    });
  }

  // Process actions
  for (const action of bill.actions) {
    upsertNode(db, 'actions', action.id, actionToNode(action));
    upsertEdge(db, 'HAS_ACTION', bill.id, action.id);
  }
}

// Process a single Senate bill
async function processSenateBill(
  db: GraphDatabase,
  bill: ParsedSenateBill,
  stats: { created: number; updated: number }
): Promise<void> {
  const result = upsertNode(db, 'bills', bill.id, senateBillToNode(bill));

  if (result.action === 'created') {
    stats.created++;
    logger.recordProcessed('bill', bill.id, 'created');
  } else {
    stats.updated++;
    logger.recordProcessed('bill', bill.id, 'updated');
  }

  // Create session edge
  upsertEdge(db, 'IN_SESSION', bill.id, `session:${config.session.code}`);

  // Create sponsor edge - try memberId first, fall back to name lookup
  if (bill.sponsor) {
    let sponsorId = bill.sponsor.memberId;
    if (!sponsorId && bill.sponsor.name) {
      // Try to find the member by name
      sponsorId = findMemberByName(db, bill.sponsor.name, 'senate') || '';
    }
    if (sponsorId) {
      upsertEdge(db, 'SPONSORED_BY', bill.id, sponsorId, {
        sponsorType: 'primary',
      });
    }
  }

  // Create committee assignment edge
  if (bill.currentCommittee) {
    upsertEdge(db, 'ASSIGNED_TO', bill.id, bill.currentCommittee, {
      status: 'pending',
    });
  }

  // Process actions
  for (const action of bill.actions) {
    upsertNode(db, 'actions', action.id, actionToNode(action));
    upsertEdge(db, 'HAS_ACTION', bill.id, action.id);
  }
}

// Data transformation helpers

function billToNode(bill: ParsedBill): Record<string, unknown> {
  return {
    billNumber: bill.billNumber,
    billPrefix: bill.billPrefix,
    billSuffix: bill.billSuffix,
    session: bill.session,
    chamber: bill.chamber,
    title: bill.title,
    briefDescription: bill.briefDescription,
    lrNumber: bill.lrNumber,
    currentStatus: bill.currentStatus,
    currentCommittee: bill.currentCommittee,
    effectiveDate: bill.effectiveDate,
    introducedDate: bill.introducedDate,
    lastActionDate: bill.lastActionDate,
    withdrawn: bill.withdrawn,
  };
}

function senateBillToNode(bill: ParsedSenateBill): Record<string, unknown> {
  return {
    billNumber: bill.billNumber,
    billPrefix: bill.billPrefix,
    billSuffix: bill.billSuffix,
    session: bill.session,
    chamber: bill.chamber,
    title: bill.title,
    briefDescription: bill.briefDescription,
    lrNumber: bill.lrNumber,
    currentStatus: bill.currentStatus,
    currentCommittee: bill.currentCommittee,
    effectiveDate: bill.effectiveDate,
    introducedDate: bill.introducedDate,
    lastActionDate: bill.lastActionDate,
    withdrawn: bill.withdrawn,
    senateBillId: bill.senateBillId,
  };
}

function memberToNode(member: ParsedMember): Record<string, unknown> {
  return {
    chamber: member.chamber,
    district: member.district,
    firstName: member.firstName,
    lastName: member.lastName,
    fullName: member.fullName,
    party: member.party,
    title: member.title,
    email: member.email,
    phone: member.phone,
    photoUrl: member.photoUrl,
    active: true,
  };
}

function senatorToNode(senator: ParsedSenator): Record<string, unknown> {
  return {
    chamber: senator.chamber,
    district: senator.district,
    firstName: senator.firstName,
    lastName: senator.lastName,
    fullName: senator.fullName,
    party: senator.party,
    title: senator.title,
    email: senator.email,
    phone: senator.phone,
    photoUrl: senator.photoUrl,
    active: true,
  };
}

function committeeToNode(committee: ParsedCommittee): Record<string, unknown> {
  return {
    chamber: committee.chamber,
    name: committee.name,
    shortName: committee.shortName,
    type: committee.type,
    meetingRoom: committee.meetingRoom,
    active: true,
  };
}

function senateCommitteeToNode(committee: ParsedSenateCommittee): Record<string, unknown> {
  return {
    chamber: committee.chamber,
    name: committee.name,
    shortName: committee.shortName,
    type: committee.type,
    active: true,
  };
}

function actionToNode(action: ParsedAction): Record<string, unknown> {
  return {
    billId: action.billId,
    sequence: action.sequence,
    actionDate: action.actionDate,
    actionCode: action.actionCode,
    actionDescription: action.actionDescription,
    chamber: action.chamber,
    committeeId: action.committeeId,
    journalPage: action.journalPage,
    isKeyMilestone: action.isKeyMilestone,
  };
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'full':
        await fullSync();
        break;

      case 'incremental':
        await incrementalSync();
        break;

      case 'bill':
        const bills = args.slice(1);
        if (bills.length === 0) {
          console.error('Usage: sync bill <BILL_NUMBER> [<BILL_NUMBER>...]');
          process.exit(1);
        }
        await syncBills(bills);
        break;

      case 'status':
        const db = await readDatabase();
        console.log('Database Status:');
        console.log(`  Bills: ${Object.keys(db.nodes.bills).length}`);
        console.log(`  Members: ${Object.keys(db.nodes.members).length}`);
        console.log(`  Committees: ${Object.keys(db.nodes.committees).length}`);
        console.log(`  Actions: ${Object.keys(db.nodes.actions).length}`);
        console.log(`  Last Full Sync: ${db._meta.syncState?.lastFullSync || 'Never'}`);
        console.log(`  Last Incremental: ${db._meta.syncState?.lastIncrementalSync || 'Never'}`);
        break;

      default:
        console.log('Missouri Legislative Data Sync');
        console.log('');
        console.log('Usage:');
        console.log('  sync full           - Full database rebuild');
        console.log('  sync incremental    - Incremental update');
        console.log('  sync bill <NUMBER>  - Sync specific bills');
        console.log('  sync status         - Show database status');
        process.exit(0);
    }
  } catch (error) {
    console.error('Sync failed:', (error as Error).message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export default {
  fullSync,
  incrementalSync,
  syncBills,
};
