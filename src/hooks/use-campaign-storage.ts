import { useCallback } from 'react';
import { CampaignData, EntityTypeDef, PromptSettings, CampaignMetadata } from '@/types/mindmap';
import { CombatInstance } from '@/components/CombatTracker';

const STORAGE_KEYS = {
  campaignData: 'dungeondesk-campaign-data',
  entityTypes: 'dungeondesk-entity-types',
  promptSettings: 'dungeondesk-prompt-settings',
  campaignMetadata: 'dungeondesk-campaign-metadata',
  combatState: 'dungeondesk-combat-state',
  placedCards: 'dungeondesk-placed-cards',
  extractSettings: 'dungeondesk-extract-settings',
} as const;

export interface ExtractSettings {
  openAiApiKey: string;
  inputText: string;
  maxExtractedEntities: number;
}

interface PlacedCard {
  entityId: string;
  row: number;
  col: number;
}

export interface StoredCombatState {
  combatInstances: CombatInstance[];
  round: number;
  currentTurnId: string | null;
}

export function useCampaignStorage() {
  // Load functions
  const loadCampaignData = useCallback((): CampaignData | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.campaignData);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Failed to load campaign data:', e);
      return null;
    }
  }, []);

  const loadEntityTypes = useCallback((): EntityTypeDef[] | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.entityTypes);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Failed to load entity types:', e);
      return null;
    }
  }, []);

  const loadPromptSettings = useCallback((): PromptSettings | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.promptSettings);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Failed to load prompt settings:', e);
      return null;
    }
  }, []);

  const loadCampaignMetadata = useCallback((): CampaignMetadata | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.campaignMetadata);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Failed to load campaign metadata:', e);
      return null;
    }
  }, []);

  const loadCombatState = useCallback((): StoredCombatState | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.combatState);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Failed to load combat state:', e);
      return null;
    }
  }, []);

  const loadPlacedCards = useCallback((): PlacedCard[] | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.placedCards);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Failed to load placed cards:', e);
      return null;
    }
  }, []);

  const loadExtractSettings = useCallback((): ExtractSettings | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.extractSettings);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Failed to load extract settings:', e);
      return null;
    }
  }, []);

  // Save functions
  const saveCampaignData = useCallback((data: CampaignData | null) => {
    try {
      if (data) {
        localStorage.setItem(STORAGE_KEYS.campaignData, JSON.stringify(data));
      } else {
        localStorage.removeItem(STORAGE_KEYS.campaignData);
      }
    } catch (e) {
      console.error('Failed to save campaign data:', e);
    }
  }, []);

  const saveEntityTypes = useCallback((types: EntityTypeDef[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.entityTypes, JSON.stringify(types));
    } catch (e) {
      console.error('Failed to save entity types:', e);
    }
  }, []);

  const savePromptSettings = useCallback((settings: PromptSettings) => {
    try {
      localStorage.setItem(STORAGE_KEYS.promptSettings, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save prompt settings:', e);
    }
  }, []);

  const saveCampaignMetadata = useCallback((metadata: CampaignMetadata) => {
    try {
      localStorage.setItem(STORAGE_KEYS.campaignMetadata, JSON.stringify(metadata));
    } catch (e) {
      console.error('Failed to save campaign metadata:', e);
    }
  }, []);

  const saveCombatState = useCallback((state: StoredCombatState) => {
    try {
      localStorage.setItem(STORAGE_KEYS.combatState, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save combat state:', e);
    }
  }, []);

  const savePlacedCards = useCallback((cards: PlacedCard[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.placedCards, JSON.stringify(cards));
    } catch (e) {
      console.error('Failed to save placed cards:', e);
    }
  }, []);

  const saveExtractSettings = useCallback((settings: ExtractSettings) => {
    try {
      localStorage.setItem(STORAGE_KEYS.extractSettings, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save extract settings:', e);
    }
  }, []);

  return {
    loadCampaignData,
    loadEntityTypes,
    loadPromptSettings,
    loadCampaignMetadata,
    loadCombatState,
    loadPlacedCards,
    loadExtractSettings,
    saveCampaignData,
    saveEntityTypes,
    savePromptSettings,
    saveCampaignMetadata,
    saveCombatState,
    savePlacedCards,
    saveExtractSettings,
  };
}
