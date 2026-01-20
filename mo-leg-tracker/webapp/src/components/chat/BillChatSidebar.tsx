'use client';

/**
 * Bill Chat Sidebar
 *
 * Main chat interface for bill analysis
 */

import { useState, useCallback } from 'react';
import { MessageSquare, X, Loader2, Sparkles } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { SuggestedQuestions } from './SuggestedQuestions';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface BillChatSidebarProps {
  billId: string;
  billNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

export function BillChatSidebar({
  billId,
  billNumber,
  isOpen,
  onClose,
}: BillChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId,
          message: content,
          sessionId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send message');
      }

      const data = await response.json();

      setSessionId(data.sessionId);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [billId, sessionId, isLoading]);

  const handleSuggestedQuestion = useCallback((question: string) => {
    sendMessage(question);
  }, [sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-lg flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Bill Analysis</h3>
            <p className="text-xs text-gray-500">{billNumber}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-200 transition-colors"
          aria-label="Close chat"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-blue-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">Ask about this bill</h4>
            <p className="text-sm text-gray-500 mb-6">
              Get AI-powered analysis of bill provisions, implications, and more.
            </p>
            <SuggestedQuestions onSelect={handleSuggestedQuestion} />
          </div>
        ) : (
          <>
            {messages.map(message => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Analyzing...</span>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Suggested Questions (when there are messages) */}
      {messages.length > 0 && messages.length < 6 && (
        <div className="px-4 py-2 border-t border-gray-100">
          <SuggestedQuestions
            onSelect={handleSuggestedQuestion}
            compact
          />
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4">
        <ChatInput
          onSend={sendMessage}
          disabled={isLoading}
          placeholder="Ask about this bill..."
        />
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear conversation
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Chat Toggle Button
 */
export function ChatToggleButton({
  onClick,
  isOpen,
}: {
  onClick: () => void;
  isOpen: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed right-4 bottom-4 p-4 rounded-full shadow-lg transition-all z-40',
        isOpen
          ? 'bg-gray-200 text-gray-600'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      )}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      {isOpen ? (
        <X className="w-6 h-6" />
      ) : (
        <MessageSquare className="w-6 h-6" />
      )}
    </button>
  );
}

export default BillChatSidebar;
