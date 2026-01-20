/**
 * Bill Section Parser
 *
 * Parses bill text to identify sections, definitions, and key components
 */

export interface BillSection {
  id: string;
  type: 'title' | 'enacting' | 'section' | 'definition' | 'effective' | 'other';
  number?: string;
  title?: string;
  content: string;
  startOffset: number;
  endOffset: number;
}

export interface ParsedBillText {
  title: string;
  enactingClause: string;
  sections: BillSection[];
  definitions: Array<{ term: string; definition: string }>;
  effectiveDate?: string;
  rsmoReferences: string[];
}

/**
 * Common patterns in Missouri bills
 */
const PATTERNS = {
  title: /^AN\s+ACT\s+(.+?)(?=Be\s+it\s+enacted|$)/is,
  enactingClause: /Be\s+it\s+enacted\s+by\s+the\s+General\s+Assembly\s+of\s+the\s+State\s+of\s+Missouri[,:]?\s*(?:as\s+follows[:]?)?/i,
  section: /Section\s+([A-Z]?\d+[\.\d]*)\.\s*([^\n]+)?/gi,
  definition: /"([^"]+)"\s*(?:means|shall mean|is defined as)\s+([^.;]+[.;])/gi,
  rsmoReference: /(?:section|sections)\s+(\d{1,3}\.\d{3,4})/gi,
  effectiveDate: /effective\s+(?:on\s+)?(?:the\s+)?(\w+\s+\d{1,2},?\s+\d{4}|January\s+1,?\s+\d{4}|August\s+28,?\s+\d{4})/gi,
  subsection: /\((\d+)\)\s*/g,
  amendingLanguage: /\[([^\]]+)\]|\[\s*([^\]]*?)\s*\]/g, // Bracketed deletions
  newLanguage: /\{([^\}]+)\}/g, // Sometimes used for additions
};

/**
 * Parse bill text into structured sections
 */
export function parseBillText(text: string, billId: string): ParsedBillText {
  const result: ParsedBillText = {
    title: '',
    enactingClause: '',
    sections: [],
    definitions: [],
    effectiveDate: undefined,
    rsmoReferences: [],
  };

  // Extract title
  const titleMatch = text.match(PATTERNS.title);
  if (titleMatch) {
    result.title = titleMatch[1].trim();
  }

  // Extract enacting clause
  const enactingMatch = text.match(PATTERNS.enactingClause);
  if (enactingMatch) {
    result.enactingClause = enactingMatch[0].trim();
  }

  // Extract sections
  let sectionMatch;
  const sectionRegex = new RegExp(PATTERNS.section.source, 'gi');
  let lastSectionEnd = 0;

  while ((sectionMatch = sectionRegex.exec(text)) !== null) {
    const sectionNumber = sectionMatch[1];
    const sectionTitle = sectionMatch[2]?.trim() || '';
    const startOffset = sectionMatch.index;

    // Find the end of this section (start of next section or end of text)
    const nextSectionMatch = new RegExp(PATTERNS.section.source, 'gi');
    nextSectionMatch.lastIndex = sectionRegex.lastIndex;
    const nextMatch = nextSectionMatch.exec(text);
    const endOffset = nextMatch ? nextMatch.index : text.length;

    const content = text.slice(startOffset, endOffset).trim();

    result.sections.push({
      id: `${billId}:section:${sectionNumber}`,
      type: 'section',
      number: sectionNumber,
      title: sectionTitle,
      content,
      startOffset,
      endOffset,
    });

    lastSectionEnd = endOffset;
  }

  // Extract definitions
  const defRegex = new RegExp(PATTERNS.definition.source, 'gi');
  let defMatch;
  while ((defMatch = defRegex.exec(text)) !== null) {
    result.definitions.push({
      term: defMatch[1].trim(),
      definition: defMatch[2].trim(),
    });
  }

  // Extract RSMO references
  const rsmoRegex = new RegExp(PATTERNS.rsmoReference.source, 'gi');
  let rsmoMatch;
  const rsmoSet = new Set<string>();
  while ((rsmoMatch = rsmoRegex.exec(text)) !== null) {
    rsmoSet.add(rsmoMatch[1]);
  }
  result.rsmoReferences = Array.from(rsmoSet);

  // Extract effective date
  const effectiveMatch = text.match(PATTERNS.effectiveDate);
  if (effectiveMatch) {
    result.effectiveDate = effectiveMatch[1];
  }

  return result;
}

/**
 * Get summary of bill structure
 */
export function getBillStructureSummary(parsed: ParsedBillText): string {
  const parts: string[] = [];

  parts.push(`Title: ${parsed.title || 'Unknown'}`);
  parts.push(`Sections: ${parsed.sections.length}`);

  if (parsed.definitions.length > 0) {
    parts.push(`Definitions: ${parsed.definitions.length}`);
  }

  if (parsed.rsmoReferences.length > 0) {
    parts.push(`RSMO References: ${parsed.rsmoReferences.join(', ')}`);
  }

  if (parsed.effectiveDate) {
    parts.push(`Effective Date: ${parsed.effectiveDate}`);
  }

  return parts.join('\n');
}

/**
 * Find section by number
 */
export function findSection(
  parsed: ParsedBillText,
  sectionNumber: string
): BillSection | undefined {
  return parsed.sections.find(s => s.number === sectionNumber);
}

/**
 * Get definition for a term
 */
export function getDefinition(
  parsed: ParsedBillText,
  term: string
): string | undefined {
  const def = parsed.definitions.find(
    d => d.term.toLowerCase() === term.toLowerCase()
  );
  return def?.definition;
}

/**
 * Extract changes (amendments) from text
 */
export function extractChanges(text: string): {
  deletions: string[];
  additions: string[];
} {
  const deletions: string[] = [];
  const additions: string[] = [];

  // Find bracketed text (deletions)
  let match;
  const delRegex = new RegExp(PATTERNS.amendingLanguage.source, 'g');
  while ((match = delRegex.exec(text)) !== null) {
    const deletion = match[1] || match[2];
    if (deletion) {
      deletions.push(deletion.trim());
    }
  }

  // Find underlined or marked additions (common in Missouri)
  // This is harder to detect in plain text - would need original formatting
  // For now, look for explicit markers
  const addRegex = /\*\*([^*]+)\*\*/g;
  while ((match = addRegex.exec(text)) !== null) {
    additions.push(match[1].trim());
  }

  return { deletions, additions };
}

/**
 * Generate section citations
 */
export function generateCitation(
  section: BillSection,
  billNumber: string
): string {
  if (section.number) {
    return `${billNumber}, Section ${section.number}`;
  }
  return `${billNumber}, ${section.type}`;
}

export default {
  parseBillText,
  getBillStructureSummary,
  findSection,
  getDefinition,
  extractChanges,
  generateCitation,
};
