/**
 * Partial Sync Functions
 *
 * Specialized sync functions for specific data types
 */

import { config } from './config';
import { fetchHearingList } from './sources/house-xml-parser';
import {
  fetchMemberList,
  fetchCommitteeList,
} from './sources/house-xml-parser';
import {
  fetchSenatorList,
  fetchSenateCommitteeList,
} from './sources/senate-scraper';
import {
  readDatabase,
  writeDatabase,
  upsertNode,
  upsertEdge,
} from './database/graph-writer';
import { syncLogger as logger } from './utils/logger';

/**
 * Sync only hearings data
 */
export async function syncHearingsOnly(): Promise<Record<string, number>> {
  logger.info('Starting hearings-only sync');

  const db = await readDatabase();
  const stats = { total: 0, created: 0, updated: 0 };

  try {
    const hearings = await fetchHearingList();
    stats.total = hearings.length;

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
        stats.created++;
      } else {
        stats.updated++;
      }

      // Create edges for scheduled bills
      for (const billId of hearing.billIds) {
        upsertEdge(db, 'SCHEDULED_FOR', billId, hearing.id);
      }
    }

    await writeDatabase(db);
    logger.info('Hearings sync complete', stats);
  } catch (error) {
    logger.error('Hearings sync failed', { error: (error as Error).message });
    throw error;
  }

  return stats;
}

/**
 * Sync static data (members and committees)
 */
export async function syncStaticData(): Promise<Record<string, number>> {
  logger.info('Starting static data sync');

  const db = await readDatabase();
  const stats = {
    members: 0,
    membersCreated: 0,
    membersUpdated: 0,
    committees: 0,
    committeesCreated: 0,
    committeesUpdated: 0,
  };

  try {
    // Sync House members
    const houseMembers = await fetchMemberList();
    for (const member of houseMembers) {
      const result = upsertNode(db, 'members', member.id, {
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
      });
      stats.members++;
      if (result.action === 'created') stats.membersCreated++;
      else stats.membersUpdated++;
    }

    // Sync Senate members
    const senators = await fetchSenatorList();
    for (const senator of senators) {
      const result = upsertNode(db, 'members', senator.id, {
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
      });
      stats.members++;
      if (result.action === 'created') stats.membersCreated++;
      else stats.membersUpdated++;
    }

    // Sync House committees
    const houseCommittees = await fetchCommitteeList();
    for (const committee of houseCommittees) {
      const result = upsertNode(db, 'committees', committee.id, {
        chamber: committee.chamber,
        name: committee.name,
        shortName: committee.shortName,
        type: committee.type,
        meetingRoom: committee.meetingRoom,
        active: true,
      });
      stats.committees++;
      if (result.action === 'created') stats.committeesCreated++;
      else stats.committeesUpdated++;
    }

    // Sync Senate committees
    const senateCommittees = await fetchSenateCommitteeList();
    for (const committee of senateCommittees) {
      const result = upsertNode(db, 'committees', committee.id, {
        chamber: committee.chamber,
        name: committee.name,
        shortName: committee.shortName,
        type: committee.type,
        active: true,
      });
      stats.committees++;
      if (result.action === 'created') stats.committeesCreated++;
      else stats.committeesUpdated++;
    }

    await writeDatabase(db);
    logger.info('Static data sync complete', stats);
  } catch (error) {
    logger.error('Static data sync failed', { error: (error as Error).message });
    throw error;
  }

  return stats;
}

export default {
  syncHearingsOnly,
  syncStaticData,
};
