/**
 * Sync State Tracker
 *
 * Tracks sync progress and enables incremental updates
 * Persists state to sync-state.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { config } from '../config';
import { dbLogger as logger } from '../utils/logger';

// Sync state structure
export interface SyncState {
  version: string;
  session: string;
  lastSync: LastSyncInfo;
  feeds: Record<string, FeedState>;
  bills: Record<string, BillState>;
  // For event detection - stores previous state snapshot
  previousSnapshot?: {
    bills: Record<string, unknown>;
    hearings: Record<string, unknown>;
    fiscal_notes: Record<string, unknown>;
    capturedAt: string;
  };
}

interface LastSyncInfo {
  fullSync: string | null;
  incrementalSync: string | null;
  duration: number;
  success: boolean;
  error?: string;
}

interface FeedState {
  url: string;
  lastFetched: string | null;
  contentHash: string | null;
  recordCount: number;
  etag?: string;
  lastModified?: string;
}

interface BillState {
  lastModified: string;
  actionCount: number;
  contentHash: string;
  lastActionDate: string | null;
  currentStatus: string;
}

// Default empty state
function createEmptyState(): SyncState {
  return {
    version: '1.0.0',
    session: config.session.code,
    lastSync: {
      fullSync: null,
      incrementalSync: null,
      duration: 0,
      success: true,
    },
    feeds: {},
    bills: {},
  };
}

/**
 * Load sync state from disk
 */
export async function loadSyncState(): Promise<SyncState> {
  const statePath = path.resolve(config.database.syncStatePath);

  try {
    const content = await fs.readFile(statePath, 'utf-8');
    const state = JSON.parse(content) as SyncState;

    // Validate session
    if (state.session !== config.session.code) {
      logger.warn('Sync state is for different session, starting fresh', {
        stored: state.session,
        current: config.session.code,
      });
      return createEmptyState();
    }

    logger.debug('Sync state loaded', {
      lastFull: state.lastSync.fullSync,
      lastIncremental: state.lastSync.incrementalSync,
      trackedBills: Object.keys(state.bills).length,
    });

    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.info('Sync state not found, creating new state');
      return createEmptyState();
    }
    throw error;
  }
}

/**
 * Save sync state to disk
 */
