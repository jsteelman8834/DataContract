/**
 * Event Type Definitions
 *
 * Defines all movement indicators and event types for notifications
 */

export type EventType =
  | 'bill_status_change'
  | 'hearing_scheduled'
  | 'hearing_cancelled'
  | 'fiscal_note_released'
  | 'fiscal_note_revised'
  | 'passed_committee'
  | 'passed_chamber'
  | 'floor_action'
  | 'governor_action'
  | 'deadline_approaching'
  | 'new_bill_introduced'
  | 'amendment_filed'
  | 'amendment_adopted'
  | 'vote_recorded';

export interface LegislativeEvent {
  id: string;
  type: EventType;
  timestamp: string;
  billId: string;
  billNumber: string;
  chamber: 'house' | 'senate';

  // Event-specific data
  previousStatus?: string;
  newStatus?: string;
  committee?: string;
  hearingDate?: string;
  hearingTime?: string;
  fiscalImpact?: number;
  voteResult?: { yeas: number; nays: number };

  // Severity for prioritization
  severity: 'high' | 'medium' | 'low';

  // Human-readable description
  description: string;

  // Webhook delivery tracking
  webhooksDelivered: string[];
  webhooksPending: string[];

  createdAt: string;
}

export interface EventFilter {
  billPrefixes?: string[];        // e.g., ['HB', 'SB']
  chambers?: ('house' | 'senate')[];
  committees?: string[];
  eventTypes?: EventType[];
  minFiscalImpact?: number;
  severity?: ('high' | 'medium' | 'low')[];
}

/**
 * Severity mapping for event types
 */
export const EVENT_SEVERITY: Record<EventType, 'high' | 'medium' | 'low'> = {
  bill_status_change: 'medium',
  hearing_scheduled: 'medium',
  hearing_cancelled: 'medium',
  fiscal_note_released: 'medium',
  fiscal_note_revised: 'low',
  passed_committee: 'high',
  passed_chamber: 'high',
  floor_action: 'medium',
  governor_action: 'high',
  deadline_approaching: 'high',
  new_bill_introduced: 'low',
  amendment_filed: 'low',
  amendment_adopted: 'medium',
  vote_recorded: 'medium',
};

/**
 * Human-readable labels for event types
 */
export const EVENT_LABELS: Record<EventType, string> = {
  bill_status_change: 'Status Changed',
  hearing_scheduled: 'Hearing Scheduled',
  hearing_cancelled: 'Hearing Cancelled',
  fiscal_note_released: 'Fiscal Note Released',
  fiscal_note_revised: 'Fiscal Note Revised',
  passed_committee: 'Passed Committee',
  passed_chamber: 'Passed Chamber',
  floor_action: 'Floor Action',
  governor_action: 'Governor Action',
  deadline_approaching: 'Deadline Approaching',
  new_bill_introduced: 'New Bill Introduced',
  amendment_filed: 'Amendment Filed',
  amendment_adopted: 'Amendment Adopted',
  vote_recorded: 'Vote Recorded',
};

/**
 * Check if an event matches a filter
 */
export function matchesFilter(event: LegislativeEvent, filter: EventFilter): boolean {
  if (filter.billPrefixes?.length) {
    const prefix = event.billNumber.match(/^[A-Z]+/)?.[0];
    if (!prefix || !filter.billPrefixes.includes(prefix)) {
      return false;
    }
  }

  if (filter.chambers?.length && !filter.chambers.includes(event.chamber)) {
    return false;
  }

  if (filter.committees?.length && event.committee) {
    if (!filter.committees.includes(event.committee)) {
      return false;
    }
  }

  if (filter.eventTypes?.length && !filter.eventTypes.includes(event.type)) {
    return false;
  }

  if (filter.minFiscalImpact !== undefined && event.fiscalImpact !== undefined) {
    if (Math.abs(event.fiscalImpact) < filter.minFiscalImpact) {
      return false;
    }
  }

  if (filter.severity?.length && !filter.severity.includes(event.severity)) {
    return false;
  }

  return true;
}

export default {
  EVENT_SEVERITY,
  EVENT_LABELS,
  matchesFilter,
};
