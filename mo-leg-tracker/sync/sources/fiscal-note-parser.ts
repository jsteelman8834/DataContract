/**
 * Fiscal Note PDF Parser
 *
 * Extracts fiscal impact data from Missouri legislative fiscal note PDFs
 * Uses pdf-parse for text extraction and regex patterns for data parsing
 */

import { config, buildHousePdfUrl, buildSenateUrl, generateFiscalId } from '../config';
import { billDetailRateLimiter } from '../utils/rate-limiter';
import { fiscalLogger as logger } from '../utils/logger';

// Note: pdf-parse must be installed: npm install pdf-parse
// import pdfParse from 'pdf-parse';

// Fiscal note data structure
export interface ParsedFiscalNote {
  id: string;
  billId: string;
  versionId: string | null;
  noteType: 'original' | 'revised' | 'supplemental' | 'corrected';
  fiscalYears: number[];
  estimatedCost: number | null;
  estimatedRevenue: number | null;
  netImpact: number;
  fundImpacts: FundImpacts;
  yearByYearImpact: YearlyImpact[];
  uncertaintyRange: { low: number; high: number } | null;
  assumptions: string[];
  issuingAgency: string;
  analystName: string | null;
  summary: string;
  pdfUrl: string;
  publishedDate: string | null;
}

interface FundImpacts {
  generalRevenue: number;
  federalFunds: number;
  otherStateFunds: number;
  totalStateFunds: number;
  localGovernment: number;
}

interface YearlyImpact {
  fiscalYear: number;
  cost: number;
  revenue: number;
  netImpact: number;
  fte: number | null;
}

// Fund name patterns for classification
const FUND_PATTERNS = {
  generalRevenue: [
    /general revenue/i,
    /general fund/i,
    /GR\s+fund/i,
  ],
  federalFunds: [
    /federal/i,
    /FMAP/i,
    /medicaid federal/i,
  ],
  otherStateFunds: [
    /highway/i,
    /road fund/i,
    /conservation/i,
    /gaming/i,
    /lottery/i,
    /school district trust/i,
  ],
  localGovernment: [
    /local government/i,
    /county/i,
    /municipal/i,
    /school district/i,
  ],
};

// Dollar amount patterns
const DOLLAR_PATTERNS = [
  /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:million|M)/gi,
  /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:billion|B)/gi,
  /\$\s*([\d,]+(?:\.\d{2})?)/g,
  /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?)/gi,
  /(?:cost|revenue|impact|savings?|expenditure)\s*(?:of|:)?\s*\$?\s*([\d,]+(?:\.\d{2})?)/gi,
];

