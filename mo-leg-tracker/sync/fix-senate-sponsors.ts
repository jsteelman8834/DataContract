/**
 * One-time fix script to add missing SPONSORED_BY edges for Senate bills
 * Run with: npx ts-node fix-senate-sponsors.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

const GRAPH_PATH = path.join(__dirname, '../webapp/db/graph.json');
const SENATE_BILL_URL = 'https://www.senate.mo.gov/26info/BTS_Web/Bill.aspx?SessionType=R&BillID=';

interface GraphDatabase {
  nodes: {
    members: Record<string, { id: string; chamber: string; lastName: string; fullName: string }>;
    bills: Record<string, { id: string; senateBillId?: string; billNumber: string }>;
  };
  edges: {
    SPONSORED_BY: Array<{ from: string; to: string; properties: { sponsorType: string } }>;
  };
}

async function fetchSponsorName(senateBillId: string): Promise<string | null> {
  try {
    const url = `${SENATE_BILL_URL}${senateBillId}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try to get sponsor from hlSponsor element
    const sponsorText = $('#hlSponsor').text().trim() ||
                        $('[id$="hlSponsor"]').text().trim() ||
                        $('#MainContent_hlSponsor').text().trim();

    if (sponsorText) {
      // Clean up the name - remove "Senator", district info, etc.
      return sponsorText
        .replace(/Senator\s*/i, '')
        .replace(/\s*\(\s*(?:District\s*)?\d+\s*\)/i, '')
        .trim();
    }
    return null;
  } catch (error) {
    console.error(`Error fetching bill ${senateBillId}:`, error);
    return null;
  }
}

function findMemberByName(members: GraphDatabase['nodes']['members'], name: string): string | null {
  if (!name) return null;

  const normalizedName = name.toLowerCase().trim();
  const memberList = Object.values(members).filter(m => m.chamber === 'senate');

  // Try exact lastName match
  for (const member of memberList) {
    if (member.lastName.toLowerCase() === normalizedName) {
      return member.id;
    }
  }

  // Try last word of name matching lastName
  const nameParts = normalizedName.split(/\s+/);
  const lastName = nameParts[nameParts.length - 1];
  for (const member of memberList) {
    if (member.lastName.toLowerCase() === lastName) {
      return member.id;
    }
  }

  // Try fullName contains
  for (const member of memberList) {
    if (member.fullName.toLowerCase().includes(normalizedName)) {
      return member.id;
    }
  }

  return null;
}

async function main() {
  console.log('Loading graph database...');
  const data: GraphDatabase = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));

  // Get existing sponsor edges
  const existingSponsors = new Set(
    (data.edges.SPONSORED_BY || []).map(e => e.from)
  );

  // Find Senate bills without sponsors
  const senateBills = Object.values(data.nodes.bills)
    .filter(b => b.id.startsWith('bill:sb') && !existingSponsors.has(b.id) && b.senateBillId);

  console.log(`Found ${senateBills.length} Senate bills without sponsors`);

  let fixed = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < senateBills.length; i++) {
    const bill = senateBills[i];
    console.log(`[${i + 1}/${senateBills.length}] Processing ${bill.billNumber}...`);

    // Fetch sponsor name from Senate website
    const sponsorName = await fetchSponsorName(bill.senateBillId!);

    if (!sponsorName) {
      console.log(`  No sponsor found for ${bill.billNumber}`);
      errors++;
      continue;
    }

    // Find member by name
    const memberId = findMemberByName(data.nodes.members, sponsorName);

    if (!memberId) {
      console.log(`  Could not match sponsor "${sponsorName}" to a member`);
      notFound++;
      continue;
    }

    // Add the edge
    data.edges.SPONSORED_BY.push({
      from: bill.id,
      to: memberId,
      properties: { sponsorType: 'primary' }
    });

    console.log(`  ✓ Linked ${bill.billNumber} -> ${sponsorName} (${memberId})`);
    fixed++;

    // Small delay to be nice to the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n--- Summary ---');
  console.log(`Fixed: ${fixed}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Errors: ${errors}`);

  if (fixed > 0) {
    console.log('\nSaving updated graph...');
    fs.writeFileSync(GRAPH_PATH, JSON.stringify(data, null, 2));
    console.log('Done!');
  }
}

main().catch(console.error);
