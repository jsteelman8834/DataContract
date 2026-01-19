/**
 * Query Committee-Member Relationships
 *
 * Utility to explore committee memberships and assignments
 */

import { readDatabase } from './database/graph-writer';

interface MemberCommittee {
  committeeName: string;
  committeeId: string;
  position: string;
}

interface CommitteeMember {
  memberName: string;
  memberId: string;
  district: string;
  position: string;
}

async function queryCommittees(): Promise<void> {
  const db = await readDatabase();

  // Build relationship maps
  const memberToCommittees = new Map<string, MemberCommittee[]>();
  const committeeToMembers = new Map<string, CommitteeMember[]>();

  for (const edge of (db.edges.MEMBER_OF || [])) {
    const member = db.nodes.members[edge.from] as {
      fullName: string;
      district: string;
    } | undefined;
    const committee = db.nodes.committees[edge.to] as {
      name: string;
    } | undefined;

    if (!member || !committee) continue;

    const position = (edge.properties?.position as string) || 'member';

    // Member's committees
    if (!memberToCommittees.has(edge.from)) {
      memberToCommittees.set(edge.from, []);
    }
    memberToCommittees.get(edge.from)!.push({
      committeeName: committee.name,
      committeeId: edge.to,
      position,
    });

    // Committee's members
    if (!committeeToMembers.has(edge.to)) {
      committeeToMembers.set(edge.to, []);
    }
    committeeToMembers.get(edge.to)!.push({
      memberName: member.fullName,
      memberId: edge.from,
      district: member.district,
      position,
    });
  }

  // Display results
  console.log('='.repeat(60));
  console.log('MEMBER-COMMITTEE RELATIONSHIPS');
  console.log('='.repeat(60));

  // Stats
  const totalMembers = Object.keys(db.nodes.members).length;
  const membersWithCommittees = memberToCommittees.size;
  const totalCommittees = Object.keys(db.nodes.committees).length;
  const committeesWithMembers = committeeToMembers.size;

  console.log('\n📊 STATISTICS:');
  console.log(`  Members: ${membersWithCommittees}/${totalMembers} have committee assignments`);
  console.log(`  Committees: ${committeesWithMembers}/${totalCommittees} have members assigned`);
  console.log(`  Total MEMBER_OF edges: ${db.edges.MEMBER_OF?.length || 0}`);

  // Show senators and their committees
  console.log('\n\n👥 SENATE MEMBERS & THEIR COMMITTEES:');
  console.log('-'.repeat(60));

  const senators = Object.entries(db.nodes.members)
    .filter(([id]) => id.includes('senate'))
    .sort((a, b) => (a[1] as { district: string }).district.localeCompare((b[1] as { district: string }).district));

  for (const [memberId, member] of senators) {
    const m = member as { fullName: string; district: string; party: string };
    const committees = memberToCommittees.get(memberId) || [];

    console.log(`\n${m.fullName} (District ${m.district}, ${m.party}):`);
    if (committees.length === 0) {
      console.log('  ⚠️  No committee assignments');
    } else {
      // Sort by position (chairs first)
      committees.sort((a, b) => {
        const order = { chair: 0, vice_chair: 1, member: 2 };
        return (order[a.position as keyof typeof order] || 2) - (order[b.position as keyof typeof order] || 2);
      });
      for (const c of committees) {
        const posLabel = c.position !== 'member' ? ` (${c.position.replace('_', '-')})` : '';
        console.log(`  • ${c.committeeName}${posLabel}`);
      }
    }
  }

  // Show sample House committees with their members
  console.log('\n\n🏛️  SAMPLE HOUSE COMMITTEES:');
  console.log('-'.repeat(60));

  const houseCommittees = Object.entries(db.nodes.committees)
    .filter(([id]) => id.includes('house'))
    .slice(0, 3);

  for (const [committeeId, committee] of houseCommittees) {
    const c = committee as { name: string };
    const members = committeeToMembers.get(committeeId) || [];

    console.log(`\n${c.name} (${members.length} members):`);

    // Group by position
    const chairs = members.filter(m => m.position === 'chair');
    const viceChairs = members.filter(m => m.position === 'vice_chair');
    const rankingMinority = members.filter(m => m.position === 'ranking_minority');
    const regularMembers = members.filter(m => m.position === 'member');

    for (const m of chairs) {
      console.log(`  👑 ${m.memberName} (Chair, District ${m.district})`);
    }
    for (const m of viceChairs) {
      console.log(`  ⭐ ${m.memberName} (Vice-Chair, District ${m.district})`);
    }
    for (const m of rankingMinority) {
      console.log(`  🔷 ${m.memberName} (Ranking Minority, District ${m.district})`);
    }
    for (const m of regularMembers.slice(0, 5)) {
      console.log(`  • ${m.memberName} (District ${m.district})`);
    }
    if (regularMembers.length > 5) {
      console.log(`  ... and ${regularMembers.length - 5} more members`);
    }
  }

  // Bills assigned to committees
  console.log('\n\n📋 BILLS ASSIGNED TO COMMITTEES:');
  console.log('-'.repeat(60));

  const assignedTo = db.edges.ASSIGNED_TO || [];
  console.log(`Total bill-committee assignments: ${assignedTo.length}`);

  // Group by committee
  const billsByCommittee = new Map<string, string[]>();
  for (const edge of assignedTo) {
    if (!billsByCommittee.has(edge.to)) {
      billsByCommittee.set(edge.to, []);
    }
    billsByCommittee.get(edge.to)!.push(edge.from);
  }

  // Show top committees by bill count
  const sortedCommittees = Array.from(billsByCommittee.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  console.log('\nTop 10 committees by assigned bills:');
  for (const [committeeId, billIds] of sortedCommittees) {
    const committee = db.nodes.committees[committeeId] as { name: string } | undefined;
    const name = committee?.name || committeeId;
    console.log(`  ${name}: ${billIds.length} bills`);
  }
}

queryCommittees().catch(console.error);
