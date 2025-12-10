export interface TextChunk {
  id: string;
  text: string;
  index: number;
  embedding?: number[];
  clusterId?: number;
}

export interface Cluster {
  id: number;
  label: string;
  summary: string;
  chunks: TextChunk[];
  centroid?: number[];
  color: string;
}

export interface GraphNode {
  id: string;
  clusterId: number;
  label: string;
  summary: string;
  chunkCount: number;
  chunks: TextChunk[];
  color: string;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  similarity: number;
}

export interface MindMapData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: Cluster[];
  totalChunks: number;
  processingTime: number;
}

export type ChunkingMethod = 'sentence' | 'paragraph' | 'line' | 'custom';

export interface ProcessingOptions {
  chunkingMethod: ChunkingMethod;
  customChunkSize?: number;
  similarityThreshold: number;
  maxClusters: number;
}

export interface ProcessingState {
  status: 'idle' | 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'clustering' | 'generating' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export interface ExportOptions {
  format: 'png' | 'svg' | 'json' | 'markdown';
}
