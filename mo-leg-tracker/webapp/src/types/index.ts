// Missouri Legislative Tracker Types

export interface Session {
  id: string;
  sessionCode: string;
  year: number;
  type: 'regular' | 'extraordinary' | 'veto';
  label: string;
  assemblyNumber: number;
  startDate: string;
  endDate: string | null;
  active: boolean;
  createdAt: string;
}

export interface Bill {
  id: string;
  billNumber: string;
  billPrefix: 'HB' | 'SB' | 'HJR' | 'SJR' | 'HCR' | 'SCR' | 'HR' | 'SR';
  billSuffix: number;
  session: string;
  chamber: 'house' | 'senate';
  title: string;
  briefDescription: string;
  lrNumber: string;
  currentStatus: BillStatus;
  currentCommittee: string | null;
  effectiveDate: string;
  introducedDate: string;
  lastActionDate: string;
  withdrawn: boolean;
  senateBillId?: string; // Internal Senate BTS Web ID (for Senate bills only)
  createdAt: string;
  updatedAt: string;
}

export type BillStatus =
  | 'prefiled'
  | 'introduced'
  | 'first_read'
  | 'second_read'
  | 'referred'
  | 'in_committee'
  | 'hearing_scheduled'
  | 'hearing_held'
  | 'committee_substitute'
  | 'reported_do_pass'
  | 'reported_do_not_pass'
  | 'placed_on_calendar'
  | 'perfected'
  | 'third_read'
  | 'passed_chamber'
  | 'referred_other_chamber'
  | 'passed_second_chamber'
  | 'conference_committee'
  | 'truly_agreed'
  | 'sent_to_governor'
  | 'signed'
  | 'vetoed'
  | 'veto_overridden'
  | 'enacted'
  | 'failed'
  | 'tabled'
  | 'withdrawn';

export interface BillVersion {
  id: string;
  billId: string;
  lrNumber: string;
  versionCode: string;
  versionNumber: number;
  versionLabel: string;
  pdfUrl: string;
  textHash: string;
  pageCount: number;
  effectiveDate: string;
  createdAt: string;
}

export interface Amendment {
  id: string;
  billId: string;
  amendmentNumber: string;
  chamber: 'house' | 'senate';
  sponsor: string;
  title: string;
  summary: string;
  status: 'pending' | 'adopted' | 'failed' | 'withdrawn' | 'ruled_out_of_order';
  pdfUrl: string;
  filedDate: string;
  actionDate: string | null;
  createdAt: string;
}

export interface Summary {
  id: string;
  billId: string;
  versionId: string;
  summaryType: 'official' | 'staff' | 'ai_generated';
  plainLanguage: string;
  technicalSummary: string;
  keyProvisions: string[];
  affectedStatutes: string[];
  pdfUrl: string | null;
  createdAt: string;
}

export interface Action {
  id: string;
  billId: string;
  sequence: number;
  actionDate: string;
  actionCode: string;
  actionDescription: string;
  chamber: 'house' | 'senate';
  committeeId: string | null;
  journalPage: string | null;
  isKeyMilestone: boolean;
  createdAt: string;
}

export interface Vote {
  id: string;
  billId: string;
  voteDate: string;
  voteType: 'passage' | 'amendment' | 'procedural' | 'veto_override';
  chamber: 'house' | 'senate';
  result: 'passed' | 'failed';
  yeas: number;
  nays: number;
  present: number;
  absent: number;
  pdfUrl: string | null;
  createdAt: string;
}

