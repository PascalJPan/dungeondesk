import React from 'react';
import { Download, Image, FileJson, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CampaignData, ENTITY_TYPE_INFO, EntityType } from '@/types/mindmap';
import { toast } from '@/hooks/use-toast';
import { toPng } from 'html-to-image';

interface ControlsPanelProps {
  data: CampaignData | null;
  graphRef: React.RefObject<HTMLDivElement>;
}

function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ControlsPanel({ data, graphRef }: ControlsPanelProps) {
  const exportPng = async () => {
    if (!graphRef.current) return;
    
    try {
      const dataUrl = await toPng(graphRef.current, {
        backgroundColor: 'hsl(220, 20%, 10%)',
        quality: 1,
      });
      
      const link = document.createElement('a');
      link.download = 'campaign.png';
      link.href = dataUrl;
      link.click();
      
      toast({
        title: "Exported",
        description: "Campaign map saved as PNG",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not export the campaign map",
        variant: "destructive",
      });
    }
  };

  const exportJson = () => {
    if (!data) return;
    
    const jsonData = {
      nodes: data.nodes.map(n => ({
        id: n.id,
        type: n.type,
        label: n.label,
        summary: n.summary,
        chunkCount: n.chunkCount,
      })),
      edges: data.edges.map(e => ({
        source: e.source,
        target: e.target,
        relationship: e.relationship,
      })),
      metadata: {
        totalChunks: data.totalChunks,
        processingTime: data.processingTime,
        exportedAt: new Date().toISOString(),
      },
    };
    
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'campaign.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported",
      description: "Campaign saved as JSON",
    });
  };

  const exportMarkdown = () => {
    if (!data) return;
    
    // Group nodes by type
    const byType: Record<string, typeof data.nodes> = {};
    data.nodes.forEach(node => {
      if (!byType[node.type]) byType[node.type] = [];
      byType[node.type].push(node);
    });

    const typeOrder: EntityType[] = ['location', 'happening', 'character', 'monster', 'item'];
    
    const md = `# Campaign Overview\n\n${typeOrder
      .filter(type => byType[type]?.length)
      .map(type => `## ${ENTITY_TYPE_INFO[type].label}\n\n${byType[type]
        .map(node => `### ${node.label}\n\n${node.summary}\n\n**Key excerpts:**\n${node.chunks.slice(0, 3).map(c => `- ${c.text}`).join('\n')}\n`)
        .join('\n')}`
      ).join('\n---\n\n')}\n\n---\n*Generated on ${new Date().toLocaleDateString()}*`;
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'campaign.md';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported",
      description: "Campaign saved as Markdown",
    });
  };

  // Count entities by type
  const entityCounts: Record<string, number> = {};
  data?.nodes.forEach(n => {
    entityCounts[n.type] = (entityCounts[n.type] || 0) + 1;
  });

  return (
    <div className="p-4 space-y-6">
      {/* Stats */}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-2xl font-mono font-semibold text-foreground">
                {data.nodes.length}
              </p>
              <p className="text-xs text-muted-foreground">Entities</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-2xl font-mono font-semibold text-foreground">
                {data.edges.length}
              </p>
              <p className="text-xs text-muted-foreground">Relationships</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50 col-span-2">
              <p className="text-lg font-mono font-semibold text-foreground">
                {formatProcessingTime(data.processingTime)}
              </p>
              <p className="text-xs text-muted-foreground">Processing time</p>
            </div>
          </div>

          <Separator />

          {/* Entity breakdown */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Entity Breakdown</Label>
            <div className="space-y-1">
              {(Object.keys(ENTITY_TYPE_INFO) as EntityType[]).map(type => {
                const count = entityCounts[type] || 0;
                if (count === 0) return null;
                return (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: ENTITY_TYPE_INFO[type].color }}
                      />
                      <span className="text-muted-foreground">{ENTITY_TYPE_INFO[type].label}</span>
                    </div>
                    <span className="font-mono text-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Export Options */}
      <div className="space-y-3">
        <Label className="text-sm flex items-center gap-2">
          <Download className="w-4 h-4 text-muted-foreground" />
          Export
        </Label>
        <div className="grid grid-cols-1 gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportPng}
            disabled={!data}
            className="justify-start"
          >
            <Image className="w-4 h-4 mr-2" />
            Export as PNG
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportJson}
            disabled={!data}
            className="justify-start"
          >
            <FileJson className="w-4 h-4 mr-2" />
            Export as JSON
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportMarkdown}
            disabled={!data}
            className="justify-start"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export as Markdown
          </Button>
        </div>
      </div>
    </div>
  );
}
