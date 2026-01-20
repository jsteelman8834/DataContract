/**
 * Webhook Retry Queue
 *
 * Handles failed webhook deliveries with exponential backoff
 */

import * as fs from 'fs';
import * as path from 'path';
import { readWebhookConfig, getWebhookSubscription } from './config';
import { getEvents, markWebhookDelivered } from '../events/store';
import { syncLogger as logger } from '../utils/logger';

const RETRY_QUEUE_PATH = path.resolve(__dirname, '../../db/webhook-retry-queue.json');
const MAX_RETRY_ATTEMPTS = 5;

export interface RetryItem {
  eventId: string;
  webhookId: string;
  attempt: number;
  lastError: string;
  nextRetryAt: string;
  createdAt?: string;
}

interface RetryQueue {
  items: RetryItem[];
  lastProcessed: string;
}

/**
 * Ensure retry queue file exists
 */
function ensureQueue(): void {
  const dir = path.dirname(RETRY_QUEUE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(RETRY_QUEUE_PATH)) {
    const emptyQueue: RetryQueue = {
      items: [],
      lastProcessed: new Date().toISOString(),
    };
    fs.writeFileSync(RETRY_QUEUE_PATH, JSON.stringify(emptyQueue, null, 2));
  }
}

/**
 * Read retry queue
 */
function readQueue(): RetryQueue {
  ensureQueue();
  try {
    const data = fs.readFileSync(RETRY_QUEUE_PATH, 'utf-8');
    return JSON.parse(data) as RetryQueue;
  } catch (error) {
    return { items: [], lastProcessed: new Date().toISOString() };
  }
}

/**
 * Write retry queue
 */
function writeQueue(queue: RetryQueue): void {
  ensureQueue();
  fs.writeFileSync(RETRY_QUEUE_PATH, JSON.stringify(queue, null, 2));
}

/**
 * Add item to retry queue
 */
export function addToRetryQueue(item: Omit<RetryItem, 'createdAt'>): void {
  const queue = readQueue();

  // Check for existing entry
  const existingIndex = queue.items.findIndex(
    i => i.eventId === item.eventId && i.webhookId === item.webhookId
  );

  if (existingIndex >= 0) {
    // Update existing entry
    queue.items[existingIndex] = {
      ...item,
      createdAt: queue.items[existingIndex].createdAt,
    };
  } else {
    // Add new entry
    queue.items.push({
      ...item,
      createdAt: new Date().toISOString(),
    });
  }

  writeQueue(queue);
  logger.info(`Added to retry queue`, { eventId: item.eventId, webhookId: item.webhookId, attempt: item.attempt });
}

/**
 * Remove item from retry queue
 */
export function removeFromRetryQueue(eventId: string, webhookId: string): void {
  const queue = readQueue();
  queue.items = queue.items.filter(
    i => !(i.eventId === eventId && i.webhookId === webhookId)
  );
  writeQueue(queue);
}

/**
 * Calculate next retry time with exponential backoff
 */
function calculateNextRetry(attempt: number): Date {
  const config = readWebhookConfig();
  const baseDelay = config.globalSettings.retryBackoffMs;
  const delay = baseDelay * Math.pow(2, attempt - 1);
  return new Date(Date.now() + delay);
}

/**
 * Attempt to deliver a webhook from the retry queue
 */
async function retryDelivery(item: RetryItem): Promise<boolean> {
  const subscription = getWebhookSubscription(item.webhookId);
  if (!subscription || !subscription.enabled) {
    logger.info(`Removing retry item for disabled/missing webhook`, { webhookId: item.webhookId });
    removeFromRetryQueue(item.eventId, item.webhookId);
    return false;
  }

  // Get the event
  const events = getEvents({ eventTypes: undefined }, 10000); // Get all recent
  const event = events.find(e => e.id === item.eventId);

  if (!event) {
    logger.warn(`Event not found for retry`, { eventId: item.eventId });
    removeFromRetryQueue(item.eventId, item.webhookId);
    return false;
  }

  const config = readWebhookConfig();
  const payloadBody = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    retryAttempt: item.attempt,
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.globalSettings.timeoutMs);

    const response = await fetch(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mo-Leg-Retry-Attempt': String(item.attempt),
      },
      body: payloadBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      logger.info(`Retry delivery successful`, {
        eventId: item.eventId,
        webhookId: item.webhookId,
        attempt: item.attempt,
      });
      markWebhookDelivered(item.eventId, item.webhookId);
      removeFromRetryQueue(item.eventId, item.webhookId);
      return true;
    }

    return false;
  } catch (error) {
    logger.warn(`Retry delivery failed`, {
      eventId: item.eventId,
      webhookId: item.webhookId,
      attempt: item.attempt,
      error: (error as Error).message,
    });
    return false;
  }
}

/**
 * Process the retry queue
 */
export async function processRetryQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  abandoned: number;
}> {
  const queue = readQueue();
  const now = new Date();
  const stats = { processed: 0, succeeded: 0, failed: 0, abandoned: 0 };

  // Find items ready for retry
  const readyItems = queue.items.filter(item => new Date(item.nextRetryAt) <= now);

  for (const item of readyItems) {
    stats.processed++;

    // Check if max attempts exceeded
    if (item.attempt >= MAX_RETRY_ATTEMPTS) {
      logger.warn(`Max retry attempts exceeded, abandoning`, {
        eventId: item.eventId,
        webhookId: item.webhookId,
      });
      removeFromRetryQueue(item.eventId, item.webhookId);
      stats.abandoned++;
      continue;
    }

    const success = await retryDelivery(item);

    if (success) {
      stats.succeeded++;
    } else {
      stats.failed++;
      // Update for next retry
      addToRetryQueue({
        ...item,
        attempt: item.attempt + 1,
        lastError: 'Retry failed',
        nextRetryAt: calculateNextRetry(item.attempt + 1).toISOString(),
      });
    }
  }

  // Update last processed time
  queue.lastProcessed = now.toISOString();
  writeQueue(queue);

  if (stats.processed > 0) {
    logger.info('Retry queue processed', stats);
  }

  return stats;
}

/**
 * Get retry queue status
 */
export function getRetryQueueStatus(): {
  totalItems: number;
  pendingItems: number;
  lastProcessed: string;
} {
  const queue = readQueue();
  const now = new Date();

  return {
    totalItems: queue.items.length,
    pendingItems: queue.items.filter(i => new Date(i.nextRetryAt) <= now).length,
    lastProcessed: queue.lastProcessed,
  };
}

export default {
  addToRetryQueue,
  removeFromRetryQueue,
  processRetryQueue,
  getRetryQueueStatus,
};
