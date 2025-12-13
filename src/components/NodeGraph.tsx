import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  EdgeProps,
  getBezierPath,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Plus, Link2 } from 'lucide-react';
import { CampaignData, CampaignEntity, EntityTypeDef, getEntityColor } from '@/types/mindmap';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface NodeGraphProps {
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  onEntitySelect: (entity: CampaignEntity | null) => void;
  selectedEntityId: string | null;
  onAddEntity?: (typeDef: EntityTypeDef) => void;
  onConnectionCreate?: (sourceEntityId: string, targetEntityId: string) => void;
  onConnectionDelete?: (sourceEntityId: string, targetEntityId: string) => void;
}

// Custom circular node component
function CircleNode({ data }: NodeProps<{ entity: CampaignEntity; color: string; isSelected: boolean; connectionCount: number; isConnectionSource?: boolean }>) {
  const size = 50 + Math.min(data.connectionCount * 5, 20);
  
  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <div className="flex flex-col items-center relative">
        {/* Label positioned above the circle */}
        <span 
          className="text-[10px] font-serif text-center max-w-[120px] leading-tight absolute z-10"
          style={{ 
            color: 'hsl(var(--foreground))',
            textShadow: '0 1px 3px hsl(var(--background)), 0 0 6px hsl(var(--background))',
            top: -20,
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
          }}
        >
          {data.entity.name.length > 30 ? data.entity.name.slice(0, 28) + '...' : data.entity.name}
        </span>
        <div
          className={cn(
            "rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer",
            "border-2 shadow-lg hover:scale-110",
            data.isSelected && "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110",
            data.isConnectionSource && "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
          )}
          style={{
            width: size,
            height: size,
            backgroundColor: data.color,
            borderColor: data.isSelected || data.isConnectionSource ? 'white' : 'transparent',
            boxShadow: `0 4px ${data.isSelected || data.isConnectionSource ? 20 : 10}px ${data.color}40`,
          }}
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </>
  );
}

const nodeTypes = {
  circle: CircleNode,
};

