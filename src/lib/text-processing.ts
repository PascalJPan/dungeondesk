import { TextChunk, ChunkingMethod } from '@/types/mindmap';

/**
 * Clean text by removing common artifacts
 */
export function cleanText(text: string): string {
  return text
    // Remove page numbers (common patterns)
    .replace(/\b(page|pg\.?)\s*\d+\b/gi, '')
    .replace(/^\d+$/gm, '')
    // Fix hyphenated line breaks
    .replace(/(\w)-\n(\w)/g, '$1$2')
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    // Remove common headers/footers patterns
    .replace(/^(confidential|draft|internal use only).*$/gim, '')
    .trim();
}

/**
 * Check if text is list-heavy (many bullet points or short lines)
 */
export function isListHeavy(text: string): boolean {
  const lines = text.split(/\n/).filter(l => l.trim().length > 0);
  if (lines.length < 3) return false;
  
  const bulletLines = lines.filter(l => /^\s*[*\-•→►▸]\s/.test(l) || /^\s*\d+[.)]\s/.test(l));
  return bulletLines.length / lines.length > 0.3;
}

/**
 * Split text into lines (for bullet points, lists, notes)
 */
export function splitIntoLines(text: string): string[] {
  return text
    .split(/\n/)
    .map(line => line.replace(/^\s*[*\-•→►▸]\s*/, '').trim()) // Remove bullet markers
    .filter(line => line.length > 10);
}

/**
 * Split text into sentences with bullet point support
 */
export function splitIntoSentences(text: string): string[] {
  // If text is list-heavy, use line-based splitting instead
  if (isListHeavy(text)) {
    return splitIntoLines(text);
  }

  // Handle common abbreviations
  const abbrevProtected = text
    .replace(/Mr\./g, 'Mr<DOT>')
    .replace(/Mrs\./g, 'Mrs<DOT>')
    .replace(/Ms\./g, 'Ms<DOT>')
    .replace(/Dr\./g, 'Dr<DOT>')
    .replace(/Prof\./g, 'Prof<DOT>')
    .replace(/Inc\./g, 'Inc<DOT>')
    .replace(/Ltd\./g, 'Ltd<DOT>')
    .replace(/vs\./g, 'vs<DOT>')
    .replace(/e\.g\./g, 'e<DOT>g<DOT>')
    .replace(/i\.e\./g, 'i<DOT>e<DOT>')
    .replace(/etc\./g, 'etc<DOT>');

  // Split on sentence boundaries
  const sentences = abbrevProtected
    .split(/(?<=[.!?])\s+(?=[A-Z])/g)
    .map(s => s.replace(/<DOT>/g, '.').trim())
    .filter(s => s.length > 10);

  return sentences;
}

/**
 * Split text into paragraphs
 */
export function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 20); // Filter out very short paragraphs
}

/**
 * Split text into custom-sized chunks
 */
export function splitIntoCustomChunks(text: string, chunkSize: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const word of words) {
    if (currentLength + word.length + 1 > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
      currentLength = 0;
    }
    currentChunk.push(word);
    currentLength += word.length + 1;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks.filter(c => c.length > 20);
}

/**
 * Create text chunks based on the specified method
 */
export function createChunks(
  text: string,
  method: ChunkingMethod,
  customSize?: number
): TextChunk[] {
  const cleanedText = cleanText(text);
  let segments: string[];

  switch (method) {
    case 'sentence':
      segments = splitIntoSentences(cleanedText);
      break;
    case 'paragraph':
      segments = splitIntoParagraphs(cleanedText);
      break;
    case 'line':
      segments = splitIntoLines(cleanedText);
      break;
    case 'custom':
      segments = splitIntoCustomChunks(cleanedText, customSize || 500);
      break;
    default:
      segments = splitIntoSentences(cleanedText);
  }

  return segments.map((text, index) => ({
    id: `chunk-${index}`,
    text,
    index,
  }));
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Get cluster colors
 */
export function getClusterColor(clusterId: number): string {
  const colors = [
    'hsl(175, 70%, 50%)',  // Teal
    'hsl(200, 70%, 55%)',  // Blue
    'hsl(280, 50%, 55%)',  // Purple
    'hsl(35, 80%, 55%)',   // Orange
    'hsl(340, 65%, 55%)',  // Pink
    'hsl(140, 55%, 45%)',  // Green
    'hsl(45, 85%, 50%)',   // Yellow
    'hsl(320, 60%, 50%)',  // Magenta
  ];
  return colors[clusterId % colors.length];
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format processing time
 */
export function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
