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
import { CampaignData, CampaignEntity, EntityType, ENTITY_TYPE_INFO } from '@/types/mindmap';
import { cn } from '@/lib/utils';

interface CampaignGraphProps {
  data: CampaignData | null;
  onEntitySelect: (entity: CampaignEntity | null) => void;
  selectedEntityId: string | null;
}

// Custom node component
function EntityNode({ data }: NodeProps<CampaignEntity & { isSelected: boolean }>) {
  const typeInfo = ENTITY_TYPE_INFO[data.type];
  
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
          backgroundColor: typeInfo.color,
          borderColor: data.isSelected ? 'white' : 'transparent',
          boxShadow: `0 4px ${data.isSelected ? 20 : 10}px ${typeInfo.color}40`,
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
          {data.name}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </>
  );
}

const nodeTypes = {
  entity: EntityNode,
};

// Row positions
const ROW_CONFIG: Record<EntityType, number> = {
  location: 0,
  happening: 1,
  character: 2,
  monster: 2,
  item: 3,
};

const ROW_HEIGHT = 150;
const ROW_PADDING = 80;
const NODE_SPACING = 40;

export function CampaignGraph({ 
  data, 
  onEntitySelect,
  selectedEntityId 
}: CampaignGraphProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data) return { initialNodes: [], initialEdges: [] };

    // Group entities by row
    const rowGroups: Record<number, CampaignEntity[]> = { 0: [], 1: [], 2: [], 3: [] };
    
    data.entities.forEach(entity => {
      const row = ROW_CONFIG[entity.type];
      rowGroups[row].push(entity);
    });

    // Position nodes
    const nodes: Node[] = [];
    
    Object.entries(rowGroups).forEach(([rowStr, rowEntities]) => {
      const row = parseInt(rowStr);
      const y = ROW_PADDING + row * ROW_HEIGHT;
      
      const totalWidth = rowEntities.length * 150 + (rowEntities.length - 1) * NODE_SPACING;
      let x = -totalWidth / 2;
      
      rowEntities.forEach(entity => {
        nodes.push({
          id: entity.id,
          type: 'entity',
          position: { x, y },
          data: {
            ...entity,
            isSelected: entity.id === selectedEntityId,
          },
        });
        x += 150 + NODE_SPACING;
      });
    });

    // Create edges from relations
    const edges: Edge[] = [];
    const edgeSet = new Set<string>();

    data.entities.forEach(entity => {
      const relationFields = [
        'associatedLocations', 'associatedCharacters', 'associatedMonsters',
        'associatedHappenings', 'associatedItems'
      ];

      relationFields.forEach(fieldKey => {
        const relations = (entity as any)[fieldKey] as string[] | undefined;
        if (!relations) return;

        relations.forEach(targetId => {
          const edgeKey = [entity.id, targetId].sort().join('-');
          if (edgeSet.has(edgeKey)) return;
          edgeSet.add(edgeKey);

          edges.push({
            id: edgeKey,
            source: entity.id,
            target: targetId,
            style: {
              stroke: 'hsl(var(--muted-foreground))',
              strokeWidth: 1.5,
            },
            type: 'smoothstep',
          });
        });
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [data, selectedEntityId]);

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
      {/* Row Labels */}
      <div className="absolute left-4 top-0 z-10 flex flex-col pointer-events-none">
        <div className="h-[80px]" />
        <div className="h-[150px] flex items-center">
          <span className="text-xs font-display text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Locations
          </span>
        </div>
        <div className="h-[150px] flex items-center">
          <span className="text-xs font-display text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Happenings
          </span>
        </div>
        <div className="h-[150px] flex items-center">
          <span className="text-xs font-display text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Characters / Monsters
          </span>
        </div>
        <div className="h-[150px] flex items-center">
          <span className="text-xs font-display text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Items
          </span>
        </div>
      </div>
      
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
          nodeColor={(node) => ENTITY_TYPE_INFO[node.data?.type as EntityType]?.color || 'hsl(var(--primary))'}
          maskColor="hsl(var(--background) / 0.8)"
          className="!bg-card"
        />
      </ReactFlow>
    </div>
  );
}
