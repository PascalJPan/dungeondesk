import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
}

export function EntityPanel({ 
  entity, 
  entityTypes, 
  entities, 
  onSave, 
  onDelete, 
  onEntityClick 
}: EntityPanelProps) {
  const [editedEntity, setEditedEntity] = useState<CampaignEntity | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevEntityIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (entity) {
      setEditedEntity({ ...entity });
      
      // Only scroll to top and reset editing when switching to a different entity
      if (prevEntityIdRef.current !== entity.id) {
        setEditingField(null);
        if (scrollAreaRef.current) {
          const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (viewport) {
            viewport.scrollTop = 0;
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

  const handleFieldBlur = (key: string) => {
    setEditingField(null);
    if (editedEntity) {
      onSave(editedEntity);
    }
  };

  const handleNameBlur = () => {
    setEditingField(null);
    if (editedEntity) {
      onSave(editedEntity);
    }
  };

  // Get available entities to add as associations (exclude self and already associated)
  const getAvailableEntities = () => {
    const currentAssocs = editedEntity?.associatedEntities
      ? editedEntity.associatedEntities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      : [];
    
    return entities.filter(e => 
      e.id !== entity.id && 
      !currentAssocs.includes(e.name.toLowerCase())
    );
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

  const fieldRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [fieldHeights, setFieldHeights] = useState<Map<string, number>>(new Map());

  // Measure field heights when not editing
  useEffect(() => {
    const heights = new Map<string, number>();
    fieldRefs.current.forEach((el, key) => {
      if (el) {
        heights.set(key, el.offsetHeight);
      }
    });
    setFieldHeights(heights);
  }, [editedEntity, editingField]);

  const renderedFields = typeDef?.attributes
    .map(attr => {
      const value = editedEntity[attr.key] || '';
      const isAssociatedEntities = attr.key === 'associatedEntities';
      const isEditing = editingField === attr.key;
      const measuredHeight = fieldHeights.get(attr.key) || 80;
      const minHeight = Math.max(80, measuredHeight);

      return (
        <div key={attr.key} className="space-y-1.5">
          <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {attr.label}
          </h4>
          {isAssociatedEntities ? (
            renderAssociatedEntities(value)
          ) : isEditing ? (
            <Textarea
              autoFocus
              value={value}
              onChange={(e) => handleFieldChange(attr.key, e.target.value)}
              onBlur={() => handleFieldBlur(attr.key)}
              className="text-sm font-serif resize-y"
              style={{ minHeight: `${minHeight}px` }}
              placeholder={`Enter ${attr.label.toLowerCase()}...`}
            />
          ) : (
            <div
              ref={(el) => {
                if (el) fieldRefs.current.set(attr.key, el);
              }}
              onClick={() => setEditingField(attr.key)}
              className={cn(
                "text-sm font-serif leading-relaxed text-foreground whitespace-pre-wrap cursor-text rounded-md p-2 -m-2",
                "hover:bg-muted/30 transition-colors",
                !value && "text-muted-foreground/50 italic"
              )}
            >
              {value || `Click to add ${attr.label.toLowerCase()}...`}
            </div>
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
              {editingField === 'name' ? (
                <Input
                  ref={nameInputRef}
                  autoFocus
                  value={editedEntity.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  onBlur={handleNameBlur}
                  className="font-serif font-semibold text-lg text-foreground h-7 px-2"
                  placeholder="Entity name"
                />
              ) : (
                <h2 
                  onClick={() => setEditingField('name')}
                  className="font-serif font-semibold text-lg text-foreground truncate cursor-text hover:bg-muted/30 rounded px-1 -mx-1 transition-colors"
                >
                  {editedEntity.name || 'Untitled'}
                </h2>
              )}
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
          
          {/* Delete Button - inline at bottom */}
          <div className="flex justify-end pt-2">
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