export interface Member {
  id: string;
  chamber: 'house' | 'senate';
  district: string;
  firstName: string;
  lastName: string;
  fullName: string;
  party: 'R' | 'D' | 'I';
  title: 'Representative' | 'Senator';
  email: string;
  phone: string;
  photoUrl: string | null;
  termStart: string;
  termEnd: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Committee {
  id: string;
  chamber: 'house' | 'senate';
  name: string;
  shortName: string;
  type: 'standing' | 'special' | 'select' | 'joint' | 'conference';
  jurisdiction: string;
  meetingRoom: string;
  meetingSchedule: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Hearing {
  id: string;
  committeeId: string;
  hearingDate: string;
  hearingTime: string;
  room: string;
  type: 'public' | 'executive' | 'informational';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';
  agendaUrl: string | null;
  minutesUrl: string | null;
  videoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Testimony {
  id: string;
  hearingId: string;
  billId: string;
  witnessName: string;
  organization: string | null;
  position: 'support' | 'oppose' | 'informational';
  summary: string | null;
  pdfUrl: string | null;
  audioTimestamp: string | null;
  createdAt: string;
}

// Fiscal Note Types
export interface FiscalYearImpact {
  fiscalYear: number;
  cost: number;
  revenue: number;
  netImpact: number;
}

export interface FundImpact {
  generalRevenue: number;
  federalFunds: number;
  otherStateFunds: number;
  localGovernment: number;
}

export interface FiscalNote {
  id: string;
  billId: string;
  versionId: string | null;
  noteType: 'original' | 'revised' | 'supplemental' | 'corrected';

  // Core fiscal data
  fiscalYears: number[];
  estimatedCost: number | null;
  estimatedRevenue: number | null;
  netImpact: number;

  // Breakdown by fund type
  fundImpacts: FundImpact;

  // Multi-year projections
  yearByYearImpact: FiscalYearImpact[];

  // Uncertainty and confidence
  uncertaintyRange: { low: number; high: number } | null;
  assumptions: string[];

  // Metadata
  issuingAgency: string;
  analystName: string | null;
  summary: string;
  pdfUrl: string | null;
  publishedDate: string;
  createdAt: string;
  updatedAt: string;
}

export type FiscalImpactType = 'cost_only' | 'revenue_only' | 'both' | 'revenue_positive' | 'neutral';

export interface FiscalSummary {
  totalCost: number;
  totalRevenue: number;
  netImpact: number;
  weightedCost: number;
  weightedRevenue: number;
  weightedNetImpact: number;
  billCount: number;
  highImpactBillCount: number;
}

// Edge types for relationships
export interface Edge<T = Record<string, unknown>> {
  from: string;
  to: string;
  properties: T;
}

export interface SponsorshipEdge {
  sponsorType: 'primary' | 'co-sponsor' | 'handler';
}

export interface CommitteeAssignmentEdge {
  assignedDate: string;
  referralType: 'initial' | 're-referred' | 'amended';
  status: 'pending' | 'reported' | 'discharged';
}

export interface CommitteeMembershipEdge {
  role: 'chair' | 'vice_chair' | 'ranking_member' | 'member';
  startDate: string;
  endDate: string | null;
}

// Graph database structure
export interface LegislativeGraph {
  _meta: {
    version: string;
    schema: string;
    created: string;
    updated: string;
    session: string;
    description: string;
  };
  nodes: {
    sessions: Record<string, Session>;
    bills: Record<string, Bill>;
    bill_versions: Record<string, BillVersion>;
    amendments: Record<string, Amendment>;
    fiscal_notes: Record<string, FiscalNote>;
    summaries: Record<string, Summary>;
    actions: Record<string, Action>;
    votes: Record<string, Vote>;
    members: Record<string, Member>;
    committees: Record<string, Committee>;
    hearings: Record<string, Hearing>;
    testimony: Record<string, Testimony>;
  };
  edges: {
    SPONSORED_BY: Edge<SponsorshipEdge>[];
    CO_SPONSORED_BY: Edge<SponsorshipEdge>[];
    HAS_VERSION: Edge<{ isCurrent: boolean }>[];
    SUPERSEDES: Edge[];
    AMENDS: Edge[];
    PROPOSED_BY: Edge[];
    ASSIGNED_TO: Edge<CommitteeAssignmentEdge>[];
    SCHEDULED_FOR: Edge<{ agendaPosition: number }>[];
    HAS_ACTION: Edge[];
    HAS_VOTE: Edge[];
    CAST_VOTE: Edge<{ vote: 'yea' | 'nay' | 'present' | 'absent' }>[];
    MEMBER_OF: Edge<CommitteeMembershipEdge>[];
    HAS_FISCAL_NOTE: Edge[];
    HAS_SUMMARY: Edge[];
    HAS_TESTIMONY: Edge[];
    TESTIFIED_AT: Edge[];
    IN_SESSION: Edge[];
    ORIGINATED_IN: Edge[];
    CROSS_CHAMBER: Edge[];
    COMBINES: Edge[];
  };
  _indexes: {
    billsByNumber: Record<string, string>;
    billsByStatus: Record<string, string[]>;
    billsByCommittee: Record<string, string[]>;
    membersByDistrict: Record<string, string>;
    actionsByDate: Record<string, string[]>;
    edgesFrom: Record<string, { type: string; to: string }[]>;
    edgesTo: Record<string, { type: string; from: string }[]>;
  };
}

// UI specific types
export interface BillCard {
  bill: Bill;
  sponsor: Member | null;
  daysInCommittee: number;
  hasUpcomingHearing: boolean;
  summary: Summary | null;
  fiscalNote: FiscalNote | null;
  passageProbability: number;
  weightedFiscalImpact: number;
}

export interface CommitteeWithBills {
  committee: Committee;
  bills: BillCard[];
  members: MemberWithRole[];
  upcomingHearings: Hearing[];
}

export interface MemberWithRole extends Member {
  role: 'chair' | 'vice_chair' | 'ranking_member' | 'member';
}

export interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  type: 'hearing' | 'floor_session' | 'deadline';
  title: string;
  description: string;
  committee?: Committee;
  bills?: Bill[];
  room?: string;
}

// Status groupings for kanban
export const STATUS_STAGES = {
  introduction: ['prefiled', 'introduced', 'first_read', 'second_read'],
  committee: ['referred', 'in_committee', 'hearing_scheduled', 'hearing_held', 'committee_substitute'],
  floor: ['reported_do_pass', 'placed_on_calendar', 'perfected', 'third_read'],
  other_chamber: ['passed_chamber', 'referred_other_chamber', 'passed_second_chamber'],
  final: ['conference_committee', 'truly_agreed', 'sent_to_governor'],
  resolved: ['signed', 'vetoed', 'veto_overridden', 'enacted', 'failed', 'tabled', 'withdrawn'],
} as const;

export const STATUS_LABELS: Record<BillStatus, string> = {
  prefiled: 'Prefiled',
  introduced: 'Introduced',
  first_read: 'First Read',
  second_read: 'Second Read',
  referred: 'Referred to Committee',
  in_committee: 'In Committee',
  hearing_scheduled: 'Hearing Scheduled',
  hearing_held: 'Hearing Held',
  committee_substitute: 'Committee Substitute',
  reported_do_pass: 'Reported Do Pass',
  reported_do_not_pass: 'Reported Do Not Pass',
  placed_on_calendar: 'On Calendar',
  perfected: 'Perfected',
  third_read: 'Third Read',
  passed_chamber: 'Passed Chamber',
  referred_other_chamber: 'In Other Chamber',
  passed_second_chamber: 'Passed Both Chambers',
  conference_committee: 'Conference Committee',
  truly_agreed: 'Truly Agreed',
  sent_to_governor: 'Sent to Governor',
  signed: 'Signed',
  vetoed: 'Vetoed',
  veto_overridden: 'Veto Overridden',
  enacted: 'Enacted',
  failed: 'Failed',
  tabled: 'Tabled',
  withdrawn: 'Withdrawn',
};

// Fiscal-related types for dashboard
export interface CommitteeFiscalSummary {
  committee: Committee;
  totalCost: number;
  totalRevenue: number;
  netImpact: number;
  weightedNetImpact: number;
  billCount: number;
}

export interface SessionFiscalSnapshot {
  date: string;
  totalCost: number;
  totalRevenue: number;
  netImpact: number;
  weightedNetImpact: number;
  billsPassed: number;
  billsFailed: number;
}

export interface FiscalWatchItem {
  bill: Bill;
  fiscalNote: FiscalNote;
  passageProbability: number;
  weightedImpact: number;
  addedDate: string;
  alertThreshold: number;
}

export interface RiskQuadrantBill {
  bill: Bill;
  fiscalNote: FiscalNote;
  probability: number;
  absoluteImpact: number;
  impactType: 'cost' | 'revenue';
  quadrant: 'critical' | 'watch' | 'tracking' | 'monitor';
}
