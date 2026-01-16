/**
 * Graph Database Writer
 *
 * Handles reading/writing the JSON graph database
 * with atomic writes and backup support
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { config } from '../config';
import { dbLogger as logger } from '../utils/logger';

// Graph database structure
export interface GraphDatabase {
  _meta: GraphMeta;
  nodes: GraphNodes;
  edges: GraphEdges;
}

interface GraphMeta {
  version: string;
  schema: string;
  created: string;
  updated: string;
  session: string;
  description: string;
  syncState?: SyncMetadata;
}

interface SyncMetadata {
  lastFullSync: string | null;
  lastIncrementalSync: string | null;
  lastSyncDuration: number;
  totalBills: number;
  totalMembers: number;
  totalActions: number;
}

interface GraphNodes {
  sessions: Record<string, unknown>;
  bills: Record<string, unknown>;
  bill_versions: Record<string, unknown>;
  amendments: Record<string, unknown>;
  fiscal_notes: Record<string, unknown>;
  summaries: Record<string, unknown>;
  actions: Record<string, unknown>;
  votes: Record<string, unknown>;
  members: Record<string, unknown>;
  committees: Record<string, unknown>;
  hearings: Record<string, unknown>;
  testimony: Record<string, unknown>;
}

interface GraphEdges {
  [edgeType: string]: Array<{
    from: string;
    to: string;
    properties?: Record<string, unknown>;
  }>;
}

// Default empty database
function createEmptyDatabase(): GraphDatabase {
  return {
    _meta: {
      version: '1.0.0',
      schema: './schema.json',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      session: config.session.code,
      description: 'Missouri Legislative Graph Database',
      syncState: {
        lastFullSync: null,
        lastIncrementalSync: null,
        lastSyncDuration: 0,
        totalBills: 0,
        totalMembers: 0,
        totalActions: 0,
      },
    },
    nodes: {
      sessions: {},
      bills: {},
      bill_versions: {},
      amendments: {},
      fiscal_notes: {},
      summaries: {},
      actions: {},
      votes: {},
      members: {},
      committees: {},
      hearings: {},
      testimony: {},
    },
    edges: {
      SPONSORED_BY: [],
      CO_SPONSORED_BY: [],
      HAS_VERSION: [],
      SUPERSEDES: [],
      AMENDS: [],
      PROPOSED_BY: [],
      ASSIGNED_TO: [],
      SCHEDULED_FOR: [],
      HAS_ACTION: [],
      HAS_VOTE: [],
      CAST_VOTE: [],
      MEMBER_OF: [],
      HAS_FISCAL_NOTE: [],
      HAS_SUMMARY: [],
      HAS_TESTIMONY: [],
      TESTIFIED_AT: [],
      IN_SESSION: [],
      ORIGINATED_IN: [],
      CROSS_CHAMBER: [],
      COMBINES: [],
    },
  };
}

/**
 * Read the graph database from disk
 */
export async function readDatabase(): Promise<GraphDatabase> {
  const dbPath = path.resolve(config.database.graphPath);

  try {
    const content = await fs.readFile(dbPath, 'utf-8');
    const db = JSON.parse(content) as GraphDatabase;

    logger.debug('Database loaded', {
      bills: Object.keys(db.nodes.bills).length,
      members: Object.keys(db.nodes.members).length,
      actions: Object.keys(db.nodes.actions).length,
    });

    return db;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.info('Database not found, creating empty database');
      return createEmptyDatabase();
    }
    throw error;
  }
}

/**
 * Write the graph database to disk
 * Uses atomic write (write to temp, then rename)
 */
export async function writeDatabase(db: GraphDatabase): Promise<void> {
  const dbPath = path.resolve(config.database.graphPath);
  const tempPath = `${dbPath}.tmp`;
  const backupPath = `${dbPath}.backup`;

  // Update metadata
  db._meta.updated = new Date().toISOString();
  db._meta.syncState = {
    ...db._meta.syncState,
    totalBills: Object.keys(db.nodes.bills).length,
    totalMembers: Object.keys(db.nodes.members).length,
    totalActions: Object.keys(db.nodes.actions).length,
  } as SyncMetadata;

  const content = JSON.stringify(db, null, 2);

  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(dbPath), { recursive: true });

    // Write to temp file
    await fs.writeFile(tempPath, content, 'utf-8');

    // Create backup of existing file
    try {
      await fs.rename(dbPath, backupPath);
    } catch {
      // No existing file, that's OK
    }

    // Atomic rename
    await fs.rename(tempPath, dbPath);

    logger.info('Database written', {
      path: dbPath,
      size: content.length,
      bills: Object.keys(db.nodes.bills).length,
    });
  } catch (error) {
    // Try to restore backup
    try {
      await fs.rename(backupPath, dbPath);
    } catch {
      // No backup to restore
    }
    throw error;
  }
}

