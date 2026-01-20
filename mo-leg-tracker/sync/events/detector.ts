/**
 * Event Detector
 *
 * Compares current and previous database states to detect legislative events
 */

import * as crypto from 'crypto';
import { readDatabase, type GraphDatabase } from '../database/graph-writer';
import { readSyncState, writeSyncState } from '../database/sync-state';
import { syncLogger as logger } from '../utils/logger';
import {
  type LegislativeEvent,
  type EventType,
  EVENT_SEVERITY,
  EVENT_LABELS,
} from './types';
import { addEvents, readEventStore } from './store';
import { getWebhookSubscriptions } from '../webhooks/config';

// Store previous state for comparison
let previousState: Record<string, unknown> | null = null;

/**
 * Generate unique event ID
 */
function generateEventId(type: EventType, billId: string, timestamp: string): string {
  const hash = crypto.createHash('sha256')
    .update(`${type}:${billId}:${timestamp}`)
    .digest('hex')
    .slice(0, 12);
  return `event:${hash}`;
}

/**
 * Get all webhook IDs that match an event
 */
function getMatchingWebhooks(event: Partial<LegislativeEvent>): string[] {
  const subscriptions = getWebhookSubscriptions();
  const matchingIds: string[] = [];

  for (const sub of subscriptions) {
    if (!sub.enabled) continue;

    // Check event type filter
    if (sub.filter.eventTypes?.length) {
      if (!sub.filter.eventTypes.includes(event.type!)) continue;
    }

    // Check chamber filter
    if (sub.filter.chambers?.length) {
      if (!sub.filter.chambers.includes(event.chamber!)) continue;
    }

    // Check bill prefix filter
    if (sub.filter.billPrefixes?.length) {
      const prefix = event.billNumber?.match(/^[A-Z]+/)?.[0];
      if (!prefix || !sub.filter.billPrefixes.includes(prefix)) continue;
    }

    // Check fiscal threshold
    if (sub.filter.minFiscalImpact !== undefined && event.fiscalImpact !== undefined) {
      if (Math.abs(event.fiscalImpact) < sub.filter.minFiscalImpact) continue;
    }

    matchingIds.push(sub.id);
  }

  return matchingIds;
}

/**
 * Create an event object
 */
function createEvent(
  type: EventType,
  billId: string,
  billNumber: string,
  chamber: 'house' | 'senate',
  description: string,
  extraData: Partial<LegislativeEvent> = {}
): LegislativeEvent {
  const timestamp = new Date().toISOString();
  const severity = extraData.severity || EVENT_SEVERITY[type];

  const event: LegislativeEvent = {
    id: generateEventId(type, billId, timestamp),
    type,
    timestamp,
    billId,
    billNumber,
    chamber,
    severity,
    description,
    webhooksDelivered: [],
    webhooksPending: [],
    createdAt: timestamp,
    ...extraData,
  };

  // Add matching webhooks to pending
  event.webhooksPending = getMatchingWebhooks(event);

  return event;
}

/**
 * Detect status change events
 */
function detectStatusChanges(
  previousBills: Record<string, unknown>,
  currentBills: Record<string, unknown>
): LegislativeEvent[] {
  const events: LegislativeEvent[] = [];

  for (const [id, currentBill] of Object.entries(currentBills)) {
    const bill = currentBill as Record<string, unknown>;
    const previousBill = previousBills[id] as Record<string, unknown> | undefined;

    if (!previousBill) {
      // New bill introduced
      events.push(createEvent(
        'new_bill_introduced',
        id,
        bill.billNumber as string,
        bill.chamber as 'house' | 'senate',
        `New bill introduced: ${bill.billNumber} - ${bill.title}`
      ));
      continue;
    }

    const prevStatus = previousBill.currentStatus as string;
    const currStatus = bill.currentStatus as string;

    if (prevStatus !== currStatus) {
      // Determine specific event type based on status change
      let eventType: EventType = 'bill_status_change';
      let severity = EVENT_SEVERITY['bill_status_change'];

      if (currStatus === 'reported_do_pass') {
        eventType = 'passed_committee';
        severity = 'high';
      } else if (currStatus === 'passed_chamber') {
        eventType = 'passed_chamber';
        severity = 'high';
      } else if (['signed', 'vetoed', 'enacted'].includes(currStatus)) {
        eventType = 'governor_action';
        severity = 'high';
      } else if (['placed_on_calendar', 'perfected', 'third_read'].includes(currStatus)) {
        eventType = 'floor_action';
        severity = 'medium';
      }

      events.push(createEvent(
        eventType,
        id,
        bill.billNumber as string,
        bill.chamber as 'house' | 'senate',
        `${bill.billNumber} status changed: ${prevStatus} → ${currStatus}`,
        {
          previousStatus: prevStatus,
          newStatus: currStatus,
          severity,
        }
      ));
    }
  }

  return events;
}

/**
 * Detect hearing changes
 */
