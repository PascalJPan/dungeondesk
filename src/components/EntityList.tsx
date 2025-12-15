import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Plus, Search, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CampaignData, CampaignEntity, EntityTypeDef, getEntityColor } from '@/types/mindmap';
import { cn } from '@/lib/utils';

interface EntityListProps {
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  selectedEntityId: string | null;
  selectedEntityIds?: Set<string>;
  onSelectEntity: (entity: CampaignEntity | null) => void;
  onMultiSelectEntity?: (entityId: string, isCtrlKey: boolean) => void;
  onAddEntity?: (typeDef: EntityTypeDef) => void;
}

export function EntityList({ 
  data, 
  entityTypes, 
  selectedEntityId, 
  selectedEntityIds,
  onSelectEntity, 
  onMultiSelectEntity,
  onAddEntity 
}: EntityListProps) {
  const [openSections, setOpenSections] = React.useState<string[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showNeedsReviewOnly, setShowNeedsReviewOnly] = React.useState(false);

  const toggleSection = (key: string) => {
    setOpenSections(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  if (!data || data.entities.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-6">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
            <span className="text-3xl">📜</span>
          </div>
          <div>
            <p className="font-display text-sm">No entities yet</p>
            <p className="text-xs mt-1 font-serif">Add entities using the + buttons below</p>
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
      </div>
    );
  }

  // Group entities by type and sort within each group
  const entityGroups: Record<string, CampaignEntity[]> = {};
  entityTypes.forEach(t => {
    entityGroups[t.key] = [];
  });

  data.entities.forEach(entity => {
    if (entityGroups[entity.type]) {
      entityGroups[entity.type].push(entity);
    }
  });

  // Sort entities within each group alphabetically by name
  Object.keys(entityGroups).forEach(key => {
    entityGroups[key].sort((a, b) => a.name.localeCompare(b.name));
  });

  // Filter entities by search query and review status
  const filteredGroups: Record<string, CampaignEntity[]> = {};
  const query = searchQuery.toLowerCase().trim();
  
  entityTypes.forEach(typeDef => {
    const entities = entityGroups[typeDef.key] || [];
    let filtered = entities;
    
    // Filter by review status first
    if (showNeedsReviewOnly) {
      filtered = filtered.filter(e => e.review === false);
    }
    
    // Then filter by search query
    if (query) {
      filtered = filtered.filter(e => 
        e.name.toLowerCase().includes(query) ||
        (e.shortDescription && e.shortDescription.toLowerCase().includes(query))
      );
    }
    
    filteredGroups[typeDef.key] = filtered;
  });

  // Count entities needing review
  const needsReviewCount = data.entities.filter(e => e.review === false).length;

  const handleEntityClick = (entity: CampaignEntity, e: React.MouseEvent) => {
    if (onMultiSelectEntity && (e.ctrlKey || e.metaKey)) {
      onMultiSelectEntity(entity.id, true);
    } else {
      onSelectEntity(entity);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <div className="p-2 border-b border-border shrink-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entities..."
              className="pl-8 h-8 text-sm font-serif"
            />
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  pressed={showNeedsReviewOnly}
                  onPressedChange={setShowNeedsReviewOnly}
                  size="sm"
                  className="h-8 px-2 data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-600"
                  aria-label="Filter by review status"
                >
                  <AlertCircle className="w-4 h-4" />
                  {needsReviewCount > 0 && (
                    <span className="ml-1 text-xs">{needsReviewCount}</span>
                  )}
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show only entities needing review ({needsReviewCount})</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {entityTypes.map(typeDef => {
            const entities = filteredGroups[typeDef.key] || [];
            const totalCount = entityGroups[typeDef.key]?.length || 0;
            const isOpen = openSections.includes(typeDef.key) || (query && entities.length > 0) || (showNeedsReviewOnly && entities.length > 0);

            // Hide empty sections when filtering
            if ((query || showNeedsReviewOnly) && entities.length === 0) return null;

            return (
              <Collapsible 
                key={typeDef.key} 
                open={isOpen}
                onOpenChange={() => toggleSection(typeDef.key)}
              >
                <CollapsibleTrigger className="w-full">
                  <div 
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors",
                      isOpen && "bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: typeDef.color }}
                      />
                      <span className="font-medium text-sm font-serif">{typeDef.label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({query || showNeedsReviewOnly ? `${entities.length}/${totalCount}` : totalCount})
                      </span>
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform",
                      isOpen && "rotate-180"
                    )} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pl-4 pr-2 py-1 space-y-1">
                    {entities.map(entity => {
                      const isSelected = selectedEntityId === entity.id || selectedEntityIds?.has(entity.id);
                      return (
                        <button
                          key={entity.id}
                          onClick={(e) => handleEntityClick(entity, e)}
                          className={cn(
                            "w-full text-left p-2 rounded-lg transition-colors",
                            "hover:bg-muted/50",
                            isSelected && "bg-primary/10 border border-primary/30"
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm truncate font-serif flex-1">{entity.name}</p>
                            {entity.review === false && (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 font-serif">
                            {entity.shortDescription || 'No description'}
                          </p>
                        </button>
                      );
                    })}
                    {onAddEntity && !query && !showNeedsReviewOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground hover:text-foreground font-serif"
                        onClick={() => onAddEntity(typeDef)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add {typeDef.label.endsWith('s') ? typeDef.label.slice(0, -1) : typeDef.label}
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
