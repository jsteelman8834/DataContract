/**
 * Event Store
 *
 * Persistence layer for legislative events using JSON file storage
 */

import * as fs from 'fs';
import * as path from 'path';
import { type LegislativeEvent, type EventFilter, matchesFilter } from './types';
import { syncLogger as logger } from '../utils/logger';

const EVENT_STORE_PATH = path.resolve(__dirname, '../../db/events.json');
const MAX_EVENTS = 10000; // Keep last 10k events

interface EventStore {
  events: LegislativeEvent[];
  lastUpdated: string;
}

/**
 * Initialize empty store if it doesn't exist
 */
function ensureStore(): void {
  const dir = path.dirname(EVENT_STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(EVENT_STORE_PATH)) {
    const emptyStore: EventStore = {
      events: [],
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(EVENT_STORE_PATH, JSON.stringify(emptyStore, null, 2));
  }
}

/**
 * Read the event store
 */
export function readEventStore(): EventStore {
  ensureStore();
  try {
    const data = fs.readFileSync(EVENT_STORE_PATH, 'utf-8');
    return JSON.parse(data) as EventStore;
  } catch (error) {
    logger.error('Failed to read event store', { error: (error as Error).message });
    return { events: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * Write the event store
 */
export function writeEventStore(store: EventStore): void {
  ensureStore();
  try {
    // Trim events if over limit
    if (store.events.length > MAX_EVENTS) {
      store.events = store.events.slice(0, MAX_EVENTS);
    }
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(EVENT_STORE_PATH, JSON.stringify(store, null, 2));
  } catch (error) {
    logger.error('Failed to write event store', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Add a new event
 */
export function addEvent(event: LegislativeEvent): void {
  const store = readEventStore();

  // Check for duplicate
  if (store.events.some(e => e.id === event.id)) {
    logger.warn(`Event ${event.id} already exists, skipping`);
    return;
  }

  // Add to beginning (newest first)
  store.events.unshift(event);
  writeEventStore(store);

  logger.info(`Event stored: ${event.type}`, {
    eventId: event.id,
    billNumber: event.billNumber,
    severity: event.severity,
  });
}

/**
 * Add multiple events
 */
export function addEvents(events: LegislativeEvent[]): void {
  if (events.length === 0) return;

  const store = readEventStore();
  const existingIds = new Set(store.events.map(e => e.id));

  const newEvents = events.filter(e => !existingIds.has(e.id));

  if (newEvents.length === 0) {
    logger.info('No new events to store');
    return;
  }

  // Add new events at beginning
  store.events = [...newEvents, ...store.events];
  writeEventStore(store);

  logger.info(`Stored ${newEvents.length} new events`);
}

/**
 * Get events with optional filtering
 */
export function getEvents(
  filter?: EventFilter,
  limit: number = 100,
  offset: number = 0
): LegislativeEvent[] {
  const store = readEventStore();
  let events = store.events;

  if (filter) {
    events = events.filter(e => matchesFilter(e, filter));
  }

  return events.slice(offset, offset + limit);
}

/**
 * Get events by bill ID
 */
export function getEventsByBill(billId: string): LegislativeEvent[] {
  const store = readEventStore();
  return store.events.filter(e => e.billId === billId);
}

/**
 * Get pending webhook events
 */
export function getPendingWebhookEvents(): LegislativeEvent[] {
  const store = readEventStore();
  return store.events.filter(e => e.webhooksPending.length > 0);
}

/**
 * Mark webhook as delivered for an event
 */
export function markWebhookDelivered(eventId: string, webhookId: string): void {
  const store = readEventStore();
  const event = store.events.find(e => e.id === eventId);

  if (!event) {
    logger.warn(`Event ${eventId} not found for webhook delivery update`);
    return;
  }

  // Move from pending to delivered
  event.webhooksPending = event.webhooksPending.filter(id => id !== webhookId);
  if (!event.webhooksDelivered.includes(webhookId)) {
    event.webhooksDelivered.push(webhookId);
  }

  writeEventStore(store);
}

/**
 * Get recent events count by type
 */
export function getEventStats(since: Date): Record<string, number> {
  const store = readEventStore();
  const stats: Record<string, number> = {};

  for (const event of store.events) {
    if (new Date(event.createdAt) >= since) {
      stats[event.type] = (stats[event.type] || 0) + 1;
    }
  }

  return stats;
}

export default {
  readEventStore,
  writeEventStore,
  addEvent,
  addEvents,
  getEvents,
  getEventsByBill,
  getPendingWebhookEvents,
  markWebhookDelivered,
  getEventStats,
};
