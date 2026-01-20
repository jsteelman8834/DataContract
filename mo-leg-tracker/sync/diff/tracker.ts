/**
 * Differential State Tracker
 *
 * Tracks content hashes and action counts for efficient change detection
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { syncLogger as logger } from '../utils/logger';

const DIFF_STATE_PATH = path.resolve(__dirname, '../../db/diff-state.json');

interface BillState {
  billId: string;
  contentHash: string;
  actionCount: number;
  lastActionDate: string;
  lastChecked: string;
}

interface DiffState {
  bills: Record<string, BillState>;
  lastFullHash: string;
  lastUpdated: string;
}

/**
 * Ensure state file exists
 */
function ensureState(): void {
  const dir = path.dirname(DIFF_STATE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DIFF_STATE_PATH)) {
    const emptyState: DiffState = {
      bills: {},
      lastFullHash: '',
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(DIFF_STATE_PATH, JSON.stringify(emptyState, null, 2));
  }
}

/**
 * Read diff state
 */
function readState(): DiffState {
  ensureState();
  try {
    const data = fs.readFileSync(DIFF_STATE_PATH, 'utf-8');
    return JSON.parse(data) as DiffState;
  } catch (error) {
    return { bills: {}, lastFullHash: '', lastUpdated: new Date().toISOString() };
  }
}

/**
 * Write diff state
 */
function writeState(state: DiffState): void {
  ensureState();
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DIFF_STATE_PATH, JSON.stringify(state, null, 2));
}

/**
 * Generate content hash
 */
export function generateHash(content: string | object): string {
  const data = typeof content === 'string' ? content : JSON.stringify(content);
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * Check if a bill has changed based on action count and date
 */
export function hasBillChanged(
  billId: string,
  newActionCount: number,
  newLastActionDate: string
): boolean {
  const state = readState();
  const existing = state.bills[billId];

  if (!existing) {
    return true; // New bill
  }

  // Check if action count increased
  if (newActionCount > existing.actionCount) {
    return true;
  }

  // Check if last action date is newer
  if (new Date(newLastActionDate) > new Date(existing.lastActionDate)) {
    return true;
  }

  return false;
}

/**
 * Update bill state after processing
 */
export function updateBillState(
  billId: string,
  contentHash: string,
  actionCount: number,
  lastActionDate: string
): void {
  const state = readState();

  state.bills[billId] = {
    billId,
    contentHash,
    actionCount,
    lastActionDate,
    lastChecked: new Date().toISOString(),
  };

  writeState(state);
}

/**
 * Get bills that need checking based on staleness
 */
export function getStaleBills(maxAge: number = 60 * 60 * 1000): string[] {
  const state = readState();
  const now = Date.now();
  const stale: string[] = [];

  for (const [billId, billState] of Object.entries(state.bills)) {
    const lastChecked = new Date(billState.lastChecked).getTime();
    if (now - lastChecked > maxAge) {
      stale.push(billId);
    }
  }

  return stale;
}

/**
 * Check if full feed content has changed
 */
export function hasFullFeedChanged(newContentHash: string): boolean {
  const state = readState();

  if (state.lastFullHash !== newContentHash) {
    state.lastFullHash = newContentHash;
    writeState(state);
    return true;
  }

  return false;
}

/**
 * Get changed bills from a feed comparison
 */
export function getChangedBillsFromFeed(
  feedBills: Array<{
    id: string;
    actionCount: number;
    lastActionDate: string;
  }>
): string[] {
  const changed: string[] = [];

  for (const bill of feedBills) {
    if (hasBillChanged(bill.id, bill.actionCount, bill.lastActionDate)) {
      changed.push(bill.id);
    }
  }

  logger.info(`Found ${changed.length} changed bills out of ${feedBills.length}`);
  return changed;
}

/**
 * Batch update bill states
 */
export function batchUpdateBillStates(
  bills: Array<{
    id: string;
    contentHash: string;
    actionCount: number;
    lastActionDate: string;
  }>
): void {
  const state = readState();

  for (const bill of bills) {
    state.bills[bill.id] = {
      billId: bill.id,
      contentHash: bill.contentHash,
      actionCount: bill.actionCount,
      lastActionDate: bill.lastActionDate,
      lastChecked: new Date().toISOString(),
    };
  }

  writeState(state);
  logger.info(`Updated state for ${bills.length} bills`);
}

/**
 * Get diff state statistics
 */
export function getDiffStats(): {
  trackedBills: number;
  lastUpdated: string;
  averageAge: number;
} {
  const state = readState();
  const bills = Object.values(state.bills);
  const now = Date.now();

  const totalAge = bills.reduce((sum, b) => {
    return sum + (now - new Date(b.lastChecked).getTime());
  }, 0);

  return {
    trackedBills: bills.length,
    lastUpdated: state.lastUpdated,
    averageAge: bills.length > 0 ? totalAge / bills.length : 0,
  };
}

/**
 * Clear state for a specific bill
 */
export function clearBillState(billId: string): void {
  const state = readState();
  delete state.bills[billId];
  writeState(state);
}

/**
 * Clear all state (for full rebuild)
 */
export function clearAllState(): void {
  const emptyState: DiffState = {
    bills: {},
    lastFullHash: '',
    lastUpdated: new Date().toISOString(),
  };
  writeState(emptyState);
  logger.info('Cleared all diff state');
}

export default {
  generateHash,
  hasBillChanged,
  updateBillState,
  getStaleBills,
  hasFullFeedChanged,
  getChangedBillsFromFeed,
  batchUpdateBillStates,
  getDiffStats,
  clearBillState,
  clearAllState,
};
