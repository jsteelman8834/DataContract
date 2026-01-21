/**
 * Fix script to add committee assignments to House bills
 * Parses committee from action history
 * Run with: npx ts-node fix-house-committees.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const GRAPH_PATH = path.join(__dirname, '../webapp/db/graph.json');

interface GraphDatabase {
  nodes: {
    bills: Record<string, {
      id: string;
      chamber: string;
      billNumber: string;
      currentCommittee: string | null;
    }>;
    committees: Record<string, { id: string; name: string }>;
  };
  edges: {
    HAS_ACTION: Array<{ from: string; to: string }>;
    ASSIGNED_TO: Array<{ from: string; to: string; properties: { assignedDate?: string } }>;
  };
}

interface ActionNode {
  id: string;
  billId: string;
  actionDate: string;
  actionDescription: string;
}

function generateCommitteeId(chamber: string, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `committee:${chamber}:${slug}`;
}

function extractCommitteeFromAction(actionDescription: string): string | null {
  // Match formats like "Referred: Emerging Issues(H)" or "Referred to Committee on XYZ"
  let match = actionDescription.match(/Referred:\s*(.+?)\s*\([HS]\)/i);
  if (!match) {
    match = actionDescription.match(/referred to\s+(?:house\s+)?(?:committee\s+on\s+)?(.+?)(?:\s*\(|$)/i);
  }
  if (match) {
    return match[1].trim();
  }
  return null;
}

async function main() {
  console.log('Loading graph database...');
  const data: GraphDatabase = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));

  // Build action lookup by billId
  const actionsByBill = new Map<string, ActionNode[]>();
  for (const edge of data.edges.HAS_ACTION || []) {
    const actionId = edge.to;
    const action = (data.nodes as any).actions?.[actionId] as ActionNode | undefined;
    if (action) {
      const list = actionsByBill.get(edge.from) || [];
      list.push(action);
      actionsByBill.set(edge.from, list);
    }
  }

  // Get House bills without committee assignments
  const houseBills = Object.values(data.nodes.bills)
    .filter(b => b.chamber === 'house' && !b.currentCommittee);

  console.log(`Found ${houseBills.length} House bills without committee assignments`);

  let fixed = 0;
  let noCommittee = 0;

  for (const bill of houseBills) {
    const actions = actionsByBill.get(bill.id) || [];

    // Sort actions by date descending
    actions.sort((a, b) => (b.actionDate || '').localeCompare(a.actionDate || ''));

    // Find most recent referral action
    let committeeId: string | null = null;
    let committeeName: string | null = null;
    let assignedDate: string | null = null;

    for (const action of actions) {
      const name = extractCommitteeFromAction(action.actionDescription);
      if (name) {
        committeeName = name;
        committeeId = generateCommitteeId('house', name);
        assignedDate = action.actionDate;
        break;
      }
    }

    if (committeeId && committeeName) {
      // Update bill's currentCommittee
      bill.currentCommittee = committeeId;

      // Check if committee exists in nodes
      if (!data.nodes.committees[committeeId]) {
        // Create committee node if it doesn't exist
        data.nodes.committees[committeeId] = {
          id: committeeId,
          name: committeeName,
        } as any;
      }

      // Add ASSIGNED_TO edge if not exists
      const edgeExists = (data.edges.ASSIGNED_TO || []).some(
        e => e.from === bill.id && e.to === committeeId
      );
      if (!edgeExists) {
        data.edges.ASSIGNED_TO = data.edges.ASSIGNED_TO || [];
        data.edges.ASSIGNED_TO.push({
          from: bill.id,
          to: committeeId,
          properties: { assignedDate: assignedDate || undefined }
        });
      }

      console.log(`✓ ${bill.billNumber} -> ${committeeName}`);
      fixed++;
    } else {
      noCommittee++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Fixed: ${fixed}`);
  console.log(`No committee found: ${noCommittee}`);

  if (fixed > 0) {
    console.log('\nSaving updated graph...');
    fs.writeFileSync(GRAPH_PATH, JSON.stringify(data, null, 2));
    console.log('Done!');
  }
}

main().catch(console.error);
