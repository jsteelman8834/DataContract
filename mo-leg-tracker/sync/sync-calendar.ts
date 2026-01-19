/**
 * Calendar/Hearing Sync
 *
 * Fetches upcoming hearings from both House (XML) and Senate (HTML) sources
 * and combines them into a unified calendar.
 */

import * as cheerio from 'cheerio';
import { config, buildHouseUrl, generateCommitteeId } from './config';
import { readDatabase, writeDatabase, upsertNode, upsertEdge } from './database/graph-writer';

interface ParsedHearing {
  id: string;
  chamber: 'house' | 'senate';
  committeeId: string;
  committeeName: string;
  hearingDate: string;  // YYYY-MM-DD
  hearingTime: string;  // HH:MM
  room: string;
  type: 'public' | 'executive' | 'informational';
  status: 'scheduled' | 'cancelled' | 'completed';
  bills: Array<{
    billNumber: string;
    billId: string;
    shortTitle?: string;
  }>;
  agendaUrl: string | null;
  notes: string | null;
}

/**
 * Generate a hearing ID
 */
function generateHearingId(
  date: string,
  chamber: string,
  committeeName: string,
  time: string
): string {
  const slug = committeeName.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
  const timeSlug = time.replace(':', '');
  return `hearing:${date}:${chamber}:${slug}:${timeSlug}`;
}

/**
 * Generate a bill ID from bill number
 */
function generateBillId(billNumber: string): string {
  const match = billNumber.match(/([A-Z]+)\s*(\d+)/i);
  if (!match) return '';
  const prefix = match[1].toUpperCase();
  const number = parseInt(match[2], 10);
  return `bill:${prefix.toLowerCase()}${number}:${config.session.code}`;
}

/**
 * Parse date from various formats to YYYY-MM-DD
 */
function parseDate(dateStr: string): string {
  // Try MM/DD/YYYY format
  const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try "Tuesday, January 20" format
  const textMatch = dateStr.match(/(\w+),?\s+(\w+)\s+(\d{1,2})/i);
  if (textMatch) {
    const [, , monthName, day] = textMatch;
    const months: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12',
    };
    const month = months[monthName.toLowerCase()];
    if (month) {
      const year = config.session.year;
      return `${year}-${month}-${day.padStart(2, '0')}`;
    }
  }

  return dateStr;
}

/**
 * Parse time to HH:MM format
 */
