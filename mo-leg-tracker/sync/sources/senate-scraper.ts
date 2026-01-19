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
  _senateCommitteeId?: string; // Internal ID for detail fetching
}

export interface ParsedSenateCommitteeMembership {
  committeeId: string;
  memberId: string;
  memberName: string;
  district: string;
  position: 'chair' | 'vice_chair' | 'member';
  chamber: 'senate';
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
      redirect: 'follow',
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
 * Fetch senator directory data (party, phone, office)
 * Parses the table at /Senators/Directory
 * Format: Name | R-## or D-## | Room | Phone
 */
async function fetchSenatorDirectory(): Promise<Map<string, { party: 'R' | 'D'; phone: string | null; office: string | null; fullName: string }>> {
  const directoryUrl = `${config.senate.baseUrl}/Senators/Directory`;
  logger.debug(`Fetching senator directory: ${directoryUrl}`);

  const directory = new Map<string, { party: 'R' | 'D'; phone: string | null; office: string | null; fullName: string }>();

  try {
    const $ = await fetchHtml(directoryUrl);

    // Parse table rows - structure: Name, Party/District, (empty), Office, Phone
    $('table tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length < 5) return;

      // Cell 0: Name (may be linked)
      const nameCell = cells.eq(0);
      const fullName = nameCell.text().trim();

      // Cell 1: Party-District (e.g., "R-25" or "D-07")
      const partyDistrictCell = cells.eq(1).text().trim();
      const partyMatch = partyDistrictCell.match(/^([RD])-(\d+)$/);
      if (!partyMatch) return;

      const party = partyMatch[1] as 'R' | 'D';
      const district = partyMatch[2].padStart(2, '0');

      // Cell 2: Empty column (skip)
      // Cell 3: Office room
      const office = cells.eq(3).text().trim() || null;

      // Cell 4: Phone
      const phoneText = cells.eq(4).text().trim();
      const phone = phoneText.match(/\(\d{3}\)\s*\d{3}-\d{4}/) ? phoneText : null;

      directory.set(district, { party, phone, office, fullName });
    });

    logger.debug(`Parsed ${directory.size} senators from directory`);
  } catch (error) {
    logger.warn('Failed to fetch senator directory', { error: (error as Error).message });
  }

  return directory;
}

/**
 * Fetch senator list
 * Combines data from:
 * 1. /Senators/Directory - party affiliation and phone
 * 2. Member list page - photos and links
 * Updated structure (2026):
 * <a href="/Senators/Member/[DISTRICT]">
 *   <img src="WebPhotos/SenatorPortraits/[NAME][DISTRICT].jpg" alt="Senator [NAME]">
 *   <strong>Senator [NAME]</strong>
 *   <br>District [NUMBER]
 * </a>
 */