// Fiscal year patterns
const FY_PATTERN = /(?:FY|fiscal year)\s*['"]?(\d{2,4})/gi;

/**
 * Build the URL for a House fiscal note PDF
 */
export function buildHouseFiscalNoteUrl(lrNumber: string): string {
  return buildHousePdfUrl('fiscalNote', { LR: lrNumber });
}

/**
 * Build the URL for checking Senate fiscal notes page
 */
export function buildSenateFiscalNotesPageUrl(senateBillId: string): string {
  return buildSenateUrl(
    config.senate.btsWeb.basePath + config.senate.btsWeb.fiscalNotes,
    { ID: senateBillId }
  );
}

/**
 * Fetch and parse a fiscal note PDF
 * Note: Requires pdf-parse to be installed
 */
export async function fetchFiscalNote(
  billId: string,
  lrNumber: string,
  chamber: 'house' | 'senate'
): Promise<ParsedFiscalNote | null> {
  const pdfUrl = chamber === 'house'
    ? buildHouseFiscalNoteUrl(lrNumber)
    : ''; // Senate requires page scrape first

  if (!pdfUrl) {
    logger.debug(`No direct PDF URL for Senate fiscal note: ${billId}`);
    return null;
  }

  return billDetailRateLimiter.execute(async () => {
    logger.debug(`Fetching fiscal note: ${billId}`);

    try {
      // Fetch PDF
      const response = await fetch(pdfUrl, {
        headers: {
          'Accept': 'application/pdf',
          'User-Agent': 'MO-Leg-Tracker/1.0 (sync)',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          logger.debug(`No fiscal note found for ${billId}`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Parse PDF text
      // Note: Uncomment when pdf-parse is installed
      // const pdfData = await pdfParse(buffer);
      // const text = pdfData.text;

      // For now, return a stub that indicates PDF was found
      // Real implementation would parse pdfData.text
      const text = ''; // Placeholder

      return parseFiscalNoteText(billId, lrNumber, text, pdfUrl);
    } catch (error) {
      logger.error(`Failed to fetch fiscal note: ${billId}`, {
        error: (error as Error).message,
        url: pdfUrl,
      });
      return null;
    }
  });
}

/**
 * Parse extracted PDF text into structured fiscal note data
 */
export function parseFiscalNoteText(
  billId: string,
  lrNumber: string,
  text: string,
  pdfUrl: string
): ParsedFiscalNote {
  const fiscalId = generateFiscalId(lrNumber, 'ORG');

  // Extract fiscal years
  const fiscalYears = extractFiscalYears(text);

  // Extract dollar amounts and classify
  const amounts = extractDollarAmounts(text);
  const { costs, revenues } = classifyAmounts(amounts, text);

  // Calculate totals
  const estimatedCost = costs.reduce((sum, c) => sum + c, 0);
  const estimatedRevenue = revenues.reduce((sum, r) => sum + r, 0);
  const netImpact = estimatedRevenue - estimatedCost;

  // Extract fund impacts
  const fundImpacts = extractFundImpacts(text, amounts);

  // Build year-by-year breakdown
  const yearByYearImpact = buildYearByYearImpact(fiscalYears, text);

  // Extract assumptions
  const assumptions = extractAssumptions(text);

  // Extract agency and analyst
  const issuingAgency = extractAgency(text);
  const analystName = extractAnalyst(text);

  // Extract summary (first paragraph or description)
  const summary = extractSummary(text);

  // Determine note type
  const noteType = determineNoteType(text);

  // Extract published date
  const publishedDate = extractPublishedDate(text);

  return {
    id: fiscalId,
    billId,
    versionId: `version:${lrNumber}`,
    noteType,
    fiscalYears,
    estimatedCost: estimatedCost || null,
    estimatedRevenue: estimatedRevenue || null,
    netImpact,
    fundImpacts,
    yearByYearImpact,
    uncertaintyRange: extractUncertaintyRange(text),
    assumptions,
    issuingAgency,
    analystName,
    summary,
    pdfUrl,
    publishedDate,
  };
}

// Extraction helper functions

function extractFiscalYears(text: string): number[] {
  const years = new Set<number>();
  let match;

  while ((match = FY_PATTERN.exec(text)) !== null) {
    let year = parseInt(match[1], 10);
    if (year < 100) {
      year += year > 50 ? 1900 : 2000;
    }
    years.add(year);
  }

  // Also look for year ranges like "FY26-FY30"
  const rangeMatch = text.match(/FY\s*['"]?(\d{2,4})\s*[-–]\s*FY?\s*['"]?(\d{2,4})/i);
  if (rangeMatch) {
    let startYear = parseInt(rangeMatch[1], 10);
    let endYear = parseInt(rangeMatch[2], 10);

    if (startYear < 100) startYear += startYear > 50 ? 1900 : 2000;
    if (endYear < 100) endYear += endYear > 50 ? 1900 : 2000;

    for (let y = startYear; y <= endYear; y++) {
      years.add(y);
    }
  }

  return Array.from(years).sort();
}

function extractDollarAmounts(text: string): number[] {
  const amounts: number[] = [];

  for (const pattern of DOLLAR_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amountStr = match[1].replace(/,/g, '');
      let amount = parseFloat(amountStr);

      // Handle million/billion
      if (/million|M/i.test(match[0])) {
        amount *= 1_000_000;
      } else if (/billion|B/i.test(match[0])) {
        amount *= 1_000_000_000;
      }

      if (!isNaN(amount) && amount > 0) {
        amounts.push(amount);
      }
    }
    pattern.lastIndex = 0; // Reset regex
  }

  return amounts;
}

function classifyAmounts(
  amounts: number[],
  text: string
): { costs: number[]; revenues: number[] } {
  const costs: number[] = [];
  const revenues: number[] = [];

  // Context-based classification
  const costPatterns = [
    /cost/i,
    /expenditure/i,
    /appropriation/i,
    /spending/i,
    /outlay/i,
    /expense/i,
  ];

  const revenuePatterns = [
    /revenue/i,
    /income/i,
    /receipt/i,
    /savings/i,
    /collection/i,
  ];

  // Simple heuristic: look at surrounding context
  const lines = text.split('\n');

  for (const amount of amounts) {
    const amountStr = amount.toLocaleString();
    let isCost = false;
    let isRevenue = false;

    // Find line containing this amount
    for (const line of lines) {
      if (line.includes(amountStr) || line.match(new RegExp(amount.toString().replace(/(\d)(?=(\d{3})+$)/g, '$1,')))) {
        const lineLower = line.toLowerCase();

        for (const pattern of costPatterns) {
          if (pattern.test(lineLower)) {
            isCost = true;
            break;
          }
        }

        for (const pattern of revenuePatterns) {
          if (pattern.test(lineLower)) {
            isRevenue = true;
            break;
          }
        }

        break;
      }
    }

    if (isCost && !isRevenue) {
      costs.push(amount);
    } else if (isRevenue && !isCost) {
      revenues.push(amount);
    } else {
      // Default to cost if uncertain
      costs.push(amount);
    }
  }

  return { costs, revenues };
}

function extractFundImpacts(text: string, amounts: number[]): FundImpacts {
  const impacts: FundImpacts = {
    generalRevenue: 0,
    federalFunds: 0,
    otherStateFunds: 0,
    totalStateFunds: 0,
    localGovernment: 0,
  };

  const lines = text.split('\n');

  for (const line of lines) {
    const lineLower = line.toLowerCase();

    // Check for fund patterns
    for (const [fund, patterns] of Object.entries(FUND_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(lineLower)) {
          // Extract amount from this line
          const amountMatch = line.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
          if (amountMatch) {
            const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
            if (!isNaN(amount)) {
              impacts[fund as keyof FundImpacts] += amount;
            }
          }
          break;
        }
      }
    }
  }

  // Calculate total state funds
  impacts.totalStateFunds = impacts.generalRevenue + impacts.federalFunds + impacts.otherStateFunds;

  return impacts;
}

function buildYearByYearImpact(fiscalYears: number[], text: string): YearlyImpact[] {
  if (fiscalYears.length === 0) {
    return [];
  }

  const impacts: YearlyImpact[] = [];

  // Look for year-specific amounts
  for (const year of fiscalYears) {
    const yearShort = year.toString().slice(-2);
    const yearPattern = new RegExp(`FY\\s*['"]?${yearShort}[^\\d]`, 'i');

    // Find lines mentioning this year
    const lines = text.split('\n');
    let yearCost = 0;
    let yearRevenue = 0;
    let yearFte: number | null = null;

    for (const line of lines) {
      if (yearPattern.test(line)) {
        const amounts = extractDollarAmounts(line);
        if (amounts.length > 0) {
          // Classify based on line context
          const { costs, revenues } = classifyAmounts(amounts, line);
          yearCost += costs.reduce((a, b) => a + b, 0);
          yearRevenue += revenues.reduce((a, b) => a + b, 0);
        }

        // Check for FTE
        const fteMatch = line.match(/(\d+(?:\.\d+)?)\s*FTE/i);
        if (fteMatch) {
          yearFte = parseFloat(fteMatch[1]);
        }
      }
    }

    impacts.push({
      fiscalYear: year,
      cost: yearCost,
      revenue: yearRevenue,
      netImpact: yearRevenue - yearCost,
      fte: yearFte,
    });
  }

  return impacts;
}

function extractAssumptions(text: string): string[] {
  const assumptions: string[] = [];

  // Look for assumptions section
  const assumptionPatterns = [
    /assumptions?:?\s*\n([\s\S]+?)(?=\n\n|\n[A-Z])/i,
    /based on the (?:following )?assumptions?:?\s*\n([\s\S]+?)(?=\n\n)/i,
    /key assumptions?:?\s*\n([\s\S]+?)(?=\n\n)/i,
  ];

  for (const pattern of assumptionPatterns) {
    const match = text.match(pattern);
    if (match) {
      const assumptionText = match[1];
      // Split by bullet points or numbers
      const items = assumptionText.split(/(?:\n\s*[-•●]\s*|\n\s*\d+[.)]\s*)/);
      for (const item of items) {
        const cleaned = item.trim();
        if (cleaned.length > 10 && cleaned.length < 500) {
          assumptions.push(cleaned);
        }
      }
      break;
    }
  }

  return assumptions.slice(0, 10); // Limit to 10 assumptions
}

function extractAgency(text: string): string {
  const agencyPatterns = [
    /prepared by[:\s]+([^\n]+)/i,
    /issuing agency[:\s]+([^\n]+)/i,
    /department of\s+([^\n]+)/i,
    /office of\s+([^\n]+)/i,
  ];

  for (const pattern of agencyPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return 'Unknown';
}

function extractAnalyst(text: string): string | null {
  const analystPatterns = [
    /analyst[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
    /prepared by[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
    /contact[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
  ];

  for (const pattern of analystPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

function extractSummary(text: string): string {
  // Look for fiscal impact summary or first substantive paragraph
  const summaryPatterns = [
    /fiscal (?:impact )?summary[:\s]*\n([\s\S]+?)(?=\n\n)/i,
    /overview[:\s]*\n([\s\S]+?)(?=\n\n)/i,
    /summary[:\s]*\n([\s\S]+?)(?=\n\n)/i,
  ];

  for (const pattern of summaryPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().slice(0, 500);
    }
  }

  // Fall back to first paragraph
  const paragraphs = text.split(/\n\n+/);
  for (const para of paragraphs) {
    const cleaned = para.trim();
    if (cleaned.length > 50 && cleaned.length < 1000) {
      return cleaned.slice(0, 500);
    }
  }

  return '';
}

function determineNoteType(text: string): 'original' | 'revised' | 'supplemental' | 'corrected' {
  const textLower = text.toLowerCase();

  if (textLower.includes('revised')) return 'revised';
  if (textLower.includes('supplemental')) return 'supplemental';
  if (textLower.includes('corrected')) return 'corrected';

  return 'original';
}

function extractUncertaintyRange(text: string): { low: number; high: number } | null {
  // Look for range indicators
  const rangePatterns = [
    /(?:range|between)\s*\$?\s*([\d,]+)\s*(?:to|and|-)\s*\$?\s*([\d,]+)/i,
    /(?:could be|may be)\s*(?:as (?:low|high) as)?\s*\$?\s*([\d,]+)\s*(?:to|or)\s*\$?\s*([\d,]+)/i,
  ];

  for (const pattern of rangePatterns) {
    const match = text.match(pattern);
    if (match) {
      const low = parseFloat(match[1].replace(/,/g, ''));
      const high = parseFloat(match[2].replace(/,/g, ''));
      if (!isNaN(low) && !isNaN(high)) {
        return { low: Math.min(low, high), high: Math.max(low, high) };
      }
    }
  }

  return null;
}

function extractPublishedDate(text: string): string | null {
  const datePatterns = [
    /date[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /published[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /(\w+ \d{1,2},? \d{4})/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      // Parse and normalize date
      const dateStr = match[1];
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
  }

  return null;
}

export default {
  buildHouseFiscalNoteUrl,
  buildSenateFiscalNotesPageUrl,
  fetchFiscalNote,
  parseFiscalNoteText,
};
