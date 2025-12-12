// Dynamic entity type - no longer hardcoded
export type EntityType = string;

// Color palette for entity types
export const COLOR_PALETTE = [
  '#5d8a66', // sage green
  '#b08d57', // amber
  '#6b7fa3', // steel blue
  '#a35d5d', // rust red
  '#7d6b99', // muted purple
  '#5d8a8a', // teal
  '#8a6b5d', // brown
  '#7a8a5d', // olive
  '#8a5d7a', // mauve
  '#5d6b8a', // slate
];

// Entity type definition (configurable)
export interface EntityTypeDef {
  key: string;
  label: string;
  color: string;
  attributes: AttributeDef[];
  extractionPrompt?: string; // AI extraction guidance
}

// Attribute definition
export interface AttributeDef {
  key: string;
  label: string;
}

// Attack definition for combat entities
export interface Attack {
  name: string;
  toHit: string;
  damage: string;
}

// Default entity type definitions
export const DEFAULT_ENTITY_TYPES: EntityTypeDef[] = [
  {
    key: 'location',
    label: 'Locations',
    color: '#5d8a66',
    extractionPrompt: 'Only pick major locations which are more than just mentioned and have associated characters, items, or monsters.',
    attributes: [
      { key: 'shortDescription', label: 'Short Description' },
      { key: 'longDescription', label: 'In-Depth Description' },
      { key: 'background', label: 'Background' },
      { key: 'secretsHiddenInfo', label: 'Secrets/Hidden Info' },
      { key: 'atmosphereMood', label: 'Atmosphere/Mood' },
      { key: 'associatedEntities', label: 'Associated Entities' },
    ],
  },
  {
    key: 'happening',
    label: 'Happenings',
    color: '#b08d57',
    extractionPrompt: 'Only include happenings if you can also find a detailed description about them.',
    attributes: [
      { key: 'shortDescription', label: 'Short Description' },
      { key: 'longDescription', label: 'Detailed Description' },
      { key: 'potentialStarts', label: 'Potential Starts' },
      { key: 'potentialOutcomes', label: 'Potential Outcomes' },
      { key: 'associatedEntities', label: 'Associated Entities' },
    ],
  },
  {
    key: 'character',
    label: 'Characters',
    color: '#6b7fa3',
    attributes: [
      { key: 'shortDescription', label: 'Short Description' },
      { key: 'longDescription', label: 'Detailed Description' },
      { key: 'background', label: 'Background' },
      { key: 'motivationsGoals', label: 'Motivations & Goals' },
      { key: 'personality', label: 'Personality' },
      { key: 'secrets', label: 'Secrets' },
      { key: 'relationships', label: 'Relationships' },
      { key: 'associatedEntities', label: 'Associated Entities' },
      { key: 'healthPoints', label: 'Health Points' },
      { key: 'armorClass', label: 'Armor Class' },
      { key: 'speed', label: 'Speed' },
      { key: 'attacks', label: 'Attacks' },
      { key: 'resistancesAdvantages', label: 'Resistances/Advantages' },
    ],
  },
  {
    key: 'monster',
    label: 'Monsters',
    color: '#a35d5d',
    attributes: [
      { key: 'shortDescription', label: 'Short Description' },
      { key: 'longDescription', label: 'Detailed Description' },
      { key: 'abilities', label: 'Abilities' },
      { key: 'behavior', label: 'Behavior' },
      { key: 'associatedEntities', label: 'Associated Entities' },
      { key: 'healthPoints', label: 'Health Points' },
      { key: 'armorClass', label: 'Armor Class' },
      { key: 'speed', label: 'Speed' },
      { key: 'attacks', label: 'Attacks' },
      { key: 'resistancesAdvantages', label: 'Resistances/Advantages' },
    ],
  },
  {
    key: 'item',
    label: 'Items',
    color: '#7d6b99',
    attributes: [
      { key: 'shortDescription', label: 'Short Description' },
      { key: 'longDescription', label: 'Detailed Description' },
      { key: 'itemType', label: 'Type' },
      { key: 'properties', label: 'Properties' },
      { key: 'history', label: 'History' },
      { key: 'associatedEntities', label: 'Associated Entities' },
    ],
  },
];

// Campaign entity (dynamic based on type definition)
export interface CampaignEntity {
  id: string;
  type: string;
  name: string;
  [key: string]: any; // Dynamic attributes
}

// Campaign data structure
export interface CampaignData {
  entities: CampaignEntity[];
  processingTime: number;
}

// Empty field info for Questions panel
export interface EmptyField {
  entityId: string;
  entityName: string;
  entityType: string;
  fieldKey: string;
  fieldLabel: string;
}

// Prompt settings for external AI
export interface PromptSettings {
  contentLanguage: string;
  tone: string;
  inferLevel: number; // 1=never, 2=rarely, 3=sometimes, 4=often, 5=always
}

export const DEFAULT_PROMPT_SETTINGS: PromptSettings = {
  contentLanguage: 'English',
  tone: 'High Fantasy',
  inferLevel: 3, // Sometimes by default
};

export const INFER_LEVEL_LABELS: Record<number, string> = {
  1: 'Never',
  2: 'Rarely',
  3: 'Sometimes',
  4: 'Often',
  5: 'Always',
};

// Extraction options
export interface ExtractionOptions {
  entityTypes: EntityTypeDef[];
  promptSettings?: PromptSettings;
}

// Campaign export format
export interface CampaignExport {
  version: string;
  exportedAt: string;
  entityTypes: EntityTypeDef[];
  entities: CampaignEntity[];
}

// Processing state
export interface ProcessingState {
  status: 'idle' | 'extracting' | 'filling' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

// Helper to get empty fields from campaign data
export function getEmptyFields(data: CampaignData, entityTypes: EntityTypeDef[]): EmptyField[] {
  const emptyFields: EmptyField[] = [];
  
  for (const entity of data.entities) {
    const typeDef = entityTypes.find(t => t.key === entity.type);
    if (!typeDef) continue;
    
    for (const attr of typeDef.attributes) {
      const value = entity[attr.key];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        emptyFields.push({
          entityId: entity.id,
          entityName: entity.name,
          entityType: entity.type,
          fieldKey: attr.key,
          fieldLabel: attr.label,
        });
      }
    }
  }
  
  return emptyFields;
}

// Helper to create empty entity
export function createEmptyEntity(typeDef: EntityTypeDef, id: string, name: string): CampaignEntity {
  const entity: CampaignEntity = { id, type: typeDef.key, name };
  
  for (const attr of typeDef.attributes) {
    entity[attr.key] = '';
  }
  
  // Add relation arrays for all other entity types
  entity.relations = [];
  
  return entity;
}

// Helper to get color for entity type
export function getEntityColor(entityTypes: EntityTypeDef[], type: string): string {
  return entityTypes.find(t => t.key === type)?.color || '#666666';
}

// Helper to get label for entity type
export function getEntityLabel(entityTypes: EntityTypeDef[], type: string): string {
  return entityTypes.find(t => t.key === type)?.label || type;
}
