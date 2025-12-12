export type EntityType = 'location' | 'happening' | 'character' | 'monster' | 'item';

// Base entity fields
export interface BaseEntity {
  id: string;
  type: EntityType;
  name: string;
  shortDescription: string; // 3 sentence description
  longDescription: string; // Detailed description
}

// Location entity
export interface LocationEntity extends BaseEntity {
  type: 'location';
  background: string;
  associatedCharacters: string[]; // Entity IDs
  associatedMonsters: string[];
  associatedHappenings: string[];
  associatedItems: string[];
}

// Happening entity
export interface HappeningEntity extends BaseEntity {
  type: 'happening';
  potentialStarts: string;
  potentialOutcomes: string;
  associatedLocations: string[];
  associatedCharacters: string[];
  associatedMonsters: string[];
  associatedItems: string[];
}

// Character entity
export interface CharacterEntity extends BaseEntity {
  type: 'character';
  background: string;
  motivationsGoals: string;
  personality: string;
  associatedLocations: string[];
  associatedHappenings: string[];
  associatedItems: string[];
}

// Monster entity
export interface MonsterEntity extends BaseEntity {
  type: 'monster';
  abilities: string;
  behavior: string;
  associatedLocations: string[];
  associatedHappenings: string[];
  associatedItems: string[];
}

// Item entity
export interface ItemEntity extends BaseEntity {
  type: 'item';
  properties: string;
  history: string;
  associatedLocations: string[];
  associatedCharacters: string[];
  associatedHappenings: string[];
}

// Union type for all entities
export type CampaignEntity = LocationEntity | HappeningEntity | CharacterEntity | MonsterEntity | ItemEntity;

// Entity field definitions for UI and extraction
export interface EntityFieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'relations';
  required: boolean;
  relationType?: EntityType[];
}

export const ENTITY_FIELDS: Record<EntityType, EntityFieldDef[]> = {
  location: [
    { key: 'shortDescription', label: 'Short Description', type: 'textarea', required: true },
    { key: 'longDescription', label: 'In-Depth Description', type: 'textarea', required: false },
    { key: 'background', label: 'Background', type: 'textarea', required: false },
    { key: 'associatedCharacters', label: 'Associated Characters', type: 'relations', required: false, relationType: ['character'] },
    { key: 'associatedMonsters', label: 'Associated Monsters', type: 'relations', required: false, relationType: ['monster'] },
    { key: 'associatedHappenings', label: 'Associated Happenings', type: 'relations', required: false, relationType: ['happening'] },
    { key: 'associatedItems', label: 'Associated Items', type: 'relations', required: false, relationType: ['item'] },
  ],
  happening: [
    { key: 'shortDescription', label: 'Short Description', type: 'textarea', required: true },
    { key: 'longDescription', label: 'Detailed Description', type: 'textarea', required: false },
    { key: 'potentialStarts', label: 'Potential Starts', type: 'textarea', required: false },
    { key: 'potentialOutcomes', label: 'Potential Outcomes', type: 'textarea', required: false },
    { key: 'associatedLocations', label: 'Associated Locations', type: 'relations', required: false, relationType: ['location'] },
    { key: 'associatedCharacters', label: 'Associated Characters', type: 'relations', required: false, relationType: ['character'] },
    { key: 'associatedMonsters', label: 'Associated Monsters', type: 'relations', required: false, relationType: ['monster'] },
    { key: 'associatedItems', label: 'Associated Items', type: 'relations', required: false, relationType: ['item'] },
  ],
  character: [
    { key: 'shortDescription', label: 'Short Description', type: 'textarea', required: true },
    { key: 'longDescription', label: 'Detailed Description', type: 'textarea', required: false },
    { key: 'background', label: 'Background', type: 'textarea', required: false },
    { key: 'motivationsGoals', label: 'Motivations & Goals', type: 'textarea', required: false },
    { key: 'personality', label: 'Personality', type: 'textarea', required: false },
    { key: 'associatedLocations', label: 'Associated Locations', type: 'relations', required: false, relationType: ['location'] },
    { key: 'associatedHappenings', label: 'Associated Happenings', type: 'relations', required: false, relationType: ['happening'] },
    { key: 'associatedItems', label: 'Associated Items', type: 'relations', required: false, relationType: ['item'] },
  ],
  monster: [
    { key: 'shortDescription', label: 'Short Description', type: 'textarea', required: true },
    { key: 'longDescription', label: 'Detailed Description', type: 'textarea', required: false },
    { key: 'abilities', label: 'Abilities', type: 'textarea', required: false },
    { key: 'behavior', label: 'Behavior', type: 'textarea', required: false },
    { key: 'associatedLocations', label: 'Associated Locations', type: 'relations', required: false, relationType: ['location'] },
    { key: 'associatedHappenings', label: 'Associated Happenings', type: 'relations', required: false, relationType: ['happening'] },
    { key: 'associatedItems', label: 'Associated Items', type: 'relations', required: false, relationType: ['item'] },
  ],
  item: [
    { key: 'shortDescription', label: 'Short Description', type: 'textarea', required: true },
    { key: 'longDescription', label: 'Detailed Description', type: 'textarea', required: false },
    { key: 'properties', label: 'Properties', type: 'textarea', required: false },
    { key: 'history', label: 'History', type: 'textarea', required: false },
    { key: 'associatedLocations', label: 'Associated Locations', type: 'relations', required: false, relationType: ['location'] },
    { key: 'associatedCharacters', label: 'Associated Characters', type: 'relations', required: false, relationType: ['character'] },
    { key: 'associatedHappenings', label: 'Associated Happenings', type: 'relations', required: false, relationType: ['happening'] },
  ],
};

