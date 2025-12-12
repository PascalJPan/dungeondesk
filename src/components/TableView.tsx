import React, { useState, useCallback } from 'react';
import { X, Plus } from 'lucide-react';
import { CampaignData, CampaignEntity, EntityTypeDef, getEntityColor } from '@/types/mindmap';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface TableViewProps {
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  onEntitySelect: (entity: CampaignEntity | null) => void;
  selectedEntityId: string | null;
}

interface PlacedCard {
  entityId: string;
  row: number;
  col: number;
}

const GRID_ROWS = 6;
const GRID_COLS = 8;

export function TableView({ data, entityTypes, onEntitySelect, selectedEntityId }: TableViewProps) {
  const [placedCards, setPlacedCards] = useState<PlacedCard[]>([]);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [openPopover, setOpenPopover] = useState<{ row: number; col: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const entities = data?.entities || [];
  const hasEntities = entities.length > 0;

  const getCardAt = useCallback((row: number, col: number) => {
    const placed = placedCards.find(c => c.row === row && c.col === col);
    if (!placed) return null;
    return entities.find(e => e.id === placed.entityId) || null;
  }, [placedCards, entities]);

  const handlePlaceCard = useCallback((entityId: string, row: number, col: number) => {
    // Remove if already placed elsewhere
    setPlacedCards(prev => {
      const filtered = prev.filter(c => c.entityId !== entityId);
      return [...filtered, { entityId, row, col }];
    });
    setOpenPopover(null);
    setSearchTerm('');
    setSelectedType(null);
  }, []);

  const handleRemoveCard = useCallback((row: number, col: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlacedCards(prev => prev.filter(c => !(c.row === row && c.col === col)));
  }, []);

  const handleCardClick = useCallback((entity: CampaignEntity) => {
    onEntitySelect(entity);
  }, [onEntitySelect]);

  const filteredEntities = entities.filter(entity => {
    const matchesSearch = entity.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !selectedType || entity.type === selectedType;
    return matchesSearch && matchesType;
  });

  if (!hasEntities) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground">
        <div className="w-20 h-20 mx-auto rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
          <span className="text-3xl">🎲</span>
        </div>
        <div className="mt-4 text-center">
          <p className="font-display text-sm">No entities yet</p>
          <p className="text-xs mt-1 font-serif">Add entities from the List or Nodes view first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <div className="text-center mb-4">
        <h2 className="font-display text-lg text-foreground">DM Table</h2>
        <p className="text-xs text-muted-foreground font-serif">Place important entities for quick reference</p>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div 
          className="grid gap-2 min-w-max"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(120px, 1fr))` }}
        >
          {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, idx) => {
            const row = Math.floor(idx / GRID_COLS);
            const col = idx % GRID_COLS;
            const entity = getCardAt(row, col);
            const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
            const isPopoverOpen = openPopover?.row === row && openPopover?.col === col;

            return (
              <div
                key={`${row}-${col}`}
                className={cn(
                  "aspect-[3/4] min-h-[100px] rounded-lg border-2 border-dashed transition-all relative",
                  entity 
                    ? "border-solid border-border bg-card" 
                    : "border-border/50 bg-muted/10 hover:border-primary/50 hover:bg-muted/20"
                )}
                onMouseEnter={() => setHoveredCell({ row, col })}
                onMouseLeave={() => setHoveredCell(null)}
              >
                {entity ? (
                  <div 
                    className={cn(
                      "h-full p-2 flex flex-col cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 rounded-lg",
                      selectedEntityId === entity.id && "ring-2 ring-primary"
                    )}
                    onClick={() => handleCardClick(entity)}
                  >
                    {/* Remove button */}
                    <button
                      className={cn(
                        "absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center transition-opacity",
                        isHovered ? "opacity-100" : "opacity-0"
                      )}
                      onClick={(e) => handleRemoveCard(row, col, e)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    
                    {/* Color indicator */}
                    <div 
                      className="w-full h-1.5 rounded-full mb-2"
                      style={{ backgroundColor: getEntityColor(entityTypes, entity.type) }}
                    />
                    
                    {/* Entity name */}
                    <p className="font-serif font-medium text-sm text-foreground line-clamp-2">
                      {entity.name}
                    </p>
                    
                    {/* Entity type */}
                    <p className="text-xs text-muted-foreground mt-auto">
                      {entityTypes.find(t => t.key === entity.type)?.label || entity.type}
                    </p>
                  </div>
                ) : (
                  <Popover 
                    open={isPopoverOpen} 
                    onOpenChange={(open) => {
                      setOpenPopover(open ? { row, col } : null);
                      if (!open) {
                        setSearchTerm('');
                        setSelectedType(null);
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button 
                        className={cn(
                          "w-full h-full flex items-center justify-center transition-opacity",
                          isHovered ? "opacity-100" : "opacity-0"
                        )}
                      >
                        <Plus className="w-6 h-6 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <div className="space-y-2">
                        {/* Type filter */}
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            variant={selectedType === null ? "secondary" : "ghost"}
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => setSelectedType(null)}
                          >
                            All
                          </Button>
                          {entityTypes.map(type => (
                            <Button
                              key={type.key}
                              variant={selectedType === type.key ? "secondary" : "ghost"}
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => setSelectedType(type.key)}
                            >
                              <span 
                                className="w-2 h-2 rounded-full mr-1"
                                style={{ backgroundColor: type.color }}
                              />
                              {type.label}
                            </Button>
                          ))}
                        </div>
                        
                        {/* Search */}
                        <Input
                          placeholder="Search entities..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="h-8 text-sm"
                        />
                        
                        {/* Entity list */}
                        <ScrollArea className="h-48">
                          <div className="space-y-1">
                            {filteredEntities.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">
                                No entities found
                              </p>
                            ) : (
                              filteredEntities.map(entity => (
                                <button
                                  key={entity.id}
                                  className="w-full text-left px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
                                  onClick={() => handlePlaceCard(entity.id, row, col)}
                                >
                                  <span 
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: getEntityColor(entityTypes, entity.type) }}
                                  />
                                  <span className="text-sm font-serif truncate">{entity.name}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