export async function fetchSenatorList(): Promise<ParsedSenator[]> {
  const url = buildSenateUrl(config.senate.members.list, {});

  logger.syncStart('fetch Senator list', { url });
  const startTime = Date.now();

  try {
    // First fetch the directory to get party and phone data
    const directory = await fetchSenatorDirectory();

    const $ = await fetchHtml(url);
    const senators: ParsedSenator[] = [];
    const seenDistricts = new Set<string>();

    // Parse senator links - structure:
    // <a href="/Senators/Member/25">
    //   <img src="WebPhotos/SenatorPortraits/Bean25.jpg" alt="Senator Bean">
    //   <strong>Senator Bean</strong>
    //   <br>District 25
    // </a>
    $('a[href*="/Senators/Member/"]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href') || '';

      // Extract district from URL
      const districtMatch = href.match(/\/Senators\/Member\/(\d+)/i);
      if (!districtMatch) return;

      const district = districtMatch[1].padStart(2, '0');

      // Skip duplicates
      if (seenDistricts.has(district)) return;
      seenDistricts.add(district);

      // Extract name from img alt, strong text, or image filename
      const imgAlt = $link.find('img').attr('alt') || '';
      const strongText = $link.find('strong').text().trim();
      const imgSrc = $link.find('img').attr('src') || '';

      // Try to extract last name from various sources
      let lastName = '';

      // From img alt: "Senator Bean"
      const altMatch = imgAlt.match(/Senator\s+(\w+)/i);
      if (altMatch) {
        lastName = altMatch[1];
      }

      // From strong text: "Senator Bean"
      if (!lastName) {
        const strongMatch = strongText.match(/Senator\s+(\w+)/i);
        if (strongMatch) {
          lastName = strongMatch[1];
        }
      }

      // From image filename: "Bean25.jpg"
      if (!lastName) {
        const filenameMatch = imgSrc.match(/([A-Za-z]+)\d+\.jpg/i);
        if (filenameMatch) {
          lastName = filenameMatch[1];
        }
      }

      if (!lastName) return;

      // Build full photo URL
      let photoUrl: string | null = null;
      if (imgSrc) {
        if (imgSrc.startsWith('http')) {
          photoUrl = imgSrc;
        } else if (imgSrc.startsWith('/')) {
          photoUrl = `${config.senate.baseUrl}${imgSrc}`;
        } else {
          photoUrl = `${config.senate.baseUrl}/Senators/${imgSrc}`;
        }
      }

      // Get party and phone from directory data
      const directoryData = directory.get(district);
      const party = directoryData?.party || 'I';
      const phone = directoryData?.phone || null;

      // Use full name from directory if available (more accurate than just last name)
      let fullName = `Senator ${lastName}`;
      let firstName = '';
      if (directoryData?.fullName) {
        fullName = directoryData.fullName;
        // Try to extract first name: "Jason Bean" -> firstName = "Jason"
        const nameParts = directoryData.fullName.split(/\s+/);
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts[nameParts.length - 1];
        }
      }

      senators.push({
        id: generateMemberId('senate', district),
        chamber: 'senate',
        district,
        firstName,
        lastName,
        fullName,
        party,
        title: null,
        email: null,
        phone,
        photoUrl,
      });
    });

    // Also add any senators from directory that weren't in the member list
    for (const [district, data] of directory) {
      if (!seenDistricts.has(district)) {
        const nameParts = data.fullName.split(/\s+/);
        const firstName = nameParts.length >= 2 ? nameParts[0] : '';
        const lastName = nameParts.length >= 2 ? nameParts[nameParts.length - 1] : data.fullName;

        senators.push({
          id: generateMemberId('senate', district),
          chamber: 'senate',
          district,
          firstName,
          lastName,
          fullName: data.fullName,
          party: data.party,
          title: null,
          email: null,
          phone: data.phone,
          photoUrl: null,
        });
      }
    }

    logger.syncComplete('fetch Senator list', { total: senators.length }, Date.now() - startTime);

    return senators;
  } catch (error) {
    logger.syncFailed('fetch Senator list', error as Error, { url });
    throw error;
  }
}

// Committee group configuration for Senate website
const COMMITTEE_GROUPS: { groupId: number; type: 'standing' | 'special' | 'select' | 'joint' }[] = [
  { groupId: 1, type: 'standing' },    // Standing Committees
  { groupId: 2, type: 'standing' },    // Statutory Committees
  { groupId: 5, type: 'select' },      // Select Committees
  { groupId: 8, type: 'special' },     // Task Forces
];

/**
 * Fetch committee list from all committee groups
 * The Senate website organizes committees by type in separate pages
 */
export async function fetchSenateCommitteeList(): Promise<ParsedSenateCommittee[]> {
  const baseUrl = config.senate.baseUrl;

  logger.syncStart('fetch Senate committee list', { url: `${baseUrl}/Committees/` });
  const startTime = Date.now();

  try {
    const committees: ParsedSenateCommittee[] = [];

    // Fetch each committee group page
    for (const group of COMMITTEE_GROUPS) {
      const groupUrl = `${baseUrl}/Committees/CommitteeGroup/${group.groupId}`;
      logger.debug(`Fetching committee group: ${groupUrl}`);

      try {
        const $ = await fetchHtml(groupUrl);

        // Parse committee links from the group page
        // Structure: <p><a href="/Committees/CommitteeDetails/1">Administration</a></p>
        $('a[href*="/Committees/CommitteeDetails/"]').each((_, element) => {
          const $link = $(element);
          const name = $link.text().trim();
          const href = $link.attr('href') || '';

          // Skip if it looks like a utility link or is empty
          if (!name || name.includes('http') || name.includes('Assigned') || name.includes('Minutes')) {
            return;
          }

          // Extract committee ID from URL for potential detail fetching
          const detailIdMatch = href.match(/\/CommitteeDetails\/(\d+)/i);
          const senateCommitteeId = detailIdMatch ? detailIdMatch[1] : '';

          const id = generateCommitteeId('senate', name);

          // Avoid duplicates
          if (!committees.find(c => c.id === id)) {
            committees.push({
              id,
              chamber: 'senate',
              name,
              shortName: abbreviate(name),
              type: group.type,
              chairId: null,
              viceChairId: null,
              // Store internal ID for later detail fetching if needed
              ...(senateCommitteeId && { _senateCommitteeId: senateCommitteeId }),
            } as ParsedSenateCommittee);
          }
        });
      } catch (groupError) {
        logger.warn(`Failed to fetch committee group ${group.groupId}`, {
          error: (groupError as Error).message,
        });
        // Continue with other groups
      }
    }

    logger.syncComplete('fetch Senate committee list', { total: committees.length }, Date.now() - startTime);

    return committees;
  } catch (error) {
    logger.syncFailed('fetch Senate committee list', error as Error, { url: `${config.senate.baseUrl}/Committees/` });
    throw error;
  }
}

