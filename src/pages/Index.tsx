import React, { useState, useRef, useCallback } from 'react';
import { Map, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { InputPanel } from '@/components/InputPanel';
import { GraphVisualization } from '@/components/GraphVisualization';
import { DetailsPanel } from '@/components/DetailsPanel';
import { ControlsPanel } from '@/components/ControlsPanel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CampaignData, 
  GraphNode, 
  ProcessingState, 
  ChunkingMethod,
  ExtractionOptions,
  ENTITY_TYPE_INFO 
} from '@/types/mindmap';
import { createChunks, getClusterColor, generateId } from '@/lib/text-processing';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function Index() {
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<'details' | 'controls'>('controls');
  
  const [campaignData, setCampaignData] = useState<CampaignData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  const graphRef = useRef<HTMLDivElement>(null);

  const handleProcess = useCallback(async (
    text: string, 
    method: ChunkingMethod, 
    extractionOptions: ExtractionOptions,
    customSize?: number
  ) => {
    const startTime = Date.now();
    
    try {
      // Step 1: Chunking
      setProcessingState({
        status: 'chunking',
        progress: 10,
        message: 'Splitting text into chunks...',
      });

      const chunks = createChunks(text, method, customSize);
      
      if (chunks.length < 3) {
        throw new Error('Not enough meaningful content to extract. Please provide more text.');
      }

      // Step 2: Extract entities
      setProcessingState({
        status: 'embedding',
        progress: 30,
        message: 'Extracting campaign entities...',
      });

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-mindmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          chunks: chunks.map(c => c.text),
          extractionOptions,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to extract campaign data');
      }

      const result = await response.json();

      setProcessingState({
        status: 'generating',
        progress: 80,
        message: 'Building campaign graph...',
      });

      // Build the graph from entities
      const nodes: GraphNode[] = result.entities.map((entity: any, idx: number) => ({
        id: `node-${entity.type}-${idx}`,
        clusterId: idx,
        type: entity.type,
        label: entity.label,
        summary: entity.summary,
        chunkCount: entity.chunkIndices.length,
        chunks: entity.chunkIndices.map((i: number) => chunks[i]),
        color: ENTITY_TYPE_INFO[entity.type as keyof typeof ENTITY_TYPE_INFO]?.color || '#888',
      }));

      // Create edges based on AI relationships
      const edges = result.relationships.map((rel: any, idx: number) => ({
        id: `edge-${idx}`,
        source: `node-${rel.sourceType}-${rel.sourceIndex}`,
        target: `node-${rel.targetType}-${rel.targetIndex}`,
        relationship: rel.description,
      }));

      const processingTime = Date.now() - startTime;

      setCampaignData({
        nodes,
        edges,
        clusters: result.entities,
        totalChunks: chunks.length,
        processingTime,
      });

      setProcessingState({
        status: 'complete',
        progress: 100,
        message: 'Complete!',
      });

      toast({
        title: "Campaign extracted",
        description: `Found ${nodes.length} entities with ${edges.length} relationships`,
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

  const handleNodeSelect = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
    if (node) {
      setActiveRightTab('details');
      if (!rightPanelOpen) setRightPanelOpen(true);
    }
  }, [rightPanelOpen]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Map className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-mono font-semibold text-lg text-foreground">
            Campaign Editor
          </h1>
        </div>
        <p className="text-sm text-muted-foreground hidden sm:block">
          Extract &amp; visualize D&amp;D campaign elements
        </p>
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
          {leftPanelOpen && <InputPanel onProcess={handleProcess} processingState={processingState} />}
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

        {/* Graph Area */}
        <main className="flex-1 min-w-0 relative" ref={graphRef}>
          <GraphVisualization 
            data={campaignData}
            onNodeSelect={handleNodeSelect}
            selectedNodeId={selectedNode?.id || null}
          />
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

        {/* Right Panel - Details & Controls */}
        <aside 
          className={cn(
            "border-l border-border bg-card transition-all duration-300 shrink-0 flex flex-col",
            rightPanelOpen ? "w-80" : "w-0"
          )}
        >
          {rightPanelOpen && (
            <>
              <Tabs 
                value={activeRightTab} 
                onValueChange={(v) => setActiveRightTab(v as 'details' | 'controls')}
                className="flex flex-col h-full"
              >
                <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-auto shrink-0">
                  <TabsTrigger 
                    value="details"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                  >
                    Details
                  </TabsTrigger>
                  <TabsTrigger 
                    value="controls"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Controls
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="flex-1 m-0 min-h-0">
                  <DetailsPanel 
                    selectedNode={selectedNode}
                    data={campaignData}
                    onClose={() => setSelectedNode(null)}
                  />
                </TabsContent>
                <TabsContent value="controls" className="flex-1 m-0 min-h-0 overflow-y-auto scrollbar-thin">
                  <ControlsPanel 
                    data={campaignData}
                    graphRef={graphRef}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
