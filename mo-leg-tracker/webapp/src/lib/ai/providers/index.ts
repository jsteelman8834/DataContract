/**
 * AI Provider Abstraction Layer
 *
 * Provides a unified interface for different AI providers (OpenAI, Anthropic)
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
}

export interface AIProvider {
  name: string;
  chat(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<ChatCompletionResult>;
  streamChat(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): AsyncGenerator<string, void, unknown>;
  countTokens(text: string): number;
}

/**
 * Get the configured AI provider
 */
export function getProvider(): AIProvider {
  const providerName = process.env.AI_PROVIDER || 'openai';

  switch (providerName.toLowerCase()) {
    case 'anthropic':
    case 'claude':
      return createAnthropicProvider();
    case 'openai':
    case 'gpt':
    default:
      return createOpenAIProvider();
  }
}

/**
 * Create OpenAI provider
 */
function createOpenAIProvider(): AIProvider {
  return {
    name: 'openai',

    async chat(messages, options = {}) {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await client.chat.completions.create({
        model: options.model || 'gpt-4-turbo-preview',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.3,
      });

      const choice = response.choices[0];

      return {
        content: choice.message.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
        finishReason: choice.finish_reason as ChatCompletionResult['finishReason'],
      };
    },

    async *streamChat(messages, options = {}) {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const stream = await client.chat.completions.create({
        model: options.model || 'gpt-4-turbo-preview',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.3,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    },

    countTokens(text) {
      // Rough estimation for GPT-4 tokenizer
      return Math.ceil(text.length / 4);
    },
  };
}

/**
 * Create Anthropic provider
 */
function createAnthropicProvider(): AIProvider {
  return {
    name: 'anthropic',

    async chat(messages, options = {}) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      // Extract system message
      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const chatMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const response = await client.messages.create({
        model: options.model || 'claude-3-5-sonnet-20241022',
        max_tokens: options.maxTokens || 4096,
        system: systemMessage,
        messages: chatMessages,
      });

      const textContent = response.content.find(c => c.type === 'text');

      return {
        content: textContent?.type === 'text' ? textContent.text : '',
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
        finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'length',
      };
    },

    async *streamChat(messages, options = {}) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const chatMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const stream = await client.messages.stream({
        model: options.model || 'claude-3-5-sonnet-20241022',
        max_tokens: options.maxTokens || 4096,
        system: systemMessage,
        messages: chatMessages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
    },

    countTokens(text) {
      // Rough estimation for Claude tokenizer
      return Math.ceil(text.length / 4);
    },
  };
}

export default {
  getProvider,
};
