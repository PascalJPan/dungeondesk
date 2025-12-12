import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  CampaignData, 
  CampaignEntity, 
  EntityTypeDef,
  getEntityColor,
} from '@/types/mindmap';

interface EntityEditorProps {
  entity: CampaignEntity | null;
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  onClose: () => void;
  onSave: (entity: CampaignEntity) => void;
  onDelete?: (entityId: string) => void;
}

export function EntityEditor({ entity, data, entityTypes, onClose, onSave, onDelete }: EntityEditorProps) {
  const [editedEntity, setEditedEntity] = useState<CampaignEntity | null>(null);

  useEffect(() => {
    if (entity) {
      setEditedEntity({ ...entity });
    } else {
      setEditedEntity(null);
    }
  }, [entity]);

  if (!entity || !editedEntity) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground">
        <span className="text-4xl mb-4">✏️</span>
        <p className="text-sm text-center font-serif">
          Select an entity to edit
        </p>
      </div>
    );
  }

  const typeDef = entityTypes.find(t => t.key === entity.type);
  const color = getEntityColor(entityTypes, entity.type);

  const handleFieldChange = (key: string, value: string) => {
    setEditedEntity(prev => prev ? { ...prev, [key]: value } : null);
  };

  const handleSave = () => {
    if (editedEntity) {
      onSave(editedEntity);
    }
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
                style={{ backgroundColor: color }}
              />
              <Input
                value={editedEntity.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="font-display text-foreground h-7 px-2 text-lg"
                placeholder="Entity name"
              />
            </div>
            <Badge 
              style={{ backgroundColor: color }}
              className="text-white text-[10px]"
            >
              {typeDef?.label || entity.type}
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
          {typeDef?.attributes.map(attr => {
            const value = editedEntity[attr.key] || '';
            
            return (
              <div key={attr.key} className="space-y-2">
                <Label className="text-xs font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                  {attr.label}
                  {!value && <span className="text-destructive/70 text-[10px] font-serif normal-case">(empty)</span>}
                </Label>
                <Textarea
                  value={value}
                  onChange={(e) => handleFieldChange(attr.key, e.target.value)}
                  placeholder={`Enter ${attr.label.toLowerCase()}...`}
                  className="min-h-[80px] text-sm resize-none font-serif"
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <Button className="w-full font-serif" onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
        {onDelete && (
          <Button 
            variant="outline" 
            className="w-full text-destructive hover:text-destructive font-serif"
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
