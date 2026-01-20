/**
 * Email Notification Service
 *
 * Sends email notifications via SendGrid
 */

import { syncLogger as logger } from '../utils/logger';

// SendGrid client (loaded dynamically to avoid hard dependency)
let sgMail: typeof import('@sendgrid/mail') | null = null;

/**
 * Initialize SendGrid client
 */
async function initSendGrid(): Promise<void> {
  if (sgMail) return;

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    logger.warn('SENDGRID_API_KEY not configured, email notifications disabled');
    return;
  }

  try {
    sgMail = await import('@sendgrid/mail');
    sgMail.setApiKey(apiKey);
    logger.info('SendGrid initialized');
  } catch (error) {
    logger.warn('SendGrid not available', { error: (error as Error).message });
  }
}

/**
 * Email configuration
 */
interface EmailConfig {
  from: string;
  to: string[];
  replyTo?: string;
}

/**
 * Get email configuration from environment
 */
function getEmailConfig(): EmailConfig {
  return {
    from: process.env.EMAIL_FROM || 'noreply@mo-leg-tracker.local',
    to: (process.env.EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
    replyTo: process.env.EMAIL_REPLY_TO,
  };
}

/**
 * Send an email notification
 */
export async function sendEmail(
  subject: string,
  htmlContent: string,
  textContent: string
): Promise<void> {
  await initSendGrid();

  if (!sgMail) {
    logger.warn('SendGrid not initialized, skipping email');
    return;
  }

  const config = getEmailConfig();

  if (config.to.length === 0) {
    logger.warn('No email recipients configured');
    return;
  }

  const msg = {
    to: config.to,
    from: config.from,
    replyTo: config.replyTo,
    subject,
    text: textContent,
    html: htmlContent,
  };

  try {
    await sgMail.send(msg);
    logger.info('Email sent successfully', { subject, recipients: config.to.length });
  } catch (error) {
    logger.error('Failed to send email', {
      error: (error as Error).message,
      subject,
    });
    throw error;
  }
}

/**
 * Send batch emails (for digest)
 */
export async function sendBatchEmail(
  subject: string,
  htmlContent: string,
  textContent: string,
  recipients: string[]
): Promise<void> {
  await initSendGrid();

  if (!sgMail) {
    logger.warn('SendGrid not initialized, skipping batch email');
    return;
  }

  const config = getEmailConfig();

  const messages = recipients.map(to => ({
    to,
    from: config.from,
    replyTo: config.replyTo,
    subject,
    text: textContent,
    html: htmlContent,
  }));

  try {
    await sgMail.send(messages);
    logger.info('Batch email sent', { subject, recipients: recipients.length });
  } catch (error) {
    logger.error('Failed to send batch email', {
      error: (error as Error).message,
      subject,
    });
    throw error;
  }
}

export default {
  sendEmail,
  sendBatchEmail,
};
