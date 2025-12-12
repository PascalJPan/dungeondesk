import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { CampaignData, CampaignEntity, EntityTypeDef, getEntityColor } from '@/types/mindmap';
import { Button } from '@/components/ui/button';

interface NodeGraphProps {
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  onEntitySelect: (entity: CampaignEntity | null) => void;
  selectedEntityId: string | null;
  onAddEntity?: (typeDef: EntityTypeDef) => void;
}

interface NodePosition {
  x: number;
  y: number;
}

export function NodeGraph({ data, entityTypes, onEntitySelect, selectedEntityId, onAddEntity }: NodeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [positions, setPositions] = useState<Map<string, NodePosition>>(new Map());
  const [dragging, setDragging] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const entities = data?.entities || [];

  // Build connections map and count
  const { connections, connectionCounts } = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const counts = new Map<string, number>();
    
    entities.forEach(entity => {
      counts.set(entity.id, 0);
    });
    
    entities.forEach(entity => {
      if (!entity.associatedEntities) return;
      const assocs = entity.associatedEntities.split(',').map((s: string) => s.trim()).filter(Boolean);
      assocs.forEach((assocName: string) => {
        const linked = entities.find(e => e.name.toLowerCase() === assocName.toLowerCase());
        if (linked) {
          if (!map.has(entity.id)) map.set(entity.id, new Set());
          if (!map.has(linked.id)) map.set(linked.id, new Set());
          map.get(entity.id)!.add(linked.id);
          map.get(linked.id)!.add(entity.id);
          counts.set(entity.id, (counts.get(entity.id) || 0) + 1);
          counts.set(linked.id, (counts.get(linked.id) || 0) + 1);
        }
      });
    });
    return { connections: map, connectionCounts: counts };
  }, [entities]);

  // Sort entities by connection count (most connected first)
  const sortedEntities = useMemo(() => {
    return [...entities].sort((a, b) => 
      (connectionCounts.get(b.id) || 0) - (connectionCounts.get(a.id) || 0)
    );
  }, [entities, connectionCounts]);

  // Calculate static positions - connected entities closer together
  useEffect(() => {
    if (!containerRef.current || entities.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const newPositions = new Map<string, NodePosition>();
    const placed = new Set<string>();

    // Place entities in layers based on connections
    const layers: string[][] = [];
    const remaining = new Set(sortedEntities.map(e => e.id));
    
    // First layer: most connected entities
    if (sortedEntities.length > 0) {
      const firstLayerCount = Math.min(Math.ceil(sortedEntities.length / 4), 5);
      layers.push(sortedEntities.slice(0, firstLayerCount).map(e => e.id));
      layers[0].forEach(id => remaining.delete(id));
    }

    // Subsequent layers: entities connected to previous layers
    while (remaining.size > 0) {
      const layer: string[] = [];
      const prevLayer = layers[layers.length - 1] || [];
      
      remaining.forEach(id => {
        const conns = connections.get(id);
        if (!conns) {
          layer.push(id);
          return;
        }
        const hasConnectionToPrev = prevLayer.some(prevId => conns.has(prevId));
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
    layers.forEach((layer, layerIdx) => {
      const radius = 80 + layerIdx * 120;
      layer.forEach((entityId, i) => {
        const angle = (2 * Math.PI * i) / layer.length - Math.PI / 2;
        newPositions.set(entityId, {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        });
        placed.add(entityId);
      });
    });

    setPositions(newPositions);
  }, [entities.length, sortedEntities, connections]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(pan.x, pan.y);

    // Draw connections
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    connections.forEach((connected, entityId) => {
      const pos = positions.get(entityId);
      if (!pos) return;
      connected.forEach(otherId => {
        const otherPos = positions.get(otherId);
        if (!otherPos || otherId < entityId) return;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(otherPos.x, otherPos.y);
        ctx.stroke();
      });
    });

    // Draw nodes
    entities.forEach(entity => {
      const pos = positions.get(entity.id);
      if (!pos) return;

      const color = getEntityColor(entityTypes, entity.type);
      const isSelected = entity.id === selectedEntityId;
      const connectionCount = connectionCounts.get(entity.id) || 0;
      const radius = 16 + Math.min(connectionCount * 2, 10);

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = entity.name.length > 12 ? entity.name.slice(0, 10) + '...' : entity.name;
      ctx.fillText(name, pos.x, pos.y + radius + 12);
    });

    ctx.restore();
  }, [positions, entities, entityTypes, selectedEntityId, connections, connectionCounts, pan]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left - pan.x;
    const y = e.clientY - rect.top - pan.y;

    // Check if clicking on a node
    for (const entity of entities) {
      const pos = positions.get(entity.id);
      if (!pos) continue;
      const dx = x - pos.x;
      const dy = y - pos.y;
      const connectionCount = connectionCounts.get(entity.id) || 0;
      const radius = 16 + Math.min(connectionCount * 2, 10);
      if (dx * dx + dy * dy < radius * radius) {
        setDragging(entity.id);
        setOffset({ x: dx, y: dy });
        onEntitySelect(entity);
        return;
      }
    }

    // Start panning
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [entities, positions, connectionCounts, pan, onEntitySelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (!dragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left - pan.x - offset.x;
    const y = e.clientY - rect.top - pan.y - offset.y;

    setPositions(prev => {
      const newPos = new Map(prev);
      newPos.set(dragging, { x, y });
      return newPos;
    });
  }, [dragging, offset, pan, isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setIsPanning(false);
  }, []);

  if (!data || entities.length === 0) {
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
    <div 
      ref={containerRef} 
      className="h-full w-full relative cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
