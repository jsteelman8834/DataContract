/**
 * Missouri Senate HTML Scraper
 *
 * Scrapes data from the Senate website which does not provide XML feeds
 * Uses cheerio for HTML parsing
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import {
  config,
  buildSenateUrl,
  generateBillId,
  generateMemberId,
  generateCommitteeId,
  generateActionId,
} from '../config';
import { senateRateLimiter } from '../utils/rate-limiter';
import { senateLogger as logger } from '../utils/logger';

// Type definitions for parsed data
export interface ParsedSenateBill {
  id: string;
  billNumber: string;
  billPrefix: string;
  billSuffix: number;
  session: string;
  chamber: 'senate';
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
  senateBillId: string; // Internal Senate BillID for further lookups
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

export interface ParsedSenator {
  id: string;
  chamber: 'senate';
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

export interface ParsedSenateCommittee {
  id: string;
  chamber: 'senate';
  name: string;
  shortName: string;
  type: 'standing' | 'special' | 'select' | 'joint';
  chairId: string | null;
  viceChairId: string | null;
}

/**
 * Fetch and parse HTML with rate limiting
 */
async function fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
  return senateRateLimiter.execute(async () => {
    logger.debug(`Fetching HTML: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'MO-Leg-Tracker/1.0 (sync)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    logger.debug(`Fetched HTML`, { url, size: html.length });

    return cheerio.load(html);
  });
}

/**
 * Fetch plain text file
 */
async function fetchText(url: string): Promise<string> {
  return senateRateLimiter.execute(async () => {
    logger.debug(`Fetching text: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'text/plain',
        'User-Agent': 'MO-Leg-Tracker/1.0 (sync)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  });
}

/**
 * Fetch bill list from Senate BillTracking app
 */
export async function fetchSenateBillList(): Promise<ParsedSenateBill[]> {
  const url = buildSenateUrl(config.senate.billTracking.billList, {});

  logger.syncStart('fetch Senate bill list', { url });
  const startTime = Date.now();

  try {
    const $ = await fetchHtml(url);
    const bills: ParsedSenateBill[] = [];

    // Parse bill table rows
    // The table structure may vary - adjust selectors as needed
    $('table.bill-list tbody tr, .bill-list-item, [data-bill-id]').each((_, element) => {
      const bill = parseBillRow($, $(element));
      if (bill) {
        bills.push(bill);
      }
    });

    // Alternative: Try parsing from links
    if (bills.length === 0) {
      $('a[href*="BillID="], a[href*="BillSuffix="]').each((_, element) => {
        const href = $(element).attr('href') || '';
        const text = $(element).text().trim();

        const billIdMatch = href.match(/BillID=(\d+)/);
        const billNumMatch = text.match(/(S[A-Z]*)\s*(\d+)/);

        if (billNumMatch) {
          const prefix = billNumMatch[1];
          const suffix = parseInt(billNumMatch[2], 10);
          const id = generateBillId(prefix, suffix, config.session.code);

          // Avoid duplicates
          if (!bills.find(b => b.id === id)) {
            bills.push({
              id,
              billNumber: `${prefix} ${suffix}`,
              billPrefix: prefix,
              billSuffix: suffix,
              session: config.session.code,
              chamber: 'senate',
              title: '',
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
              senateBillId: billIdMatch ? billIdMatch[1] : '',
            });
          }
        }
      });
    }

    logger.syncComplete('fetch Senate bill list', { total: bills.length }, Date.now() - startTime);

    return bills;
  } catch (error) {
    logger.syncFailed('fetch Senate bill list', error as Error, { url });
    throw error;
  }
}

/**
 * Fetch detailed bill information from BTS Web
 */
export async function fetchSenateBillDetail(
  prefix: string,
  number: number
): Promise<ParsedSenateBill | null> {
  const url = buildSenateUrl(
    config.senate.btsWeb.basePath + config.senate.btsWeb.billByNumber,
    { PREFIX: prefix, NUMBER: number }
  );

  logger.debug(`Fetching Senate bill detail: ${prefix}${number}`);

  try {
    const $ = await fetchHtml(url);
    return parseBillDetailPage($, prefix, number);
  } catch (error) {
    logger.error(`Failed to fetch Senate bill detail: ${prefix}${number}`, {
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Fetch bill actions from Actions.aspx page
 */
export async function fetchSenateBillActions(
  billId: string,
  senateBillId: string
): Promise<ParsedAction[]> {
  const url = buildSenateUrl(
    config.senate.btsWeb.basePath + config.senate.btsWeb.actions,
    { ID: senateBillId }
  );

  logger.debug(`Fetching Senate bill actions: ${billId}`);

  try {
    const $ = await fetchHtml(url);
    return parseActionsPage($, billId);
  } catch (error) {
    logger.error(`Failed to fetch Senate bill actions: ${billId}`, {
      error: (error as Error).message,
    });
    return [];
  }
}

/**
 * Fetch senator list
 */
export async function fetchSenatorList(): Promise<ParsedSenator[]> {
  const url = buildSenateUrl(config.senate.members.list, {});

  logger.syncStart('fetch Senator list', { url });
  const startTime = Date.now();

  try {
    const $ = await fetchHtml(url);
    const senators: ParsedSenator[] = [];

    // Parse senator cards/rows
    $('.senator-card, .member-row, [data-district]').each((_, element) => {
      const senator = parseSenatorElement($, $(element));
      if (senator) {
        senators.push(senator);
      }
    });

    // Alternative: Parse from table rows
    if (senators.length === 0) {
      $('table tbody tr').each((_, element) => {
        const senator = parseSenatorTableRow($, $(element));
        if (senator) {
          senators.push(senator);
        }
      });
    }

    logger.syncComplete('fetch Senator list', { total: senators.length }, Date.now() - startTime);

    return senators;
  } catch (error) {
    logger.syncFailed('fetch Senator list', error as Error, { url });
    throw error;
  }
}

/**
 * Fetch committee list
 */
export async function fetchSenateCommitteeList(): Promise<ParsedSenateCommittee[]> {
  const url = buildSenateUrl(config.senate.committees.list, {});

  logger.syncStart('fetch Senate committee list', { url });
  const startTime = Date.now();

  try {
    const $ = await fetchHtml(url);
    const committees: ParsedSenateCommittee[] = [];

    // Parse committee entries
    $('.committee-item, .committee-card, [data-committee-id]').each((_, element) => {
      const committee = parseCommitteeElement($, $(element));
      if (committee) {
        committees.push(committee);
      }
    });

    // Alternative: Parse from links
    if (committees.length === 0) {
      $('a[href*="CommitteeDetails"]').each((_, element) => {
        const name = $(element).text().trim();
        if (name && !name.includes('http')) {
          const id = generateCommitteeId('senate', name);
          if (!committees.find(c => c.id === id)) {
            committees.push({
              id,
              chamber: 'senate',
              name,
              shortName: abbreviate(name),
              type: categorizeCommittee(name),
              chairId: null,
              viceChairId: null,
            });
          }
        }
      });
    }

    logger.syncComplete('fetch Senate committee list', { total: committees.length }, Date.now() - startTime);

    return committees;
  } catch (error) {
    logger.syncFailed('fetch Senate committee list', error as Error, { url });
    throw error;
  }
}

/**
 * Fetch bills with statute mappings from text file
 */
export async function fetchBillStatuteMapping(): Promise<Map<string, string[]>> {
  const yearShort = String(config.session.year).slice(-2);
  const url = `${config.senate.baseUrl}${config.senate.textFiles.byBill.replace('{YY}', yearShort)}`;

  logger.syncStart('fetch bill statute mapping', { url });
  const startTime = Date.now();

  try {
    const text = await fetchText(url);
    const mapping = new Map<string, string[]>();

    // Parse text file format: BILL_NUMBER\tSTATUTE1,STATUTE2,...
    const lines = text.split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const billRef = parts[0].trim();
        const statutes = parts.slice(1).join(' ').split(',').map(s => s.trim()).filter(Boolean);

        const match = billRef.match(/(S[A-Z]*)\s*(\d+)/);
        if (match) {
          const billId = generateBillId(match[1], parseInt(match[2], 10), config.session.code);
          mapping.set(billId, statutes);
        }
      }
    }

    logger.syncComplete('fetch bill statute mapping', { total: mapping.size }, Date.now() - startTime);

    return mapping;
  } catch (error) {
    logger.syncFailed('fetch bill statute mapping', error as Error, { url });
    return new Map();
  }
}

// Parser helper functions

function parseBillRow($: cheerio.CheerioAPI, $row: cheerio.Cheerio<Element>): ParsedSenateBill | null {
  // Extract bill number from row
  const billText = $row.find('a, .bill-number, td:first-child').first().text().trim();
  const match = billText.match(/(S[A-Z]*)\s*(\d+)/);

  if (!match) return null;

  const prefix = match[1];
  const suffix = parseInt(match[2], 10);
  const id = generateBillId(prefix, suffix, config.session.code);

  // Extract other fields
  const title = $row.find('.bill-title, td:nth-child(2)').text().trim();
  const sponsor = $row.find('.sponsor, td:nth-child(3)').text().trim();
  const status = $row.find('.status, td:nth-child(4)').text().trim();

  // Extract Senate BillID from link
  const href = $row.find('a[href*="BillID"]').attr('href') || '';
  const billIdMatch = href.match(/BillID=(\d+)/);

  return {
    id,
    billNumber: `${prefix} ${suffix}`,
    billPrefix: prefix,
    billSuffix: suffix,
    session: config.session.code,
    chamber: 'senate',
    title: title || '',
    briefDescription: title || '',
    lrNumber: '',
    currentStatus: mapStatusFromText(status),
    currentCommittee: null,
    effectiveDate: null,
    introducedDate: null,
    lastActionDate: null,
    withdrawn: status.toLowerCase().includes('withdrawn'),
    sponsor: sponsor ? { memberId: '', name: sponsor, district: null } : null,
    coSponsors: [],
    actions: [],
    senateBillId: billIdMatch ? billIdMatch[1] : '',
  };
}

function parseBillDetailPage(
  $: cheerio.CheerioAPI,
  prefix: string,
  number: number
): ParsedSenateBill | null {
  const id = generateBillId(prefix, number, config.session.code);

  // Extract title
  const title = $('.bill-title, #billTitle, h1, h2').first().text().trim()
    .replace(new RegExp(`^${prefix}\\s*${number}\\s*[-–]?\\s*`, 'i'), '');

  // Extract sponsor
  const sponsorText = $('label:contains("Sponsor"), th:contains("Sponsor")').next().text().trim() ||
    $('.sponsor-name').text().trim();
  let sponsor: ParsedSponsor | null = null;
  if (sponsorText) {
    const match = sponsorText.match(/(.+?)(?:\s*\(District\s*(\d+)\))?$/i);
    sponsor = {
      memberId: match?.[2] ? generateMemberId('senate', match[2]) : '',
      name: match?.[1]?.trim() || sponsorText,
      district: match?.[2] || null,
    };
  }

  // Extract co-sponsors
  const coSponsors: ParsedSponsor[] = [];
  $('label:contains("Co-Sponsor"), th:contains("Co-Sponsor")').next().find('a, span').each((_, el) => {
    const name = $(el).text().trim();
    if (name) {
      coSponsors.push({
        memberId: '',
        name,
        district: null,
      });
    }
  });

  // Extract status
  const statusText = $('label:contains("Status"), th:contains("Status")').next().text().trim() ||
    $('.bill-status').text().trim();

  // Extract LR Number
  const lrNumber = $('label:contains("LR"), th:contains("LR")').next().text().trim() ||
    $('[data-lr-number]').attr('data-lr-number') || '';

  // Extract committee
  const committeeText = $('label:contains("Committee"), th:contains("Committee")').next().text().trim();
  const currentCommittee = committeeText ? generateCommitteeId('senate', committeeText) : null;

  // Extract effective date
  const effectiveDateText = $('label:contains("Effective"), th:contains("Effective")').next().text().trim();
  const effectiveDate = parseDate(effectiveDateText);

  // Extract BillID for actions lookup
  const billIdMatch = $('input[name="BillID"], [data-bill-id]').attr('value') ||
    $('a[href*="BillID="]').attr('href')?.match(/BillID=(\d+)/)?.[1] || '';

  return {
    id,
    billNumber: `${prefix} ${number}`,
    billPrefix: prefix,
    billSuffix: number,
    session: config.session.code,
    chamber: 'senate',
    title,
    briefDescription: title,
    lrNumber,
    currentStatus: mapStatusFromText(statusText),
    currentCommittee,
    effectiveDate,
    introducedDate: null,
    lastActionDate: null,
    withdrawn: statusText.toLowerCase().includes('withdrawn'),
    sponsor,
    coSponsors,
    actions: [],
    senateBillId: billIdMatch,
  };
}

function parseActionsPage($: cheerio.CheerioAPI, billId: string): ParsedAction[] {
  const actions: ParsedAction[] = [];
  let sequence = 0;

  // Parse actions table
  $('table tbody tr, .action-row').each((_, element) => {
    const $row = $(element);
    const dateText = $row.find('td:nth-child(1), .action-date').text().trim();
    const description = $row.find('td:nth-child(2), .action-description').text().trim();
    const journalPage = $row.find('td:nth-child(3), .journal-page').text().trim();

    if (dateText && description) {
      sequence++;
      const actionCode = extractActionCode(description);

      actions.push({
        id: generateActionId(billId, sequence),
        billId,
        sequence,
        actionDate: parseDate(dateText) || dateText,
        actionCode,
        actionDescription: description,
        chamber: inferChamber(description),
        committeeId: extractCommittee(description),
        journalPage: journalPage || null,
        isKeyMilestone: isKeyMilestone(actionCode),
      });
    }
  });

  return actions;
}

function parseSenatorElement(
  $: cheerio.CheerioAPI,
  $element: cheerio.Cheerio<Element>
): ParsedSenator | null {
  const district = $element.attr('data-district') ||
    $element.find('.district').text().replace(/\D/g, '') ||
    '';

  if (!district) return null;

  const name = $element.find('.senator-name, .name, h3, h4').first().text().trim();
  const nameParts = name.split(/\s+/);
  const lastName = nameParts.pop() || '';
  const firstName = nameParts.join(' ');

  const party = $element.find('.party').text().trim().charAt(0) as 'R' | 'D' | 'I' || 'I';
  const email = $element.find('a[href^="mailto:"]').attr('href')?.replace('mailto:', '') || null;
  const phone = $element.find('.phone, [data-phone]').text().trim() || null;
  const photoUrl = $element.find('img').attr('src') || null;

  return {
    id: generateMemberId('senate', district.padStart(2, '0')),
    chamber: 'senate',
    district: district.padStart(2, '0'),
    firstName,
    lastName,
    fullName: name,
    party,
    title: null,
    email,
    phone,
    photoUrl,
  };
}

function parseSenatorTableRow(
  $: cheerio.CheerioAPI,
  $row: cheerio.Cheerio<Element>
): ParsedSenator | null {
  const cells = $row.find('td');
  if (cells.length < 3) return null;

  const name = cells.eq(0).text().trim();
  const district = cells.eq(1).text().replace(/\D/g, '');
  const party = cells.eq(2).text().trim().charAt(0) as 'R' | 'D' | 'I' || 'I';

  if (!name || !district) return null;

  const nameParts = name.split(/\s+/);
  const lastName = nameParts.pop() || '';
  const firstName = nameParts.join(' ');

  return {
    id: generateMemberId('senate', district.padStart(2, '0')),
    chamber: 'senate',
    district: district.padStart(2, '0'),
    firstName,
    lastName,
    fullName: name,
    party,
    title: null,
    email: null,
    phone: null,
    photoUrl: null,
  };
}

function parseCommitteeElement(
  $: cheerio.CheerioAPI,
  $element: cheerio.Cheerio<Element>
): ParsedSenateCommittee | null {
  const name = $element.find('.committee-name, h3, h4, a').first().text().trim();
  if (!name) return null;

  const chairText = $element.find('.chair, [data-chair]').text().trim();
  const viceChairText = $element.find('.vice-chair, [data-vice-chair]').text().trim();

  return {
    id: generateCommitteeId('senate', name),
    chamber: 'senate',
    name,
    shortName: abbreviate(name),
    type: categorizeCommittee(name),
    chairId: chairText ? `member:unknown:${chairText.toLowerCase().replace(/\s+/g, '_')}` : null,
    viceChairId: viceChairText ? `member:unknown:${viceChairText.toLowerCase().replace(/\s+/g, '_')}` : null,
  };
}

// Utility functions

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  const formats = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /(\d{1,2})\/(\d{1,2})\/(\d{2})/,
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) {
        // MM/DD/YYYY
        return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
      } else if (format === formats[1]) {
        // MM/DD/YY
        const year = parseInt(match[3], 10);
        const fullYear = year > 50 ? 1900 + year : 2000 + year;
        return `${fullYear}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
      } else if (format === formats[2]) {
        // YYYY-MM-DD
        return match[0];
      } else if (format === formats[3]) {
        // Month DD, YYYY
        const months: Record<string, string> = {
          january: '01', february: '02', march: '03', april: '04',
          may: '05', june: '06', july: '07', august: '08',
          september: '09', october: '10', november: '11', december: '12',
        };
        const month = months[match[1].toLowerCase()];
        if (month) {
          return `${match[3]}-${month}-${match[2].padStart(2, '0')}`;
        }
      }
    }
  }

  return null;
}

function mapStatusFromText(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes('prefiled')) return 'prefiled';
  if (lower.includes('introduced')) return 'introduced';
  if (lower.includes('first read')) return 'first_read';
  if (lower.includes('second read')) return 'referred';
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

  return 'introduced';
}

function extractActionCode(description: string): string {
  const patterns: [RegExp, string][] = [
    [/prefiled/i, 'PREF'],
    [/introduced/i, 'INTR'],
    [/first read/i, '1RD'],
    [/second read/i, '2RD'],
    [/referred to/i, 'REF'],
    [/hearing scheduled/i, 'SCHED'],
    [/public hearing/i, 'HEAR'],
    [/executive session/i, 'EXEC'],
    [/do pass/i, 'DP'],
    [/perfected/i, 'PERF'],
    [/third read/i, '3RD'],
    [/passed senate/i, 'S-PASS'],
    [/passed house/i, 'H-PASS'],
    [/received.*house/i, 'H-REC'],
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

function inferChamber(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('house')) return 'house';
  if (lower.includes('governor')) return 'governor';
  return 'senate';
}

function extractCommittee(description: string): string | null {
  const match = description.match(/referred to (?:the )?([^.]+?)(?:\.|$)/i);
  if (match) {
    return generateCommitteeId('senate', match[1].trim());
  }
  return null;
}

function isKeyMilestone(actionCode: string): boolean {
  const milestones = new Set([
    'PREF', 'INTR', '1RD', '2RD', 'REF', 'DP', 'PERF',
    '3RD', 'S-PASS', 'H-PASS', 'TATFP', 'GOV-S', 'GOV-V', 'WDRN',
  ]);
  return milestones.has(actionCode);
}

function categorizeCommittee(name: string): 'standing' | 'special' | 'select' | 'joint' {
  const lower = name.toLowerCase();
  if (lower.includes('special')) return 'special';
  if (lower.includes('select')) return 'select';
  if (lower.includes('joint')) return 'joint';
  if (lower.includes('conference')) return 'joint';
  return 'standing';
}

function abbreviate(name: string): string {
  return name
    .split(/\s+/)
    .filter(word => word.length > 2 && !['and', 'the', 'for', 'on'].includes(word.toLowerCase()))
    .map(word => word[0].toUpperCase())
    .join('');
}

export default {
  fetchSenateBillList,
  fetchSenateBillDetail,
  fetchSenateBillActions,
  fetchSenatorList,
  fetchSenateCommitteeList,
  fetchBillStatuteMapping,
};