function NodeGraphInner({ 
  data, 
  entityTypes,
  onEntitySelect,
  selectedEntityId,
  onAddEntity,
  onConnectionCreate,
  onConnectionDelete,
}: NodeGraphProps) {
  const { fitView } = useReactFlow();
  const filterChangeRef = useRef(0);
  // Filter state for entity types
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  // Selected edge state
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  // Connection tool mode
  const [connectionMode, setConnectionMode] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  
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

  // Filter entities based on hiddenTypes
  const filteredData = useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      entities: data.entities.filter(e => !hiddenTypes.has(e.type)),
    };
  }, [data, hiddenTypes]);

  // Filter connectionMap based on visible entities
  const filteredConnectionMap = useMemo(() => {
    if (!filteredData) return new Map();
    const visibleIds = new Set(filteredData.entities.map(e => e.id));
    const filtered = new Map<string, Set<string>>();
    
    connectionMap.forEach((connected, entityId) => {
      if (!visibleIds.has(entityId)) return;
      const filteredConnected = new Set<string>();
      connected.forEach(targetId => {
        if (visibleIds.has(targetId)) {
          filteredConnected.add(targetId);
        }
      });
      if (filteredConnected.size > 0) {
        filtered.set(entityId, filteredConnected);
      }
    });
    
    return filtered;
  }, [filteredData, connectionMap]);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!filteredData || entityTypes.length === 0) return { initialNodes: [], initialEdges: [] };

    // Group entities by type for clustering
    const entityGroups = new Map<string, CampaignEntity[]>();
    filteredData.entities.forEach(entity => {
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
    // Base pull strength decreases with more total connections to prevent cramping
    const totalConnections = Array.from(filteredConnectionMap.values()).reduce((sum, set) => sum + set.size, 0);
    const basePullStrength = Math.max(0.03, 0.12 - (totalConnections * 0.002));
    
    const iterations = 6;
    for (let iter = 0; iter < iterations; iter++) {
      filteredConnectionMap.forEach((connected, entityId) => {
        const pos = positions.get(entityId);
        if (!pos) return;
        
        const connCount = connected.size;
        connected.forEach(targetId => {
          const targetPos = positions.get(targetId);
          if (!targetPos) return;
          
          // More connections for this node = stronger pull, but base is dampened by overall count
          const pullStrength = basePullStrength + (connCount * 0.02);
          const midX = (pos.x + targetPos.x) / 2;
          const midY = (pos.y + targetPos.y) / 2;
          
          positions.set(entityId, {
            x: pos.x + (midX - pos.x) * pullStrength,
            y: pos.y + (midY - pos.y) * pullStrength,
          });
        });
      });
    }

    // Anti-cramping: push nodes apart if they're too close
    const minDistance = 80;
    const repulsionIterations = 3;
    for (let iter = 0; iter < repulsionIterations; iter++) {
      const posArray = Array.from(positions.entries());
      for (let i = 0; i < posArray.length; i++) {
        for (let j = i + 1; j < posArray.length; j++) {
          const [idA, posA] = posArray[i];
          const [idB, posB] = posArray[j];
          
          const dx = posB.x - posA.x;
          const dy = posB.y - posA.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < minDistance && dist > 0) {
            const overlap = (minDistance - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            
            positions.set(idA, {
              x: posA.x - nx * overlap,
              y: posA.y - ny * overlap,
            });
            positions.set(idB, {
              x: posB.x + nx * overlap,
              y: posB.y + ny * overlap,
            });
          }
        }
      }
    }

    // Create nodes
    filteredData.entities.forEach(entity => {
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

    // Build edges with bezier curves
    const edges: Edge[] = [];
    const addedEdges = new Set<string>();
    
    // Check if edge connects to selected entity
    const isNodeHighlighted = (sourceId: string, targetId: string) => {
      return selectedEntityId && (sourceId === selectedEntityId || targetId === selectedEntityId);
    };
    
    filteredConnectionMap.forEach((connected, entityId) => {
      connected.forEach(targetId => {
        const edgeKey = [entityId, targetId].sort().join('-');
        if (!addedEdges.has(edgeKey)) {
          addedEdges.add(edgeKey);
          const isHighlighted = isNodeHighlighted(entityId, targetId);
          edges.push({
            id: edgeKey,
            source: entityId,
            target: targetId,
            data: { sourceId: entityId, targetId },
            style: { 
              stroke: isHighlighted ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground) / 0.3)', 
              strokeWidth: isHighlighted ? 3 : 1.5,
            },
            type: 'default',
          });
        }
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [filteredData, entityTypes, selectedEntityId, connectionCounts, filteredConnectionMap]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update node selection state
  React.useEffect(() => {
    setNodes(nodes => nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        isSelected: node.id === selectedEntityId,
        isConnectionSource: connectionMode && node.id === connectionSource,
      },
    })));
  }, [selectedEntityId, setNodes, connectionMode, connectionSource]);

  // Update edge selection highlighting
  React.useEffect(() => {
    setEdges(edges => edges.map(edge => ({
      ...edge,
      style: {
        ...edge.style,
        stroke: edge.id === selectedEdgeId 
          ? 'hsl(var(--destructive))' 
          : (selectedEntityId && (edge.source === selectedEntityId || edge.target === selectedEntityId))
            ? 'hsl(var(--foreground))'
            : 'hsl(var(--muted-foreground) / 0.3)',
        strokeWidth: edge.id === selectedEdgeId ? 4 : 
          (selectedEntityId && (edge.source === selectedEntityId || edge.target === selectedEntityId)) ? 3 : 1.5,
      },
    })));
  }, [selectedEdgeId, selectedEntityId, setEdges]);

  // Track previous entity count to detect filter vs connection changes
  const prevEntityCountRef = useRef(filteredData?.entities.length ?? 0);
  const prevHiddenTypesRef = useRef(hiddenTypes);

  // Auto fit view only when filters change or entities are added/removed (not connections)
  React.useEffect(() => {
    const currentCount = filteredData?.entities.length ?? 0;
    const hiddenTypesChanged = prevHiddenTypesRef.current !== hiddenTypes;
    const entityCountChanged = prevEntityCountRef.current !== currentCount;
    
    setNodes(initialNodes);
    setEdges(initialEdges);
    
    // Only fit view if filter changed or entity count changed (not just connection changes)
    if (hiddenTypesChanged || entityCountChanged) {
      setTimeout(() => {
        fitView({ padding: 0.4, duration: 300 });
      }, 50);
    }
    
    prevEntityCountRef.current = currentCount;
    prevHiddenTypesRef.current = hiddenTypes;
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView, filteredData?.entities.length, hiddenTypes]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    // If in connection mode, handle connection creation
    if (connectionMode && onConnectionCreate) {
      if (!connectionSource) {
        setConnectionSource(node.id);
        toast({ title: "Select second entity to connect" });
      } else if (connectionSource !== node.id) {
        onConnectionCreate(connectionSource, node.id);
        setConnectionSource(null);
        setConnectionMode(false);
        toast({ title: "Connection created" });
      }
      return;
    }
    
    setSelectedEdgeId(null);
    const entity = data?.entities.find(e => e.id === node.id);
    onEntitySelect(entity || null);
  }, [data, onEntitySelect, connectionMode, connectionSource, onConnectionCreate]);

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    if (connectionMode) return;
    setSelectedEdgeId(edge.id);
    onEntitySelect(null);
  }, [onEntitySelect, connectionMode]);

  const handlePaneClick = useCallback(() => {
    setSelectedEdgeId(null);
    if (connectionMode) {
      setConnectionSource(null);
      setConnectionMode(false);
    }
    onEntitySelect(null);
  }, [onEntitySelect, connectionMode]);

  // Handle backspace to delete selected edge
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && selectedEdgeId && onConnectionDelete) {
        const edge = edges.find(ed => ed.id === selectedEdgeId);
        if (edge) {
          onConnectionDelete(edge.source, edge.target);
          setSelectedEdgeId(null);
          toast({ title: "Connection deleted" });
        }
      }
      if (e.key === 'Escape') {
        setSelectedEdgeId(null);
        setConnectionSource(null);
        setConnectionMode(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEdgeId, edges, onConnectionDelete]);

  const toggleTypeFilter = useCallback((typeKey: string) => {
    setHiddenTypes(prev => {
      const next = new Set(prev);
      if (next.has(typeKey)) {
        next.delete(typeKey);
      } else {
        next.add(typeKey);
      }
      return next;
    });
  }, []);

  const toggleConnectionMode = useCallback(() => {
    setConnectionMode(prev => !prev);
    setConnectionSource(null);
    setSelectedEdgeId(null);
    if (!connectionMode) {
      toast({ title: "Connection mode", description: "Click two entities to connect them" });
    }
  }, [connectionMode]);

  // Get unique entity types from data
  const presentTypes = useMemo(() => {
    if (!data) return [];
    const types = new Set(data.entities.map(e => e.type));
    return entityTypes.filter(t => types.has(t.key));
  }, [data, entityTypes]);

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
    <div className="h-full relative" tabIndex={0}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesUpdatable={false}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background color="hsl(var(--border))" gap={30} size={1} />
        <Controls className="!bg-card !border-border" />
      </ReactFlow>
      
      {/* Connection mode button - bottom left */}
      {onConnectionCreate && (
        <div className="absolute bottom-4 left-4 z-10">
          <Button
            variant={connectionMode ? "default" : "outline"}
            size="sm"
            onClick={toggleConnectionMode}
            className={cn(
              "font-serif",
              connectionMode && "bg-primary text-primary-foreground"
            )}
          >
            <Link2 className="w-4 h-4 mr-1" />
            {connectionMode ? (connectionSource ? "Select target..." : "Select source...") : "Connect"}
          </Button>
        </div>
      )}
      
      {/* Selected edge hint */}
      {selectedEdgeId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-xs font-serif text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-foreground">Backspace</kbd> to delete connection
        </div>
      )}
      
      {/* Type filter buttons at bottom center */}
      {presentTypes.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 bg-card/80 backdrop-blur-sm border border-border rounded-lg p-2">
          {presentTypes.map(typeDef => {
            const isHidden = hiddenTypes.has(typeDef.key);
            return (
              <button
                key={typeDef.key}
                onClick={() => toggleTypeFilter(typeDef.key)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-all duration-200",
                  isHidden ? "opacity-30 scale-90" : "opacity-100 scale-100 hover:scale-110"
                )}
                style={{
                  backgroundColor: typeDef.color,
                  borderColor: isHidden ? 'transparent' : 'white',
                }}
                title={`${isHidden ? 'Show' : 'Hide'} ${typeDef.label}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NodeGraph(props: NodeGraphProps) {
  return (
    <ReactFlowProvider>
      <NodeGraphInner {...props} />
    </ReactFlowProvider>
  );
}