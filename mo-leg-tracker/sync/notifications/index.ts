/**
 * Unified Notification Dispatcher
 *
 * Routes notifications to appropriate channels based on subscription config
 */

import { type LegislativeEvent } from '../events/types';
import { getWebhookSubscription, type NotificationChannel } from '../webhooks/config';
import { formatEventMessage } from './templates';
import { sendEmail } from './email';
import { sendSlackMessage } from './slack';
import { sendDiscordMessage } from './discord';
import { sendSms } from './sms';
import { syncLogger as logger } from '../utils/logger';

export interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
}

/**
 * Send notification through specified channel
 */
async function sendToChannel(
  channel: NotificationChannel,
  event: LegislativeEvent,
  webhookId: string
): Promise<NotificationResult> {
  const message = formatEventMessage(event);

  try {
    switch (channel) {
      case 'email':
        await sendEmail(message.subject, message.htmlBody, message.textBody);
        break;

      case 'slack':
        await sendSlackMessage(message.slackBlocks!);
        break;

      case 'discord':
        await sendDiscordMessage(message.discordEmbed!);
        break;

      case 'sms':
        await sendSms(message.shortText);
        break;

      case 'webhook':
        // Handled separately by webhook dispatcher
        return { channel, success: true };
    }

    return { channel, success: true };
  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.error(`Notification failed for ${channel}`, { error: errorMessage });
    return { channel, success: false, error: errorMessage };
  }
}

/**
 * Send notifications for an event to all configured channels
 */
export async function sendNotifications(
  event: LegislativeEvent,
  webhookId: string
): Promise<NotificationResult[]> {
  const subscription = getWebhookSubscription(webhookId);

  if (!subscription) {
    logger.warn(`Subscription not found: ${webhookId}`);
    return [];
  }

  const results: NotificationResult[] = [];

  for (const channel of subscription.notificationChannels) {
    const result = await sendToChannel(channel, event, webhookId);
    results.push(result);
  }

  const successCount = results.filter(r => r.success).length;
  logger.info(`Notifications sent: ${successCount}/${results.length}`, {
    eventId: event.id,
    webhookId,
  });

  return results;
}

/**
 * Send urgent notification (high severity events)
 */
export async function sendUrgentNotification(
  event: LegislativeEvent
): Promise<NotificationResult[]> {
  const message = formatEventMessage(event);
  const results: NotificationResult[] = [];

  // Send to all channels for urgent notifications
  try {
    await sendSlackMessage(message.slackBlocks!);
    results.push({ channel: 'slack', success: true });
  } catch (error) {
    results.push({ channel: 'slack', success: false, error: (error as Error).message });
  }

  try {
    await sendDiscordMessage(message.discordEmbed!);
    results.push({ channel: 'discord', success: true });
  } catch (error) {
    results.push({ channel: 'discord', success: false, error: (error as Error).message });
  }

  // SMS for very high priority
  if (event.severity === 'high') {
    try {
      await sendSms(message.shortText);
      results.push({ channel: 'sms', success: true });
    } catch (error) {
      results.push({ channel: 'sms', success: false, error: (error as Error).message });
    }
  }

  return results;
}

export default {
  sendNotifications,
  sendUrgentNotification,
};
