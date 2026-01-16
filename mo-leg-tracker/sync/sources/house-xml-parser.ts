/**
 * Missouri House of Representatives XML Feed Parser
 *
 * Parses official XML feeds from documents.house.mo.gov
 */

import { XMLParser } from 'fast-xml-parser';
import {
  config,
  buildHouseUrl,
  generateBillId,
  generateMemberId,
  generateCommitteeId,
  generateActionId,
  ACTION_STATUS_MAP,
} from '../config';
import { billDetailRateLimiter } from '../utils/rate-limiter';
import { houseLogger as logger } from '../utils/logger';

// XML parser configuration
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  trimValues: true,
});

// Type definitions for parsed XML data
interface RawHouseBill {
  BillNum?: string;
  BillType?: string;
  Desc?: string;
  Sponsor?: string;
  LRNum?: string;
  CurrentStatus?: string;
  Committee?: string;
  LastAction?: string;
  LastActionDate?: string;
  EffectiveDate?: string;
  CoSponsors?: { Sponsor?: string | string[] };
  Actions?: { Action?: RawHouseAction | RawHouseAction[] };
}

interface RawHouseAction {
  ActionDate?: string;
  Description?: string;
  ActionCode?: string;
  Chamber?: string;
  Committee?: string;
  JrnPg?: string;
}

interface RawHouseMember {
  District?: number;
  FirstName?: string;
  LastName?: string;
  Party?: string;
  Title?: string;
  Email?: string;
  Phone?: string;
  PhotoURL?: string;
}

interface RawHouseCommittee {
  Code?: string;
  Name?: string;
  Type?: string;
  Chair?: string;
  ViceChair?: string;
  Room?: string;
}

interface RawHouseHearing {
  Committee?: string;
  HearingDate?: string;
  HearingTime?: string;
  Room?: string;
  Bills?: { Bill?: string | string[] };
}

// Normalized output types
export interface ParsedBill {
  id: string;
  billNumber: string;
  billPrefix: string;
  billSuffix: number;
  session: string;
  chamber: 'house' | 'senate';
  title: string;
  briefDescription: string;
  lrNumber: string;
  currentStatus: string;
  currentCommittee: string | null;
  effectiveDate: string | null;
  introducedDate: string | null;
  lastActionDate: string | null;
  withdrawn: boolean;
  sponsor: ParsedSponsor | null;
  coSponsors: ParsedSponsor[];
  actions: ParsedAction[];
}

export interface ParsedSponsor {
  memberId: string;
  name: string;
  district: string | null;
}

export interface ParsedAction {
  id: string;
  billId: string;
  sequence: number;
  actionDate: string;
  actionCode: string;
  actionDescription: string;
  chamber: string;
  committeeId: string | null;
  journalPage: string | null;
  isKeyMilestone: boolean;
}

export interface ParsedMember {
  id: string;
  chamber: 'house';
  district: string;
  firstName: string;
  lastName: string;
  fullName: string;
  party: 'R' | 'D' | 'I';
  title: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
}

export interface ParsedCommittee {
  id: string;
  chamber: 'house';
  name: string;
  shortName: string;
  type: 'standing' | 'special' | 'select' | 'joint';
  chairId: string | null;
  viceChairId: string | null;
  meetingRoom: string | null;
}

export interface ParsedHearing {
  id: string;
  committeeId: string;
  hearingDate: string;
  hearingTime: string;
  room: string;
  billIds: string[];
}

/**
 * Fetch and parse an XML feed
 */
async function fetchXml<T>(url: string): Promise<T> {
  logger.debug(`Fetching XML: ${url}`);

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/xml, text/xml',
      'User-Agent': 'MO-Leg-Tracker/1.0 (sync)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  const parsed = xmlParser.parse(text);

  logger.debug(`Parsed XML response`, { url, size: text.length });

  return parsed as T;
}

/**
 * Parse the bill list feed
 */
export async function fetchBillList(): Promise<ParsedBill[]> {
  const url = buildHouseUrl(config.house.feeds.billList, {
    SESSION: config.session.code,
  });

  logger.syncStart('fetch bill list', { url });
  const startTime = Date.now();

  try {
    const data = await fetchXml<{ BillList?: { Bill?: RawHouseBill | RawHouseBill[] } }>(url);

    const rawBills = data.BillList?.Bill;
    if (!rawBills) {
      logger.warn('No bills found in feed');
      return [];
    }

    const billArray = Array.isArray(rawBills) ? rawBills : [rawBills];
    const bills = billArray.map(parseBill).filter((b): b is ParsedBill => b !== null);

    logger.syncComplete('fetch bill list', { total: bills.length }, Date.now() - startTime);

    return bills;
  } catch (error) {
    logger.syncFailed('fetch bill list', error as Error, { url });
    throw error;
  }
}

