/**
 * Slack Notification Service
 *
 * Sends notifications via Slack incoming webhooks
 */

import { syncLogger as logger } from '../utils/logger';

/**
 * Get Slack webhook URL from environment
 */
function getSlackWebhookUrl(): string | null {
  return process.env.SLACK_WEBHOOK_URL || null;
}

/**
 * Send a message to Slack
 */
export async function sendSlackMessage(blocks: unknown[]): Promise<void> {
  const webhookUrl = getSlackWebhookUrl();

  if (!webhookUrl) {
    logger.warn('SLACK_WEBHOOK_URL not configured, skipping Slack notification');
    return;
  }

  const payload = {
    blocks,
    unfurl_links: false,
    unfurl_media: false,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    logger.info('Slack message sent successfully');
  } catch (error) {
    logger.error('Failed to send Slack message', {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Send a simple text message to Slack
 */
export async function sendSlackText(text: string): Promise<void> {
  const webhookUrl = getSlackWebhookUrl();

  if (!webhookUrl) {
    logger.warn('SLACK_WEBHOOK_URL not configured');
    return;
  }

  const payload = { text };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }

    logger.info('Slack text message sent');
  } catch (error) {
    logger.error('Failed to send Slack text', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Send a Slack message with attachments
 */
export async function sendSlackWithAttachment(
  text: string,
  attachments: Array<{
    color: string;
    title: string;
    text: string;
    fields?: Array<{ title: string; value: string; short?: boolean }>;
  }>
): Promise<void> {
  const webhookUrl = getSlackWebhookUrl();

  if (!webhookUrl) {
    logger.warn('SLACK_WEBHOOK_URL not configured');
    return;
  }

  const payload = { text, attachments };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }

    logger.info('Slack message with attachment sent');
  } catch (error) {
    logger.error('Failed to send Slack attachment', { error: (error as Error).message });
    throw error;
  }
}

export default {
  sendSlackMessage,
  sendSlackText,
  sendSlackWithAttachment,
};
