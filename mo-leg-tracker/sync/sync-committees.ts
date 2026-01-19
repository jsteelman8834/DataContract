/**
 * Committee Sync Script
 *
 * Syncs committees, committee memberships (MEMBER_OF edges),
 * and bill-to-committee assignments (ASSIGNED_TO edges)
 */

import { config, generateCommitteeId } from './config';
import {
  fetchCommitteeList,
  fetchCommitteeMemberships,
  type ParsedCommitteeMembership,
} from './sources/house-xml-parser';
import {
  fetchSenateCommitteeList,
  fetchSenateCommitteeMemberships,
  type ParsedSenateCommitteeMembership,
} from './sources/senate-scraper';
import {
  readDatabase,
  writeDatabase,
  upsertNode,
  upsertEdge,
  type GraphDatabase,
} from './database/graph-writer';

interface SyncStats {
  committees: { house: number; senate: number };
  memberships: { house: number; senate: number };
  billAssignments: number;
}

async function syncCommittees(): Promise<void> {
  console.log('Starting committee sync...\n');

  const stats: SyncStats = {
    committees: { house: 0, senate: 0 },
    memberships: { house: 0, senate: 0 },
    billAssignments: 0,
  };

  try {
    // Load existing database
    const db = await readDatabase();

    // ============================================
    // 1. Sync House Committees
    // ============================================
    console.log('Fetching House committees...');
    const houseCommittees = await fetchCommitteeList();
    stats.committees.house = houseCommittees.length;
    console.log(`  Found ${houseCommittees.length} House committees`);

    for (const committee of houseCommittees) {
      upsertNode(db, 'committees', committee.id, {
        chamber: committee.chamber,
        name: committee.name,
        shortName: committee.shortName,
        type: committee.type,
        chairId: committee.chairId,
        viceChairId: committee.viceChairId,
        meetingRoom: committee.meetingRoom,
        active: true,
      });
    }

    // ============================================
    // 2. Sync Senate Committees
    // ============================================
    console.log('Fetching Senate committees...');
    const senateCommittees = await fetchSenateCommitteeList();
    stats.committees.senate = senateCommittees.length;
    console.log(`  Found ${senateCommittees.length} Senate committees`);

    for (const committee of senateCommittees) {
      upsertNode(db, 'committees', committee.id, {
        chamber: committee.chamber,
        name: committee.name,
        shortName: committee.shortName,
        type: committee.type,
        chairId: committee.chairId,
        viceChairId: committee.viceChairId,
        active: true,
      });
    }

    // ============================================
    // 3. Sync House Committee Memberships
    // ============================================
    console.log('\nFetching House committee memberships...');
    const houseMemberships = await fetchCommitteeMemberships();
    stats.memberships.house = houseMemberships.length;
    console.log(`  Found ${houseMemberships.length} House committee memberships`);

    // Clear existing MEMBER_OF edges for house members to rebuild fresh
    if (db.edges.MEMBER_OF) {
      db.edges.MEMBER_OF = db.edges.MEMBER_OF.filter(
        (e: { from: string }) => !e.from.includes('member:house:')
      );
    }

    for (const membership of houseMemberships) {
      upsertEdge(db, 'MEMBER_OF', membership.memberId, membership.committeeId, {
        position: membership.position,
        chamber: membership.chamber,
      });
    }

    // ============================================
    // 4. Sync Senate Committee Memberships
    // ============================================
    console.log('Fetching Senate committee memberships...');
    const senateMemberships = await fetchSenateCommitteeMemberships();
    stats.memberships.senate = senateMemberships.length;
    console.log(`  Found ${senateMemberships.length} Senate committee memberships`);

    // Clear existing MEMBER_OF edges for senate members to rebuild fresh
    if (db.edges.MEMBER_OF) {
      db.edges.MEMBER_OF = db.edges.MEMBER_OF.filter(
        (e: { from: string }) => !e.from.includes('member:senate:')
      );
    }

    for (const membership of senateMemberships) {
      upsertEdge(db, 'MEMBER_OF', membership.memberId, membership.committeeId, {
        position: membership.position,
        chamber: membership.chamber,
      });
    }

    // ============================================
    // 5. Update Bill-to-Committee Assignments
    // ============================================
    console.log('\nUpdating bill-to-committee assignments...');

    // Clear existing ASSIGNED_TO edges to rebuild from bill data
    db.edges.ASSIGNED_TO = [];

    // Build a map of committee names to IDs for matching
    const committeeNameToId = new Map<string, string>();
    const allCommittees = [...houseCommittees, ...senateCommittees];
    for (const committee of allCommittees) {
      // Store multiple variations of the name for matching
      const name = committee.name.toLowerCase();
      committeeNameToId.set(name, committee.id);
      // Also store without "Committee" suffix
      committeeNameToId.set(name.replace(/\s+committee$/i, ''), committee.id);
      // Store short name if it's a string
      if (committee.shortName && typeof committee.shortName === 'string') {
        committeeNameToId.set(committee.shortName.toLowerCase(), committee.id);
      }
    }

    // Parse committee names from action descriptions
    // Patterns: "Referred to X Committee", "Referred S X Committee", "Referred H X Committee"
    const referredPattern = /referred\s+(?:[SH]\s+)?(.+?)\s*committee/i;
    const toCommitteePattern = /to\s+(?:the\s+)?(.+?)\s*committee/i;

    // Track bills and their most recent committee assignment
    const billToCommittee = new Map<string, string>();

    // Process all actions to find committee assignments
    const actions = Object.values(db.nodes.actions || {}) as Array<{
      billId: string;
      actionDescription?: string;
      actionCode?: string;
      actionDate?: string;
    }>;

    // Sort actions by date to get the most recent assignment
    const sortedActions = [...actions].sort((a, b) => {
      const dateA = a.actionDate || '';
      const dateB = b.actionDate || '';
      return dateA.localeCompare(dateB);
    });

    for (const action of sortedActions) {
      if (!action.actionDescription) continue;

      const desc = action.actionDescription;

      // Check if this is a referral action
      if (desc.toLowerCase().includes('referred')) {
        // Try to extract committee name
        let committeeName: string | null = null;

        const match1 = desc.match(referredPattern);
        if (match1) {
          committeeName = match1[1].trim();
        } else {
          const match2 = desc.match(toCommitteePattern);
          if (match2) {
            committeeName = match2[1].trim();
          }
        }

        if (committeeName) {
          // Determine chamber from bill ID or action
          const billId = action.billId;
          const chamber = billId.includes(':hb') || billId.includes(':hr') || billId.includes(':hcr') || billId.includes(':hjr')
            ? 'house'
            : 'senate';

          // Try to find matching committee
          const searchName = committeeName.toLowerCase();
          let committeeId = committeeNameToId.get(searchName);

          if (!committeeId) {
            // Try partial match
            for (const [name, id] of committeeNameToId.entries()) {
              if (name.includes(searchName) || searchName.includes(name)) {
                // Prefer same chamber
                if (id.includes(chamber)) {
                  committeeId = id;
                  break;
                }
                if (!committeeId) {
                  committeeId = id;
                }
              }
            }
          }

          if (!committeeId) {
            // Generate committee ID
            committeeId = generateCommitteeId(chamber, committeeName);
          }

          // Store the most recent assignment (will overwrite earlier ones)
          billToCommittee.set(billId, committeeId);
        }
      }
    }

    // Create ASSIGNED_TO edges
    for (const [billId, committeeId] of billToCommittee.entries()) {
      upsertEdge(db, 'ASSIGNED_TO', billId, committeeId, {
        status: 'pending',
      });
      stats.billAssignments++;
    }

    console.log(`  Created ${stats.billAssignments} bill-committee assignments`);

    // ============================================
    // 6. Write Database
    // ============================================
    console.log('\nWriting database...');
    db._meta.updated = new Date().toISOString();
    await writeDatabase(db);

    // ============================================
    // Summary
    // ============================================
    console.log('\n✓ Committee sync complete!');
    console.log(`\n  Committees:`);
    console.log(`    House: ${stats.committees.house}`);
    console.log(`    Senate: ${stats.committees.senate}`);
    console.log(`\n  Memberships (MEMBER_OF edges):`);
    console.log(`    House: ${stats.memberships.house}`);
    console.log(`    Senate: ${stats.memberships.senate}`);
    console.log(`\n  Bill Assignments (ASSIGNED_TO edges): ${stats.billAssignments}`);

    // Verify
    const memberOfCount = db.edges.MEMBER_OF?.length || 0;
    const assignedToCount = db.edges.ASSIGNED_TO?.length || 0;
    console.log(`\n  Total MEMBER_OF edges in DB: ${memberOfCount}`);
    console.log(`  Total ASSIGNED_TO edges in DB: ${assignedToCount}`);

  } catch (error) {
    console.error('Sync failed:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

syncCommittees();