/**
 * Fetch detailed bill information including actions
 */
export async function fetchBillDetail(prefix: string, number: number): Promise<ParsedBill | null> {
  const url = buildHouseUrl(config.house.billDetail, {
    SESSION: config.session.code,
    PREFIX: prefix,
    NUMBER: number,
  });

  return billDetailRateLimiter.execute(async () => {
    logger.debug(`Fetching bill detail: ${prefix}${number}`);

    try {
      const data = await fetchXml<{ BillInfo?: RawHouseBill }>(url);

      if (!data.BillInfo) {
        logger.warn(`Bill not found: ${prefix}${number}`);
        return null;
      }

      return parseBill(data.BillInfo, true);
    } catch (error) {
      logger.error(`Failed to fetch bill detail: ${prefix}${number}`, { error: (error as Error).message });
      return null;
    }
  });
}

/**
 * Parse the member list feed
 */
export async function fetchMemberList(): Promise<ParsedMember[]> {
  const url = buildHouseUrl(config.house.feeds.memberList, {
    SESSION: config.session.code,
  });

  logger.syncStart('fetch member list', { url });
  const startTime = Date.now();

  try {
    const data = await fetchXml<{ MemberList?: { Member?: RawHouseMember | RawHouseMember[] } }>(url);

    const rawMembers = data.MemberList?.Member;
    if (!rawMembers) {
      logger.warn('No members found in feed');
      return [];
    }

    const memberArray = Array.isArray(rawMembers) ? rawMembers : [rawMembers];
    const members = memberArray.map(parseMember).filter((m): m is ParsedMember => m !== null);

    logger.syncComplete('fetch member list', { total: members.length }, Date.now() - startTime);

    return members;
  } catch (error) {
    logger.syncFailed('fetch member list', error as Error, { url });
    throw error;
  }
}

/**
 * Parse the committee list feed
 */
export async function fetchCommitteeList(): Promise<ParsedCommittee[]> {
  const url = buildHouseUrl(config.house.feeds.committeeList, {
    SESSION: config.session.code,
  });

  logger.syncStart('fetch committee list', { url });
  const startTime = Date.now();

  try {
    const data = await fetchXml<{ CommitteeList?: { Committee?: RawHouseCommittee | RawHouseCommittee[] } }>(url);

    const rawCommittees = data.CommitteeList?.Committee;
    if (!rawCommittees) {
      logger.warn('No committees found in feed');
      return [];
    }

    const committeeArray = Array.isArray(rawCommittees) ? rawCommittees : [rawCommittees];
    const committees = committeeArray.map(parseCommittee).filter((c): c is ParsedCommittee => c !== null);

    logger.syncComplete('fetch committee list', { total: committees.length }, Date.now() - startTime);

    return committees;
  } catch (error) {
    logger.syncFailed('fetch committee list', error as Error, { url });
    throw error;
  }
}

/**
 * Parse the upcoming hearings feed
 */
export async function fetchHearingList(): Promise<ParsedHearing[]> {
  const url = buildHouseUrl(config.house.feeds.hearings, {
    SESSION: config.session.code,
  });

  logger.syncStart('fetch hearing list', { url });
  const startTime = Date.now();

  try {
    const data = await fetchXml<{ HearingList?: { Hearing?: RawHouseHearing | RawHouseHearing[] } }>(url);

    const rawHearings = data.HearingList?.Hearing;
    if (!rawHearings) {
      logger.debug('No hearings found in feed');
      return [];
    }

    const hearingArray = Array.isArray(rawHearings) ? rawHearings : [rawHearings];
    const hearings = hearingArray.map(parseHearing).filter((h): h is ParsedHearing => h !== null);

    logger.syncComplete('fetch hearing list', { total: hearings.length }, Date.now() - startTime);

    return hearings;
  } catch (error) {
    logger.syncFailed('fetch hearing list', error as Error, { url });
    throw error;
  }
}

// Helper functions

