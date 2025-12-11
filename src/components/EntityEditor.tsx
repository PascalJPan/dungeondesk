import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Plus, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CampaignData, 
  CampaignEntity, 
  EntityType, 
  ENTITY_TYPE_INFO, 
  ENTITY_FIELDS,
  EntityFieldDef 
} from '@/types/mindmap';
import { cn } from '@/lib/utils';

interface EntityEditorProps {
  entity: CampaignEntity | null;
  data: CampaignData | null;
  onClose: () => void;
  onSave: (entity: CampaignEntity) => void;
  onDelete?: (entityId: string) => void;
}

export function EntityEditor({ entity, data, onClose, onSave, onDelete }: EntityEditorProps) {
  const [editedEntity, setEditedEntity] = useState<CampaignEntity | null>(null);

  useEffect(() => {
    if (entity) {
      setEditedEntity({ ...entity } as CampaignEntity);
    } else {
      setEditedEntity(null);
    }
  }, [entity]);

  if (!entity || !editedEntity) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground">
        <span className="text-4xl mb-4">✏️</span>
        <p className="text-sm text-center">
          Select an entity to edit
        </p>
      </div>
    );
  }

  const typeInfo = ENTITY_TYPE_INFO[entity.type];
  const fields = ENTITY_FIELDS[entity.type];

  const handleFieldChange = (key: string, value: string) => {
    setEditedEntity(prev => prev ? { ...prev, [key]: value } as CampaignEntity : null);
  };

  const handleRelationAdd = (fieldKey: string, entityId: string) => {
    setEditedEntity(prev => {
      if (!prev) return null;
      const current = (prev as any)[fieldKey] || [];
      if (current.includes(entityId)) return prev;
      return { ...prev, [fieldKey]: [...current, entityId] } as CampaignEntity;
    });
  };

  const handleRelationRemove = (fieldKey: string, entityId: string) => {
    setEditedEntity(prev => {
      if (!prev) return null;
      const current = (prev as any)[fieldKey] || [];
      return { ...prev, [fieldKey]: current.filter((id: string) => id !== entityId) } as CampaignEntity;
    });
  };

  const handleSave = () => {
    if (editedEntity) {
      onSave(editedEntity);
    }
  };

  const getRelatedEntities = (field: EntityFieldDef): CampaignEntity[] => {
    if (!data || !field.relationType) return [];
    return data.entities.filter(e => 
      field.relationType!.includes(e.type) && e.id !== entity.id
    );
  };

  const getCurrentRelations = (fieldKey: string): string[] => {
    return (editedEntity as any)[fieldKey] || [];
  };

  const renderField = (field: EntityFieldDef) => {
    if (field.type === 'relations') {
      const relatedEntities = getRelatedEntities(field);
      const currentRelations = getCurrentRelations(field.key);
      const selectedEntities = currentRelations
        .map(id => data?.entities.find(e => e.id === id))
        .filter(Boolean) as CampaignEntity[];
      const availableEntities = relatedEntities.filter(e => !currentRelations.includes(e.id));

      return (
        <div key={field.key} className="space-y-2">
          <Label className="text-xs font-mono uppercase text-muted-foreground">
            {field.label}
          </Label>
          
          {/* Selected relations */}
          <div className="flex flex-wrap gap-1">
            {selectedEntities.map(relEntity => (
              <Badge 
                key={relEntity.id}
                variant="secondary"
                className="flex items-center gap-1 pr-1"
                style={{ borderColor: ENTITY_TYPE_INFO[relEntity.type].color }}
              >
                <span 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: ENTITY_TYPE_INFO[relEntity.type].color }}
                />
                {relEntity.name}
                <button
                  onClick={() => handleRelationRemove(field.key, relEntity.id)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>

          {/* Add relation */}
          {availableEntities.length > 0 && (
            <Select onValueChange={(id) => handleRelationAdd(field.key, id)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={`Add ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {availableEntities.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: ENTITY_TYPE_INFO[e.type].color }}
                      />
                      {e.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      );
    }

    const value = (editedEntity as any)[field.key] || '';

    return (
      <div key={field.key} className="space-y-2">
        <Label className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
          {field.label}
          {!value && <span className="text-destructive/70 text-[10px]">(empty)</span>}
        </Label>
        {field.type === 'textarea' ? (
          <Textarea
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            className="min-h-[80px] text-sm resize-none"
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            className="text-sm"
          />
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span 
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: typeInfo.color }}
              />
              <Input
                value={editedEntity.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="font-mono font-semibold text-foreground h-7 px-2"
                placeholder="Entity name"
              />
            </div>
            <Badge 
              style={{ backgroundColor: typeInfo.color }}
              className="text-white text-[10px]"
            >
              {typeInfo.label.slice(0, -1)}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {fields.map(field => renderField(field))}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <Button className="w-full" onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
        {onDelete && (
          <Button 
            variant="outline" 
            className="w-full text-destructive hover:text-destructive"
            onClick={() => onDelete(entity.id)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Entity
          </Button>
        )}
      </div>
    </div>
  );
}
