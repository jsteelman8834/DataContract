/**
 * Notification Message Templates
 *
 * Templates for formatting event notifications across different channels
 */

import { type LegislativeEvent, type EventType, EVENT_LABELS } from '../events/types';

export interface FormattedMessage {
  subject: string;
  textBody: string;
  htmlBody: string;
  shortText: string;  // For SMS
  slackBlocks?: unknown[];
  discordEmbed?: unknown;
}

/**
 * Get severity emoji
 */
function getSeverityEmoji(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high': return '🔴';
    case 'medium': return '🟡';
    case 'low': return '🟢';
  }
}

/**
 * Get event type emoji
 */
function getEventEmoji(type: EventType): string {
  const emojis: Record<EventType, string> = {
    bill_status_change: '📋',
    hearing_scheduled: '📅',
    hearing_cancelled: '❌',
    fiscal_note_released: '💰',
    fiscal_note_revised: '💵',
    passed_committee: '✅',
    passed_chamber: '🏛️',
    floor_action: '🗣️',
    governor_action: '📝',
    deadline_approaching: '⏰',
    new_bill_introduced: '📄',
    amendment_filed: '📎',
    amendment_adopted: '✓',
    vote_recorded: '🗳️',
  };
  return emojis[type] || '📢';
}

/**
 * Format a legislative event into notification messages
 */
export function formatEventMessage(event: LegislativeEvent): FormattedMessage {
  const emoji = getEventEmoji(event.type);
  const severityEmoji = getSeverityEmoji(event.severity);
  const label = EVENT_LABELS[event.type];

  // Subject line
  const subject = `${event.billNumber}: ${label}`;

  // Short text for SMS (max 160 chars)
  const shortText = `MO Leg: ${event.billNumber} - ${label}. ${event.description.slice(0, 80)}`;

  // Plain text body
  const textBody = `
Missouri Legislative Alert
═══════════════════════════

Bill: ${event.billNumber}
Event: ${label}
Chamber: ${event.chamber.charAt(0).toUpperCase() + event.chamber.slice(1)}
Severity: ${event.severity.toUpperCase()}
Time: ${new Date(event.timestamp).toLocaleString()}

${event.description}

${event.previousStatus && event.newStatus ? `Status Change: ${event.previousStatus} → ${event.newStatus}` : ''}
${event.committee ? `Committee: ${event.committee}` : ''}
${event.hearingDate ? `Hearing: ${event.hearingDate} at ${event.hearingTime}` : ''}
${event.fiscalImpact !== undefined ? `Fiscal Impact: $${event.fiscalImpact.toLocaleString()}` : ''}

---
Missouri Legislative Tracker
  `.trim();

  // HTML body for email
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #1a365d; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .badge-high { background: #fed7d7; color: #c53030; }
    .badge-medium { background: #fef3c7; color: #d97706; }
    .badge-low { background: #c6f6d5; color: #2f855a; }
    .detail { margin: 8px 0; }
    .label { color: #718096; font-size: 14px; }
    .value { color: #1a202c; font-weight: 500; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #718096; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">${emoji} ${event.billNumber}</h1>
    <p style="margin: 8px 0 0 0; opacity: 0.9;">${label}</p>
  </div>
  <div class="content">
    <p style="font-size: 16px;">${event.description}</p>

    <div class="detail">
      <span class="label">Severity:</span>
      <span class="badge badge-${event.severity}">${event.severity.toUpperCase()}</span>
    </div>

    <div class="detail">
      <span class="label">Chamber:</span>
      <span class="value">${event.chamber.charAt(0).toUpperCase() + event.chamber.slice(1)}</span>
    </div>

    ${event.previousStatus && event.newStatus ? `
    <div class="detail">
      <span class="label">Status Change:</span>
      <span class="value">${event.previousStatus} → ${event.newStatus}</span>
    </div>
    ` : ''}

    ${event.committee ? `
    <div class="detail">
      <span class="label">Committee:</span>
      <span class="value">${event.committee}</span>
    </div>
    ` : ''}

    ${event.hearingDate ? `
    <div class="detail">
      <span class="label">Hearing:</span>
      <span class="value">${event.hearingDate} at ${event.hearingTime}</span>
    </div>
    ` : ''}

    ${event.fiscalImpact !== undefined ? `
    <div class="detail">
      <span class="label">Fiscal Impact:</span>
      <span class="value">$${event.fiscalImpact.toLocaleString()}</span>
    </div>
    ` : ''}

    <div class="footer">
      <p>Missouri Legislative Tracker</p>
      <p>Event ID: ${event.id}</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Slack blocks
  const slackBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${event.billNumber}: ${label}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: event.description,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${severityEmoji} *${event.severity.toUpperCase()}* | ${event.chamber} | ${new Date(event.timestamp).toLocaleString()}`,
        },
      ],
    },
  ];

  // Discord embed
  const discordEmbed = {
    title: `${emoji} ${event.billNumber}: ${label}`,
    description: event.description,
    color: event.severity === 'high' ? 0xdc2626 : event.severity === 'medium' ? 0xd97706 : 0x16a34a,
    fields: [
      { name: 'Chamber', value: event.chamber, inline: true },
      { name: 'Severity', value: event.severity, inline: true },
      ...(event.fiscalImpact !== undefined ? [{ name: 'Fiscal Impact', value: `$${event.fiscalImpact.toLocaleString()}`, inline: true }] : []),
    ],
    timestamp: event.timestamp,
    footer: {
      text: 'Missouri Legislative Tracker',
    },
  };

  return {
    subject,
    textBody,
    htmlBody,
    shortText,
    slackBlocks,
    discordEmbed,
  };
}

export default {
  formatEventMessage,
};
