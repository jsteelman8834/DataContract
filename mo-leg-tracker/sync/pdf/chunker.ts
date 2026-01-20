/**
 * Text Chunker
 *
 * Splits extracted text into manageable chunks for AI context windows
 */

export interface TextChunk {
  id: string;
  index: number;
  text: string;
  startOffset: number;
  endOffset: number;
  tokenCount: number;
  section?: string;
}

export interface ChunkOptions {
  maxTokens: number;         // Max tokens per chunk
  overlapTokens: number;     // Overlap between chunks
  preserveSections: boolean; // Try to keep sections together
}

const DEFAULT_OPTIONS: ChunkOptions = {
  maxTokens: 4000,
  overlapTokens: 200,
  preserveSections: true,
};

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks with overlap
 */
export function chunkText(
  text: string,
  billId: string,
  options: Partial<ChunkOptions> = {}
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: TextChunk[] = [];

  // If text fits in one chunk, return it
  const totalTokens = estimateTokens(text);
  if (totalTokens <= opts.maxTokens) {
    return [{
      id: `${billId}:chunk:0`,
      index: 0,
      text,
      startOffset: 0,
      endOffset: text.length,
      tokenCount: totalTokens,
    }];
  }

  // Calculate approximate chars per chunk
  const charsPerToken = 4;
  const maxChars = opts.maxTokens * charsPerToken;
  const overlapChars = opts.overlapTokens * charsPerToken;

  let currentOffset = 0;
  let chunkIndex = 0;

  while (currentOffset < text.length) {
    let endOffset = currentOffset + maxChars;

    // Don't exceed text length
    if (endOffset >= text.length) {
      endOffset = text.length;
    } else if (opts.preserveSections) {
      // Try to end at a section break or paragraph
      const searchStart = Math.max(currentOffset + maxChars - 500, currentOffset);
      const searchText = text.slice(searchStart, endOffset);

      // Look for section breaks (common patterns in bills)
      const sectionBreak = searchText.lastIndexOf('\nSection ');
      const paragraphBreak = searchText.lastIndexOf('\n\n');
      const sentenceBreak = searchText.lastIndexOf('. ');

      let breakPoint = -1;
      if (sectionBreak > -1) {
        breakPoint = searchStart + sectionBreak;
      } else if (paragraphBreak > -1) {
        breakPoint = searchStart + paragraphBreak;
      } else if (sentenceBreak > -1) {
        breakPoint = searchStart + sentenceBreak + 2; // Include the period and space
      }

      if (breakPoint > currentOffset + maxChars / 2) {
        endOffset = breakPoint;
      }
    }

    const chunkText = text.slice(currentOffset, endOffset).trim();

    if (chunkText.length > 0) {
      chunks.push({
        id: `${billId}:chunk:${chunkIndex}`,
        index: chunkIndex,
        text: chunkText,
        startOffset: currentOffset,
        endOffset,
        tokenCount: estimateTokens(chunkText),
      });
      chunkIndex++;
    }

    // Move forward, accounting for overlap
    currentOffset = endOffset - overlapChars;

    // Prevent infinite loop
    if (currentOffset >= text.length - 10) break;
  }

  return chunks;
}

/**
 * Select relevant chunks based on query
 */
export function selectRelevantChunks(
  chunks: TextChunk[],
  query: string,
  maxTokens: number = 50000
): TextChunk[] {
  // Simple relevance scoring based on keyword matching
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  const scored = chunks.map(chunk => {
    const lowerText = chunk.text.toLowerCase();
    let score = 0;

    for (const word of queryWords) {
      const matches = (lowerText.match(new RegExp(word, 'g')) || []).length;
      score += matches;
    }

    // Boost first and last chunks (intro and conclusion)
    if (chunk.index === 0) score += 2;
    if (chunk.index === chunks.length - 1) score += 1;

    return { chunk, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Select chunks up to token limit
  const selected: TextChunk[] = [];
  let totalTokens = 0;

  for (const { chunk } of scored) {
    if (totalTokens + chunk.tokenCount > maxTokens) break;
    selected.push(chunk);
    totalTokens += chunk.tokenCount;
  }

  // Sort by original index for coherent reading
  selected.sort((a, b) => a.index - b.index);

  return selected;
}

/**
 * Get chunk context for citation
 */
export function getChunkContext(chunk: TextChunk): string {
  const preview = chunk.text.slice(0, 100).trim();
  return `[Chunk ${chunk.index + 1}: "${preview}..."]`;
}

/**
 * Merge adjacent chunks back together
 */
export function mergeChunks(chunks: TextChunk[]): string {
  if (chunks.length === 0) return '';
  if (chunks.length === 1) return chunks[0].text;

  // Sort by index
  const sorted = [...chunks].sort((a, b) => a.index - b.index);

  let merged = sorted[0].text;

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];

    // Check if chunks are adjacent
    if (current.index === previous.index + 1) {
      // Remove overlap
      const overlapSize = Math.min(200 * 4, current.text.length / 4); // ~200 tokens
      merged += '\n\n' + current.text.slice(overlapSize);
    } else {
      // Non-adjacent, add with separator
      merged += '\n\n[...]\n\n' + current.text;
    }
  }

  return merged;
}

export default {
  estimateTokens,
  chunkText,
  selectRelevantChunks,
  getChunkContext,
  mergeChunks,
};