/**
 * Fetch detailed committee information including chair/vice-chair
 */
export async function fetchSenateCommitteeDetail(
  senateCommitteeId: string
): Promise<{ chairId: string | null; viceChairId: string | null } | null> {
  const url = `${config.senate.baseUrl}/Committees/CommitteeDetails/${senateCommitteeId}`;

  logger.debug(`Fetching committee detail: ${senateCommitteeId}`);

  try {
    const $ = await fetchHtml(url);

    let chairId: string | null = null;
    let viceChairId: string | null = null;

    // Parse committee members to find chair and vice-chair
    // Updated structure: <a href="/senators/member/XX"> with img and text
    $('a[href*="/senators/member/"]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href') || '';
      const textContent = $link.text().trim();

      const districtMatch = href.match(/\/senators\/member\/(\d+)/i);
      if (!districtMatch) return;

      const district = districtMatch[1].padStart(2, '0');
      const memberId = generateMemberId('senate', district);

      if (textContent.includes('Chair') && !textContent.includes('Vice')) {
        chairId = memberId;
      } else if (textContent.includes('Vice-Chair') || textContent.includes('Vice Chair') || textContent.includes('Vice-')) {
        viceChairId = memberId;
      }
    });

    return { chairId, viceChairId };
  } catch (error) {
    logger.warn(`Failed to fetch committee detail: ${senateCommitteeId}`, {
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Fetch all committee memberships from Senate committee detail pages
 * This iterates through all committees and scrapes member lists
 */
export async function fetchSenateCommitteeMemberships(): Promise<ParsedSenateCommitteeMembership[]> {
  logger.syncStart('fetch Senate committee memberships', { url: `${config.senate.baseUrl}/Committees/` });
  const startTime = Date.now();

  try {
    // First get all committees with their internal IDs
    const committees = await fetchSenateCommitteeList();
    const memberships: ParsedSenateCommitteeMembership[] = [];

    for (const committee of committees) {
      // Extract senate committee ID from _senateCommitteeId if available
      const senateCommitteeIdMatch = (committee as ParsedSenateCommittee & { _senateCommitteeId?: string })._senateCommitteeId;
      if (!senateCommitteeIdMatch) continue;

      try {
        const url = `${config.senate.baseUrl}/Committees/CommitteeDetails/${senateCommitteeIdMatch}`;
        const $ = await fetchHtml(url);
        const seenDistricts = new Set<string>();

        // Parse all member links on the committee detail page
        // Structure: <a href="/senators/member/XX"> with senator info
        $('a[href*="/senators/member/"]').each((_, element) => {
          const $link = $(element);
          const href = $link.attr('href') || '';
          const textContent = $link.text().trim();

          const districtMatch = href.match(/\/senators\/member\/(\d+)/i);
          if (!districtMatch) return;

          const district = districtMatch[1].padStart(2, '0');

          // Skip duplicates (same senator might appear in multiple links)
          if (seenDistricts.has(district)) return;
          seenDistricts.add(district);

          const memberId = generateMemberId('senate', district);

          // Determine position from text content
          let position: 'chair' | 'vice_chair' | 'member' = 'member';
          if (textContent.includes('Chair') && !textContent.includes('Vice')) {
            position = 'chair';
          } else if (textContent.includes('Vice-Chair') || textContent.includes('Vice Chair') || textContent.includes('Vice-')) {
            position = 'vice_chair';
          }

          // Extract name from text (usually "Senator LastName" or just name with role)
          let memberName = textContent.replace(/\s*(Chair|Vice-Chair|Vice Chair)\s*/gi, '').trim();
          if (!memberName) {
            // Try img alt
            const imgAlt = $link.find('img').attr('alt') || '';
            memberName = imgAlt.replace(/^Senator\s+/i, '').trim();
          }

          memberships.push({
            committeeId: committee.id,
            memberId,
            memberName,
            district,
            position,
            chamber: 'senate',
          });
        });
      } catch (error) {
        logger.warn(`Failed to fetch committee members for ${committee.name}`, {
          error: (error as Error).message,
        });
      }
    }

    logger.syncComplete('fetch Senate committee memberships', { total: memberships.length }, Date.now() - startTime);

    return memberships;
  } catch (error) {
    logger.syncFailed('fetch Senate committee memberships', error as Error, {});
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

  // Senate BTS Web uses span/anchor elements with specific IDs
  // Extract directly using those IDs for reliable parsing

  // Get text from element by ID, handling nested font tags
  function getById(elementId: string): string {
    const el = $(`#${elementId}`);
    return el.length ? el.text().trim() : '';
  }

  // Get href from anchor by ID
  function getHrefById(elementId: string): string {
    const el = $(`#${elementId}`);
    return el.length ? (el.attr('href') || '') : '';
  }

  // Extract title/description - Senate uses lblBriefDesc for main description
  let title = getById('lblBriefDesc');

  // If no brief desc, try the formal title
  if (!title) {
    title = getById('lblBillTitle');
  }

  // Extract sponsor - uses anchor with id hlSponsor
  // Format may be "Name", "Name (X)", or "Name (District X)"
  const sponsorText = getById('hlSponsor');
  let sponsor: ParsedSponsor | null = null;
  if (sponsorText && sponsorText.length > 1) {
    // Try to extract district from text like "Justin Brown (16)" or "Name (District 16)"
    const districtMatch = sponsorText.match(/\(\s*(?:District\s*)?(\d+)\s*\)/i);
    const district = districtMatch ? districtMatch[1] : null;
    const name = sponsorText
      .replace(/\s*\(\s*(?:District\s*)?\d+\s*\)/i, '')
      .replace(/Senator\s*/i, '')
      .trim();
    sponsor = {
      memberId: district ? generateMemberId('senate', district.padStart(2, '0')) : '',
      name,
      district,
    };
  }

  // Extract co-sponsors
  const coSponsors: ParsedSponsor[] = [];
  const coSponsorText = getById('hlCoSponsors');
  if (coSponsorText) {
    const names = coSponsorText.split(/[,;]/);
    for (const name of names) {
      const cleanName = name.replace(/Senator\s*/i, '').trim();
      if (cleanName && cleanName.length > 1) {
        coSponsors.push({
          memberId: '',
          name: cleanName,
          district: null,
        });
      }
    }
  }

  // Extract status/last action - uses lblLastAction
  // Format: "1/8/2026 - Second Read and Referred S Appropriations Committee"
  const statusText = getById('lblLastAction');

  // Parse last action date from status text
  let lastActionDate: string | null = null;
  const dateMatch = statusText.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
  if (dateMatch) {
    const [month, day, year] = dateMatch[1].split('/');
    lastActionDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Extract LR Number - uses lblLRNum
  const lrNumber = getById('lblLRNum');

  // Extract committee - uses anchor hlCommittee
  const committeeText = getById('hlCommittee');
  const currentCommittee = committeeText ? generateCommitteeId('senate', committeeText) : null;

  // Extract effective date - uses lblEffDate
  const effectiveDateText = getById('lblEffDate');
  const effectiveDate = parseDate(effectiveDateText);

  // Extract BillID for actions lookup
  // Try from form action first
  let senateBillId = '';
  const formAction = $('form#form1').attr('action') || '';
  const formMatch = formAction.match(/BillID=(\d+)/i);
  if (formMatch) {
    senateBillId = formMatch[1];
  }
  // If not found, try from links
  if (!senateBillId) {
    $('a[href*="BillID="]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/BillID=(\d+)/i);
      if (match) {
        senateBillId = match[1];
        return false;
      }
      return undefined;
    });
  }

  // Get summary/description from lblSummary
  let briefDescription = title;
  const summaryText = getById('lblSummary');
  if (summaryText && summaryText.length > 20) {
    // Remove the "SB X - " prefix if present
    briefDescription = summaryText
      .replace(new RegExp(`^${prefix}\\s*${number}\\s*[-–]\\s*`, 'i'), '')
      .trim()
      .substring(0, 500);
    // If we don't have a title yet, use start of summary
    if (!title) {
      title = briefDescription.substring(0, 200);
    }
  }

  return {
    id,
    billNumber: `${prefix} ${number}`,
    billPrefix: prefix,
    billSuffix: number,
    session: config.session.code,
    chamber: 'senate',
    title,
    briefDescription,
    lrNumber,
    currentStatus: mapStatusFromText(statusText),
    currentCommittee,
    effectiveDate,
    introducedDate: null,
    lastActionDate,
    withdrawn: statusText.toLowerCase().includes('withdrawn'),
    sponsor,
    coSponsors,
    actions: [],
    senateBillId,
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
  fetchSenateCommitteeDetail,
  fetchSenateCommitteeMemberships,
  fetchBillStatuteMapping,
};
