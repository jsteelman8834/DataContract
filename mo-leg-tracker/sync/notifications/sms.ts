/**
 * SMS Notification Service
 *
 * Sends SMS notifications via Twilio
 */

import { syncLogger as logger } from '../utils/logger';

// Twilio client (loaded dynamically)
let twilioClient: ReturnType<typeof import('twilio')> | null = null;

/**
 * Initialize Twilio client
 */
async function initTwilio(): Promise<void> {
  if (twilioClient) return;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    logger.warn('Twilio credentials not configured, SMS notifications disabled');
    return;
  }

  try {
    const twilio = await import('twilio');
    twilioClient = twilio.default(accountSid, authToken);
    logger.info('Twilio initialized');
  } catch (error) {
    logger.warn('Twilio not available', { error: (error as Error).message });
  }
}

/**
 * Get SMS configuration from environment
 */
function getSmsConfig(): { from: string; to: string[] } {
  return {
    from: process.env.TWILIO_PHONE_NUMBER || '',
    to: (process.env.SMS_RECIPIENTS || '').split(',').filter(Boolean),
  };
}

/**
 * Send an SMS notification
 */
export async function sendSms(message: string): Promise<void> {
  await initTwilio();

  if (!twilioClient) {
    logger.warn('Twilio not initialized, skipping SMS');
    return;
  }

  const config = getSmsConfig();

  if (!config.from) {
    logger.warn('TWILIO_PHONE_NUMBER not configured');
    return;
  }

  if (config.to.length === 0) {
    logger.warn('No SMS recipients configured');
    return;
  }

  // Truncate message if too long (SMS limit is 160 chars for single segment)
  const truncatedMessage = message.length > 160 ? message.slice(0, 157) + '...' : message;

  for (const recipient of config.to) {
    try {
      await twilioClient.messages.create({
        body: truncatedMessage,
        from: config.from,
        to: recipient,
      });

      logger.info('SMS sent', { recipient: recipient.slice(-4) }); // Log last 4 digits only
    } catch (error) {
      logger.error('Failed to send SMS', {
        error: (error as Error).message,
        recipient: recipient.slice(-4),
      });
      throw error;
    }
  }
}

/**
 * Send SMS to a specific number
 */
export async function sendSmsTo(phoneNumber: string, message: string): Promise<void> {
  await initTwilio();

  if (!twilioClient) {
    logger.warn('Twilio not initialized');
    return;
  }

  const config = getSmsConfig();

  if (!config.from) {
    logger.warn('TWILIO_PHONE_NUMBER not configured');
    return;
  }

  const truncatedMessage = message.length > 160 ? message.slice(0, 157) + '...' : message;

  try {
    await twilioClient.messages.create({
      body: truncatedMessage,
      from: config.from,
      to: phoneNumber,
    });

    logger.info('SMS sent to specific number');
  } catch (error) {
    logger.error('Failed to send SMS', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Check if SMS is configured and available
 */
export async function isSmsAvailable(): Promise<boolean> {
  await initTwilio();
  const config = getSmsConfig();
  return twilioClient !== null && !!config.from && config.to.length > 0;
}

export default {
  sendSms,
  sendSmsTo,
  isSmsAvailable,
};
