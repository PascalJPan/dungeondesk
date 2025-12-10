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
import { CampaignData, GraphNode as CampaignNode, ENTITY_TYPE_INFO, EntityType } from '@/types/mindmap';
import { cn } from '@/lib/utils';

interface GraphVisualizationProps {
  data: CampaignData | null;
  onNodeSelect: (node: CampaignNode | null) => void;
  selectedNodeId: string | null;
}

// Custom node component
function EntityNode({ data, selected }: NodeProps<CampaignNode & { isSelected: boolean }>) {
  const nodeWidth = Math.min(Math.max(data.chunkCount * 15 + 80, 100), 200);
  const nodeHeight = 50;
  const typeInfo = ENTITY_TYPE_INFO[data.type];
  
  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div
        className={cn(
          "rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer px-3 py-2",
          "border-2 shadow-lg hover:scale-105",
          data.isSelected && "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-105"
        )}
        style={{
          width: nodeWidth,
          minHeight: nodeHeight,
          backgroundColor: typeInfo.color,
          borderColor: data.isSelected ? 'white' : 'transparent',
          boxShadow: `0 4px ${data.isSelected ? 20 : 10}px ${typeInfo.color}40`,
        }}
      >
        <span 
          className="text-xs font-medium text-center leading-tight"
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
          {data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </>
  );
}

const nodeTypes = {
  entity: EntityNode,
};

// Row heights and spacing
const ROW_HEIGHT = 180;
const ROW_PADDING = 100;
const NODE_SPACING = 30;

export function GraphVisualization({ 
  data, 
  onNodeSelect,
  selectedNodeId 
}: GraphVisualizationProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data) return { initialNodes: [], initialEdges: [] };

    // Group nodes by row (based on entity type)
    const rowGroups: Record<number, CampaignNode[]> = { 0: [], 1: [], 2: [] };
    
    data.nodes.forEach(node => {
      const row = ENTITY_TYPE_INFO[node.type].row;
      rowGroups[row].push(node);
    });

    // Position nodes in rows
    const nodes: Node[] = [];
    
    Object.entries(rowGroups).forEach(([rowStr, rowNodes]) => {
      const row = parseInt(rowStr);
      const y = ROW_PADDING + row * ROW_HEIGHT;
      
      // Calculate total width needed
      const totalWidth = rowNodes.reduce((sum, node) => {
        const nodeWidth = Math.min(Math.max(node.chunkCount * 15 + 80, 100), 200);
        return sum + nodeWidth + NODE_SPACING;
      }, -NODE_SPACING);
      
      // Start position (centered)
      let x = -totalWidth / 2;
      
      rowNodes.forEach(node => {
        const nodeWidth = Math.min(Math.max(node.chunkCount * 15 + 80, 100), 200);
        
        nodes.push({
          id: node.id,
          type: 'entity',
          position: { x, y },
          data: {
            ...node,
            isSelected: node.id === selectedNodeId,
          },
        });
        
        x += nodeWidth + NODE_SPACING;
      });
    });

    // Create edges with relationship labels
    const edges: Edge[] = data.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.relationship,
      labelStyle: { fill: 'hsl(var(--muted-foreground))', fontSize: 10 },
      labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.8 },
      style: {
        stroke: 'hsl(var(--muted-foreground))',
        strokeWidth: 1.5,
      },
      type: 'smoothstep',
    }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [data, selectedNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when selection changes
  React.useEffect(() => {
    setNodes(nodes => nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        isSelected: node.id === selectedNodeId,
      },
    })));
  }, [selectedNodeId, setNodes]);

  // Update nodes and edges when data changes
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const campaignNode = data?.nodes.find(n => n.id === node.id);
    onNodeSelect(campaignNode || null);
  }, [data, onNodeSelect]);

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 mx-auto rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <p className="font-mono text-sm">No campaign extracted</p>
            <p className="text-xs mt-1">Upload campaign notes to get started</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {/* Row Labels */}
      <div className="absolute left-4 top-0 z-10 flex flex-col pointer-events-none">
        <div className="h-[100px]" /> {/* Padding */}
        <div className="h-[180px] flex items-center">
          <span className="text-xs font-mono text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Locations
          </span>
        </div>
        <div className="h-[180px] flex items-center">
          <span className="text-xs font-mono text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Happenings
          </span>
        </div>
        <div className="h-[180px] flex items-center">
          <span className="text-xs font-mono text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Characters / Monsters / Items
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
