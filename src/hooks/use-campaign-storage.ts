import { useCallback, useEffect } from 'react';
import { CampaignData, EntityTypeDef, PromptSettings, CampaignMetadata, CombatState } from '@/types/mindmap';

const STORAGE_KEYS = {
  campaignData: 'dungeondesk-campaign-data',
  entityTypes: 'dungeondesk-entity-types',
  promptSettings: 'dungeondesk-prompt-settings',
  campaignMetadata: 'dungeondesk-campaign-metadata',
  combatState: 'dungeondesk-combat-state',
  placedCards: 'dungeondesk-placed-cards',
} as const;

interface PlacedCard {
  entityId: string;
  row: number;
  col: number;
}

interface CombatantState {
  currentHP: number;
  initiative: number;
}

interface StoredCombatState {
  combatants: Record<string, CombatantState>;
  activeCombatantIds: string[];
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

  return {
    loadCampaignData,
    loadEntityTypes,
    loadPromptSettings,
    loadCampaignMetadata,
    loadCombatState,
    loadPlacedCards,
    saveCampaignData,
    saveEntityTypes,
    savePromptSettings,
    saveCampaignMetadata,
    saveCombatState,
    savePlacedCards,
  };
}
