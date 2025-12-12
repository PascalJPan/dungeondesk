import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CampaignData, CampaignEntity, EntityTypeDef, getEntityColor } from '@/types/mindmap';

interface NodeGraphProps {
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  onEntitySelect: (entity: CampaignEntity | null) => void;
  selectedEntityId: string | null;
}

interface NodePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function NodeGraph({ data, entityTypes, onEntitySelect, selectedEntityId }: NodeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [positions, setPositions] = useState<Map<string, NodePosition>>(new Map());
  const [dragging, setDragging] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const entities = data?.entities || [];

  // Build connections map
  const connections = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
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
        }
      });
    });
    return map;
  }, [entities]);

  // Initialize positions
  useEffect(() => {
    if (!containerRef.current || entities.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const newPositions = new Map<string, NodePosition>();

    entities.forEach((entity, i) => {
      const angle = (2 * Math.PI * i) / entities.length;
      const radius = Math.min(width, height) * 0.3;
      newPositions.set(entity.id, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      });
    });

    setPositions(newPositions);
  }, [entities.length]);

  // Force-directed simulation
  useEffect(() => {
    if (positions.size === 0) return;

    const simulate = () => {
      setPositions(prev => {
        const newPos = new Map(prev);
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        const centerX = width / 2;
        const centerY = height / 2;

        // Apply forces
        entities.forEach(entity => {
          const pos = newPos.get(entity.id);
          if (!pos || dragging === entity.id) return;

          let fx = 0, fy = 0;

          // Repulsion from all other nodes
          entities.forEach(other => {
            if (other.id === entity.id) return;
            const otherPos = newPos.get(other.id);
            if (!otherPos) return;

            const dx = pos.x - otherPos.x;
            const dy = pos.y - otherPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 5000 / (dist * dist);
            fx += (dx / dist) * force;
            fy += (dy / dist) * force;
          });

          // Attraction to connected nodes
          const connected = connections.get(entity.id);
          if (connected) {
            connected.forEach(otherId => {
              const otherPos = newPos.get(otherId);
              if (!otherPos) return;

              const dx = otherPos.x - pos.x;
              const dy = otherPos.y - pos.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = (dist - 150) * 0.05;
              fx += (dx / dist) * force;
              fy += (dy / dist) * force;
            });
          }

          // Gravity towards center
          const dx = centerX - pos.x;
          const dy = centerY - pos.y;
          fx += dx * 0.001;
          fy += dy * 0.001;

          // Update velocity and position
          pos.vx = (pos.vx + fx) * 0.9;
          pos.vy = (pos.vy + fy) * 0.9;
          pos.x += pos.vx;
          pos.y += pos.vy;

          // Keep in bounds
          pos.x = Math.max(50, Math.min(width - 50, pos.x));
          pos.y = Math.max(50, Math.min(height - 50, pos.y));
        });

        return newPos;
      });

      animationRef.current = requestAnimationFrame(simulate);
    };

    animationRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [positions.size, entities, connections, dragging]);

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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    connections.forEach((connected, entityId) => {
      const pos = positions.get(entityId);
      if (!pos) return;
      connected.forEach(otherId => {
        const otherPos = positions.get(otherId);
        if (!otherPos || otherId < entityId) return; // Draw each line once
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
      const connectionCount = connections.get(entity.id)?.size || 0;
      const radius = 20 + Math.min(connectionCount * 3, 15);

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
      ctx.font = '12px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = entity.name.length > 15 ? entity.name.slice(0, 12) + '...' : entity.name;
      ctx.fillText(name, pos.x, pos.y + radius + 15);
    });

    ctx.restore();
  }, [positions, entities, entityTypes, selectedEntityId, connections, pan]);

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
      const connectionCount = connections.get(entity.id)?.size || 0;
      const radius = 20 + Math.min(connectionCount * 3, 15);
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
  }, [entities, positions, connections, pan, onEntitySelect]);

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
      const pos = newPos.get(dragging);
      if (pos) {
        pos.x = x;
        pos.y = y;
        pos.vx = 0;
        pos.vy = 0;
      }
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
          <p className="font-display text-sm">No campaign data</p>
          <p className="text-xs mt-1 font-serif">Add entities to see the node graph</p>
        </div>
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