function parseBill(raw: RawHouseBill, includeActions = false): ParsedBill | null {
  if (!raw.BillNum || !raw.BillType) {
    return null;
  }

  const billNumber = raw.BillNum.trim();
  const match = billNumber.match(/([A-Z]+)\s*(\d+)/);
  if (!match) return null;

  const prefix = match[1];
  const suffix = parseInt(match[2], 10);
  const billId = generateBillId(prefix, suffix, config.session.code);

  // Parse sponsor
  let sponsor: ParsedSponsor | null = null;
  if (raw.Sponsor) {
    const sponsorMatch = raw.Sponsor.match(/(.+?)(?:\s*\((\d+)\))?$/);
    if (sponsorMatch) {
      sponsor = {
        memberId: sponsorMatch[2]
          ? generateMemberId('house', sponsorMatch[2])
          : `member:unknown:${raw.Sponsor.toLowerCase().replace(/\s+/g, '_')}`,
        name: sponsorMatch[1].trim(),
        district: sponsorMatch[2] || null,
      };
    }
  }

  // Parse co-sponsors
  const coSponsors: ParsedSponsor[] = [];
  if (raw.CoSponsors?.Sponsor) {
    const coSponsorList = Array.isArray(raw.CoSponsors.Sponsor)
      ? raw.CoSponsors.Sponsor
      : [raw.CoSponsors.Sponsor];

    for (const cs of coSponsorList) {
      const csMatch = cs.match(/(.+?)(?:\s*\((\d+)\))?$/);
      if (csMatch) {
        coSponsors.push({
          memberId: csMatch[2]
            ? generateMemberId('house', csMatch[2])
            : `member:unknown:${cs.toLowerCase().replace(/\s+/g, '_')}`,
          name: csMatch[1].trim(),
          district: csMatch[2] || null,
        });
      }
    }
  }

  // Parse actions
  const actions: ParsedAction[] = [];
  if (includeActions && raw.Actions?.Action) {
    const actionList = Array.isArray(raw.Actions.Action)
      ? raw.Actions.Action
      : [raw.Actions.Action];

    actionList.forEach((action, index) => {
      const parsed = parseAction(action, billId, index + 1);
      if (parsed) {
        actions.push(parsed);
      }
    });
  }

  // Determine current status from action code or text
  let currentStatus = 'introduced';
  if (raw.CurrentStatus) {
    const statusCode = raw.CurrentStatus.toUpperCase().trim();
    currentStatus = ACTION_STATUS_MAP[statusCode] || mapStatusFromDescription(raw.CurrentStatus);
  }

  // Parse dates
  const lastActionDate = raw.LastActionDate ? parseDate(raw.LastActionDate) : null;
  const effectiveDate = raw.EffectiveDate ? parseDate(raw.EffectiveDate) : null;

  // Find introduced date from actions
  let introducedDate: string | null = null;
  if (actions.length > 0) {
    const introAction = actions.find(a =>
      a.actionCode === 'INTR' || a.actionCode === '1RD' || a.actionCode === 'PREF'
    );
    introducedDate = introAction?.actionDate || actions[0].actionDate;
  }

  return {
    id: billId,
    billNumber: `${prefix} ${suffix}`,
    billPrefix: prefix,
    billSuffix: suffix,
    session: config.session.code,
    chamber: prefix.startsWith('H') ? 'house' : 'senate',
    title: raw.Desc?.trim() || '',
    briefDescription: raw.Desc?.trim() || '',
    lrNumber: raw.LRNum?.trim() || '',
    currentStatus,
    currentCommittee: raw.Committee ? generateCommitteeId('house', raw.Committee) : null,
    effectiveDate,
    introducedDate,
    lastActionDate,
    withdrawn: currentStatus === 'withdrawn',
    sponsor,
    coSponsors,
    actions,
  };
}

function parseAction(raw: RawHouseAction, billId: string, sequence: number): ParsedAction | null {
  if (!raw.ActionDate || !raw.Description) {
    return null;
  }

  const actionCode = raw.ActionCode?.trim() || extractActionCode(raw.Description);

  return {
    id: generateActionId(billId, sequence),
    billId,
    sequence,
    actionDate: parseDate(raw.ActionDate) || raw.ActionDate,
    actionCode,
    actionDescription: raw.Description.trim(),
    chamber: raw.Chamber?.toLowerCase() || 'house',
    committeeId: raw.Committee ? generateCommitteeId('house', raw.Committee) : null,
    journalPage: raw.JrnPg || null,
    isKeyMilestone: isKeyMilestone(actionCode),
  };
}

function parseMember(raw: RawHouseMember): ParsedMember | null {
  if (!raw.District || !raw.LastName) {
    return null;
  }

  const district = String(raw.District).padStart(3, '0');

  return {
    id: generateMemberId('house', district),
    chamber: 'house',
    district,
    firstName: raw.FirstName?.trim() || '',
    lastName: raw.LastName.trim(),
    fullName: `${raw.FirstName?.trim() || ''} ${raw.LastName.trim()}`.trim(),
    party: (raw.Party as 'R' | 'D' | 'I') || 'I',
    title: raw.Title || null,
    email: raw.Email || null,
    phone: raw.Phone || null,
    photoUrl: raw.PhotoURL || null,
  };
}

