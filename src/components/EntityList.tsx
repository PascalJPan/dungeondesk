import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CampaignData, CampaignEntity, EntityTypeDef, getEntityColor } from '@/types/mindmap';
import { cn } from '@/lib/utils';

interface EntityListProps {
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  selectedEntityId: string | null;
  onSelectEntity: (entity: CampaignEntity | null) => void;
  onAddEntity?: (typeDef: EntityTypeDef) => void;
}

export function EntityList({ data, entityTypes, selectedEntityId, onSelectEntity, onAddEntity }: EntityListProps) {
  const [openSections, setOpenSections] = React.useState<string[]>(entityTypes.map(t => t.key));

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

  // Group entities by type
  const entityGroups: Record<string, CampaignEntity[]> = {};
  entityTypes.forEach(t => {
    entityGroups[t.key] = [];
  });

  data.entities.forEach(entity => {
    if (entityGroups[entity.type]) {
      entityGroups[entity.type].push(entity);
    }
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {entityTypes.map(typeDef => {
          const entities = entityGroups[typeDef.key] || [];
          const isOpen = openSections.includes(typeDef.key);

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
  );
}
