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
import { MindMapData, GraphNode as MindMapNode } from '@/types/mindmap';
import { cn } from '@/lib/utils';

interface GraphVisualizationProps {
  data: MindMapData | null;
  similarityThreshold: number;
  onNodeSelect: (node: MindMapNode | null) => void;
  selectedNodeId: string | null;
}

// Custom node component
function ConceptNode({ data, selected }: NodeProps<MindMapNode & { isSelected: boolean }>) {
  const nodeSize = Math.min(Math.max(data.chunkCount * 8, 40), 120);
  
  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div
        className={cn(
          "rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer",
          "border-2 shadow-lg hover:scale-110",
          data.isSelected && "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110"
        )}
        style={{
          width: nodeSize,
          height: nodeSize,
          backgroundColor: data.color,
          borderColor: data.isSelected ? 'white' : 'transparent',
          boxShadow: `0 0 ${data.isSelected ? 30 : 15}px ${data.color}40`,
        }}
      >
        <span 
          className="text-xs font-medium text-center px-1 leading-tight"
          style={{ 
            color: 'white',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            maxWidth: nodeSize - 8,
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
  concept: ConceptNode,
};

export function GraphVisualization({ 
  data, 
  similarityThreshold, 
  onNodeSelect,
  selectedNodeId 
}: GraphVisualizationProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data) return { initialNodes: [], initialEdges: [] };

    // Apply force-directed positioning
    const nodes: Node[] = data.nodes.map((node, index) => {
      // Simple circular layout as initial positions
      const angle = (index / data.nodes.length) * 2 * Math.PI;
      const radius = 200 + Math.random() * 100;
      
      return {
        id: node.id,
        type: 'concept',
        position: {
          x: 400 + Math.cos(angle) * radius,
          y: 300 + Math.sin(angle) * radius,
        },
        data: {
          ...node,
          isSelected: node.id === selectedNodeId,
        },
      };
    });

    // Filter edges by threshold
    const edges: Edge[] = data.edges
      .filter(edge => edge.similarity >= similarityThreshold)
      .map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        style: {
          stroke: `hsl(var(--edge-default))`,
          strokeWidth: 1 + edge.similarity * 2,
          opacity: 0.3 + edge.similarity * 0.5,
        },
        animated: edge.similarity > 0.8,
      }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [data, similarityThreshold, selectedNodeId]);

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
    const mindMapNode = data?.nodes.find(n => n.id === node.id);
    onNodeSelect(mindMapNode || null);
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <p className="font-mono text-sm">No mindmap generated</p>
            <p className="text-xs mt-1">Upload text or PDF to get started</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
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
  );
}
