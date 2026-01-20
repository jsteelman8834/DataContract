'use client';

/**
 * Suggested Questions Component
 *
 * Quick-select questions for bill analysis
 */

import { cn } from '@/lib/utils';

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
  compact?: boolean;
}

const SUGGESTED_QUESTIONS = [
  'What is the main purpose of this bill?',
  'Who does this bill affect?',
  'What are the key provisions?',
  'What statutes does this amend?',
  'When would this take effect?',
  'What are the penalties?',
];

const COMPACT_QUESTIONS = [
  'Key provisions?',
  'Who is affected?',
  'Fiscal impact?',
];

export function SuggestedQuestions({
  onSelect,
  compact = false,
}: SuggestedQuestionsProps) {
  const questions = compact ? COMPACT_QUESTIONS : SUGGESTED_QUESTIONS;

  return (
    <div className={cn('space-y-2', compact && 'flex flex-wrap gap-2 space-y-0')}>
      {!compact && (
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
          Suggested Questions
        </p>
      )}
      {questions.map((question, index) => (
        <button
          key={index}
          onClick={() => onSelect(question)}
          className={cn(
            'text-left transition-colors',
            compact
              ? 'px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700'
              : 'block w-full px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded-md text-blue-700 border border-blue-200'
          )}
        >
          {question}
        </button>
      ))}
    </div>
  );
}

export default SuggestedQuestions;
