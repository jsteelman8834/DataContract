'use client';

/**
 * Chat Message Component
 *
 * Displays a single chat message with formatting
 */

import { User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-blue-100' : 'bg-gray-100'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-blue-600" />
        ) : (
          <Bot className="w-4 h-4 text-gray-600" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'flex-1 max-w-[85%]',
          isUser ? 'text-right' : 'text-left'
        )}
      >
        <div
          className={cn(
            'inline-block p-3 rounded-lg text-sm',
            isUser
              ? 'bg-blue-600 text-white rounded-tr-none'
              : 'bg-gray-100 text-gray-900 rounded-tl-none'
          )}
        >
          <MessageContent content={message.content} isUser={isUser} />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

/**
 * Format message content with basic markdown support
 */
function MessageContent({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  // Simple markdown-like formatting for assistant messages
  if (isUser) {
    return <span>{content}</span>;
  }

  // Process content for basic formatting
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inList = false;
  let listItems: string[] = [];

  lines.forEach((line, index) => {
    // Headers
    if (line.startsWith('## ')) {
      if (inList) {
        elements.push(
          <ul key={`list-${index}`} className="list-disc list-inside my-2 space-y-1">
            {listItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
      elements.push(
        <h4 key={index} className="font-semibold mt-3 mb-1">
          {line.slice(3)}
        </h4>
      );
    }
    // Bullet points
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      inList = true;
      listItems.push(line.slice(2));
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(line)) {
      inList = true;
      listItems.push(line.replace(/^\d+\.\s/, ''));
    }
    // Bold text
    else if (line.includes('**')) {
      if (inList) {
        elements.push(
          <ul key={`list-${index}`} className="list-disc list-inside my-2 space-y-1">
            {listItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
      const formatted = line.split(/\*\*(.*?)\*\*/g).map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
      );
      elements.push(<p key={index} className="my-1">{formatted}</p>);
    }
    // Regular paragraph
    else if (line.trim()) {
      if (inList) {
        elements.push(
          <ul key={`list-${index}`} className="list-disc list-inside my-2 space-y-1">
            {listItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
      elements.push(<p key={index} className="my-1">{line}</p>);
    }
    // Empty line
    else if (!inList) {
      elements.push(<br key={index} />);
    }
  });

  // Flush remaining list items
  if (inList && listItems.length > 0) {
    elements.push(
      <ul key="list-final" className="list-disc list-inside my-2 space-y-1">
        {listItems.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

/**
 * Format timestamp
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default ChatMessage;
