import React, { useCallback } from 'react';
import { X, Plus } from 'lucide-react';
import { CampaignData, CampaignEntity, EntityTypeDef, getEntityColor } from '@/types/mindmap';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface PlacedCard {
  entityId: string;
  row: number;
  col: number;
}

interface TableViewProps {
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  onEntitySelect: (entity: CampaignEntity | null) => void;
  selectedEntityId: string | null;
  // Lifted state
  placedCards: PlacedCard[];
  setPlacedCards: React.Dispatch<React.SetStateAction<PlacedCard[]>>;
}

// Fixed 4x4 grid = 16 squares
const GRID_ROWS = 4;
const GRID_COLS = 4;

export function TableView({ 
  data, 
  entityTypes, 
  onEntitySelect, 
  selectedEntityId,
  placedCards,
  setPlacedCards,
}: TableViewProps) {
  const [hoveredCell, setHoveredCell] = React.useState<{ row: number; col: number } | null>(null);
  const [openPopover, setOpenPopover] = React.useState<{ row: number; col: number } | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

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
  }, [setPlacedCards]);

  const handleRemoveCard = useCallback((row: number, col: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlacedCards(prev => prev.filter(c => !(c.row === row && c.col === col)));
  }, [setPlacedCards]);

  const handleCardClick = useCallback((entity: CampaignEntity) => {
    onEntitySelect(entity);
  }, [onEntitySelect]);

  // Filter and sort entities by type then alphabetically
  const filteredEntities = entities
    .filter(entity => entity.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const typeCompare = a.type.localeCompare(b.type);
      if (typeCompare !== 0) return typeCompare;
      return a.name.localeCompare(b.name);
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
      <div className="flex-1 flex items-center justify-center">
        <div 
          className="grid gap-3"
          style={{ 
            gridTemplateColumns: `repeat(${GRID_COLS}, 140px)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 180px)`,
          }}
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
                  "rounded-lg transition-all relative",
                  entity 
                    ? "border-2 border-solid bg-card" 
                    : "border-2 border-dashed border-border/50 bg-muted/10 hover:border-primary/50 hover:bg-muted/20"
                )}
                style={entity ? { borderColor: getEntityColor(entityTypes, entity.type) } : undefined}
                onMouseEnter={() => setHoveredCell({ row, col })}
                onMouseLeave={() => setHoveredCell(null)}
              >
                {entity ? (
                  <div 
                    className={cn(
                      "h-full p-2 flex flex-col cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 rounded-md",
                      selectedEntityId === entity.id && "ring-2 ring-primary"
                    )}
                    onClick={() => handleCardClick(entity)}
                  >
                    {/* Remove button */}
                    <button
                      className={cn(
                        "absolute -top-2 -right-2 w-5 h-5 rounded-full bg-muted border border-border text-muted-foreground flex items-center justify-center transition-opacity hover:bg-background z-10",
                        isHovered ? "opacity-100" : "opacity-0"
                      )}
                      onClick={(e) => handleRemoveCard(row, col, e)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    
                    {/* Entity name */}
                    <p className="font-serif font-medium text-sm text-foreground line-clamp-2">
                      {entity.name}
                    </p>
                    
                    {/* Short description */}
                    {entity.shortDescription && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-4 font-serif flex-1">
                        {entity.shortDescription}
                      </p>
                    )}
                    
                    {/* Entity type badge - bottom right, subtle */}
                    <div className="mt-auto flex justify-end">
                      <span 
                        className="text-[10px] text-muted-foreground/60 font-serif"
                      >
                        {entityTypes.find(t => t.key === entity.type)?.label || entity.type}
                      </span>
                    </div>
                  </div>
                ) : (
                  <Popover 
                    open={isPopoverOpen} 
                    onOpenChange={(open) => {
                      setOpenPopover(open ? { row, col } : null);
                      if (!open) {
                        setSearchTerm('');
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
                    <PopoverContent className="w-64 p-2 z-50 bg-popover" align="start">
                      <div className="space-y-2">
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