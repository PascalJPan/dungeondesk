import React, { useState, useCallback } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, HelpCircle, Pencil, List, LayoutGrid, Sword } from 'lucide-react';
import { InputPanel } from '@/components/InputPanel';
import { EntityList } from '@/components/EntityList';
import { EntityEditor } from '@/components/EntityEditor';
import { EntityReader } from '@/components/EntityReader';
import { QuestionsPanel } from '@/components/QuestionsPanel';
import { CampaignGraph } from '@/components/CampaignGraph';
import { CombatTracker } from '@/components/CombatTracker';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CampaignData, 
  CampaignEntity, 
  ProcessingState, 
  ExtractionOptions,
  EntityTypeDef,
  createEmptyEntity,
  CampaignExport,
  DEFAULT_ENTITY_TYPES,
} from '@/types/mindmap';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function Index() {
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<'read' | 'edit' | 'questions'>('read');
  const [viewMode, setViewMode] = useState<'graph' | 'list' | 'combat'>('graph');
  
  const [campaignData, setCampaignData] = useState<CampaignData | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<CampaignEntity | null>(null);
  const [entityTypes, setEntityTypes] = useState<EntityTypeDef[]>(DEFAULT_ENTITY_TYPES);
  
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

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-mindmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          text,
          extractionOptions,
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

      const existingEntities = campaignData?.entities || [];
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

  const handleImport = useCallback((data: CampaignExport, keepExisting: boolean) => {
    const existingEntities = campaignData?.entities || [];
    const finalEntities = keepExisting 
      ? mergeEntities(existingEntities, data.entities)
      : data.entities;
    
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
    
    const addedCount = finalEntities.length - existingEntities.length;
    toast({
      title: "Campaign imported",
      description: keepExisting 
        ? `Merged ${data.entities.length} entities (${addedCount} new)`
        : `Loaded ${data.entities.length} entities`,
    });
  }, [campaignData, entityTypes, mergeEntities]);

  const handleExport = useCallback(() => {
    if (!campaignData) return;
    
    const exportData: CampaignExport = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      entityTypes: entityTypes,
      entities: campaignData.entities,
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
  }, [campaignData, entityTypes]);

  const handleEntitySelect = useCallback((entity: CampaignEntity | null) => {
    setSelectedEntity(entity);
    if (entity) {
      setActiveRightTab('read');
      if (!rightPanelOpen) setRightPanelOpen(true);
    }
  }, [rightPanelOpen]);

  const handleEntitySave = useCallback((updatedEntity: CampaignEntity) => {
    setCampaignData(prev => {
      if (!prev) return prev;
      
      // Get the old entity to compare associations
      const oldEntity = prev.entities.find(e => e.id === updatedEntity.id);
      const oldAssocs = oldEntity?.associatedEntities 
        ? oldEntity.associatedEntities.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
      const newAssocs = updatedEntity.associatedEntities 
        ? updatedEntity.associatedEntities.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
      
      // Find added and removed associations
      const addedAssocs = newAssocs.filter((a: string) => !oldAssocs.includes(a));
      const removedAssocs = oldAssocs.filter((a: string) => !newAssocs.includes(a));
      
      let updatedEntities = prev.entities.map(e => 
        e.id === updatedEntity.id ? updatedEntity : e
      );
      
      // Sync bidirectional associations
      updatedEntities = updatedEntities.map(entity => {
        if (entity.id === updatedEntity.id) return entity;
        
        const entityAssocs = entity.associatedEntities 
          ? entity.associatedEntities.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];
        
        let modified = false;
        
        // If this entity was added as an association, add the current entity to it
        if (addedAssocs.some((a: string) => a.toLowerCase() === entity.name.toLowerCase())) {
          if (!entityAssocs.some((a: string) => a.toLowerCase() === updatedEntity.name.toLowerCase())) {
            entityAssocs.push(updatedEntity.name);
            modified = true;
          }
        }
        
        // If this entity was removed as an association, remove the current entity from it
        if (removedAssocs.some((a: string) => a.toLowerCase() === entity.name.toLowerCase())) {
          const idx = entityAssocs.findIndex((a: string) => a.toLowerCase() === updatedEntity.name.toLowerCase());
          if (idx !== -1) {
            entityAssocs.splice(idx, 1);
            modified = true;
          }
        }
        
        if (modified) {
          return { ...entity, associatedEntities: entityAssocs.join(', ') };
        }
        return entity;
      });
      
      return {
        ...prev,
        entities: updatedEntities,
      };
    });
    setSelectedEntity(updatedEntity);
    toast({
      title: "Entity saved",
      description: `${updatedEntity.name} has been updated`,
    });
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
    setActiveRightTab('edit');
    if (!rightPanelOpen) setRightPanelOpen(true);
  }, [rightPanelOpen]);

  const handleSelectField = useCallback((entityId: string, fieldKey: string) => {
    const entity = campaignData?.entities.find(e => e.id === entityId);
    if (entity) {
      setSelectedEntity(entity);
      setActiveRightTab('edit');
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
            variant={viewMode === 'graph' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('graph')}
            className="font-serif"
          >
            <LayoutGrid className="w-4 h-4 mr-1" />
            Graph
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="font-serif"
          >
            <List className="w-4 h-4 mr-1" />
            List
          </Button>
          <Button
            variant={viewMode === 'combat' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('combat')}
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
            "border-r border-border bg-card transition-all duration-300 shrink-0",
            leftPanelOpen ? "w-80" : "w-0"
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
            />
          )}
        </aside>

        {/* Left Panel Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-auto rounded-none border-r border-border hover:bg-muted"
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
        >
          {leftPanelOpen ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </Button>

        {/* Main Area */}
        <main className="flex-1 min-w-0 relative">
          {viewMode === 'graph' ? (
            <CampaignGraph 
              data={campaignData}
              entityTypes={entityTypes}
              onEntitySelect={handleEntitySelect}
              selectedEntityId={selectedEntity?.id || null}
            />
          ) : viewMode === 'list' ? (
            <EntityList
              data={campaignData}
              entityTypes={entityTypes}
              selectedEntityId={selectedEntity?.id || null}
              onSelectEntity={handleEntitySelect}
              onAddEntity={handleAddEntity}
            />
          ) : (
            <CombatTracker
              data={campaignData}
              entityTypes={entityTypes}
              onEntitySelect={handleEntitySelect}
              selectedEntityId={selectedEntity?.id || null}
            />
          )}
        </main>

        {/* Right Panel Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-auto rounded-none border-l border-border hover:bg-muted"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
        >
          {rightPanelOpen ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>

        {/* Right Panel - Read, Edit & Questions */}
        <aside 
          className={cn(
            "border-l border-border bg-card transition-all duration-300 shrink-0 flex flex-col",
            rightPanelOpen ? "w-96" : "w-0"
          )}
        >
          {rightPanelOpen && (
            <Tabs 
              value={activeRightTab} 
              onValueChange={(v) => setActiveRightTab(v as 'read' | 'edit' | 'questions')}
              className="flex flex-col h-full"
            >
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-auto shrink-0">
                <TabsTrigger 
                  value="read"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-serif"
                >
                  <BookOpen className="w-4 h-4 mr-1" />
                  Read
                </TabsTrigger>
                <TabsTrigger 
                  value="edit"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-serif"
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Edit
                </TabsTrigger>
                <TabsTrigger 
                  value="questions"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-serif"
                >
                  <HelpCircle className="w-4 h-4 mr-1" />
                  Questions
                </TabsTrigger>
              </TabsList>
              <TabsContent value="read" className="flex-1 m-0 min-h-0">
                <EntityReader 
                  entity={selectedEntity}
                  entityTypes={entityTypes}
                  entities={campaignData?.entities || []}
                  onClose={() => setSelectedEntity(null)}
                  onEntityClick={handleEntitySelect}
                />
              </TabsContent>
              <TabsContent value="edit" className="flex-1 m-0 min-h-0">
                <EntityEditor 
                  entity={selectedEntity}
                  data={campaignData}
                  entityTypes={entityTypes}
                  onClose={() => setSelectedEntity(null)}
                  onSave={handleEntitySave}
                  onDelete={handleEntityDelete}
                />
              </TabsContent>
              <TabsContent value="questions" className="flex-1 m-0 min-h-0">
                <QuestionsPanel 
                  data={campaignData}
                  entityTypes={entityTypes}
                  onSelectField={handleSelectField}
                />
              </TabsContent>
            </Tabs>
          )}
        </aside>
      </div>
    </div>
  );
}
