import React, { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeProps,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Plus, Lock, Unlock } from 'lucide-react';
import { CampaignData, CampaignEntity, EntityTypeDef, getEntityColor } from '@/types/mindmap';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/toggle';

interface NodeGraphProps {
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  onEntitySelect: (entity: CampaignEntity | null) => void;
  selectedEntityId: string | null;
  onAddEntity?: (typeDef: EntityTypeDef) => void;
}

// Custom circular node component
function CircleNode({ data }: NodeProps<{ entity: CampaignEntity; color: string; isSelected: boolean; connectionCount: number }>) {
  const size = 50 + Math.min(data.connectionCount * 5, 20);
  
  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer",
            "border-2 shadow-lg hover:scale-110",
            data.isSelected && "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110"
          )}
          style={{
            width: size,
            height: size,
            backgroundColor: data.color,
            borderColor: data.isSelected ? 'white' : 'transparent',
            boxShadow: `0 4px ${data.isSelected ? 20 : 10}px ${data.color}40`,
          }}
        />
        <span 
          className="text-[10px] font-serif text-center mt-1 max-w-[80px] leading-tight"
          style={{ 
            color: 'hsl(var(--foreground))',
            textShadow: '0 1px 2px hsl(var(--background))',
          }}
        >
          {data.entity.name.length > 15 ? data.entity.name.slice(0, 13) + '...' : data.entity.name}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </>
  );
}

const nodeTypes = {
  circle: CircleNode,
};

