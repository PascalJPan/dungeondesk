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
import { CampaignData, CampaignEntity, EntityTypeDef, getEntityColor } from '@/types/mindmap';
import { cn } from '@/lib/utils';

interface CampaignGraphProps {
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  onEntitySelect: (entity: CampaignEntity | null) => void;
  selectedEntityId: string | null;
}

// Custom node component
function EntityNode({ data }: NodeProps<{ entity: CampaignEntity; color: string; isSelected: boolean }>) {
  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div
        className={cn(
          "rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer px-3 py-2",
          "border-2 shadow-lg hover:scale-105 min-w-[100px] max-w-[200px]",
          data.isSelected && "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-105"
        )}
        style={{
          backgroundColor: data.color,
          borderColor: data.isSelected ? 'white' : 'transparent',
          boxShadow: `0 4px ${data.isSelected ? 20 : 10}px ${data.color}40`,
        }}
      >
        <span 
          className="text-xs font-serif font-medium text-center leading-tight"
          style={{ 
            color: 'white',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {data.entity.name}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </>
  );
}

const nodeTypes = {
  entity: EntityNode,
};

const ROW_HEIGHT = 150;
const ROW_PADDING = 80;
const NODE_SPACING = 40;

export function CampaignGraph({ 
  data, 
  entityTypes,
  onEntitySelect,
  selectedEntityId 
}: CampaignGraphProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data || entityTypes.length === 0) return { initialNodes: [], initialEdges: [] };

    // Create row config based on entity types order
    const rowConfig: Record<string, number> = {};
    entityTypes.forEach((type, idx) => {
      rowConfig[type.key] = idx;
    });

    // Group entities by type (row)
    const rowGroups: Record<number, CampaignEntity[]> = {};
    entityTypes.forEach((_, idx) => {
      rowGroups[idx] = [];
    });
    
    data.entities.forEach(entity => {
      const row = rowConfig[entity.type];
      if (row !== undefined) {
        rowGroups[row].push(entity);
      }
    });

    // Position nodes
    const nodes: Node[] = [];
    
    Object.entries(rowGroups).forEach(([rowStr, rowEntities]) => {
      const row = parseInt(rowStr);
      const y = ROW_PADDING + row * ROW_HEIGHT;
      
      const totalWidth = rowEntities.length * 150 + (rowEntities.length - 1) * NODE_SPACING;
      let x = -totalWidth / 2;
      
      rowEntities.forEach(entity => {
        const color = getEntityColor(entityTypes, entity.type);
        nodes.push({
          id: entity.id,
          type: 'entity',
          position: { x, y },
          data: {
            entity,
            color,
            isSelected: entity.id === selectedEntityId,
          },
        });
        x += 150 + NODE_SPACING;
      });
    });

    // Build edges from associatedEntities field
    const edges: Edge[] = [];
    const entityMap = new Map(data.entities.map(e => [e.name.toLowerCase(), e.id]));
    const addedEdges = new Set<string>();
    
    data.entities.forEach(entity => {
      const associated = entity.associatedEntities;
      if (!associated || typeof associated !== 'string') return;
      
      // Parse comma-separated entity names
      const names = associated.split(',').map(n => n.trim().toLowerCase()).filter(Boolean);
      
      names.forEach(name => {
        const targetId = entityMap.get(name);
        if (targetId && targetId !== entity.id) {
          const edgeKey = [entity.id, targetId].sort().join('-');
          if (!addedEdges.has(edgeKey)) {
            addedEdges.add(edgeKey);
            edges.push({
              id: edgeKey,
              source: entity.id,
              target: targetId,
              style: { stroke: 'hsl(var(--edge-default))', strokeWidth: 1.5 },
              type: 'smoothstep',
            });
          }
        }
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [data, entityTypes, selectedEntityId]);

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

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 mx-auto rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
            <span className="text-4xl">📜</span>
          </div>
          <div>
            <p className="font-display text-sm">No campaign extracted</p>
            <p className="text-xs mt-1 font-serif">Upload campaign notes to get started</p>
          </div>
        </div>
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
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background color="hsl(var(--border))" gap={20} size={1} />
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