// Entity type display info - ink/parchment theme colors
export const ENTITY_TYPE_INFO: Record<EntityType, { label: string; color: string; icon: string }> = {
  location: { label: 'Locations', color: '#5d8a66', icon: '📍' },
  happening: { label: 'Happenings', color: '#b08d57', icon: '⚡' },
  character: { label: 'Characters', color: '#6b7fa3', icon: '👤' },
  monster: { label: 'Monsters', color: '#a35d5d', icon: '👹' },
  item: { label: 'Items', color: '#7d6b99', icon: '🗡️' },
};

// Campaign data structure
export interface CampaignData {
  entities: CampaignEntity[];
  processingTime: number;
}

// Empty field info for Questions panel
export interface EmptyField {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  fieldKey: string;
  fieldLabel: string;
}

// Custom attribute definition
export interface CustomAttribute {
  key: string;
  label: string;
  type: 'text' | 'textarea';
}

// Extraction options
export interface ExtractionOptions {
  entityTypes: EntityType[];
  customAttributes?: Record<EntityType, CustomAttribute[]>;
}

// Campaign export format
export interface CampaignExport {
  version: string;
  exportedAt: string;
  customAttributes?: Record<EntityType, CustomAttribute[]>;
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
export function getEmptyFields(data: CampaignData): EmptyField[] {
  const emptyFields: EmptyField[] = [];
  
  for (const entity of data.entities) {
    const fields = ENTITY_FIELDS[entity.type];
    for (const field of fields) {
      if (field.type === 'relations') continue; // Skip relations for now
      
      const value = (entity as any)[field.key];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        emptyFields.push({
          entityId: entity.id,
          entityName: entity.name,
          entityType: entity.type,
          fieldKey: field.key,
          fieldLabel: field.label,
        });
      }
    }
  }
  
  return emptyFields;
}

// Helper to create empty entity
export function createEmptyEntity(type: EntityType, id: string, name: string): CampaignEntity {
  const base = { id, type, name, shortDescription: '', longDescription: '' };
  
  switch (type) {
    case 'location':
      return { ...base, type: 'location', background: '', associatedCharacters: [], associatedMonsters: [], associatedHappenings: [], associatedItems: [] };
    case 'happening':
      return { ...base, type: 'happening', potentialStarts: '', potentialOutcomes: '', associatedLocations: [], associatedCharacters: [], associatedMonsters: [], associatedItems: [] };
    case 'character':
      return { ...base, type: 'character', background: '', motivationsGoals: '', personality: '', associatedLocations: [], associatedHappenings: [], associatedItems: [] };
    case 'monster':
      return { ...base, type: 'monster', abilities: '', behavior: '', associatedLocations: [], associatedHappenings: [], associatedItems: [] };
    case 'item':
      return { ...base, type: 'item', properties: '', history: '', associatedLocations: [], associatedCharacters: [], associatedHappenings: [] };
  }
}
