/**
 * Semantic Diff Detection
 *
 * Compares bill versions to detect meaningful policy changes
 */

import { getProvider, type ChatMessage } from './providers';
import { COMPARISON_SYSTEM_PROMPT } from './prompts';

export interface SemanticChange {
  id: string;
  type: 'policy' | 'scope' | 'fiscal' | 'timeline' | 'enforcement' | 'technical';
  severity: 'major' | 'moderate' | 'minor';
  location: string;
  summary: string;
  details: string;
  beforeText?: string;
  afterText?: string;
}

export interface SemanticDiffResult {
  billId: string;
  version1: string;
  version2: string;
  changes: SemanticChange[];
  summary: string;
  totalChanges: number;
  majorChanges: number;
  analyzedAt: string;
}

/**
 * Analyze semantic differences between two bill versions
 */
export async function analyzeSemanticDiff(
  billId: string,
  billNumber: string,
  version1: { label: string; text: string; hash: string },
  version2: { label: string; text: string; hash: string }
): Promise<SemanticDiffResult> {
  // Quick check: if hashes are the same, no changes
  if (version1.hash === version2.hash) {
    return {
      billId,
      version1: version1.label,
      version2: version2.label,
      changes: [],
      summary: 'No changes detected between versions.',
      totalChanges: 0,
      majorChanges: 0,
      analyzedAt: new Date().toISOString(),
    };
  }

  const provider = getProvider();

  // Truncate texts if too long (keep first 50k chars each)
  const maxChars = 50000;
  const v1Text = version1.text.length > maxChars
    ? version1.text.slice(0, maxChars) + '\n\n[...truncated...]'
    : version1.text;
  const v2Text = version2.text.length > maxChars
    ? version2.text.slice(0, maxChars) + '\n\n[...truncated...]'
    : version2.text;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: COMPARISON_SYSTEM_PROMPT + `

Output your analysis as JSON in this format:
{
  "summary": "Brief overall summary of changes",
  "changes": [
    {
      "type": "policy|scope|fiscal|timeline|enforcement|technical",
      "severity": "major|moderate|minor",
      "location": "Section X.XXX",
      "summary": "One-line summary",
      "details": "Detailed explanation",
      "beforeText": "Relevant text from version 1 (optional)",
      "afterText": "Relevant text from version 2 (optional)"
    }
  ]
}`,
    },
    {
      role: 'user',
      content: `Compare these two versions of ${billNumber}:

=== VERSION 1: ${version1.label} ===
${v1Text}
=== END VERSION 1 ===

=== VERSION 2: ${version2.label} ===
${v2Text}
=== END VERSION 2 ===

Analyze the substantive differences and return the JSON analysis.`,
    },
  ];

  const result = await provider.chat(messages, {
    maxTokens: 4096,
    temperature: 0.1, // Very low for consistent structured output
  });

  // Parse the JSON response
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const changes: SemanticChange[] = (parsed.changes || []).map(
      (c: Record<string, unknown>, index: number) => ({
        id: `diff:${billId}:${version1.hash.slice(0, 8)}:${version2.hash.slice(0, 8)}:${index}`,
        type: c.type as SemanticChange['type'],
        severity: c.severity as SemanticChange['severity'],
        location: c.location as string,
        summary: c.summary as string,
        details: c.details as string,
        beforeText: c.beforeText as string | undefined,
        afterText: c.afterText as string | undefined,
      })
    );

    return {
      billId,
      version1: version1.label,
      version2: version2.label,
      changes,
      summary: parsed.summary || 'Changes detected between versions.',
      totalChanges: changes.length,
      majorChanges: changes.filter(c => c.severity === 'major').length,
      analyzedAt: new Date().toISOString(),
    };
  } catch (parseError) {
    // If parsing fails, return a basic result with the raw text
    return {
      billId,
      version1: version1.label,
      version2: version2.label,
      changes: [],
      summary: result.content,
      totalChanges: 0,
      majorChanges: 0,
      analyzedAt: new Date().toISOString(),
    };
  }
}

/**
 * Quick text-based diff detection (no AI)
 */
export function detectTextChanges(
  text1: string,
  text2: string
): { added: number; removed: number; changed: number } {
  const lines1 = text1.split('\n').filter(l => l.trim());
  const lines2 = text2.split('\n').filter(l => l.trim());

  const set1 = new Set(lines1);
  const set2 = new Set(lines2);

  let added = 0;
  let removed = 0;

  for (const line of lines2) {
    if (!set1.has(line)) added++;
  }

  for (const line of lines1) {
    if (!set2.has(line)) removed++;
  }

  // Rough estimate of changed lines (some removed became added)
  const changed = Math.min(added, removed);

  return {
    added: added - changed,
    removed: removed - changed,
    changed,
  };
}

/**
 * Get change type label
 */
export function getChangeTypeLabel(type: SemanticChange['type']): string {
  const labels: Record<SemanticChange['type'], string> = {
    policy: 'Policy Change',
    scope: 'Scope Change',
    fiscal: 'Fiscal Change',
    timeline: 'Timeline Change',
    enforcement: 'Enforcement Change',
    technical: 'Technical Change',
  };
  return labels[type] || type;
}

/**
 * Get severity color
 */
export function getSeverityColor(severity: SemanticChange['severity']): string {
  const colors: Record<SemanticChange['severity'], string> = {
    major: 'text-red-600 bg-red-50',
    moderate: 'text-yellow-600 bg-yellow-50',
    minor: 'text-blue-600 bg-blue-50',
  };
  return colors[severity] || 'text-gray-600 bg-gray-50';
}

export default {
  analyzeSemanticDiff,
  detectTextChanges,
  getChangeTypeLabel,
  getSeverityColor,
};