function parseTime(timeStr: string): string {
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
  if (!match) return '00:00';

  let hours = parseInt(match[1], 10);
  const minutes = match[2] || '00';
  const ampm = match[3]?.toUpperCase();

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

/**
 * Fetch and parse House hearings from XML feed
 */
async function fetchHouseHearings(): Promise<ParsedHearing[]> {
  const url = buildHouseUrl(config.house.feeds.hearings, { SESSION: config.session.code });
  console.log(`Fetching House hearings from: ${url}`);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MO-Leg-Tracker/1.0 (calendar-sync)' },
    });

    if (!response.ok) {
      console.log(`  House hearings fetch failed: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const hearings: ParsedHearing[] = [];

    $('HearingInfo').each((_, elem) => {
      const $hearing = $(elem);

      const committeeName = $hearing.find('CommitteeName').text().trim();
      const dateStr = $hearing.find('HearingDate').text().trim();
      const timeStr = $hearing.find('HearingTime').text().trim();
      const room = $hearing.find('HearingLocation').text().trim();
      const comments = $hearing.find('Comments').text().trim();
      const status = $hearing.find('HearingStatus').text().trim().toLowerCase();

      const hearingDate = parseDate(dateStr);
      const hearingTime = parseTime(timeStr);

      // Determine hearing type
      const isPublic = $hearing.find('PublicHearing').text().trim().toLowerCase() === 'true';
      const isExecutive = $hearing.find('ExecutiveSession').text().trim().toLowerCase() === 'true';
      const type = isExecutive ? 'executive' : (isPublic ? 'public' : 'informational');

      // Parse bills
      const bills: ParsedHearing['bills'] = [];
      $hearing.find('HearingBill').each((_, billElem) => {
        const $bill = $(billElem);
        const billNumber = $bill.find('CurrentBillString').text().trim();
        const shortTitle = $bill.find('ShortTitle').text().trim();

        if (billNumber) {
          bills.push({
            billNumber,
            billId: generateBillId(billNumber),
            shortTitle: shortTitle || undefined,
          });
        }
      });

      const id = generateHearingId(hearingDate, 'house', committeeName, hearingTime);

      hearings.push({
        id,
        chamber: 'house',
        committeeId: generateCommitteeId('house', committeeName),
        committeeName,
        hearingDate,
        hearingTime,
        room,
        type,
        status: status.includes('cancel') ? 'cancelled' : 'scheduled',
        bills,
        agendaUrl: null,
        notes: comments || null,
      });
    });

    console.log(`  Found ${hearings.length} House hearings`);
    return hearings;
  } catch (error) {
    console.error('Error fetching House hearings:', (error as Error).message);
    return [];
  }
}

/**
 * Fetch and parse Senate hearings from HTML page
 */
async function fetchSenateHearings(): Promise<ParsedHearing[]> {
  const url = `${config.senate.baseUrl}${config.senate.hearings.schedule}`;
  console.log(`Fetching Senate hearings from: ${url}`);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MO-Leg-Tracker/1.0 (calendar-sync)' },
    });

    if (!response.ok) {
      console.log(`  Senate hearings fetch failed: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const hearings: ParsedHearing[] = [];

    let currentDate = '';

    // The Senate page has hearings separated by <hr> tags
    // Each hearing block has committee name in bold, time/location, and bill links
    $('body').children().each((_, elem) => {
      const $elem = $(elem);
      const text = $elem.text().trim();

      // Check for date headers (e.g., "Tuesday, January 20")
      if (text.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i)) {
        currentDate = parseDate(text);
        return;
      }

      // Look for strong/b tags that might contain committee names
      const strong = $elem.find('strong, b').first().text().trim();
      if (strong && strong.length > 3 && currentDate) {
        // This might be a hearing entry
        const fullText = $elem.text();

        // Extract time (e.g., "2:00 PM" or "2:30 PM")
        const timeMatch = fullText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
        const hearingTime = timeMatch ? parseTime(timeMatch[1]) : '00:00';

        // Extract room/location
        const roomMatch = fullText.match(/(?:Room|SCR|Lounge)[^,\n]*/i);
        const room = roomMatch ? roomMatch[0].trim() : '';

        // Extract bills (links to bill pages)
        const bills: ParsedHearing['bills'] = [];
        $elem.find('a[href*="BillID"], a[href*="Bill.aspx"]').each((_, link) => {
          const billText = $(link).text().trim();
          const billMatch = billText.match(/([SH][BCJ]?R?)\s*(\d+)/i);
          if (billMatch) {
            const billNumber = `${billMatch[1].toUpperCase()} ${billMatch[2]}`;
            bills.push({
              billNumber,
              billId: generateBillId(billNumber),
            });
          }
        });

        // Also check for bill numbers in text
        const billMatches = fullText.matchAll(/\b(S[BCJ]?R?)\s*(\d+)\b/gi);
        for (const match of billMatches) {
          const billNumber = `${match[1].toUpperCase()} ${match[2]}`;
          if (!bills.find(b => b.billNumber === billNumber)) {
            bills.push({
              billNumber,
              billId: generateBillId(billNumber),
            });
          }
        }

        const committeeName = strong;
        const id = generateHearingId(currentDate, 'senate', committeeName, hearingTime);

        hearings.push({
          id,
          chamber: 'senate',
          committeeId: generateCommitteeId('senate', committeeName),
          committeeName,
          hearingDate: currentDate,
          hearingTime,
          room,
          type: 'public',
          status: 'scheduled',
          bills,
          agendaUrl: null,
          notes: null,
        });
      }
    });

    // Alternative parsing: look for patterns in the raw text
    if (hearings.length === 0) {
      // Fallback: parse the entire page text for hearing patterns
      const bodyText = $('body').html() || '';
      const sections = bodyText.split(/<hr\s*\/?>/i);

      for (const section of sections) {
        const $section = cheerio.load(section);
        const text = $section.text();

        // Look for date
        const dateMatch = text.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]+(\w+)\s+(\d{1,2})/i);
        if (dateMatch) {
          currentDate = parseDate(`${dateMatch[1]}, ${dateMatch[2]} ${dateMatch[3]}`);
        }

        // Look for committee and time
        const committeeMatch = text.match(/^([A-Z][A-Za-z\s,&]+?)(?:\s+[-–]\s+|\s*\n)/m);
        const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);

        if (committeeMatch && timeMatch && currentDate) {
          const committeeName = committeeMatch[1].trim();
          const hearingTime = parseTime(timeMatch[1]);

          const roomMatch = text.match(/(?:Room|SCR|Lounge|Floor)[^,\n]*/i);
          const room = roomMatch ? roomMatch[0].trim() : '';

          const bills: ParsedHearing['bills'] = [];
          const billMatches = text.matchAll(/\b(S[BCJ]?R?)\s*(\d+)\b/gi);
          for (const match of billMatches) {
            const billNumber = `${match[1].toUpperCase()} ${match[2]}`;
            if (!bills.find(b => b.billNumber === billNumber)) {
              bills.push({
                billNumber,
                billId: generateBillId(billNumber),
              });
            }
          }

          const id = generateHearingId(currentDate, 'senate', committeeName, hearingTime);

          if (!hearings.find(h => h.id === id)) {
            hearings.push({
              id,
              chamber: 'senate',
              committeeId: generateCommitteeId('senate', committeeName),
              committeeName,
              hearingDate: currentDate,
              hearingTime,
              room,
              type: 'public',
              status: 'scheduled',
              bills,
              agendaUrl: null,
              notes: null,
            });
          }
        }
      }
    }

    console.log(`  Found ${hearings.length} Senate hearings`);
    return hearings;
  } catch (error) {
    console.error('Error fetching Senate hearings:', (error as Error).message);
    return [];
  }
}

