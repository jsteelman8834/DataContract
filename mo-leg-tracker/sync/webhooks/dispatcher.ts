/**
 * Webhook Dispatcher
 *
 * Handles delivery of events to webhook endpoints with HMAC signing
 */

import * as crypto from 'crypto';
import { type LegislativeEvent } from '../events/types';
import { getPendingWebhookEvents, markWebhookDelivered } from '../events/store';
import { getWebhookSubscription, readWebhookConfig } from './config';
import { addToRetryQueue, processRetryQueue } from './retry-queue';
import { syncLogger as logger } from '../utils/logger';

interface WebhookPayload {
  event: LegislativeEvent;
  timestamp: string;
  signature: string;
}

/**
 * Generate HMAC signature for payload
 */
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Build webhook headers
 */
function buildHeaders(signature: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Mo-Leg-Signature': signature,
    'X-Mo-Leg-Timestamp': new Date().toISOString(),
    'User-Agent': 'MO-Legislative-Tracker/1.0',
  };
}

/**
 * Deliver a single webhook
 */
async function deliverWebhook(
  event: LegislativeEvent,
  webhookId: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const subscription = getWebhookSubscription(webhookId);

  if (!subscription) {
    logger.warn(`Webhook subscription not found: ${webhookId}`);
    return { success: false, error: 'Subscription not found' };
  }

  if (!subscription.enabled) {
    logger.info(`Webhook ${webhookId} is disabled, skipping`);
    return { success: false, error: 'Subscription disabled' };
  }

  const config = readWebhookConfig();
  const payloadBody = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
  });

  const signature = generateSignature(payloadBody, subscription.secret);
  const headers = buildHeaders(signature);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      config.globalSettings.timeoutMs
    );

    const response = await fetch(subscription.url, {
      method: 'POST',
      headers,
      body: payloadBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      logger.info(`Webhook delivered successfully`, {
        webhookId,
        eventId: event.id,
        statusCode: response.status,
      });
      return { success: true, statusCode: response.status };
    } else {
      const error = `HTTP ${response.status}: ${response.statusText}`;
      logger.warn(`Webhook delivery failed`, {
        webhookId,
        eventId: event.id,
        error,
      });
      return { success: false, statusCode: response.status, error };
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.error(`Webhook delivery error`, {
      webhookId,
      eventId: event.id,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Dispatch all pending webhooks for an event
 */
async function dispatchEventWebhooks(event: LegislativeEvent): Promise<void> {
  for (const webhookId of event.webhooksPending) {
    const result = await deliverWebhook(event, webhookId);

    if (result.success) {
      markWebhookDelivered(event.id, webhookId);
    } else {
      // Add to retry queue
      addToRetryQueue({
        eventId: event.id,
        webhookId,
        attempt: 1,
        lastError: result.error || 'Unknown error',
        nextRetryAt: new Date(Date.now() + 60000).toISOString(), // 1 minute
      });
    }
  }
}

/**
 * Dispatch all pending webhooks
 */
export async function dispatchPendingWebhooks(): Promise<{
  processed: number;
  delivered: number;
  failed: number;
}> {
  logger.info('Starting webhook dispatch...');

  const pendingEvents = getPendingWebhookEvents();
  let delivered = 0;
  let failed = 0;

  for (const event of pendingEvents) {
    for (const webhookId of event.webhooksPending) {
      const result = await deliverWebhook(event, webhookId);

      if (result.success) {
        markWebhookDelivered(event.id, webhookId);
        delivered++;
      } else {
        addToRetryQueue({
          eventId: event.id,
          webhookId,
          attempt: 1,
          lastError: result.error || 'Unknown error',
          nextRetryAt: new Date(Date.now() + 60000).toISOString(),
        });
        failed++;
      }
    }
  }

  // Process retry queue
  await processRetryQueue();

  const stats = {
    processed: pendingEvents.length,
    delivered,
    failed,
  };

  logger.info('Webhook dispatch complete', stats);
  return stats;
}

/**
 * Send immediate webhook (bypass queue)
 */
export async function sendImmediateWebhook(
  event: LegislativeEvent,
  webhookId: string
): Promise<boolean> {
  const result = await deliverWebhook(event, webhookId);

  if (result.success) {
    markWebhookDelivered(event.id, webhookId);
  }

  return result.success;
}

export default {
  dispatchPendingWebhooks,
  sendImmediateWebhook,
};
