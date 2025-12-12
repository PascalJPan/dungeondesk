import React, { useState, useCallback } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, HelpCircle, Pencil, List, LayoutGrid } from 'lucide-react';
import { InputPanel } from '@/components/InputPanel';
import { EntityList } from '@/components/EntityList';
import { EntityEditor } from '@/components/EntityEditor';
import { EntityReader } from '@/components/EntityReader';
import { QuestionsPanel } from '@/components/QuestionsPanel';
import { CampaignGraph } from '@/components/CampaignGraph';
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
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  
  const [campaignData, setCampaignData] = useState<CampaignData | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<CampaignEntity | null>(null);
  const [entityTypes, setEntityTypes] = useState<EntityTypeDef[]>(DEFAULT_ENTITY_TYPES);
  
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  const handleProcess = useCallback(async (
    text: string, 
    extractionOptions: ExtractionOptions
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

      setCampaignData({
        entities: result.entities,
        processingTime,
      });

      setProcessingState({
        status: 'complete',
        progress: 100,
        message: 'Complete!',
      });

      toast({
        title: "Campaign extracted",
        description: `Found ${result.entities.length} entities`,
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
  }, []);

  const handleImport = useCallback((data: CampaignExport) => {
    setCampaignData({
      entities: data.entities,
      processingTime: 0,
    });
    if (data.entityTypes && data.entityTypes.length > 0) {
      setEntityTypes(data.entityTypes);
    }
    toast({
      title: "Campaign imported",
      description: `Loaded ${data.entities.length} entities`,
    });
  }, []);

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
      return {
        ...prev,
        entities: prev.entities.map(e => 
          e.id === updatedEntity.id ? updatedEntity : e
        ),
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
          ) : (
            <EntityList
              data={campaignData}
              entityTypes={entityTypes}
              selectedEntityId={selectedEntity?.id || null}
              onSelectEntity={handleEntitySelect}
              onAddEntity={handleAddEntity}
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
                  onClose={() => setSelectedEntity(null)}
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
