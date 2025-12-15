import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Plus, Minus, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  CampaignEntity, 
  EntityTypeDef,
  getEntityColor,
} from '@/types/mindmap';
import { cn } from '@/lib/utils';

interface EntityPanelProps {
  entity: CampaignEntity | null;
  entityTypes: EntityTypeDef[];
  entities: CampaignEntity[];
  onSave: (entity: CampaignEntity) => void;
  onDelete: (entityId: string) => void;
  onEntityClick: (entity: CampaignEntity) => void;
  onDuplicate?: (entity: CampaignEntity) => void;
}

export function EntityPanel({ 
  entity, 
  entityTypes, 
  entities, 
  onSave, 
  onDelete, 
  onEntityClick,
  onDuplicate,
}: EntityPanelProps) {
  const [editedEntity, setEditedEntity] = useState<CampaignEntity | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevEntityIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (entity) {
      setEditedEntity({ ...entity });
      
      // Only scroll to top when switching to a different entity
      if (prevEntityIdRef.current !== entity.id) {
        if (scrollAreaRef.current) {
          const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (viewport) {
            (viewport as HTMLElement).scrollTop = 0;
          }
        }
      }
      prevEntityIdRef.current = entity.id;
    } else {
      setEditedEntity(null);
      prevEntityIdRef.current = null;
    }
  }, [entity]);

  if (!entity || !editedEntity) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground">
        <BookOpen className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm text-center font-serif italic">
          Select an entity to view its details
        </p>
      </div>
    );
  }

  const typeDef = entityTypes.find(t => t.key === entity.type);
  const color = getEntityColor(entityTypes, entity.type);

  const handleFieldChange = (key: string, value: string) => {
    setEditedEntity(prev => prev ? { ...prev, [key]: value } : null);
  };

  const handleFieldBlur = () => {
    if (editedEntity) {
      onSave(editedEntity);
    }
  };

  // Get available entities to add as associations (exclude self and already associated)
  // Sorted by entity type order, then alphabetically by name
  const getAvailableEntities = () => {
    const currentAssocs = editedEntity?.associatedEntities
      ? editedEntity.associatedEntities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      : [];
    
    const available = entities.filter(e => 
      e.id !== entity.id && 
      !currentAssocs.includes(e.name.toLowerCase())
    );
    
    // Sort by entity type order, then alphabetically by name
    const typeOrder = new Map(entityTypes.map((t, i) => [t.key, i]));
    return available.sort((a, b) => {
      const typeA = typeOrder.get(a.type) ?? 999;
      const typeB = typeOrder.get(b.type) ?? 999;
      if (typeA !== typeB) return typeA - typeB;
      return a.name.localeCompare(b.name);
    });
  };

  const handleAddAssociation = (entityName: string) => {
    if (!editedEntity) return;
    
    const currentAssocs = editedEntity.associatedEntities
      ? editedEntity.associatedEntities.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    
    currentAssocs.push(entityName);
    const updated = { ...editedEntity, associatedEntities: currentAssocs.join(', ') };
    setEditedEntity(updated);
    onSave(updated);
  };

  const handleRemoveAssociation = (entityName: string) => {
    if (!editedEntity) return;
    
    const currentAssocs = editedEntity.associatedEntities
      ? editedEntity.associatedEntities.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    
    const filtered = currentAssocs.filter(a => a.toLowerCase() !== entityName.toLowerCase());
    const updated = { ...editedEntity, associatedEntities: filtered.join(', ') };
    setEditedEntity(updated);
    onSave(updated);
  };

  // Render associated entities section with +/- controls
  const renderAssociatedEntities = (value: string) => {
    const names = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
    const availableEntities = getAvailableEntities();
    
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {names.map((name, idx) => {
            const linkedEntity = entities.find(e => 
              e.name.toLowerCase() === name.toLowerCase()
            );
            const linkedColor = linkedEntity ? getEntityColor(entityTypes, linkedEntity.type) : undefined;
            
            return (
              <div key={idx} className="flex items-center gap-1 group">
                {linkedEntity ? (
                  <button
                    onClick={() => onEntityClick(linkedEntity)}
                    className={cn(
                      "text-sm font-serif px-2 py-1 rounded-md border transition-colors",
                      "hover:bg-muted/50 cursor-pointer"
                    )}
                    style={{ borderColor: linkedColor, color: linkedColor }}
                  >
                    {name}
                  </button>
                ) : (
                  <span className="text-sm font-serif text-muted-foreground px-2 py-1">
                    {name}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-50 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                  onClick={() => handleRemoveAssociation(name)}
                >
                  <Minus className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
        </div>
        
        {/* Add association dropdown */}
        {availableEntities.length > 0 && (
          <Select onValueChange={handleAddAssociation}>
            <SelectTrigger className="w-full h-8 text-sm font-serif">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Plus className="w-3 h-3" />
                <SelectValue placeholder="Add association..." />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {availableEntities.map(e => {
                const eColor = getEntityColor(entityTypes, e.type);
                return (
                  <SelectItem key={e.id} value={e.name} className="font-serif">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: eColor }}
                      />
                      {e.name}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
        
        {names.length === 0 && availableEntities.length === 0 && (
          <p className="text-sm text-muted-foreground italic font-serif">No entities available</p>
        )}
      </div>
    );
  };


  const renderedFields = typeDef?.attributes
    .map(attr => {
      const value = editedEntity[attr.key] || '';
      const isAssociatedEntities = attr.key === 'associatedEntities';

      return (
        <div key={attr.key} className="space-y-1.5">
          <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {attr.label}
          </h4>
          {isAssociatedEntities ? (
            renderAssociatedEntities(value)
          ) : (
            <Textarea
              value={value}
              onChange={(e) => handleFieldChange(attr.key, e.target.value)}
              onBlur={handleFieldBlur}
              className={cn(
                "text-sm font-serif leading-relaxed resize-none min-h-[2.5rem] p-0 border-0 bg-transparent shadow-none overflow-hidden",
                "focus-visible:ring-0 focus-visible:ring-offset-0 caret-slim",
                "text-foreground",
                !value && "text-muted-foreground/50 italic"
              )}
              placeholder={`Add ${attr.label.toLowerCase()}...`}
              style={{ height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight}px`;
                }
              }}
            />
          )}
        </div>
      );
    }) || [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span 
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <Input
                value={editedEntity.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                onBlur={handleFieldBlur}
                className="font-serif font-semibold text-lg text-foreground h-7 px-1 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 caret-slim"
                placeholder="Entity name"
              />
              {/* Review toggle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        const updated = { ...editedEntity, review: !editedEntity.review };
                        setEditedEntity(updated);
                        onSave(updated);
                      }}
                      className="shrink-0 p-1 rounded hover:bg-muted/50 transition-colors"
                    >
                      {editedEntity.review ? (
                        <CheckCircle2 className="w-5 h-5 text-foreground" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{editedEntity.review ? 'Approved - click to mark for review' : 'Needs review - click to approve'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Badge 
              variant="outline"
              style={{ borderColor: color, color: color }}
              className="text-[10px] font-mono"
            >
              {typeDef?.label || entity.type}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-4 space-y-6">
          {renderedFields.length > 0 ? (
            renderedFields.map((field, idx) => (
              <React.Fragment key={idx}>
                {field}
                {idx < renderedFields.length - 1 && (
                  <Separator className="opacity-30" />
                )}
              </React.Fragment>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p className="font-serif italic">No information recorded yet</p>
            </div>
          )}
          
          {/* Action Buttons - inline at bottom */}
          <div className="flex justify-end gap-2 pt-2">
            {onDuplicate && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => onDuplicate(entity)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Duplicate
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a copy of this entity</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete
            </Button>
          </div>
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {entity.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this entity
              and remove it from all associations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete(entity.id);
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
