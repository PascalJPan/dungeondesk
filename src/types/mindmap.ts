export type EntityType = 'location' | 'happening' | 'character' | 'monster' | 'item';

export interface TextChunk {
  id: string;
  text: string;
  index: number;
  embedding?: number[];
  clusterIds?: number[]; // Can belong to multiple clusters
}

export interface Cluster {
  id: number;
  type: EntityType;
  label: string;
  summary: string;
  chunks: TextChunk[];
  centroid?: number[];
  color: string;
}

export interface GraphNode {
  id: string;
  clusterId: number;
  type: EntityType;
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
  relationship: string; // Description of the relationship
}

export interface CampaignData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: Cluster[];
  totalChunks: number;
  processingTime: number;
}

// Legacy alias for compatibility
export type MindMapData = CampaignData;

export type ChunkingMethod = 'sentence' | 'paragraph' | 'line' | 'custom';

export interface ClusterRange {
  min: number;
  max: number;
}

export interface ExtractionOptions {
  entityTypes: EntityType[];
  clusterRange: ClusterRange;
}

export interface ProcessingOptions {
  chunkingMethod: ChunkingMethod;
  extractionOptions: ExtractionOptions;
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

// Entity type display info
export const ENTITY_TYPE_INFO: Record<EntityType, { label: string; color: string; row: number }> = {
  location: { label: 'Locations', color: '#10b981', row: 0 },
  happening: { label: 'Happenings', color: '#f59e0b', row: 1 },
  character: { label: 'Characters', color: '#3b82f6', row: 2 },
  monster: { label: 'Monsters', color: '#ef4444', row: 2 },
  item: { label: 'Items', color: '#8b5cf6', row: 2 },
};
