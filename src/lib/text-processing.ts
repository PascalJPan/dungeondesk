import { TextChunk, ChunkingMethod } from '@/types/mindmap';

/**
 * Clean text by removing common artifacts and markdown syntax
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
 * Clean markdown syntax from text (for display in excerpts)
 */
export function cleanMarkdown(text: string): string {
  return text
    // Remove headers (# ## ### etc.)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold (**text** or __text__)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Remove italic (*text* or _text_)
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    .trim();
}

/**
 * Split text by markdown headers (creates chunks at each header boundary)
 */
export function splitByHeaders(text: string): string[] {
  // Split on markdown headers (# ## ### etc.)
  const headerPattern = /^(?=#{1,6}\s)/gm;
  const sections = text.split(headerPattern).filter(s => s.trim().length > 20);
  
  // If no headers found, return null to fall back to other methods
  if (sections.length <= 1) {
    return [];
  }
  
  return sections.map(s => s.trim());
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

  // First, try to split by headers if present (respects markdown structure)
  const headerSections = splitByHeaders(cleanedText);
  
  if (headerSections.length > 0) {
    // If we have header sections, further split them based on method
    segments = [];
    for (const section of headerSections) {
      let sectionChunks: string[];
      switch (method) {
        case 'sentence':
          sectionChunks = splitIntoSentences(section);
          break;
        case 'paragraph':
          sectionChunks = splitIntoParagraphs(section);
          break;
        case 'line':
          sectionChunks = splitIntoLines(section);
          break;
        case 'custom':
          sectionChunks = splitIntoCustomChunks(section, customSize || 500);
          break;
        default:
          sectionChunks = splitIntoSentences(section);
      }
      // If section is small enough, keep it as one chunk
      if (sectionChunks.length === 0 || section.length < 200) {
        segments.push(section);
      } else {
        segments.push(...sectionChunks);
      }
    }
  } else {
    // No headers, use original method
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
  }

  // Clean markdown from each segment for cleaner excerpts
  return segments.map((text, index) => ({
    id: `chunk-${index}`,
    text: cleanMarkdown(text),
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
