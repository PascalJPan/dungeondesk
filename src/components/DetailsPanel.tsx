import React from 'react';
import { X, Copy, FileText, Hash, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { GraphNode, MindMapData } from '@/types/mindmap';
import { truncateText } from '@/lib/text-processing';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DetailsPanelProps {
  selectedNode: GraphNode | null;
  data: MindMapData | null;
  onClose: () => void;
}

export function DetailsPanel({ selectedNode, data, onClose }: DetailsPanelProps) {
  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground">
        <Sparkles className="w-10 h-10 mb-4 opacity-50" />
        <p className="text-sm text-center">
          Click on a node to see its details
        </p>
      </div>
    );
  }

  const copyAsOutline = () => {
    const outline = `# ${selectedNode.label}\n\n${selectedNode.summary}\n\n## Key Points\n\n${selectedNode.chunks.map((c, i) => `${i + 1}. ${truncateText(c.text, 200)}`).join('\n\n')}`;
    navigator.clipboard.writeText(outline);
    toast({
      title: "Copied to clipboard",
      description: "The outline has been copied in Markdown format",
    });
  };

  return (
    <div className="h-full flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: selectedNode.color }}
            />
            <h3 className="font-mono font-semibold text-foreground truncate">
              {selectedNode.label}
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              Cluster {selectedNode.clusterId + 1}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {selectedNode.chunkCount} chunks
            </span>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-4 space-y-4">
          {/* Summary */}
          <div>
            <h4 className="text-xs font-mono uppercase text-muted-foreground mb-2">
              Summary
            </h4>
            <p className="text-sm text-foreground leading-relaxed">
              {selectedNode.summary}
            </p>
          </div>

          <Separator />

          {/* Key Sentences */}
          <div>
            <h4 className="text-xs font-mono uppercase text-muted-foreground mb-3">
              Key Excerpts
            </h4>
            <div className="space-y-3">
              {selectedNode.chunks.slice(0, 5).map((chunk, index) => (
                <div 
                  key={chunk.id}
                  className={cn(
                    "p-3 rounded-lg bg-muted/30 border border-border/50",
                    "text-sm text-secondary-foreground leading-relaxed"
                  )}
                >
                  <span className="inline-block w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-mono text-center leading-5 mr-2">
                    {index + 1}
                  </span>
                  {chunk.text}
                </div>
              ))}
              {selectedNode.chunks.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{selectedNode.chunks.length - 5} more excerpts
                </p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t border-border">
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={copyAsOutline}
        >
          <Copy className="w-4 h-4 mr-2" />
          Copy as Outline
        </Button>
      </div>
    </div>
  );
}