/**
 * Upsert a node into the database
 */
export function upsertNode<T extends Record<string, unknown>>(
  db: GraphDatabase,
  nodeType: keyof GraphNodes,
  id: string,
  data: T
): { action: 'created' | 'updated'; node: T } {
  const collection = db.nodes[nodeType] as Record<string, T>;
  const existing = collection[id];

  const now = new Date().toISOString();

  if (existing) {
    // Update existing node
    collection[id] = {
      ...existing,
      ...data,
      id,
      updatedAt: now,
    };
    return { action: 'updated', node: collection[id] };
  } else {
    // Create new node
    collection[id] = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    return { action: 'created', node: collection[id] };
  }
}

/**
 * Upsert an edge into the database
 */
export function upsertEdge(
  db: GraphDatabase,
  edgeType: string,
  from: string,
  to: string,
  properties?: Record<string, unknown>
): { action: 'created' | 'updated' } {
  if (!db.edges[edgeType]) {
    db.edges[edgeType] = [];
  }

  const edges = db.edges[edgeType];
  const existingIndex = edges.findIndex(e => e.from === from && e.to === to);

  if (existingIndex >= 0) {
    // Update existing edge
    edges[existingIndex] = { from, to, properties };
    return { action: 'updated' };
  } else {
    // Create new edge
    edges.push({ from, to, properties });
    return { action: 'created' };
  }
}

/**
 * Remove an edge from the database
 */
export function removeEdge(
  db: GraphDatabase,
  edgeType: string,
  from: string,
  to: string
): boolean {
  if (!db.edges[edgeType]) {
    return false;
  }

  const edges = db.edges[edgeType];
  const index = edges.findIndex(e => e.from === from && e.to === to);

  if (index >= 0) {
    edges.splice(index, 1);
    return true;
  }

  return false;
}

/**
 * Get a node by ID
 */
export function getNode<T>(
  db: GraphDatabase,
  nodeType: keyof GraphNodes,
  id: string
): T | undefined {
  return (db.nodes[nodeType] as Record<string, T>)[id];
}

/**
 * Get all nodes of a type
 */
export function getAllNodes<T>(
  db: GraphDatabase,
  nodeType: keyof GraphNodes
): T[] {
  return Object.values(db.nodes[nodeType] as Record<string, T>);
}

/**
 * Get edges of a type
 */
export function getEdges(
  db: GraphDatabase,
  edgeType: string,
  options?: { from?: string; to?: string }
): Array<{ from: string; to: string; properties?: Record<string, unknown> }> {
  const edges = db.edges[edgeType] || [];

  if (!options) return edges;

  return edges.filter(e => {
    if (options.from && e.from !== options.from) return false;
    if (options.to && e.to !== options.to) return false;
    return true;
  });
}

/**
 * Compute hash of a node for change detection
 */
export function computeHash(data: unknown): string {
  const json = JSON.stringify(data, Object.keys(data as object).sort());
  return createHash('md5').update(json).digest('hex');
}

/**
 * Check if node has changed
 */
export function hasChanged(
  db: GraphDatabase,
  nodeType: keyof GraphNodes,
  id: string,
  newData: Record<string, unknown>
): boolean {
  const existing = getNode<Record<string, unknown>>(db, nodeType, id);
  if (!existing) return true;

  // Compare relevant fields (exclude timestamps)
  const { createdAt: _c, updatedAt: _u, ...existingData } = existing;
  const { createdAt: _c2, updatedAt: _u2, ...compareData } = newData;

  return computeHash(existingData) !== computeHash(compareData);
}

export default {
  readDatabase,
  writeDatabase,
  upsertNode,
  upsertEdge,
  removeEdge,
  getNode,
  getAllNodes,
  getEdges,
  computeHash,
  hasChanged,
};
