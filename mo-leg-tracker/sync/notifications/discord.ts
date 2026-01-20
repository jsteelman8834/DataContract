/**
 * Discord Notification Service
 *
 * Sends notifications via Discord webhooks
 */

import { syncLogger as logger } from '../utils/logger';

/**
 * Get Discord webhook URL from environment
 */
function getDiscordWebhookUrl(): string | null {
  return process.env.DISCORD_WEBHOOK_URL || null;
}

/**
 * Send a message with embed to Discord
 */
export async function sendDiscordMessage(embed: unknown): Promise<void> {
  const webhookUrl = getDiscordWebhookUrl();

  if (!webhookUrl) {
    logger.warn('DISCORD_WEBHOOK_URL not configured, skipping Discord notification');
    return;
  }

  const payload = {
    username: 'MO Legislative Tracker',
    embeds: [embed],
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
      const errorText = await response.text();
      throw new Error(`Discord API error: ${response.status} - ${errorText}`);
    }

    logger.info('Discord message sent successfully');
  } catch (error) {
    logger.error('Failed to send Discord message', {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Send a simple text message to Discord
 */
export async function sendDiscordText(content: string): Promise<void> {
  const webhookUrl = getDiscordWebhookUrl();

  if (!webhookUrl) {
    logger.warn('DISCORD_WEBHOOK_URL not configured');
    return;
  }

  const payload = {
    username: 'MO Legislative Tracker',
    content,
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
      throw new Error(`Discord API error: ${response.status}`);
    }

    logger.info('Discord text message sent');
  } catch (error) {
    logger.error('Failed to send Discord text', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Send multiple embeds to Discord
 */
export async function sendDiscordEmbeds(embeds: unknown[]): Promise<void> {
  const webhookUrl = getDiscordWebhookUrl();

  if (!webhookUrl) {
    logger.warn('DISCORD_WEBHOOK_URL not configured');
    return;
  }

  // Discord allows max 10 embeds per message
  const chunks = [];
  for (let i = 0; i < embeds.length; i += 10) {
    chunks.push(embeds.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    const payload = {
      username: 'MO Legislative Tracker',
      embeds: chunk,
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
        throw new Error(`Discord API error: ${response.status}`);
      }

      // Rate limit: wait between chunks
      if (chunks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.error('Failed to send Discord embeds', { error: (error as Error).message });
      throw error;
    }
  }

  logger.info(`Discord embeds sent: ${embeds.length}`);
}

export default {
  sendDiscordMessage,
  sendDiscordText,
  sendDiscordEmbeds,
};
