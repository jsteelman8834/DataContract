/**
 * Token Counter and Budget Management
 *
 * Utilities for managing token usage and costs
 */

/**
 * Rough token estimation (4 chars per token average)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * More accurate token estimation using word-based heuristic
 */
export function estimateTokensAccurate(text: string): number {
  // Split on whitespace and punctuation
  const tokens = text.split(/[\s\p{P}]+/u).filter(Boolean);

  // Most English words are 1-2 tokens
  // Technical/legal text tends to have longer words
  let count = 0;
  for (const token of tokens) {
    if (token.length <= 4) {
      count += 1;
    } else if (token.length <= 8) {
      count += 1.3;
    } else {
      count += Math.ceil(token.length / 4);
    }
  }

  // Add tokens for whitespace and punctuation
  const punctuation = (text.match(/[\p{P}]/gu) || []).length;
  count += punctuation * 0.5;

  return Math.ceil(count);
}

/**
 * Token budget configuration
 */
export interface TokenBudget {
  maxInput: number;
  maxOutput: number;
  reserveForSystem: number;
  reserveForHistory: number;
}

export const DEFAULT_BUDGET: TokenBudget = {
  maxInput: 100000,
  maxOutput: 4096,
  reserveForSystem: 2000,
  reserveForHistory: 8000,
};

/**
 * Calculate available tokens for content
 */
export function calculateAvailableTokens(
  budget: TokenBudget,
  systemPromptLength: number,
  historyLength: number
): number {
  const systemTokens = estimateTokens(systemPromptLength.toString()) || 0;
  const historyTokens = Math.min(historyLength, budget.reserveForHistory);

  return budget.maxInput - systemTokens - historyTokens - budget.maxOutput;
}

/**
 * Cost calculation models
 */
export interface CostModel {
  name: string;
  inputCostPer1K: number;
  outputCostPer1K: number;
}

export const COST_MODELS: Record<string, CostModel> = {
  'gpt-4-turbo-preview': {
    name: 'GPT-4 Turbo',
    inputCostPer1K: 0.01,
    outputCostPer1K: 0.03,
  },
  'gpt-4': {
    name: 'GPT-4',
    inputCostPer1K: 0.03,
    outputCostPer1K: 0.06,
  },
  'gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    inputCostPer1K: 0.0005,
    outputCostPer1K: 0.0015,
  },
  'claude-3-5-sonnet-20241022': {
    name: 'Claude 3.5 Sonnet',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015,
  },
  'claude-3-opus-20240229': {
    name: 'Claude 3 Opus',
    inputCostPer1K: 0.015,
    outputCostPer1K: 0.075,
  },
  'claude-3-haiku-20240307': {
    name: 'Claude 3 Haiku',
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.00125,
  },
};

/**
 * Calculate cost for a request
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costModel = COST_MODELS[model] || COST_MODELS['gpt-4-turbo-preview'];

  return (
    (inputTokens / 1000) * costModel.inputCostPer1K +
    (outputTokens / 1000) * costModel.outputCostPer1K
  );
}

/**
 * Format cost as currency
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Usage statistics
 */
export interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  requestCount: number;
  averageInputTokens: number;
  averageOutputTokens: number;
}

/**
 * Calculate usage statistics
 */
export function calculateUsageStats(
  requests: Array<{ inputTokens: number; outputTokens: number; model: string }>
): UsageStats {
  if (requests.length === 0) {
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      requestCount: 0,
      averageInputTokens: 0,
      averageOutputTokens: 0,
    };
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;

  for (const req of requests) {
    totalInputTokens += req.inputTokens;
    totalOutputTokens += req.outputTokens;
    totalCost += calculateCost(req.model, req.inputTokens, req.outputTokens);
  }

  return {
    totalInputTokens,
    totalOutputTokens,
    totalCost,
    requestCount: requests.length,
    averageInputTokens: Math.round(totalInputTokens / requests.length),
    averageOutputTokens: Math.round(totalOutputTokens / requests.length),
  };
}

/**
 * Check if usage is within daily limit
 */
export function isWithinDailyLimit(
  currentUsage: UsageStats,
  limit: { maxRequests?: number; maxCost?: number }
): boolean {
  if (limit.maxRequests && currentUsage.requestCount >= limit.maxRequests) {
    return false;
  }

  if (limit.maxCost && currentUsage.totalCost >= limit.maxCost) {
    return false;
  }

  return true;
}

export default {
  estimateTokens,
  estimateTokensAccurate,
  calculateAvailableTokens,
  calculateCost,
  formatCost,
  calculateUsageStats,
  isWithinDailyLimit,
  DEFAULT_BUDGET,
  COST_MODELS,
};
