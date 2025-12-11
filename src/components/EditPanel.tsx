import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, FileText, Sparkles, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GraphNode, CampaignData, GraphEdge, ENTITY_TYPE_INFO, TextChunk } from '@/types/mindmap';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface EditPanelProps {
  selectedNode: GraphNode | null;
  data: CampaignData | null;
  onClose: () => void;
  onUpdate: (updatedData: CampaignData, affectedNodeIds: string[]) => void;
}

interface EditableRelationship {
  edgeId: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  relationship: string;
  direction: 'incoming' | 'outgoing';
}

interface EditableExcerpt {
  chunkId: string;
  text: string;
  originalText: string;
}

export function EditPanel({ selectedNode, data, onClose, onUpdate }: EditPanelProps) {
  const [label, setLabel] = useState('');
  const [relationships, setRelationships] = useState<EditableRelationship[]>([]);
  const [excerpts, setExcerpts] = useState<EditableExcerpt[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedNode && data) {
      setLabel(selectedNode.label);
      
      // Build editable relationships
      const relatedEdges = data.edges.filter(
        e => e.source === selectedNode.id || e.target === selectedNode.id
      );
      
      const editableRels = relatedEdges.map(edge => {
        const isOutgoing = edge.source === selectedNode.id;
        const relatedId = isOutgoing ? edge.target : edge.source;
        const relatedNode = data.nodes.find(n => n.id === relatedId);
        return {
          edgeId: edge.id,
          nodeId: relatedId,
          nodeLabel: relatedNode?.label || 'Unknown',
          nodeType: relatedNode?.type || 'unknown',
          relationship: edge.relationship,
          direction: isOutgoing ? 'outgoing' : 'incoming',
        } as EditableRelationship;
      }).filter(r => r.nodeLabel !== 'Unknown');
      
      setRelationships(editableRels);
      
      // Build editable excerpts
      const editableExcerpts = selectedNode.chunks.map(chunk => ({
        chunkId: chunk.id,
        text: chunk.text,
        originalText: chunk.text,
      }));
      setExcerpts(editableExcerpts);
    }
  }, [selectedNode, data]);

  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground">
        <Sparkles className="w-10 h-10 mb-4 opacity-50" />
        <p className="text-sm text-center">
          Select an entity to edit
        </p>
      </div>
    );
  }

  const typeInfo = ENTITY_TYPE_INFO[selectedNode.type];

  const handleRelationshipChange = (edgeId: string, newRelationship: string) => {
    setRelationships(prev => 
      prev.map(r => r.edgeId === edgeId ? { ...r, relationship: newRelationship } : r)
    );
  };

  const handleRemoveRelationship = (edgeId: string) => {
    setRelationships(prev => prev.filter(r => r.edgeId !== edgeId));
  };

  const handleExcerptChange = (chunkId: string, newText: string) => {
    setExcerpts(prev =>
      prev.map(e => e.chunkId === chunkId ? { ...e, text: newText } : e)
    );
  };

  const handleRemoveExcerpt = (chunkId: string) => {
    setExcerpts(prev => prev.filter(e => e.chunkId !== chunkId));
  };

  const handleSave = async () => {
    if (!data || !selectedNode) return;
    
    setIsSaving(true);
    
    try {
      // Find all affected nodes (nodes that share any changed excerpts)
      const changedExcerpts = excerpts.filter(e => e.text !== e.originalText);
      const removedExcerpts = selectedNode.chunks
        .filter(c => !excerpts.find(e => e.chunkId === c.id))
        .map(c => c.id);
      
      const affectedNodeIds = new Set<string>([selectedNode.id]);
      
      // Find other nodes that have the same chunks
      if (changedExcerpts.length > 0 || removedExcerpts.length > 0) {
        for (const node of data.nodes) {
          if (node.id === selectedNode.id) continue;
          for (const chunk of node.chunks) {
            const changedExcerpt = changedExcerpts.find(e => e.originalText === chunk.text);
            if (changedExcerpt) {
              affectedNodeIds.add(node.id);
            }
          }
        }
      }

      // Update the data
      const updatedNodes = data.nodes.map(node => {
        if (node.id === selectedNode.id) {
          // Update the selected node
          const updatedChunks = excerpts.map(e => {
            const originalChunk = node.chunks.find(c => c.id === e.chunkId);
            return {
              ...originalChunk!,
              text: e.text,
            };
          });
          
          return {
            ...node,
            label,
            chunks: updatedChunks,
            chunkCount: updatedChunks.length,
          };
        }
        
        // Update other affected nodes with changed excerpts
        if (affectedNodeIds.has(node.id) && node.id !== selectedNode.id) {
          const updatedChunks = node.chunks.map(chunk => {
            const changedExcerpt = changedExcerpts.find(e => e.originalText === chunk.text);
            if (changedExcerpt) {
              return { ...chunk, text: changedExcerpt.text };
            }
            return chunk;
          });
          return { ...node, chunks: updatedChunks };
        }
        
        return node;
      });

      // Update edges
      const removedEdgeIds = data.edges
        .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
        .filter(e => !relationships.find(r => r.edgeId === e.id))
        .map(e => e.id);

      const updatedEdges = data.edges
        .filter(e => !removedEdgeIds.includes(e.id))
        .map(edge => {
          const updatedRel = relationships.find(r => r.edgeId === edge.id);
          if (updatedRel) {
            return { ...edge, relationship: updatedRel.relationship };
          }
          return edge;
        });

      // Regenerate summaries for affected nodes using AI
      const nodesNeedingSummaryUpdate = Array.from(affectedNodeIds);
      
      const updatedNodesWithSummaries = await regenerateSummaries(
        updatedNodes, 
        nodesNeedingSummaryUpdate
      );

      const updatedData: CampaignData = {
        ...data,
        nodes: updatedNodesWithSummaries,
        edges: updatedEdges,
      };

      onUpdate(updatedData, Array.from(affectedNodeIds));
      
      toast({
        title: "Changes saved",
        description: `Updated ${affectedNodeIds.size} entity summaries`,
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error saving",
        description: error instanceof Error ? error.message : "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: typeInfo.color }}
            />
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="font-mono font-semibold text-foreground h-7 px-2"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span 
              className="px-2 py-0.5 rounded-full text-white text-[10px] uppercase font-medium"
              style={{ backgroundColor: typeInfo.color }}
            >
              {typeInfo.label}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {excerpts.length} excerpts
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
          {/* Relationships */}
          {relationships.length > 0 && (
            <>
              <div>
                <h4 className="text-xs font-mono uppercase text-muted-foreground mb-3">
                  Relationships ({relationships.length})
                </h4>
                <div className="space-y-2">
                  {relationships.map((rel) => {
                    const relTypeInfo = ENTITY_TYPE_INFO[rel.nodeType as keyof typeof ENTITY_TYPE_INFO];
                    return (
                      <div 
                        key={rel.edgeId}
                        className="p-2 rounded-lg bg-muted/30 border border-border/50"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div 
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: relTypeInfo?.color || '#888' }}
                          />
                          <p className="text-sm font-medium text-foreground flex-1 truncate">
                            {rel.nodeLabel}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveRelationship(rel.edgeId)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <Input
                          value={rel.relationship}
                          onChange={(e) => handleRelationshipChange(rel.edgeId, e.target.value)}
                          placeholder="Relationship description"
                          className="h-7 text-xs"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Key Excerpts */}
          <div>
            <h4 className="text-xs font-mono uppercase text-muted-foreground mb-3">
              Key Excerpts
            </h4>
            <div className="space-y-3">
              {excerpts.map((excerpt, index) => (
                <div 
                  key={excerpt.chunkId}
                  className="p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span 
                      className="inline-block w-5 h-5 rounded-full text-white text-xs font-mono text-center leading-5 shrink-0"
                      style={{ backgroundColor: typeInfo.color }}
                    >
                      {index + 1}
                    </span>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveExcerpt(excerpt.chunkId)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <Textarea
                    value={excerpt.text}
                    onChange={(e) => handleExcerptChange(excerpt.chunkId, e.target.value)}
                    className="text-sm min-h-[80px] resize-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Save Button */}
      <div className="p-4 border-t border-border">
        <Button 
          className="w-full" 
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Regenerating summaries...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save & Update Summaries
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

async function regenerateSummaries(
  nodes: GraphNode[], 
  nodeIdsToUpdate: string[]
): Promise<GraphNode[]> {
  const nodesToUpdate = nodes.filter(n => nodeIdsToUpdate.includes(n.id));
  
  if (nodesToUpdate.length === 0) return nodes;

  const LOVABLE_API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

  // Call edge function to regenerate summaries
  const response = await fetch(`${SUPABASE_URL}/functions/v1/regenerate-summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      entities: nodesToUpdate.map(n => ({
        id: n.id,
        type: n.type,
        label: n.label,
        excerpts: n.chunks.map(c => c.text),
      })),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to regenerate summaries');
  }

  const result = await response.json();
  const summaryMap = new Map(
    result.summaries.map((s: { id: string; summary: string }) => [s.id, s.summary])
  );

  return nodes.map(node => {
    const newSummary = summaryMap.get(node.id);
    if (newSummary) {
      return { ...node, summary: newSummary as string };
    }
    return node;
  });
}
