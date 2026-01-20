/**
 * Chat Handler
 *
 * Processes chat requests with context management and token budgeting
 */

import { getProvider, type ChatMessage, type ChatCompletionResult } from './providers';
import {
  BILL_ANALYSIS_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
  COMPARISON_SYSTEM_PROMPT,
  buildBillContextPrompt,
  buildComparisonContextPrompt,
} from './prompts';

export interface ChatSession {
  id: string;
  billId: string;
  messages: ChatMessage[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BillContext {
  billNumber: string;
  billTitle: string;
  extractedText: string;
  textHash: string;
}

// Token budget configuration
const TOKEN_BUDGET = {
  maxContext: 100000,      // Max input tokens
  maxResponse: 4096,       // Max response tokens
  reserveForResponse: 4500, // Reserve for response
  maxHistoryTokens: 8000,   // Max tokens for chat history
};

// Cost per 1K tokens (approximate)
const COST_PER_1K = {
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
};

/**
 * Calculate cost for token usage
 */
function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rates = COST_PER_1K[model as keyof typeof COST_PER_1K] ||
    COST_PER_1K['gpt-4-turbo-preview'];

  return (
    (promptTokens / 1000) * rates.input +
    (completionTokens / 1000) * rates.output
  );
}

/**
 * Truncate text to fit token budget
 */
function truncateToTokens(text: string, maxTokens: number): { text: string; truncated: boolean } {
  const provider = getProvider();
  const currentTokens = provider.countTokens(text);

  if (currentTokens <= maxTokens) {
    return { text, truncated: false };
  }

  // Rough truncation based on character ratio
  const ratio = maxTokens / currentTokens;
  const targetChars = Math.floor(text.length * ratio * 0.95); // 5% buffer

  return {
    text: text.slice(0, targetChars) + '\n\n[...text truncated due to length...]',
    truncated: true,
  };
}

/**
 * Build messages with context and history
 */
function buildMessages(
  billContext: BillContext,
  userMessage: string,
  history: ChatMessage[] = []
): ChatMessage[] {
  const provider = getProvider();
  const messages: ChatMessage[] = [];

  // Calculate available tokens for bill text
  const systemTokens = provider.countTokens(BILL_ANALYSIS_SYSTEM_PROMPT);
  const userMessageTokens = provider.countTokens(userMessage);

  // Truncate history if needed
  let historyTokens = 0;
  const truncatedHistory: ChatMessage[] = [];
  for (const msg of [...history].reverse()) {
    const msgTokens = provider.countTokens(msg.content);
    if (historyTokens + msgTokens > TOKEN_BUDGET.maxHistoryTokens) break;
    truncatedHistory.unshift(msg);
    historyTokens += msgTokens;
  }

  // Calculate max tokens for bill context
  const availableForContext = TOKEN_BUDGET.maxContext -
    systemTokens -
    userMessageTokens -
    historyTokens -
    TOKEN_BUDGET.reserveForResponse;

  // Truncate bill text if needed
  const { text: truncatedBillText, truncated } = truncateToTokens(
    billContext.extractedText,
    availableForContext
  );

  // Build system message with bill context
  const contextPrompt = buildBillContextPrompt(
    billContext.billNumber,
    billContext.billTitle,
    truncatedBillText,
    truncated
  );

  messages.push({
    role: 'system',
    content: BILL_ANALYSIS_SYSTEM_PROMPT + '\n\n' + contextPrompt,
  });

  // Add history
  messages.push(...truncatedHistory);

  // Add current user message
  messages.push({
    role: 'user',
    content: userMessage,
  });

  return messages;
}

/**
 * Process a chat message
 */
export async function processChat(
  session: ChatSession,
  userMessage: string,
  billContext: BillContext
): Promise<{ response: string; updatedSession: ChatSession }> {
  const provider = getProvider();

  // Build messages with context
  const messages = buildMessages(
    billContext,
    userMessage,
    session.messages
  );

  // Call AI provider
  const result = await provider.chat(messages, {
    maxTokens: TOKEN_BUDGET.maxResponse,
    temperature: 0.3, // Lower temperature for factual responses
  });

  // Calculate cost
  const cost = calculateCost(
    result.model,
    result.usage.promptTokens,
    result.usage.completionTokens
  );

  // Update session
  const updatedSession: ChatSession = {
    ...session,
    messages: [
      ...session.messages,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: result.content },
    ],
    tokenUsage: {
      promptTokens: session.tokenUsage.promptTokens + result.usage.promptTokens,
      completionTokens: session.tokenUsage.completionTokens + result.usage.completionTokens,
      totalCost: session.tokenUsage.totalCost + cost,
    },
    updatedAt: new Date().toISOString(),
  };

  return {
    response: result.content,
    updatedSession,
  };
}

/**
 * Generate a bill summary
 */
export async function generateSummary(billContext: BillContext): Promise<string> {
  const provider = getProvider();

  const { text: truncatedText, truncated } = truncateToTokens(
    billContext.extractedText,
    TOKEN_BUDGET.maxContext - 2000 // Reserve for prompt and response
  );

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: SUMMARY_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: buildBillContextPrompt(
        billContext.billNumber,
        billContext.billTitle,
        truncatedText,
        truncated
      ) + '\n\nPlease provide a plain-language summary of this bill.',
    },
  ];

  const result = await provider.chat(messages, {
    maxTokens: 1024,
    temperature: 0.3,
  });

  return result.content;
}

/**
 * Compare two bill versions
 */
export async function compareBillVersions(
  billNumber: string,
  version1: { label: string; text: string },
  version2: { label: string; text: string }
): Promise<string> {
  const provider = getProvider();

  // Calculate available space for each version
  const availablePerVersion = Math.floor(
    (TOKEN_BUDGET.maxContext - 3000) / 2 // Reserve for prompts
  );

  const { text: v1Text } = truncateToTokens(version1.text, availablePerVersion);
  const { text: v2Text } = truncateToTokens(version2.text, availablePerVersion);

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: COMPARISON_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: buildComparisonContextPrompt(
        billNumber,
        version1.label,
        v1Text,
        version2.label,
        v2Text
      ) + '\n\nPlease identify and explain the substantive changes between these two versions.',
    },
  ];

  const result = await provider.chat(messages, {
    maxTokens: 2048,
    temperature: 0.3,
  });

  return result.content;
}

/**
 * Create a new chat session
 */
export function createSession(billId: string): ChatSession {
  return {
    id: `chat:${billId}:${Date.now()}`,
    billId,
    messages: [],
    tokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default {
  processChat,
  generateSummary,
  compareBillVersions,
  createSession,
};
