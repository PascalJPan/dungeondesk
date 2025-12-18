import React, { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, List, Sword, Network, Grid3X3, Settings, BookOpenText, Plus } from 'lucide-react';
import logo from '@/assets/logo.png';
import { InputPanel } from '@/components/InputPanel';
import { EntityList } from '@/components/EntityList';
import { EntityPanel } from '@/components/EntityPanel';
import { NodeGraph } from '@/components/NodeGraph';
import { TableView } from '@/components/TableView';
import { CombatTracker, CombatInstance } from '@/components/CombatTracker';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  CampaignData, 
  CampaignEntity, 
  ProcessingState, 
  ExtractionOptions,
  EntityTypeDef,
  createEmptyEntity,
  duplicateEntity,
  CampaignExport,
  DEFAULT_ENTITY_TYPES,
  PromptSettings,
  DEFAULT_PROMPT_SETTINGS,
  CampaignMetadata,
  DEFAULT_CAMPAIGN_METADATA,
} from '@/types/mindmap';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useCampaignStorage } from '@/hooks/use-campaign-storage';

// Table view state (lifted to persist across tab changes)
interface PlacedCard {
  entityId: string;
  row: number;
  col: number;
}

export default function Index() {
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'combat' | 'nodes' | 'table'>('list');
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  const storage = useCampaignStorage();

  // Auto-close left panel when switching views
  const handleViewChange = useCallback((newView: 'list' | 'combat' | 'nodes' | 'table') => {
    setViewMode(newView);
    setLeftPanelOpen(false);
  }, []);
  
  const [campaignData, setCampaignData] = useState<CampaignData | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<CampaignEntity | null>(null);
  const [entityTypes, setEntityTypes] = useState<EntityTypeDef[]>(DEFAULT_ENTITY_TYPES);
  const [promptSettings, setPromptSettings] = useState<PromptSettings>(DEFAULT_PROMPT_SETTINGS);
  const [campaignMetadata, setCampaignMetadata] = useState<CampaignMetadata>({
    ...DEFAULT_CAMPAIGN_METADATA,
    createdAt: new Date().toISOString(),
  });
  // Combat tracker state (persisted)
  const [combatInstances, setCombatInstances] = useState<CombatInstance[]>([]);
  const [combatRound, setCombatRound] = useState(1);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  
  // Table view state (persisted)
  const [placedCards, setPlacedCards] = useState<PlacedCard[]>([]);
  
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  // Load from localStorage on mount
  useEffect(() => {
    const loadedCampaignData = storage.loadCampaignData();
    const loadedEntityTypes = storage.loadEntityTypes();
    const loadedPromptSettings = storage.loadPromptSettings();
    const loadedMetadata = storage.loadCampaignMetadata();
    const loadedCombatState = storage.loadCombatState();
    const loadedPlacedCards = storage.loadPlacedCards();

    if (loadedCampaignData) setCampaignData(loadedCampaignData);
    if (loadedEntityTypes) {
      // Merge loaded types with defaults to ensure new properties like combatEligible are applied
      const mergedTypes = loadedEntityTypes.map(loadedType => {
        const defaultType = DEFAULT_ENTITY_TYPES.find(d => d.key === loadedType.key);
        if (defaultType && loadedType.combatEligible === undefined) {
          return { ...loadedType, combatEligible: defaultType.combatEligible };
        }
        return loadedType;
      });
      setEntityTypes(mergedTypes);
    }
    if (loadedPromptSettings) setPromptSettings(loadedPromptSettings);
    if (loadedMetadata) setCampaignMetadata(loadedMetadata);
    if (loadedCombatState) {
      setCombatInstances(loadedCombatState.combatInstances || []);
      setCombatRound(loadedCombatState.round);
      setCurrentTurnId(loadedCombatState.currentTurnId);
    }
    if (loadedPlacedCards) setPlacedCards(loadedPlacedCards);

    setIsInitialized(true);
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    if (!isInitialized) return;
    storage.saveCampaignData(campaignData);
  }, [campaignData, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    storage.saveEntityTypes(entityTypes);
  }, [entityTypes, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    storage.savePromptSettings(promptSettings);
  }, [promptSettings, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    storage.saveCampaignMetadata(campaignMetadata);
  }, [campaignMetadata, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    storage.saveCombatState({
      combatInstances,
      round: combatRound,
      currentTurnId,
    });
  }, [combatInstances, combatRound, currentTurnId, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    storage.savePlacedCards(placedCards);
  }, [placedCards, isInitialized]);

  // Beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (campaignData && campaignData.entities.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved campaign data. Consider exporting to JSON before leaving.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [campaignData]);

  // Helper to merge entities
  const mergeEntities = useCallback((
    existingEntities: CampaignEntity[],
    newEntities: CampaignEntity[]
  ): CampaignEntity[] => {
    const merged = [...existingEntities];
    
    newEntities.forEach(newEntity => {
      // Try to find existing entity by name (case insensitive)
      const existingIdx = merged.findIndex(e => 
        e.name.toLowerCase() === newEntity.name.toLowerCase() && e.type === newEntity.type
      );
      
      if (existingIdx !== -1) {
        // Merge: append text to existing attributes
        const existing = merged[existingIdx];
        const mergedEntity = { ...existing };
        
        Object.keys(newEntity).forEach(key => {
          if (['id', 'type', 'name'].includes(key)) return;
          
          const newValue = String(newEntity[key] || '').trim();
          const existingValue = String(existing[key] || '').trim();
          
          if (newValue && newValue !== existingValue) {
            if (existingValue) {
              // Append new content if different
              mergedEntity[key] = existingValue + '\n\n' + newValue;
            } else {
              mergedEntity[key] = newValue;
            }
          }
        });
        
        merged[existingIdx] = mergedEntity;
      } else {
        // New entity - add it
        merged.push(newEntity);
      }
    });
    
    return merged;
  }, []);

  const handleProcess = useCallback(async (
    text: string, 
    extractionOptions: ExtractionOptions,
    keepExisting: boolean,
    openAiApiKey: string,
    maxEntities: number = 1
  ) => {
    const startTime = Date.now();
    
    try {
      setProcessingState({
        status: 'extracting',
        progress: 20,
        message: 'Finding entities in text...',
      });

      const existingEntities = campaignData?.entities || [];

      // Build prompt for OpenAI
      const settings = extractionOptions.promptSettings || {
        contentLanguage: 'English',
        tone: 'High Fantasy',
        inferLevel: 3,
      };

      // Build entity schemas with descriptive placeholders instead of empty strings
      const entitySchemas = extractionOptions.entityTypes.map(type => {
        const attrs = type.attributes.map(attr => `"${attr.key}": "[${attr.label}]"`).join(', ');
        return `{ "id": "${type.key}-N", "type": "${type.key}", "name": "[entity name]", ${attrs} }`;
      }).join('\n');

      // Build entity type descriptions with extraction prompts
      const entityTypeDescriptions = extractionOptions.entityTypes.map(type => {
        let desc = `- ${type.label} (${type.key}): attributes are ${type.attributes.map(a => a.label).join(', ')}`;
        if (type.extractionPrompt) {
          desc += `\n  Guidance: ${type.extractionPrompt}`;
        }
        return desc;
      }).join('\n');

      // Map inferLevel to clear instructions
      const inferLevelInstructions: Record<number, string> = {
        1: 'NEVER infer or invent information. Only use content explicitly stated in the source text. Leave fields empty if information is not found.',
        2: 'RARELY infer information. Only make obvious deductions from context. Prefer leaving fields empty over guessing.',
        3: 'SOMETIMES infer information. Make reasonable deductions from context when helpful, but don\'t invent major details.',
        4: 'OFTEN infer information. Fill most fields with reasonable content based on context, genre conventions, and common sense.',
        5: 'ALWAYS fill every field. Never leave any attribute empty. If information is not in the source text, create plausible, fitting content that matches the tone and context. Invent details as needed.',
      };

      const inferInstruction = inferLevelInstructions[settings.inferLevel] || inferLevelInstructions[3];
      const fillEmptyFieldsRule = settings.inferLevel >= 4 
        ? '\n- CRITICAL: Every attribute must have meaningful content - never leave empty strings ""'
        : '';

      // Build campaign context summary for AI (smart truncation)
      const buildCampaignContext = () => {
        const parts: string[] = [];
        
        // Campaign name and description
        if (campaignMetadata.name && campaignMetadata.name !== 'Untitled Campaign') {
          parts.push(`Campaign: ${campaignMetadata.name}`);
        }
        if (campaignMetadata.description?.trim()) {
          parts.push(`Setting: ${campaignMetadata.description.trim()}`);
        }
        
        // Existing entities grouped by type (names only for compactness)
        if (existingEntities.length > 0) {
          const grouped: Record<string, string[]> = {};
          existingEntities.forEach(e => {
            const typeDef = extractionOptions.entityTypes.find(t => t.key === e.type);
            const typeLabel = typeDef?.label || e.type;
            if (!grouped[typeLabel]) grouped[typeLabel] = [];
            grouped[typeLabel].push(e.name);
          });
          
          const entityList = Object.entries(grouped)
            .map(([type, names]) => `${type}: ${names.slice(0, 15).join(', ')}${names.length > 15 ? ` (+${names.length - 15} more)` : ''}`)
            .join('\n');
          
          parts.push(`\nExisting entities (reference these for associations):\n${entityList}`);
        }
        
        // Sample writing style from existing entities (1-2 examples)
        const entitiesWithDescriptions = existingEntities.filter(e => 
          e.shortDescription?.trim() && e.shortDescription.length > 50
        );
        if (entitiesWithDescriptions.length > 0) {
          const sample = entitiesWithDescriptions[0];
          parts.push(`\nWriting style example:\n"${sample.shortDescription.substring(0, 300)}${sample.shortDescription.length > 300 ? '...' : ''}"`);
        }
        
        return parts.length > 0 ? parts.join('\n') : '';
      };

      const campaignContext = buildCampaignContext();
      const campaignContextSection = campaignContext 
        ? `\nCAMPAIGN CONTEXT:\n${campaignContext}\n` 
        : '';

      const systemPrompt = `You extract D&D/TTRPG campaign entities from text. Output ONLY valid JSON.
Language: ${settings.contentLanguage}. Tone: ${settings.tone}.
Maximum entities to extract: ${maxEntities}
${campaignContextSection}
INFERENCE LEVEL: ${inferInstruction}

Entity types:
${entityTypeDescriptions}

Output format:
{"entities": [${entitySchemas}]}

Rules:
- Each entity needs unique id: "type-N" (e.g., character-1)
- shortDescription is required for all entities
- associatedEntities: comma-separated names of related entities from the campaign (prefer existing entity names when relevant)
- Use consistent names when referencing the same entity
- All attributes must be flat strings (no nested objects or arrays)
- For attacks: use format "Name: +modifier | damage [type]" per line
- For speed: default is "9" (always in meters as a string)
- Every entity must have "review": false${fillEmptyFieldsRule}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Extract campaign entities from this text:\n\n${text.substring(0, 50000)}` }
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your OpenAI API key.');
        }
        throw new Error(error.error?.message || 'Failed to call OpenAI API');
      }

      setProcessingState({
        status: 'filling',
        progress: 60,
        message: 'Processing response...',
      });

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';
      
      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse AI response');
      }
      
      const result = JSON.parse(jsonMatch[0]);
      const processingTime = Date.now() - startTime;

      // Deduplicate extracted entities by name+type and ensure unique IDs
      const rawEntities = (result.entities || []) as CampaignEntity[];
      const seenNameType = new Set<string>();
      const usedIds = new Set<string>(existingEntities.map(e => e.id));
      
      const extractedEntities: CampaignEntity[] = [];
      rawEntities.forEach(e => {
        const key = `${e.type}:${e.name.toLowerCase()}`;
        if (seenNameType.has(key)) return; // Skip duplicate name+type
        seenNameType.add(key);
        
        // Ensure unique ID
        let entityId = e.id;
        if (usedIds.has(entityId)) {
          const baseType = entityId.replace(/-\d+$/, '') || e.type;
          let counter = 1;
          entityId = `${baseType}-${counter}`;
          while (usedIds.has(entityId)) {
            counter++;
            entityId = `${baseType}-${counter}`;
          }
        }
        usedIds.add(entityId);
        
        extractedEntities.push({ ...e, id: entityId, review: false });
      });

      const finalEntities = keepExisting 
        ? mergeEntities(existingEntities, extractedEntities)
        : extractedEntities;

      setCampaignData({
        entities: finalEntities,
        processingTime,
      });

      setProcessingState({
        status: 'complete',
        progress: 100,
        message: 'Complete!',
      });

      const addedCount = finalEntities.length - existingEntities.length;
      toast({
        title: "Campaign extracted",
        description: keepExisting 
          ? `Merged ${extractedEntities.length} entities (${addedCount} new)`
          : `Found ${extractedEntities.length} entities`,
      });

    } catch (error) {
      console.error('Processing error:', error);
      setProcessingState({
        status: 'error',
        progress: 0,
        message: '',
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  }, [campaignData, mergeEntities]);

  // Helper to clean and sync associations
  const cleanAndSyncAssociations = useCallback((entities: CampaignEntity[]): CampaignEntity[] => {
    const entityNames = new Set(entities.map(e => e.name.toLowerCase()));
    
    // First pass: remove invalid associations and collect all valid ones
    const validAssocs = new Map<string, Set<string>>(); // entityName -> set of associated names
    
    entities.forEach(entity => {
      const myName = entity.name.toLowerCase();
      if (!validAssocs.has(myName)) {
        validAssocs.set(myName, new Set());
      }
      
      if (entity.associatedEntities) {
        const assocs = entity.associatedEntities.split(',').map(s => s.trim()).filter(Boolean);
        assocs.forEach(assocName => {
          if (entityNames.has(assocName.toLowerCase())) {
            validAssocs.get(myName)!.add(assocName.toLowerCase());
          }
        });
      }
    });
    
    // Second pass: ensure bidirectional consistency
    validAssocs.forEach((assocs, entityName) => {
      assocs.forEach(assocName => {
        if (!validAssocs.has(assocName)) {
          validAssocs.set(assocName, new Set());
        }
        validAssocs.get(assocName)!.add(entityName);
      });
    });
    
    // Third pass: apply cleaned associations back to entities
    return entities.map(entity => {
      const myName = entity.name.toLowerCase();
      const myAssocs = validAssocs.get(myName) || new Set();
      
      // Get proper cased names from actual entities
      const properCasedAssocs = Array.from(myAssocs).map(assocLower => {
        const found = entities.find(e => e.name.toLowerCase() === assocLower);
        return found ? found.name : assocLower;
      });
      
      return {
        ...entity,
        associatedEntities: properCasedAssocs.join(', '),
      };
    });
  }, []);

  // Fix duplicate IDs in imported entities
  const fixDuplicateIds = useCallback((entities: CampaignEntity[]): { entities: CampaignEntity[], fixedCount: number } => {
    const usedIds = new Set<string>();
    let fixedCount = 0;
    
    const fixedEntities = entities.map(entity => {
      if (!usedIds.has(entity.id)) {
        usedIds.add(entity.id);
        return entity;
      }
      
      // Find a new unique ID
      const baseType = entity.id.replace(/-\d+$/, '');
      let counter = 1;
      let newId = `${baseType}-${counter}`;
      while (usedIds.has(newId)) {
        counter++;
        newId = `${baseType}-${counter}`;
      }
      
      usedIds.add(newId);
      fixedCount++;
      return { ...entity, id: newId };
    });
    
    return { entities: fixedEntities, fixedCount };
  }, []);

  const handleImport = useCallback((
    data: CampaignExport, 
    keepEntities: boolean,
    keepMetadata: boolean,
    mergeTypes: boolean
  ) => {
    const existingEntities = campaignData?.entities || [];
    
    // Fix duplicate IDs in imported data first and ensure all have review:false
    const { entities: fixedImportedEntities, fixedCount } = fixDuplicateIds(
      data.entities.map(e => ({ ...e, review: e.review ?? false }))
    );
    
    let finalEntities = keepEntities 
      ? mergeEntities(existingEntities, fixedImportedEntities)
      : fixedImportedEntities;
    
    // Clean and sync associations
    finalEntities = cleanAndSyncAssociations(finalEntities);
    
    setCampaignData({
      entities: finalEntities,
      processingTime: 0,
    });
    
    // Handle entity types based on mergeTypes and keepMetadata flags
    if (data.entityTypes && data.entityTypes.length > 0) {
      if (mergeTypes) {
        // Merge new types and attributes
        const mergedTypes = [...entityTypes];
        data.entityTypes.forEach(importedType => {
          const existingIndex = mergedTypes.findIndex(t => t.key === importedType.key);
          if (existingIndex === -1) {
            // Add new type
            mergedTypes.push(importedType);
          } else {
            // Merge attributes
            const existingAttrKeys = new Set(mergedTypes[existingIndex].attributes.map(a => a.key));
            const newAttrs = importedType.attributes.filter(a => !existingAttrKeys.has(a.key));
            mergedTypes[existingIndex] = {
              ...mergedTypes[existingIndex],
              attributes: [...mergedTypes[existingIndex].attributes, ...newAttrs]
            };
          }
        });
        setEntityTypes(mergedTypes);
      } else if (!keepMetadata) {
        // Replace entity types completely when not merging and not keeping metadata
        setEntityTypes(data.entityTypes);
      }
      // If mergeTypes=false and keepMetadata=true, keep existing entityTypes unchanged
    }

    // Import prompt settings if present and not keeping metadata
    if (data.promptSettings && !keepMetadata) {
      setPromptSettings(data.promptSettings);
    }

    // Import campaign metadata based on keepMetadata flag
    if (!keepMetadata) {
      if (data.metadata) {
        setCampaignMetadata(data.metadata);
      } else {
        // Reset to default metadata if not present in import
        setCampaignMetadata({
          ...DEFAULT_CAMPAIGN_METADATA,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Import combat state if present (always restore combat state from import)
    if (data.combatState) {
      setCombatInstances(data.combatState.combatInstances || []);
      setCombatRound(data.combatState.round);
      setCurrentTurnId(data.combatState.currentTurnId);
    }
    
    const addedCount = finalEntities.length - existingEntities.length;
    const fixedMsg = fixedCount > 0 ? ` (fixed ${fixedCount} duplicate IDs)` : '';
    toast({
      title: "Campaign imported",
      description: keepEntities 
        ? `Merged ${data.entities.length} entities (${addedCount} new)${fixedMsg}`
        : `Loaded ${data.entities.length} entities${fixedMsg}`,
    });
  }, [campaignData, entityTypes, mergeEntities, cleanAndSyncAssociations, fixDuplicateIds]);

  const handleExport = useCallback(() => {
    const combatState = {
      combatInstances,
      round: combatRound,
      currentTurnId,
    };

    // Generate dynamic ChatGPT prompt based on current entity types
    const entityExamples = entityTypes.map(t => {
      const exampleAttrs: Record<string, string> = {
        id: `${t.key}-1`,
        type: t.key,
        name: `Example ${t.label}`,
      };
      t.attributes.forEach(attr => {
        if (attr.key === 'attacks') {
          exampleAttrs[attr.key] = 'Longsword: +4 | 1d8+5 slashing\nDagger: +2 | 1d4+3 piercing\nFirecast: +5 | 50% Burning';
        } else if (attr.key === 'associatedEntities') {
          exampleAttrs[attr.key] = 'Aragorn, Legolas, Gimli';
        } else {
          exampleAttrs[attr.key] = `[${attr.label} here]`;
        }
      });
      return JSON.stringify(exampleAttrs, null, 2);
    }).join('\n\n');

    const chatGptPrompt = `## ChatGPT Instructions for Dungeon Desk JSON

${promptSettings.systemPrompt}

### Mode 1: Update Existing Entities
Modify the entities array while preserving: all IDs, structure, metadata, entityTypes, promptSettings.
Output the complete JSON with your changes.

### Mode 2: Create New Entities
Output ONLY this structure for merging:
{"version":"1.0","entities":[...your new entities...]}
Then paste into JSON field and Import with "Keep existing entities" checked.

### Settings
- Language: ${promptSettings.contentLanguage}
- Tone: ${promptSettings.tone}
- Infer Missing: ${promptSettings.inferLevel <= 2 ? 'Rarely' : promptSettings.inferLevel >= 4 ? 'Often' : 'Sometimes'}

### Entity Types & Attributes
${entityTypes.map(t => `**${t.label}** (type: "${t.key}")\nAttributes: ${t.attributes.map(a => `${a.key}`).join(', ')}`).join('\n\n')}

### Example Entities (follow this structure EXACTLY)
${entityExamples}`;
    
    const exportData: CampaignExport = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      metadata: campaignMetadata,
      entityTypes: entityTypes,
      entities: campaignData?.entities || [],
      promptSettings: promptSettings,
      combatState: campaignData ? combatState : undefined,
      chatGptPrompt: chatGptPrompt,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Use campaign name for filename, sanitized
    const safeName = campaignMetadata.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'campaign';
    a.download = `${safeName}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Campaign exported",
      description: "JSON file downloaded",
    });
  }, [campaignData, entityTypes, promptSettings, campaignMetadata, combatInstances, combatRound, currentTurnId]);

  const handleEntitySelect = useCallback((entity: CampaignEntity | null) => {
    setSelectedEntity(entity);
    setSelectedEntityIds(new Set()); // Clear multi-select when single selecting
    if (entity) {
      if (!rightPanelOpen) setRightPanelOpen(true);
    }
  }, [rightPanelOpen]);

  const handleMultiSelectEntity = useCallback((entityId: string, isCtrlKey: boolean) => {
    if (isCtrlKey) {
      setSelectedEntityIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(entityId)) {
          newSet.delete(entityId);
        } else {
          newSet.add(entityId);
        }
        return newSet;
      });
    }
  }, []);

  const handleEntitySave = useCallback((updatedEntity: CampaignEntity) => {
    setCampaignData(prev => {
      if (!prev) return prev;
      
      // Get the old entity to compare
      const oldEntity = prev.entities.find(e => e.id === updatedEntity.id);
      const oldName = oldEntity?.name?.trim() || '';
      const newName = updatedEntity.name?.trim() || '';
      const nameChanged = oldName !== newName && oldName !== '';
      
      // Parse associations safely
      const parseAssocs = (str: string | undefined): string[] => {
        if (!str) return [];
        return str.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      };
      
      const oldAssocs = parseAssocs(oldEntity?.associatedEntities);
      const newAssocs = parseAssocs(updatedEntity.associatedEntities);
      
      // Find added and removed associations (case-insensitive comparison)
      const addedAssocs = newAssocs.filter(a => !oldAssocs.includes(a));
      const removedAssocs = oldAssocs.filter(a => !newAssocs.includes(a));
      
      // First, update the main entity
      let updatedEntities = prev.entities.map(e => 
        e.id === updatedEntity.id ? updatedEntity : e
      );
      
      // Handle name change - update all references
      if (nameChanged) {
        updatedEntities = updatedEntities.map(entity => {
          if (entity.id === updatedEntity.id) return entity;
          
          const entityAssocs = entity.associatedEntities
            ? entity.associatedEntities.split(',').map(s => s.trim()).filter(Boolean)
            : [];
          
          // Find and replace the old name with the new name
          const oldNameIdx = entityAssocs.findIndex(a => a.toLowerCase() === oldName.toLowerCase());
          if (oldNameIdx !== -1) {
            entityAssocs[oldNameIdx] = newName;
            return { ...entity, associatedEntities: entityAssocs.join(', ') };
          }
          return entity;
        });
      }
      
      // Sync bidirectional associations
      updatedEntities = updatedEntities.map(entity => {
        if (entity.id === updatedEntity.id) return entity;
        
        const entityAssocs = entity.associatedEntities
          ? entity.associatedEntities.split(',').map(s => s.trim()).filter(Boolean)
          : [];
        
        let newEntityAssocs = [...entityAssocs];
        let modified = false;
        
        // If this entity was added as an association, add the current entity to it
        if (addedAssocs.includes(entity.name.toLowerCase())) {
          const alreadyHas = newEntityAssocs.some(a => a.toLowerCase() === newName.toLowerCase());
          if (!alreadyHas) {
            newEntityAssocs.push(newName);
            modified = true;
          }
        }
        
        // If this entity was removed as an association, remove the current entity from it
        if (removedAssocs.includes(entity.name.toLowerCase())) {
          const filtered = newEntityAssocs.filter(a => a.toLowerCase() !== newName.toLowerCase());
          if (filtered.length !== newEntityAssocs.length) {
            newEntityAssocs = filtered;
            modified = true;
          }
        }
        
        if (modified) {
          return { ...entity, associatedEntities: newEntityAssocs.join(', ') };
        }
        return entity;
      });
      
      return {
        ...prev,
        entities: updatedEntities,
      };
    });
    setSelectedEntity(updatedEntity);
  }, []);

  const handleEntityDelete = useCallback((entityId: string) => {
    setCampaignData(prev => {
      if (!prev) return prev;
      
      const newEntities = prev.entities.filter(e => e.id !== entityId);
      
      return { ...prev, entities: newEntities };
    });
    
    // Clean up combat state for deleted entity - remove all instances of this entity
    setCombatInstances(prev => prev.filter(inst => inst.entityId !== entityId));
    // Reset current turn if it was an instance of this entity
    setCurrentTurnId(prev => {
      if (prev && (prev === entityId || prev.startsWith(`${entityId}#`))) {
        return null;
      }
      return prev;
    });
    
    // Clean up table view placed cards
    setPlacedCards(prev => prev.filter(card => card.entityId !== entityId));
    
    setSelectedEntity(null);
    setSelectedEntityIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(entityId);
      return newSet;
    });
    toast({
      title: "Entity deleted",
    });
  }, [currentTurnId]);

  const handleBulkDelete = useCallback(() => {
    if (selectedEntityIds.size === 0) return;
    
    setCampaignData(prev => {
      if (!prev) return prev;
      const newEntities = prev.entities.filter(e => !selectedEntityIds.has(e.id));
      return { ...prev, entities: newEntities };
    });
    
    // Clean up combat state - remove all instances of deleted entities
    setCombatInstances(prev => prev.filter(inst => !selectedEntityIds.has(inst.entityId)));
    setCurrentTurnId(prev => {
      if (prev) {
        const entityIdFromInstance = prev.includes('#') ? prev.split('#')[0] : prev;
        if (selectedEntityIds.has(entityIdFromInstance)) {
          return null;
        }
      }
      return prev;
    });
    
    // Clean up table view
    setPlacedCards(prev => prev.filter(card => !selectedEntityIds.has(card.entityId)));
    
    toast({
      title: `${selectedEntityIds.size} entities deleted`,
    });
    
    setSelectedEntity(null);
    setSelectedEntityIds(new Set());
  }, [selectedEntityIds, currentTurnId]);

  const handleClearAllEntities = useCallback(() => {
    setCampaignData(null);
    setSelectedEntity(null);
    setSelectedEntityIds(new Set());
    setCombatInstances([]);
    setCombatRound(1);
    setCurrentTurnId(null);
    setPlacedCards([]);
    toast({
      title: "All entities cleared",
    });
  }, []);

  const handleAddEntity = useCallback((typeDef: EntityTypeDef) => {
    const id = `${typeDef.key}-${Date.now()}`;
    const newEntity = createEmptyEntity(typeDef, id, `New ${typeDef.label.slice(0, -1)}`);
    
    setCampaignData(prev => {
      if (!prev) {
        return { entities: [newEntity], processingTime: 0 };
      }
      return { ...prev, entities: [...prev.entities, newEntity] };
    });
    
    setSelectedEntity(newEntity);
    if (!rightPanelOpen) setRightPanelOpen(true);
  }, [rightPanelOpen]);

  const handleDuplicateEntity = useCallback((entity: CampaignEntity) => {
    const id = `${entity.type}-${Date.now()}`;
    const newEntity = duplicateEntity(entity, id);
    
    setCampaignData(prev => {
      if (!prev) {
        return { entities: [newEntity], processingTime: 0 };
      }
      return { ...prev, entities: [...prev.entities, newEntity] };
    });
    
    setSelectedEntity(newEntity);
    toast({
      title: "Entity duplicated",
      description: `Created "${newEntity.name}"`,
    });
  }, []);

  const handleConnectionCreate = useCallback((sourceEntityId: string, targetEntityId: string) => {
    setCampaignData(prev => {
      if (!prev) return prev;
      
      const sourceEntity = prev.entities.find(e => e.id === sourceEntityId);
      const targetEntity = prev.entities.find(e => e.id === targetEntityId);
      if (!sourceEntity || !targetEntity) return prev;
      
      // Add bidirectional associations
      const updatedEntities = prev.entities.map(entity => {
        if (entity.id === sourceEntityId) {
          const currentAssocs = entity.associatedEntities
            ? entity.associatedEntities.split(',').map(s => s.trim()).filter(Boolean)
            : [];
          if (!currentAssocs.some(a => a.toLowerCase() === targetEntity.name.toLowerCase())) {
            currentAssocs.push(targetEntity.name);
          }
          return { ...entity, associatedEntities: currentAssocs.join(', ') };
        }
        if (entity.id === targetEntityId) {
          const currentAssocs = entity.associatedEntities
            ? entity.associatedEntities.split(',').map(s => s.trim()).filter(Boolean)
            : [];
          if (!currentAssocs.some(a => a.toLowerCase() === sourceEntity.name.toLowerCase())) {
            currentAssocs.push(sourceEntity.name);
          }
          return { ...entity, associatedEntities: currentAssocs.join(', ') };
        }
        return entity;
      });
      
      return { ...prev, entities: updatedEntities };
    });
  }, []);

  const handleConnectionDelete = useCallback((sourceEntityId: string, targetEntityId: string) => {
    setCampaignData(prev => {
      if (!prev) return prev;
      
      const sourceEntity = prev.entities.find(e => e.id === sourceEntityId);
      const targetEntity = prev.entities.find(e => e.id === targetEntityId);
      if (!sourceEntity || !targetEntity) return prev;
      
      // Remove bidirectional associations
      const updatedEntities = prev.entities.map(entity => {
        if (entity.id === sourceEntityId) {
          const currentAssocs = entity.associatedEntities
            ? entity.associatedEntities.split(',').map(s => s.trim()).filter(Boolean)
            : [];
          const filtered = currentAssocs.filter(a => a.toLowerCase() !== targetEntity.name.toLowerCase());
          return { ...entity, associatedEntities: filtered.join(', ') };
        }
        if (entity.id === targetEntityId) {
          const currentAssocs = entity.associatedEntities
            ? entity.associatedEntities.split(',').map(s => s.trim()).filter(Boolean)
            : [];
          const filtered = currentAssocs.filter(a => a.toLowerCase() !== sourceEntity.name.toLowerCase());
          return { ...entity, associatedEntities: filtered.join(', ') };
        }
        return entity;
      });
      
      return { ...prev, entities: updatedEntities };
    });
  }, []);

  const handleSelectField = useCallback((entityId: string, _fieldKey: string) => {
    const entity = campaignData?.entities.find(e => e.id === entityId);
    if (entity) {
      setSelectedEntity(entity);
      if (!rightPanelOpen) setRightPanelOpen(true);
    }
  }, [campaignData, rightPanelOpen]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden ink-texture">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
            <img src={logo} alt="Dungeon Desk logo" className="w-8 h-8 object-contain" />
          </div>
          <h1 className="font-display text-xl text-foreground tracking-wide">
            Dungeon Desk
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {selectedEntityIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              className="font-serif"
            >
              Delete {selectedEntityIds.size} selected
            </Button>
          )}
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleViewChange('list')}
            className="font-serif"
          >
            <List className="w-4 h-4 mr-1" />
            List
          </Button>
          <Button
            variant={viewMode === 'nodes' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleViewChange('nodes')}
            className="font-serif"
          >
            <Network className="w-4 h-4 mr-1" />
            Nodes
          </Button>
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleViewChange('table')}
            className="font-serif"
          >
            <Grid3X3 className="w-4 h-4 mr-1" />
            Desk
          </Button>
          <Button
            variant={viewMode === 'combat' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleViewChange('combat')}
            className="font-serif"
          >
            <Sword className="w-4 h-4 mr-1" />
            Combat
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="font-serif px-2"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2 z-50 bg-popover" align="end">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground px-2 py-1">Add new entity</p>
                {entityTypes.map(typeDef => (
                  <button
                    key={typeDef.key}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
                    onClick={() => handleAddEntity(typeDef)}
                  >
                    <span 
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: typeDef.color }}
                    />
                    <span className="text-sm font-serif">
                      {typeDef.label.endsWith('s') ? typeDef.label.slice(0, -1) : typeDef.label}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Input */}
        <aside 
          className={cn(
            "border-r border-border bg-card transition-all duration-300 shrink-0 z-20",
            leftPanelOpen ? "w-[50vw]" : "w-0"
          )}
        >
          {leftPanelOpen && (
            <InputPanel 
              onProcess={handleProcess} 
              onImport={handleImport}
              onExport={handleExport}
              processingState={processingState}
              hasData={!!campaignData}
              entityTypes={entityTypes}
              onEntityTypesChange={setEntityTypes}
              existingEntities={campaignData?.entities || []}
              campaignData={campaignData}
              onSelectField={handleSelectField}
              promptSettings={promptSettings}
              onPromptSettingsChange={setPromptSettings}
              campaignMetadata={campaignMetadata}
              onCampaignMetadataChange={setCampaignMetadata}
              onClearAllEntities={handleClearAllEntities}
            />
          )}
        </aside>

        {/* Left Panel Toggle - hidden when both panels open */}
        {!(leftPanelOpen && rightPanelOpen) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "shrink-0 h-10 w-8 self-end mb-2 rounded-none text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 z-20",
                    !leftPanelOpen && "ml-1"
                  )}
                  onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                >
                  {leftPanelOpen ? (
                    <ChevronLeft className="w-5 h-5" />
                  ) : (
                    <Settings className="w-5 h-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{leftPanelOpen ? 'Close settings panel' : 'Open settings, extraction & data import/export'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Main Area */}
        <main className="flex-1 min-w-0 relative z-0">
          {viewMode === 'list' ? (
            <EntityList
              data={campaignData}
              entityTypes={entityTypes}
              selectedEntityId={selectedEntity?.id || null}
              selectedEntityIds={selectedEntityIds}
              onSelectEntity={handleEntitySelect}
              onMultiSelectEntity={handleMultiSelectEntity}
              onAddEntity={handleAddEntity}
            />
          ) : viewMode === 'combat' ? (
            <CombatTracker
              data={campaignData}
              entityTypes={entityTypes}
              onEntitySelect={handleEntitySelect}
              selectedEntityId={selectedEntity?.id || null}
              combatInstances={combatInstances}
              setCombatInstances={setCombatInstances}
              round={combatRound}
              setRound={setCombatRound}
              currentTurnId={currentTurnId}
              setCurrentTurnId={setCurrentTurnId}
            />
          ) : viewMode === 'table' ? (
            <TableView
              data={campaignData}
              entityTypes={entityTypes}
              onEntitySelect={handleEntitySelect}
              selectedEntityId={selectedEntity?.id || null}
              placedCards={placedCards}
              setPlacedCards={setPlacedCards}
            />
          ) : (
            <NodeGraph
              data={campaignData}
              entityTypes={entityTypes}
              onEntitySelect={handleEntitySelect}
              selectedEntityId={selectedEntity?.id || null}
              onAddEntity={handleAddEntity}
              onConnectionCreate={handleConnectionCreate}
              onConnectionDelete={handleConnectionDelete}
            />
          )}
        </main>

        {/* Right Panel Toggle - hidden when both panels open */}
        {!(leftPanelOpen && rightPanelOpen) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "shrink-0 h-10 w-8 self-end mb-2 rounded-none text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 z-20",
                    !rightPanelOpen && "mr-1"
                  )}
                  onClick={() => setRightPanelOpen(!rightPanelOpen)}
                >
                  {rightPanelOpen ? (
                    <ChevronRight className="w-5 h-5" />
                  ) : (
                    <BookOpenText className="w-5 h-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{rightPanelOpen ? 'Close entity details' : 'Open entity details panel'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Right Panel - Entity Details */}
        <aside 
          className={cn(
            "border-l border-border bg-card transition-all duration-300 shrink-0 flex flex-col z-20",
            rightPanelOpen ? "w-[50vw]" : "w-0"
          )}
        >
          {rightPanelOpen && (
            <EntityPanel
              entity={selectedEntity}
              entityTypes={entityTypes}
              entities={campaignData?.entities || []}
              onSave={handleEntitySave}
              onDelete={handleEntityDelete}
              onEntityClick={handleEntitySelect}
              onDuplicate={handleDuplicateEntity}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
