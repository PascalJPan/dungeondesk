import React, { useRef } from 'react';
import { Download, Image, FileJson, FileText, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MindMapData } from '@/types/mindmap';
import { formatProcessingTime } from '@/lib/text-processing';
import { toast } from '@/hooks/use-toast';
import { toPng } from 'html-to-image';

interface ControlsPanelProps {
  data: MindMapData | null;
  similarityThreshold: number;
  onThresholdChange: (value: number) => void;
  graphRef: React.RefObject<HTMLDivElement>;
}

export function ControlsPanel({ 
  data, 
  similarityThreshold, 
  onThresholdChange,
  graphRef 
}: ControlsPanelProps) {
  const exportPng = async () => {
    if (!graphRef.current) return;
    
    try {
      const dataUrl = await toPng(graphRef.current, {
        backgroundColor: 'hsl(220, 20%, 10%)',
        quality: 1,
      });
      
      const link = document.createElement('a');
      link.download = 'mindmap.png';
      link.href = dataUrl;
      link.click();
      
      toast({
        title: "Exported",
        description: "Mindmap saved as PNG",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not export the mindmap",
        variant: "destructive",
      });
    }
  };

  const exportJson = () => {
    if (!data) return;
    
    const jsonData = {
      nodes: data.nodes.map(n => ({
        id: n.id,
        label: n.label,
        summary: n.summary,
        chunkCount: n.chunkCount,
        clusterId: n.clusterId,
      })),
      edges: data.edges.map(e => ({
        source: e.source,
        target: e.target,
        similarity: e.similarity,
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
    link.download = 'mindmap.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported",
      description: "Mindmap saved as JSON",
    });
  };

  const exportMarkdown = () => {
    if (!data) return;
    
    const md = `# Concept Map\n\n${data.nodes
      .sort((a, b) => b.chunkCount - a.chunkCount)
      .map(node => `## ${node.label}\n\n${node.summary}\n\n**Key points:**\n${node.chunks.slice(0, 3).map(c => `- ${c.text}`).join('\n')}\n`)
      .join('\n---\n\n')}\n\n---\n*Generated on ${new Date().toLocaleDateString()}*`;
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'mindmap.md';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported",
      description: "Mindmap saved as Markdown outline",
    });
  };

  const visibleEdges = data?.edges.filter(e => e.similarity >= similarityThreshold).length || 0;
  const totalEdges = data?.edges.length || 0;

  return (
    <div className="p-4 space-y-6">
      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-2xl font-mono font-semibold text-foreground">
              {data.nodes.length}
            </p>
            <p className="text-xs text-muted-foreground">Concepts</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-2xl font-mono font-semibold text-foreground">
              {data.totalChunks}
            </p>
            <p className="text-xs text-muted-foreground">Chunks</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50 col-span-2">
            <p className="text-lg font-mono font-semibold text-foreground">
              {formatProcessingTime(data.processingTime)}
            </p>
            <p className="text-xs text-muted-foreground">Processing time</p>
          </div>
        </div>
      )}

      <Separator />

      {/* Similarity Threshold */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm flex items-center gap-2">
            <Sliders className="w-4 h-4 text-muted-foreground" />
            Similarity Threshold
          </Label>
          <span className="text-sm font-mono text-primary">
            {(similarityThreshold * 100).toFixed(0)}%
          </span>
        </div>
        <Slider
          value={[similarityThreshold]}
          onValueChange={([v]) => onThresholdChange(v)}
          min={0}
          max={1}
          step={0.05}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Showing {visibleEdges} of {totalEdges} connections
        </p>
      </div>

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