export async function saveSyncState(state: SyncState): Promise<void> {
  const statePath = path.resolve(config.database.syncStatePath);
  const tempPath = `${statePath}.tmp`;

  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(statePath), { recursive: true });

    const content = JSON.stringify(state, null, 2);

    // Atomic write
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, statePath);

    logger.debug('Sync state saved', {
      path: statePath,
      trackedBills: Object.keys(state.bills).length,
    });
  } catch (error) {
    logger.error('Failed to save sync state', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Update feed state after fetching
 */
export function updateFeedState(
  state: SyncState,
  feedName: string,
  data: {
    url: string;
    content: string;
    recordCount: number;
    etag?: string;
    lastModified?: string;
  }
): boolean {
  const contentHash = computeHash(data.content);
  const existing = state.feeds[feedName];

  const isNew = !existing || existing.contentHash !== contentHash;

  state.feeds[feedName] = {
    url: data.url,
    lastFetched: new Date().toISOString(),
    contentHash,
    recordCount: data.recordCount,
    etag: data.etag,
    lastModified: data.lastModified,
  };

  if (isNew) {
    logger.debug(`Feed ${feedName} has new content`);
  }

  return isNew;
}

/**
 * Check if feed needs refresh based on content hash
 */
export function feedNeedsRefresh(state: SyncState, feedName: string): boolean {
  const feed = state.feeds[feedName];
  if (!feed || !feed.lastFetched) {
    return true;
  }

  // Always refresh if no hash
  if (!feed.contentHash) {
    return true;
  }

  // Refresh if last fetch was more than sync interval ago
  const lastFetch = new Date(feed.lastFetched).getTime();
  const age = Date.now() - lastFetch;

  // House feeds: 30 min minimum
  // Senate pages: 1 hour recommended
  const maxAge = feedName.startsWith('senate') ? 60 * 60 * 1000 : 30 * 60 * 1000;

  return age > maxAge;
}

/**
 * Update bill state after processing
 */
export function updateBillState(
  state: SyncState,
  billId: string,
  data: {
    actionCount: number;
    lastActionDate: string | null;
    currentStatus: string;
    contentHash: string;
  }
): { isNew: boolean; hasChanged: boolean } {
  const existing = state.bills[billId];

  const isNew = !existing;
  const hasChanged = !existing || existing.contentHash !== data.contentHash;

  state.bills[billId] = {
    lastModified: new Date().toISOString(),
    actionCount: data.actionCount,
    contentHash: data.contentHash,
    lastActionDate: data.lastActionDate,
    currentStatus: data.currentStatus,
  };

  return { isNew, hasChanged };
}

/**
 * Check if bill needs refresh based on stored state
 */
export function billNeedsRefresh(
  state: SyncState,
  billId: string,
  newActionCount?: number,
  newStatus?: string
): boolean {
  const existing = state.bills[billId];
  if (!existing) {
    return true; // New bill
  }

  // Check if action count changed
  if (newActionCount !== undefined && existing.actionCount !== newActionCount) {
    return true;
  }

  // Check if status changed
  if (newStatus !== undefined && existing.currentStatus !== newStatus) {
    return true;
  }

  return false;
}

/**
 * Get bills that have changed since a given date
 */
export function getChangedBillsSince(state: SyncState, since: string): string[] {
  const sinceTime = new Date(since).getTime();

  return Object.entries(state.bills)
    .filter(([_, billState]) => {
      const modTime = new Date(billState.lastModified).getTime();
      return modTime > sinceTime;
    })
    .map(([billId]) => billId);
}

/**
 * Record sync completion
 */
export function recordSyncComplete(
  state: SyncState,
  type: 'full' | 'incremental',
  duration: number,
  success: boolean,
  error?: string
): void {
  const now = new Date().toISOString();

  if (type === 'full') {
    state.lastSync.fullSync = now;
  } else {
    state.lastSync.incrementalSync = now;
  }

  state.lastSync.duration = duration;
  state.lastSync.success = success;

  if (error) {
    state.lastSync.error = error;
  } else {
    delete state.lastSync.error;
  }
}

/**
 * Get bills that may have been missed (not synced recently)
 */
export function getStaleBills(state: SyncState, maxAge: number = 24 * 60 * 60 * 1000): string[] {
  const cutoff = Date.now() - maxAge;

  return Object.entries(state.bills)
    .filter(([_, billState]) => {
      const modTime = new Date(billState.lastModified).getTime();
      return modTime < cutoff;
    })
    .map(([billId]) => billId);
}

/**
 * Clear state for specific bills (for re-sync)
 */
export function clearBillStates(state: SyncState, billIds: string[]): void {
  for (const billId of billIds) {
    delete state.bills[billId];
  }
}

/**
 * Compute content hash for change detection
 */
function computeHash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

/**
 * Synchronous read for event detection
 */
export function readSyncState(): SyncState {
  const statePath = path.resolve(config.database.syncStatePath);

  try {
    const fs = require('fs');
    const content = fs.readFileSync(statePath, 'utf-8');
    return JSON.parse(content) as SyncState;
  } catch {
    return createEmptyState();
  }
}

/**
 * Synchronous write for event detection
 */
export function writeSyncState(state: SyncState): void {
  const statePath = path.resolve(config.database.syncStatePath);
  const fs = require('fs');

  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Failed to write sync state', { error: (error as Error).message });
  }
}

export default {
  loadSyncState,
  saveSyncState,
  updateFeedState,
  feedNeedsRefresh,
  updateBillState,
  billNeedsRefresh,
  getChangedBillsSince,
  recordSyncComplete,
  getStaleBills,
  clearBillStates,
  readSyncState,
  writeSyncState,
};