export function NodeGraph({ 
  data, 
  entityTypes,
  onEntitySelect,
  selectedEntityId,
  onAddEntity,
}: NodeGraphProps) {
  // Default interactivity to OFF (nodes locked)
  const [interactivityEnabled, setInteractivityEnabled] = useState(false);
  
  // Build connections and count
  const { connectionMap, connectionCounts } = useMemo(() => {
    if (!data) return { connectionMap: new Map(), connectionCounts: new Map() };
    
    const map = new Map<string, Set<string>>();
    const counts = new Map<string, number>();
    
    data.entities.forEach(entity => {
      counts.set(entity.id, 0);
    });
    
    data.entities.forEach(entity => {
      if (!entity.associatedEntities) return;
      const assocs = entity.associatedEntities.split(',').map((s: string) => s.trim()).filter(Boolean);
      assocs.forEach((assocName: string) => {
        const linked = data.entities.find(e => e.name.toLowerCase() === assocName.toLowerCase());
        if (linked) {
          if (!map.has(entity.id)) map.set(entity.id, new Set());
          map.get(entity.id)!.add(linked.id);
          counts.set(entity.id, (counts.get(entity.id) || 0) + 1);
        }
      });
    });
    
    return { connectionMap: map, connectionCounts: counts };
  }, [data]);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data || entityTypes.length === 0) return { initialNodes: [], initialEdges: [] };

    // Group entities by type for clustering
    const entityGroups = new Map<string, CampaignEntity[]>();
    data.entities.forEach(entity => {
      if (!entityGroups.has(entity.type)) {
        entityGroups.set(entity.type, []);
      }
      entityGroups.get(entity.type)!.push(entity);
    });

    // Sort entities within each group by connection count
    entityGroups.forEach((entities, type) => {
      entities.sort((a, b) => 
        (connectionCounts.get(b.id) || 0) - (connectionCounts.get(a.id) || 0)
      );
    });

    const nodes: Node[] = [];
    const positions = new Map<string, { x: number; y: number }>();
    
    // Calculate layout: spread type clusters around the canvas
    const typeKeys = Array.from(entityGroups.keys());
    const numTypes = typeKeys.length;
    const clusterRadius = 400; // Distance from center for each type cluster
    const nodeSpacing = 120; // Space between nodes within a cluster
    
    typeKeys.forEach((typeKey, typeIdx) => {
      const entities = entityGroups.get(typeKey)!;
      const clusterAngle = (2 * Math.PI * typeIdx) / numTypes - Math.PI / 2;
      
      // Cluster center position
      const clusterCenterX = Math.cos(clusterAngle) * clusterRadius;
      const clusterCenterY = Math.sin(clusterAngle) * clusterRadius;
      
      // Arrange entities within cluster in a spiral pattern
      entities.forEach((entity, i) => {
        const connCount = connectionCounts.get(entity.id) || 0;
        
        if (i === 0 && connCount > 0) {
          // Most connected entity at cluster center
          positions.set(entity.id, { x: clusterCenterX, y: clusterCenterY });
        } else {
          // Spiral outward from cluster center
          const spiralLayer = Math.floor((i) / 6) + 1;
          const spiralAngle = ((i) % 6) * (Math.PI / 3) + (spiralLayer * 0.3);
          const spiralRadius = spiralLayer * nodeSpacing;
          
          // Add some randomness for organic feel
          const jitterX = (Math.sin(entity.id.length * 1.5) * 20);
          const jitterY = (Math.cos(entity.id.length * 2.3) * 20);
          
          positions.set(entity.id, {
            x: clusterCenterX + Math.cos(spiralAngle) * spiralRadius + jitterX,
            y: clusterCenterY + Math.sin(spiralAngle) * spiralRadius + jitterY,
          });
        }
      });
    });
    
    // Pull connected entities closer together
    const iterations = 3;
    for (let iter = 0; iter < iterations; iter++) {
      connectionMap.forEach((connected, entityId) => {
        const pos = positions.get(entityId);
        if (!pos) return;
        
        connected.forEach(targetId => {
          const targetPos = positions.get(targetId);
          if (!targetPos) return;
          
          // Calculate midpoint pull (very subtle)
          const pullStrength = 0.05;
          const midX = (pos.x + targetPos.x) / 2;
          const midY = (pos.y + targetPos.y) / 2;
          
          positions.set(entityId, {
            x: pos.x + (midX - pos.x) * pullStrength,
            y: pos.y + (midY - pos.y) * pullStrength,
          });
        });
      });
    }

    // Create nodes
    data.entities.forEach(entity => {
      const pos = positions.get(entity.id);
      if (!pos) return;
      
      const color = getEntityColor(entityTypes, entity.type);
      nodes.push({
        id: entity.id,
        type: 'circle',
        position: pos,
        data: {
          entity,
          color,
          isSelected: entity.id === selectedEntityId,
          connectionCount: connectionCounts.get(entity.id) || 0,
        },
      });
    });

    // Build edges
    const edges: Edge[] = [];
    const addedEdges = new Set<string>();
    
    connectionMap.forEach((connected, entityId) => {
      connected.forEach(targetId => {
        const edgeKey = [entityId, targetId].sort().join('-');
        if (!addedEdges.has(edgeKey)) {
          addedEdges.add(edgeKey);
          edges.push({
            id: edgeKey,
            source: entityId,
            target: targetId,
            style: { stroke: 'hsl(var(--muted-foreground) / 0.3)', strokeWidth: 1.5 },
            type: 'straight',
          });
        }
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [data, entityTypes, selectedEntityId, connectionCounts, connectionMap]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(nodes => nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        isSelected: node.id === selectedEntityId,
      },
    })));
  }, [selectedEntityId, setNodes]);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const entity = data?.entities.find(e => e.id === node.id);
    onEntitySelect(entity || null);
  }, [data, onEntitySelect]);

  const handlePaneClick = useCallback(() => {
    onEntitySelect(null);
  }, [onEntitySelect]);

  if (!data || data.entities.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground">
        <div className="w-20 h-20 mx-auto rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
          <span className="text-3xl">🕸️</span>
        </div>
        <div className="mt-4 text-center">
          <p className="font-display text-sm">No entities yet</p>
          <p className="text-xs mt-1 font-serif">Add entities to see the node graph</p>
        </div>
        {onAddEntity && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {entityTypes.map(typeDef => (
              <Button
                key={typeDef.key}
                variant="outline"
                size="sm"
                className="font-serif"
                onClick={() => onAddEntity(typeDef)}
              >
                <Plus className="w-3 h-3 mr-1" />
                {typeDef.label.endsWith('s') ? typeDef.label.slice(0, -1) : typeDef.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {/* Interactivity toggle */}
      <div className="absolute top-4 right-4 z-10">
        <Toggle
          pressed={interactivityEnabled}
          onPressedChange={setInteractivityEnabled}
          aria-label="Toggle node interactivity"
          className="bg-card border border-border"
        >
          {interactivityEnabled ? (
            <Unlock className="w-4 h-4 mr-1" />
          ) : (
            <Lock className="w-4 h-4 mr-1" />
          )}
          <span className="text-xs font-serif">
            {interactivityEnabled ? 'Unlocked' : 'Locked'}
          </span>
        </Toggle>
      </div>
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={interactivityEnabled ? onNodesChange : undefined}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        nodesDraggable={interactivityEnabled}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background color="hsl(var(--border))" gap={30} size={1} />
        <Controls className="!bg-card !border-border" />
        <MiniMap 
          nodeColor={(node) => node.data?.color || 'hsl(var(--primary))'}
          maskColor="hsl(var(--background) / 0.8)"
          className="!bg-card"
        />
      </ReactFlow>
    </div>
  );
}
