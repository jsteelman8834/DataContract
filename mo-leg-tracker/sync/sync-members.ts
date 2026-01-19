/**
 * Quick script to sync only members (House and Senate)
 */

import { config } from './config';
import { fetchMemberList } from './sources/house-xml-parser';
import { fetchSenatorList } from './sources/senate-scraper';
import { readDatabase, writeDatabase, upsertNode, type GraphDatabase } from './database/graph-writer';

async function syncMembersOnly(): Promise<void> {
  console.log('Starting members-only sync...\n');

  try {
    // Load existing database
    const db = await readDatabase();

    // Sync House members
    console.log('Fetching House members...');
    const houseMembers = await fetchMemberList();
    console.log(`Found ${houseMembers.length} House members`);

    for (const member of houseMembers) {
      upsertNode(db, 'members', member.id, {
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
    }

    // Sync Senate members
    console.log('\nFetching Senate members...');
    const senators = await fetchSenatorList();
    console.log(`Found ${senators.length} Senate members`);

    for (const senator of senators) {
      upsertNode(db, 'members', senator.id, {
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
    }

    // Update metadata
    db._meta.updated = new Date().toISOString();

    // Write database
    console.log('\nWriting database...');
    await writeDatabase(db);

    // Summary
    const totalMembers = Object.keys(db.nodes.members).length;
    const houseCount = Object.keys(db.nodes.members).filter(k => k.includes('house')).length;
    const senateCount = Object.keys(db.nodes.members).filter(k => k.includes('senate')).length;

    console.log('\n✓ Members sync complete!');
    console.log(`  Total members: ${totalMembers}`);
    console.log(`  House: ${houseCount}`);
    console.log(`  Senate: ${senateCount}`);

  } catch (error) {
    console.error('Sync failed:', (error as Error).message);
    process.exit(1);
  }
}

syncMembersOnly();
