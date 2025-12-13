import React, { useState, useCallback } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, List, Sword, Network, Grid3X3, Settings, BookOpenText } from 'lucide-react';
import { InputPanel } from '@/components/InputPanel';
import { EntityList } from '@/components/EntityList';
import { EntityPanel } from '@/components/EntityPanel';
import { NodeGraph } from '@/components/NodeGraph';
import { TableView } from '@/components/TableView';
import { CombatTracker } from '@/components/CombatTracker';
import { Button } from '@/components/ui/button';
import { 
  CampaignData, 
  CampaignEntity, 
  ProcessingState, 
  ExtractionOptions,
  EntityTypeDef,
  createEmptyEntity,
  CampaignExport,
  DEFAULT_ENTITY_TYPES,
  PromptSettings,
  DEFAULT_PROMPT_SETTINGS,
} from '@/types/mindmap';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

// Combat tracker state (lifted to persist across tab changes)
interface CombatantState {
  currentHP: number;
  initiative: number;
}

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

  // Auto-close left panel when switching views
  const handleViewChange = useCallback((newView: 'list' | 'combat' | 'nodes' | 'table') => {
    setViewMode(newView);
    setLeftPanelOpen(false);
  }, []);
  
  const [campaignData, setCampaignData] = useState<CampaignData | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<CampaignEntity | null>(null);
  const [entityTypes, setEntityTypes] = useState<EntityTypeDef[]>(DEFAULT_ENTITY_TYPES);
  const [promptSettings, setPromptSettings] = useState<PromptSettings>(DEFAULT_PROMPT_SETTINGS);
  // Combat tracker state (persisted)
  const [combatants, setCombatants] = useState<Record<string, CombatantState>>({});
  const [activeCombatantIds, setActiveCombatantIds] = useState<Set<string>>(new Set());
  const [combatRound, setCombatRound] = useState(1);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  
  // Table view state (persisted)
  const [placedCards, setPlacedCards] = useState<PlacedCard[]>([]);
  
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    message: '',
  });

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
    keepExisting: boolean
  ) => {
    const startTime = Date.now();
    
    try {
      setProcessingState({
        status: 'extracting',
        progress: 20,
        message: 'Finding entities in text...',
      });

      const existingEntities = campaignData?.entities || [];

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-mindmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          text,
          extractionOptions,
          existingEntities: keepExisting ? existingEntities : [],
          keepExisting,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to extract campaign data');
      }

      setProcessingState({
        status: 'filling',
        progress: 60,
        message: 'Filling entity details...',
      });

      const result = await response.json();
      const processingTime = Date.now() - startTime;

      const finalEntities = keepExisting 
        ? mergeEntities(existingEntities, result.entities)
        : result.entities;

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
          ? `Merged ${result.entities.length} entities (${addedCount} new)`
          : `Found ${result.entities.length} entities`,
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

  const handleImport = useCallback((data: CampaignExport, keepExisting: boolean) => {
    const existingEntities = campaignData?.entities || [];
    
    // Fix duplicate IDs in imported data first
    const { entities: fixedImportedEntities, fixedCount } = fixDuplicateIds(data.entities);
    
    let finalEntities = keepExisting 
      ? mergeEntities(existingEntities, fixedImportedEntities)
      : fixedImportedEntities;
    
    // Clean and sync associations
    finalEntities = cleanAndSyncAssociations(finalEntities);
    
    setCampaignData({
      entities: finalEntities,
      processingTime: 0,
    });
    
    if (data.entityTypes && data.entityTypes.length > 0) {
      if (keepExisting) {
        // Merge entity types
        const merged = [...entityTypes];
        data.entityTypes.forEach(newType => {
          const existingIdx = merged.findIndex(t => t.key === newType.key);
          if (existingIdx === -1) {
            merged.push(newType);
          }
        });
        setEntityTypes(merged);
      } else {
        setEntityTypes(data.entityTypes);
      }
    }

    // Import prompt settings if present
    if (data.promptSettings && !keepExisting) {
      setPromptSettings(data.promptSettings);
    }
    
    const addedCount = finalEntities.length - existingEntities.length;
    const fixedMsg = fixedCount > 0 ? ` (fixed ${fixedCount} duplicate IDs)` : '';
    toast({
      title: "Campaign imported",
      description: keepExisting 
        ? `Merged ${data.entities.length} entities (${addedCount} new)${fixedMsg}`
        : `Loaded ${data.entities.length} entities${fixedMsg}`,
    });
  }, [campaignData, entityTypes, mergeEntities, cleanAndSyncAssociations, fixDuplicateIds]);

  const handleExport = useCallback(() => {
    if (!campaignData) return;
    
    const exportData: CampaignExport = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      entityTypes: entityTypes,
      entities: campaignData.entities,
      promptSettings: promptSettings,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Campaign exported",
      description: "JSON file downloaded",
    });
  }, [campaignData, entityTypes, promptSettings]);

  const handleEntitySelect = useCallback((entity: CampaignEntity | null) => {
    setSelectedEntity(entity);
    if (entity) {
      if (!rightPanelOpen) setRightPanelOpen(true);
    }
  }, [rightPanelOpen]);

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
    setSelectedEntity(null);
    toast({
      title: "Entity deleted",
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
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-xl text-foreground tracking-wide">
            Campaign Editor
          </h1>
        </div>
        <div className="flex items-center gap-2">
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
            Table
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
            />
          )}
        </aside>

        {/* Left Panel Toggle - hidden when both panels open */}
        {!(leftPanelOpen && rightPanelOpen) && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "shrink-0 h-8 w-6 self-end mb-2 rounded-none text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 z-20",
              !leftPanelOpen && "ml-1"
            )}
            onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          >
            {leftPanelOpen ? (
              <ChevronLeft className="w-3 h-3" />
            ) : (
              <Settings className="w-3 h-3" />
            )}
          </Button>
        )}

        {/* Main Area */}
        <main className="flex-1 min-w-0 relative z-0">
          {viewMode === 'list' ? (
            <EntityList
              data={campaignData}
              entityTypes={entityTypes}
              selectedEntityId={selectedEntity?.id || null}
              onSelectEntity={handleEntitySelect}
              onAddEntity={handleAddEntity}
            />
          ) : viewMode === 'combat' ? (
            <CombatTracker
              data={campaignData}
              entityTypes={entityTypes}
              onEntitySelect={handleEntitySelect}
              selectedEntityId={selectedEntity?.id || null}
              combatants={combatants}
              setCombatants={setCombatants}
              activeCombatantIds={activeCombatantIds}
              setActiveCombatantIds={setActiveCombatantIds}
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
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "shrink-0 h-8 w-6 self-end mb-2 rounded-none text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 z-20",
              !rightPanelOpen && "mr-1"
            )}
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
          >
            {rightPanelOpen ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <BookOpenText className="w-3 h-3" />
            )}
          </Button>
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
            />
          )}
        </aside>
      </div>
    </div>
  );
}
