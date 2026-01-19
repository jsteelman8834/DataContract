/**
 * Test Senate scraper against 2025 session (which has actual data)
 */
import * as cheerio from 'cheerio';

const TEST_URL = 'https://www.senate.mo.gov/25info/bts_web/Bill.aspx?SessionType=R&BillPrefix=SB&BillSuffix=201';

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'MO-Legislative-Tracker-Test/1.0' },
    redirect: 'follow', // Follow redirects
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  return cheerio.load(html);
}

function parseBillDetailPage($: cheerio.CheerioAPI, prefix: string, number: number) {
  // Get text from element by ID
  function getById(elementId: string): string {
    const el = $(`#${elementId}`);
    return el.length ? el.text().trim() : '';
  }

  // Extract title/description from lblBriefDesc
  let title = getById('lblBriefDesc');
  if (!title) {
    title = getById('lblBillTitle');
  }

  // Extract sponsor from hlSponsor anchor
  const sponsor = getById('hlSponsor');

  // Extract LR Number
  const lrNumber = getById('lblLRNum');

  // Extract committee
  const committee = getById('hlCommittee');

  // Extract last action
  const lastAction = getById('lblLastAction');

  // Extract effective date
  const effectiveDate = getById('lblEffDate');

  // Extract summary
  const summaryRaw = getById('lblSummary');
  const summary = summaryRaw
    .replace(new RegExp(`^${prefix}\\s*${number}\\s*[-–]\\s*`, 'i'), '')
    .trim()
    .substring(0, 500);

  // Extract BillID from form or links
  let billId = '';
  const formAction = $('form#form1').attr('action') || '';
  const formMatch = formAction.match(/BillID=(\d+)/i);
  if (formMatch) {
    billId = formMatch[1];
  }

  return { title, sponsor, lrNumber, committee, lastAction, effectiveDate, summary, billId };
}

async function test() {
  console.log('Testing Senate scraper against 2025 session data...');
  console.log(`URL: ${TEST_URL}\n`);

  try {
    const $ = await fetchHtml(TEST_URL);
    const result = parseBillDetailPage($, 'SB', 201);

    console.log('=== Results ===');
    console.log('Title:', result.title || '(empty)');
    console.log('Sponsor:', result.sponsor || '(empty)');
    console.log('LR Number:', result.lrNumber || '(empty)');
    console.log('Committee:', result.committee || '(empty)');
    console.log('Last Action:', result.lastAction || '(empty)');
    console.log('Effective Date:', result.effectiveDate || '(empty)');
    console.log('Summary:', result.summary ? result.summary.substring(0, 100) + '...' : '(empty)');
    console.log('BillID:', result.billId || '(empty)');
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

test();
