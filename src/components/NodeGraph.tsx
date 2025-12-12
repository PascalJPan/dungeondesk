import React, { useCallback, useMemo } from 'react';
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
import { Plus } from 'lucide-react';
import { CampaignData, CampaignEntity, EntityTypeDef, getEntityColor } from '@/types/mindmap';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

    // Sort entities by connection count (most connected first)
    const sortedEntities = [...data.entities].sort((a, b) => 
      (connectionCounts.get(b.id) || 0) - (connectionCounts.get(a.id) || 0)
    );

    // Position nodes in concentric circles based on connections
    const nodes: Node[] = [];
    const placed = new Set<string>();
    const positions = new Map<string, { x: number; y: number }>();
    
    // Create layers
    const layers: string[][] = [];
    const remaining = new Set(sortedEntities.map(e => e.id));
    
    // First layer: most connected entities (center)
    if (sortedEntities.length > 0) {
      const firstLayerCount = Math.min(Math.ceil(sortedEntities.length / 5), 4);
      layers.push(sortedEntities.slice(0, firstLayerCount).map(e => e.id));
      layers[0].forEach(id => remaining.delete(id));
    }

    // Subsequent layers: entities connected to previous layers
    while (remaining.size > 0) {
      const layer: string[] = [];
      const prevLayer = layers[layers.length - 1] || [];
      
      remaining.forEach(id => {
        const conns = connectionMap.get(id);
        const hasConnectionToPrev = prevLayer.some(prevId => conns?.has(prevId));
        if (hasConnectionToPrev || layers.length === 0) {
          layer.push(id);
        }
      });

      // If no connections found, add remaining
      if (layer.length === 0) {
        remaining.forEach(id => layer.push(id));
      }

      layer.forEach(id => remaining.delete(id));
      if (layer.length > 0) {
        layers.push(layer);
      }
    }

    // Position entities in concentric circles
    const centerX = 0;
    const centerY = 0;
    
    layers.forEach((layer, layerIdx) => {
      const radius = layerIdx === 0 ? 0 : 150 + (layerIdx - 1) * 180;
      
      if (radius === 0 && layer.length === 1) {
        positions.set(layer[0], { x: centerX, y: centerY });
      } else {
        layer.forEach((entityId, i) => {
          const angle = (2 * Math.PI * i) / layer.length - Math.PI / 2;
          const actualRadius = radius === 0 ? 80 : radius;
          positions.set(entityId, {
            x: centerX + Math.cos(angle) * actualRadius,
            y: centerY + Math.sin(angle) * actualRadius,
          });
        });
      }
    });

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
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
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
