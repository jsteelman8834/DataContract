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

// Bill list entry (from 261-BillList.XML)
interface RawBillListEntry {
  BillType?: string;
  BillNumber?: number;
  SessionYear?: number;
  SessionCode?: string;
  BillXMLLink?: string;
  LastTimeRun?: string;
}

// Full bill info (from individual bill XML like 261-HB2.xml)
interface RawHouseBill {
  BillNumber?: string;
  CurrentBillString?: string;
  Title?: {
    ShortTitle?: string;
    LongTitle?: string;
  };
  ProposedEffectiveDate?: string;
  CurrentLRNumber?: string;
  LastAction?: string;
  Calendar?: string;
  Sponsor?: {
    SponsorType?: string;
    FullName?: string;
    District?: string;
  } | Array<{
    SponsorType?: string;
    FullName?: string;
    District?: string;
  }>;
  BillText?: {
    BillTextLink?: string;
    LRNumber?: string;
    DocumentName?: string;
  } | Array<{
    BillTextLink?: string;
    LRNumber?: string;
    DocumentName?: string;
  }>;
  Action?: RawHouseAction | RawHouseAction[];
}

interface RawHouseAction {
  ActionDate?: string;
  Description?: string;
  ActionCode?: string;
  Chamber?: string;
  Committee?: string;
  JrnPg?: string;
  // Fields from individual bill XML
  PubDate?: string;
  ActivitySequence?: number;
  Guid?: string;
  Link?: string;
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
 * Parse the bill list feed - returns list of bill entries with links
 */
export async function fetchBillList(): Promise<ParsedBill[]> {
  const url = buildHouseUrl(config.house.feeds.billList, {
    SESSION: config.session.code,
  });

  logger.syncStart('fetch bill list', { url });
  const startTime = Date.now();

  try {
    const data = await fetchXml<{ ROOT?: { BillXML?: RawBillListEntry | RawBillListEntry[] } }>(url);

    const rawBills = data.ROOT?.BillXML;
    if (!rawBills) {
      logger.warn('No bills found in feed');
      return [];
    }

    const billArray = Array.isArray(rawBills) ? rawBills : [rawBills];

    // Convert bill list entries to ParsedBill with basic info
    // Full details require fetching individual bill XMLs
    const bills: ParsedBill[] = [];
    for (const entry of billArray) {
      if (!entry.BillType || !entry.BillNumber) continue;

      const prefix = entry.BillType;
      const suffix = entry.BillNumber;
      const billNumber = `${prefix} ${suffix}`;
      const id = generateBillId(prefix, suffix, config.session.code);

      bills.push({
        id,
        billNumber,
        billPrefix: prefix,
        billSuffix: suffix,
        session: config.session.code,
        chamber: 'house',
        title: '', // Will be filled by fetchBillDetail
        briefDescription: '',
        lrNumber: '',
        currentStatus: 'introduced',
        currentCommittee: null,
        effectiveDate: null,
        introducedDate: null,
        lastActionDate: null,
        withdrawn: false,
        sponsor: null,
        coSponsors: [],
        actions: [],
      });
    }

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
      const data = await fetchXml<{ ROOT?: { BillInformation?: RawHouseBill } }>(url);

      if (!data.ROOT?.BillInformation) {
        logger.warn(`Bill not found: ${prefix}${number}`);
        return null;
      }

      return parseBillFromDetail(data.ROOT.BillInformation, prefix, number);
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

/**
 * Parse bill from detailed XML (261-HB2.xml format)
 */
function parseBillFromDetail(raw: RawHouseBill, prefix: string, number: number): ParsedBill | null {
  const billId = generateBillId(prefix, number, config.session.code);

  // Parse sponsor from Sponsor object/array
  let sponsor: ParsedSponsor | null = null;
  if (raw.Sponsor) {
    const sponsorData = Array.isArray(raw.Sponsor)
      ? raw.Sponsor.find(s => s.SponsorType === 'Sponsor') || raw.Sponsor[0]
      : raw.Sponsor;

    if (sponsorData?.FullName) {
      sponsor = {
        memberId: sponsorData.District
          ? generateMemberId('house', String(sponsorData.District).padStart(3, '0'))
          : `member:unknown:${sponsorData.FullName.toLowerCase().replace(/\s+/g, '_')}`,
        name: sponsorData.FullName,
        district: sponsorData.District || null,
      };
    }
  }

  // Parse co-sponsors
  const coSponsors: ParsedSponsor[] = [];
  if (raw.Sponsor && Array.isArray(raw.Sponsor)) {
    for (const s of raw.Sponsor) {
      if (s.SponsorType !== 'Sponsor' && s.FullName) {
        coSponsors.push({
          memberId: s.District
            ? generateMemberId('house', String(s.District).padStart(3, '0'))
            : `member:unknown:${s.FullName.toLowerCase().replace(/\s+/g, '_')}`,
          name: s.FullName,
          district: s.District || null,
        });
      }
    }
  }

  // Parse actions
  const actions: ParsedAction[] = [];
  if (raw.Action) {
    const actionList = Array.isArray(raw.Action) ? raw.Action : [raw.Action];
    actionList.forEach((action, index) => {
      if (action.Description && action.PubDate) {
        actions.push({
          id: generateActionId(billId, index + 1),
          billId,
          sequence: action.ActivitySequence || index + 1,
          actionDate: parseDate(action.PubDate) || action.PubDate,
          actionCode: extractActionCode(action.Description),
          actionDescription: action.Description,
          chamber: 'house',
          committeeId: null,
          journalPage: null,
          isKeyMilestone: isKeyMilestone(extractActionCode(action.Description)),
        });
      }
    });
  }

  // Determine status from Calendar or LastAction
  let currentStatus = 'introduced';
  if (raw.Calendar) {
    currentStatus = mapStatusFromDescription(raw.Calendar);
  } else if (raw.LastAction) {
    currentStatus = mapStatusFromDescription(raw.LastAction);
  }

  // Parse dates
  const effectiveDate = raw.ProposedEffectiveDate ? parseDate(raw.ProposedEffectiveDate) : null;

  // Get last action date from actions
  let lastActionDate: string | null = null;
  if (actions.length > 0) {
    lastActionDate = actions.reduce((latest, action) =>
      action.actionDate > latest ? action.actionDate : latest
    , actions[0].actionDate);
  }

  // Find introduced date
  let introducedDate: string | null = null;
  if (actions.length > 0) {
    const introAction = actions.find(a =>
      a.actionCode === 'INTR' || a.actionCode === '1RD' || a.actionCode === 'PREF'
    );
    introducedDate = introAction?.actionDate || actions[actions.length - 1].actionDate;
  }

  // Get LR number from BillText
  let lrNumber = raw.CurrentLRNumber || '';
  if (raw.BillText) {
    const billText = Array.isArray(raw.BillText) ? raw.BillText[0] : raw.BillText;
    lrNumber = billText.LRNumber || lrNumber;
  }

  return {
    id: billId,
    billNumber: `${prefix} ${number}`,
    billPrefix: prefix,
    billSuffix: number,
    session: config.session.code,
    chamber: 'house',
    title: raw.Title?.LongTitle || raw.Title?.ShortTitle || '',
    briefDescription: raw.Title?.ShortTitle || raw.Title?.LongTitle || '',
    lrNumber,
    currentStatus,
    currentCommittee: null, // Would need to parse from actions
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
