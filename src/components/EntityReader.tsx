import React from 'react';
import { X, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CampaignData, 
  CampaignEntity, 
  ENTITY_TYPE_INFO, 
  ENTITY_FIELDS,
  EntityFieldDef 
} from '@/types/mindmap';

interface EntityReaderProps {
  entity: CampaignEntity | null;
  data: CampaignData | null;
  onClose: () => void;
}

export function EntityReader({ entity, data, onClose }: EntityReaderProps) {
  if (!entity) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground">
        <BookOpen className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm text-center font-serif italic">
          Select an entity to view its details
        </p>
      </div>
    );
  }

  const typeInfo = ENTITY_TYPE_INFO[entity.type];
  const fields = ENTITY_FIELDS[entity.type];

  const getRelatedEntities = (field: EntityFieldDef): CampaignEntity[] => {
    if (!data || !field.relationType) return [];
    const relationIds = (entity as any)[field.key] || [];
    return data.entities.filter(e => relationIds.includes(e.id));
  };

  const renderField = (field: EntityFieldDef) => {
    if (field.type === 'relations') {
      const relatedEntities = getRelatedEntities(field);
      if (relatedEntities.length === 0) return null;

      return (
        <div key={field.key} className="space-y-2">
          <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {field.label}
          </h4>
          <div className="flex flex-wrap gap-1">
            {relatedEntities.map(relEntity => (
              <Badge 
                key={relEntity.id}
                variant="outline"
                className="font-serif"
                style={{ borderColor: ENTITY_TYPE_INFO[relEntity.type].color }}
              >
                <span 
                  className="w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: ENTITY_TYPE_INFO[relEntity.type].color }}
                />
                {relEntity.name}
              </Badge>
            ))}
          </div>
        </div>
      );
    }

    const value = (entity as any)[field.key];
    if (!value || (typeof value === 'string' && value.trim() === '')) return null;

    return (
      <div key={field.key} className="space-y-1.5">
        <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {field.label}
        </h4>
        <p className="text-sm font-serif leading-relaxed text-foreground whitespace-pre-wrap">
          {value}
        </p>
      </div>
    );
  };

  const renderedFields = fields.map(field => renderField(field)).filter(Boolean);

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
              <h2 className="font-serif font-semibold text-lg text-foreground truncate">
                {entity.name}
              </h2>
            </div>
            <Badge 
              variant="outline"
              style={{ borderColor: typeInfo.color, color: typeInfo.color }}
              className="text-[10px] font-mono"
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
        </div>
      </ScrollArea>
    </div>
  );
}