/**
 * Main sync function
 */
async function syncCalendar(): Promise<void> {
  console.log('Starting calendar sync...\n');

  const db = await readDatabase();

  // Fetch from both chambers
  const [houseHearings, senateHearings] = await Promise.all([
    fetchHouseHearings(),
    fetchSenateHearings(),
  ]);

  const allHearings = [...houseHearings, ...senateHearings];

  console.log(`\nTotal hearings found: ${allHearings.length}`);
  console.log(`  House: ${houseHearings.length}`);
  console.log(`  Senate: ${senateHearings.length}`);

  if (allHearings.length === 0) {
    console.log('No hearings to sync.');
    return;
  }

  // Group by date for display
  const byDate: Record<string, ParsedHearing[]> = {};
  for (const hearing of allHearings) {
    if (!byDate[hearing.hearingDate]) {
      byDate[hearing.hearingDate] = [];
    }
    byDate[hearing.hearingDate].push(hearing);
  }

  console.log('\nHearings by date:');
  Object.keys(byDate).sort().forEach(date => {
    console.log(`  ${date}: ${byDate[date].length} hearings`);
  });

  // Save hearings to database
  let hearingsAdded = 0;
  let billLinksAdded = 0;

  const now = new Date().toISOString();

  for (const hearing of allHearings) {
    // Upsert hearing node
    upsertNode(db, 'hearings', hearing.id, {
      id: hearing.id,
      committeeId: hearing.committeeId,
      hearingDate: hearing.hearingDate,
      hearingTime: hearing.hearingTime,
      room: hearing.room,
      type: hearing.type,
      status: hearing.status,
      agendaUrl: hearing.agendaUrl,
      minutesUrl: null,
      videoUrl: null,
      notes: hearing.notes,
      createdAt: now,
      updatedAt: now,
    });
    hearingsAdded++;

    // Create SCHEDULED_FOR edges for each bill
    for (const bill of hearing.bills) {
      if (bill.billId) {
        // Check if bill exists in database
        if (db.nodes.bills[bill.billId]) {
          upsertEdge(db, 'SCHEDULED_FOR', bill.billId, hearing.id, {
            addedDate: now,
          });
          billLinksAdded++;
        }
      }
    }
  }

  // Save database
  console.log('\nSaving database...');
  db._meta.updated = now;
  await writeDatabase(db);

  console.log('\n--- Calendar Sync Complete ---');
  console.log(`  Hearings synced: ${hearingsAdded}`);
  console.log(`  Bill-hearing links: ${billLinksAdded}`);

  // Show upcoming hearings
  const today = new Date().toISOString().split('T')[0];
  const upcoming = allHearings
    .filter(h => h.hearingDate >= today)
    .sort((a, b) => {
      if (a.hearingDate !== b.hearingDate) {
        return a.hearingDate.localeCompare(b.hearingDate);
      }
      return a.hearingTime.localeCompare(b.hearingTime);
    })
    .slice(0, 10);

  if (upcoming.length > 0) {
    console.log('\nUpcoming hearings:');
    for (const h of upcoming) {
      const billCount = h.bills.length;
      console.log(`  ${h.hearingDate} ${h.hearingTime} - ${h.committeeName} (${h.chamber}) - ${billCount} bills`);
    }
  }
}

syncCalendar();