function parseCommittee(raw: RawHouseCommittee): ParsedCommittee | null {
  if (!raw.Name) {
    return null;
  }

  const name = raw.Name.trim();

  return {
    id: generateCommitteeId('house', name),
    chamber: 'house',
    name,
    shortName: raw.Code?.trim() || abbreviate(name),
    type: mapCommitteeType(raw.Type),
    chairId: raw.Chair ? `member:unknown:${raw.Chair.toLowerCase().replace(/\s+/g, '_')}` : null,
    viceChairId: raw.ViceChair ? `member:unknown:${raw.ViceChair.toLowerCase().replace(/\s+/g, '_')}` : null,
    meetingRoom: raw.Room || null,
  };
}

function parseHearing(raw: RawHouseHearing): ParsedHearing | null {
  if (!raw.Committee || !raw.HearingDate) {
    return null;
  }

  const committeeId = generateCommitteeId('house', raw.Committee);
  const hearingDate = parseDate(raw.HearingDate) || raw.HearingDate;

  // Parse bill list
  const billIds: string[] = [];
  if (raw.Bills?.Bill) {
    const billList = Array.isArray(raw.Bills.Bill) ? raw.Bills.Bill : [raw.Bills.Bill];
    for (const bill of billList) {
      const match = bill.match(/([A-Z]+)\s*(\d+)/);
      if (match) {
        billIds.push(generateBillId(match[1], parseInt(match[2], 10), config.session.code));
      }
    }
  }

  return {
    id: `hearing:${hearingDate}:${committeeId.split(':').pop()}`,
    committeeId,
    hearingDate,
    hearingTime: raw.HearingTime || '',
    room: raw.Room || '',
    billIds,
  };
}

// Utility functions

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Handle various date formats
  const formats = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) {
        // MM/DD/YYYY
        const [, month, day, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else {
        // Already YYYY-MM-DD
        return match[0];
      }
    }
  }

  return null;
}

function extractActionCode(description: string): string {
  // Common patterns in action descriptions
  const patterns: [RegExp, string][] = [
    [/prefiled/i, 'PREF'],
    [/introduced/i, 'INTR'],
    [/first read/i, '1RD'],
    [/second read/i, '2RD'],
    [/referred to/i, 'REF'],
    [/hearing scheduled/i, 'SCHED'],
    [/public hearing/i, 'HEAR'],
    [/do pass/i, 'DP'],
    [/perfected/i, 'PERF'],
    [/third read/i, '3RD'],
    [/passed/i, 'PASS'],
    [/truly agreed/i, 'TATFP'],
    [/signed by governor/i, 'GOV-S'],
    [/vetoed/i, 'GOV-V'],
    [/withdrawn/i, 'WDRN'],
  ];

  for (const [pattern, code] of patterns) {
    if (pattern.test(description)) {
      return code;
    }
  }

  return 'UNK';
}

function mapStatusFromDescription(description: string): string {
  const lower = description.toLowerCase();

  if (lower.includes('prefiled')) return 'prefiled';
  if (lower.includes('introduced')) return 'introduced';
  if (lower.includes('first read')) return 'first_read';
  if (lower.includes('referred')) return 'referred';
  if (lower.includes('committee')) return 'in_committee';
  if (lower.includes('hearing')) return 'hearing_scheduled';
  if (lower.includes('do pass')) return 'reported_do_pass';
  if (lower.includes('perfected')) return 'perfected';
  if (lower.includes('third read')) return 'third_read';
  if (lower.includes('passed')) return 'passed_origin';
  if (lower.includes('truly agreed')) return 'truly_agreed';
  if (lower.includes('signed')) return 'signed';
  if (lower.includes('vetoed')) return 'vetoed';
  if (lower.includes('enacted')) return 'enacted';
  if (lower.includes('withdrawn')) return 'withdrawn';

  return 'in_committee';
}

function isKeyMilestone(actionCode: string): boolean {
  const milestones = new Set([
    'PREF', 'INTR', '1RD', '2RD', 'REF', 'DP', 'PERF',
    '3RD', 'PASS', 'TATFP', 'GOV-S', 'GOV-V', 'WDRN',
  ]);
  return milestones.has(actionCode);
}

function mapCommitteeType(type?: string): 'standing' | 'special' | 'select' | 'joint' {
  if (!type) return 'standing';
  const lower = type.toLowerCase();
  if (lower.includes('special')) return 'special';
  if (lower.includes('select')) return 'select';
  if (lower.includes('joint')) return 'joint';
  return 'standing';
}

function abbreviate(name: string): string {
  // Create abbreviation from committee name
  return name
    .split(/\s+/)
    .filter(word => word.length > 2 && !['and', 'the', 'for', 'on'].includes(word.toLowerCase()))
    .map(word => word[0].toUpperCase())
    .join('');
}

export default {
  fetchBillList,
  fetchBillDetail,
  fetchMemberList,
  fetchCommitteeList,
  fetchHearingList,
};
