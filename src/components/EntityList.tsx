import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CampaignData, CampaignEntity, EntityType, ENTITY_TYPE_INFO } from '@/types/mindmap';
import { cn } from '@/lib/utils';

interface EntityListProps {
  data: CampaignData | null;
  selectedEntityId: string | null;
  onSelectEntity: (entity: CampaignEntity | null) => void;
  onAddEntity?: (type: EntityType) => void;
}

export function EntityList({ data, selectedEntityId, onSelectEntity, onAddEntity }: EntityListProps) {
  const [openSections, setOpenSections] = React.useState<EntityType[]>(['location', 'happening', 'character', 'monster', 'item']);

  const toggleSection = (type: EntityType) => {
    setOpenSections(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
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
            <p className="font-display text-sm">No campaign data</p>
            <p className="text-xs mt-1 font-serif">Extract campaign notes to see entities</p>
          </div>
        </div>
      </div>
    );
  }

  // Group entities by type
  const entityGroups: Record<EntityType, CampaignEntity[]> = {
    location: [],
    happening: [],
    character: [],
    monster: [],
    item: [],
  };

  data.entities.forEach(entity => {
    entityGroups[entity.type].push(entity);
  });

  const entityTypes: EntityType[] = ['location', 'happening', 'character', 'monster', 'item'];

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {entityTypes.map(type => {
          const entities = entityGroups[type];
          const typeInfo = ENTITY_TYPE_INFO[type];
          const isOpen = openSections.includes(type);

          return (
            <Collapsible 
              key={type} 
              open={isOpen}
              onOpenChange={() => toggleSection(type)}
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
                      style={{ backgroundColor: typeInfo.color }}
                    />
                    <span className="font-medium text-sm font-serif">{typeInfo.label}</span>
                    <span className="text-xs text-muted-foreground">({entities.length})</span>
                  </div>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                  )} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pl-4 pr-2 py-1 space-y-1">
                  {entities.map(entity => (
                    <button
                      key={entity.id}
                      onClick={() => onSelectEntity(entity)}
                      className={cn(
                        "w-full text-left p-2 rounded-lg transition-colors",
                        "hover:bg-muted/50",
                        selectedEntityId === entity.id && "bg-primary/10 border border-primary/30"
                      )}
                    >
                      <p className="font-medium text-sm truncate font-serif">{entity.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 font-serif">
                        {entity.shortDescription || 'No description'}
                      </p>
                    </button>
                  ))}
                  {onAddEntity && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground hover:text-foreground font-serif"
                      onClick={() => onAddEntity(type)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add {typeInfo.label.slice(0, -1)}
                    </Button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </ScrollArea>
  );
}