function detectHearingChanges(
  previousHearings: Record<string, unknown>,
  currentHearings: Record<string, unknown>,
  bills: Record<string, unknown>
): LegislativeEvent[] {
  const events: LegislativeEvent[] = [];

  // Detect new hearings
  for (const [id, currentHearing] of Object.entries(currentHearings)) {
    const hearing = currentHearing as Record<string, unknown>;

    if (!previousHearings[id]) {
      // This is a new hearing - need to create events for all bills
      // But we need bill info. For now, create a general event
      events.push(createEvent(
        'hearing_scheduled',
        id,
        'Multiple Bills',
        'house', // Default, would need to determine from committee
        `New hearing scheduled for ${hearing.hearingDate} at ${hearing.hearingTime}`,
        {
          hearingDate: hearing.hearingDate as string,
          hearingTime: hearing.hearingTime as string,
          committee: hearing.committeeId as string,
        }
      ));
    } else {
      const prevHearing = previousHearings[id] as Record<string, unknown>;

      // Check for cancellation
      if (hearing.status === 'cancelled' && prevHearing.status !== 'cancelled') {
        events.push(createEvent(
          'hearing_cancelled',
          id,
          'Multiple Bills',
          'house',
          `Hearing cancelled that was scheduled for ${hearing.hearingDate}`,
          {
            hearingDate: hearing.hearingDate as string,
            committee: hearing.committeeId as string,
          }
        ));
      }
    }
  }

  return events;
}

/**
 * Detect fiscal note changes
 */
function detectFiscalNoteChanges(
  previousNotes: Record<string, unknown>,
  currentNotes: Record<string, unknown>,
  bills: Record<string, unknown>
): LegislativeEvent[] {
  const events: LegislativeEvent[] = [];

  for (const [id, currentNote] of Object.entries(currentNotes)) {
    const note = currentNote as Record<string, unknown>;
    const previousNote = previousNotes[id] as Record<string, unknown> | undefined;

    if (!previousNote) {
      // Find associated bill
      const billId = note.billId as string;
      const bill = bills[billId] as Record<string, unknown> | undefined;

      if (bill) {
        events.push(createEvent(
          'fiscal_note_released',
          billId,
          bill.billNumber as string,
          bill.chamber as 'house' | 'senate',
          `Fiscal note released for ${bill.billNumber}: Net impact $${note.netImpact}`,
          {
            fiscalImpact: note.netImpact as number,
          }
        ));
      }
    } else {
      // Check for revision
      if (note.updatedAt !== previousNote.updatedAt) {
        const billId = note.billId as string;
        const bill = bills[billId] as Record<string, unknown> | undefined;

        if (bill) {
          events.push(createEvent(
            'fiscal_note_revised',
            billId,
            bill.billNumber as string,
            bill.chamber as 'house' | 'senate',
            `Fiscal note revised for ${bill.billNumber}: New net impact $${note.netImpact}`,
            {
              fiscalImpact: note.netImpact as number,
            }
          ));
        }
      }
    }
  }

  return events;
}

/**
 * Detect and store all events by comparing database states
 */
export async function detectAndStoreEvents(): Promise<LegislativeEvent[]> {
  logger.info('Starting event detection...');

  const db = await readDatabase();
  const syncState = readSyncState();

  // Get previous state from sync state
  const prevState = syncState.previousSnapshot;

  if (!prevState) {
    logger.info('No previous state available, storing current state for next comparison');
    syncState.previousSnapshot = {
      bills: db.nodes.bills,
      hearings: db.nodes.hearings,
      fiscal_notes: db.nodes.fiscal_notes,
      capturedAt: new Date().toISOString(),
    };
    writeSyncState(syncState);
    return [];
  }

  const allEvents: LegislativeEvent[] = [];

  // Detect status changes
  const statusEvents = detectStatusChanges(
    prevState.bills as Record<string, unknown>,
    db.nodes.bills as unknown as Record<string, unknown>
  );
  allEvents.push(...statusEvents);

  // Detect hearing changes
  const hearingEvents = detectHearingChanges(
    prevState.hearings as Record<string, unknown>,
    db.nodes.hearings as unknown as Record<string, unknown>,
    db.nodes.bills as unknown as Record<string, unknown>
  );
  allEvents.push(...hearingEvents);

  // Detect fiscal note changes
  const fiscalEvents = detectFiscalNoteChanges(
    prevState.fiscal_notes as Record<string, unknown>,
    db.nodes.fiscal_notes as unknown as Record<string, unknown>,
    db.nodes.bills as unknown as Record<string, unknown>
  );
  allEvents.push(...fiscalEvents);

  // Store events
  if (allEvents.length > 0) {
    addEvents(allEvents);
    logger.info(`Detected and stored ${allEvents.length} events`, {
      statusChanges: statusEvents.length,
      hearingChanges: hearingEvents.length,
      fiscalChanges: fiscalEvents.length,
    });
  } else {
    logger.info('No new events detected');
  }

  // Update previous state for next comparison
  syncState.previousSnapshot = {
    bills: db.nodes.bills,
    hearings: db.nodes.hearings,
    fiscal_notes: db.nodes.fiscal_notes,
    capturedAt: new Date().toISOString(),
  };
  writeSyncState(syncState);

  return allEvents;
}

export default {
  detectAndStoreEvents,
};
