/**
 * Webhook Configuration
 *
 * Manages webhook subscriptions and their configurations
 */

import * as fs from 'fs';
import * as path from 'path';
import { type EventFilter, type EventType } from '../events/types';
import { syncLogger as logger } from '../utils/logger';

const WEBHOOK_CONFIG_PATH = path.resolve(__dirname, '../../db/webhooks.json');

export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  secret: string;  // For HMAC signing
  enabled: boolean;
  filter: EventFilter;
  notificationChannels: NotificationChannel[];
  createdAt: string;
  updatedAt: string;
}

export type NotificationChannel = 'webhook' | 'email' | 'slack' | 'discord' | 'sms';

export interface WebhookConfig {
  subscriptions: WebhookSubscription[];
  globalSettings: {
    retryAttempts: number;
    retryBackoffMs: number;
    timeoutMs: number;
  };
}

/**
 * Default configuration
 */
const defaultConfig: WebhookConfig = {
  subscriptions: [],
  globalSettings: {
    retryAttempts: 3,
    retryBackoffMs: 5000,
    timeoutMs: 30000,
  },
};

/**
 * Ensure config file exists
 */
function ensureConfig(): void {
  const dir = path.dirname(WEBHOOK_CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(WEBHOOK_CONFIG_PATH)) {
    fs.writeFileSync(WEBHOOK_CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
  }
}

/**
 * Read webhook configuration
 */
export function readWebhookConfig(): WebhookConfig {
  ensureConfig();
  try {
    const data = fs.readFileSync(WEBHOOK_CONFIG_PATH, 'utf-8');
    return JSON.parse(data) as WebhookConfig;
  } catch (error) {
    logger.error('Failed to read webhook config', { error: (error as Error).message });
    return defaultConfig;
  }
}

/**
 * Write webhook configuration
 */
export function writeWebhookConfig(config: WebhookConfig): void {
  ensureConfig();
  try {
    fs.writeFileSync(WEBHOOK_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    logger.error('Failed to write webhook config', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Get all webhook subscriptions
 */
export function getWebhookSubscriptions(): WebhookSubscription[] {
  const config = readWebhookConfig();
  return config.subscriptions;
}

/**
 * Get a specific webhook subscription
 */
export function getWebhookSubscription(id: string): WebhookSubscription | undefined {
  const config = readWebhookConfig();
  return config.subscriptions.find(s => s.id === id);
}

/**
 * Add a new webhook subscription
 */
export function addWebhookSubscription(
  subscription: Omit<WebhookSubscription, 'id' | 'createdAt' | 'updatedAt'>
): WebhookSubscription {
  const config = readWebhookConfig();
  const now = new Date().toISOString();

  const newSubscription: WebhookSubscription = {
    ...subscription,
    id: `webhook:${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  };

  config.subscriptions.push(newSubscription);
  writeWebhookConfig(config);

  logger.info(`Added webhook subscription: ${newSubscription.name}`, {
    id: newSubscription.id,
    url: newSubscription.url,
  });

  return newSubscription;
}

/**
 * Update a webhook subscription
 */
export function updateWebhookSubscription(
  id: string,
  updates: Partial<Omit<WebhookSubscription, 'id' | 'createdAt'>>
): WebhookSubscription | null {
  const config = readWebhookConfig();
  const index = config.subscriptions.findIndex(s => s.id === id);

  if (index === -1) {
    logger.warn(`Webhook subscription not found: ${id}`);
    return null;
  }

  config.subscriptions[index] = {
    ...config.subscriptions[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  writeWebhookConfig(config);
  return config.subscriptions[index];
}

/**
 * Delete a webhook subscription
 */
export function deleteWebhookSubscription(id: string): boolean {
  const config = readWebhookConfig();
  const index = config.subscriptions.findIndex(s => s.id === id);

  if (index === -1) {
    return false;
  }

  config.subscriptions.splice(index, 1);
  writeWebhookConfig(config);

  logger.info(`Deleted webhook subscription: ${id}`);
  return true;
}

/**
 * Get enabled subscriptions that match an event type
 */
export function getMatchingSubscriptions(
  eventType: EventType,
  chamber?: 'house' | 'senate',
  billPrefix?: string
): WebhookSubscription[] {
  const config = readWebhookConfig();

  return config.subscriptions.filter(sub => {
    if (!sub.enabled) return false;

    // Check event type filter
    if (sub.filter.eventTypes?.length) {
      if (!sub.filter.eventTypes.includes(eventType)) return false;
    }

    // Check chamber filter
    if (sub.filter.chambers?.length && chamber) {
      if (!sub.filter.chambers.includes(chamber)) return false;
    }

    // Check bill prefix filter
    if (sub.filter.billPrefixes?.length && billPrefix) {
      if (!sub.filter.billPrefixes.includes(billPrefix)) return false;
    }

    return true;
  });
}

export default {
  readWebhookConfig,
  writeWebhookConfig,
  getWebhookSubscriptions,
  getWebhookSubscription,
  addWebhookSubscription,
  updateWebhookSubscription,
  deleteWebhookSubscription,
  getMatchingSubscriptions,
};
