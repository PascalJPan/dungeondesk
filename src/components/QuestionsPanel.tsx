import React, { forwardRef } from 'react';
import { HelpCircle, ArrowRight, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CampaignData, EmptyField, getEmptyFields, EntityTypeDef, getEntityColor } from '@/types/mindmap';
import { cn } from '@/lib/utils';

interface QuestionsPanelProps {
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  onSelectField: (entityId: string, fieldKey: string) => void;
}

export const QuestionsPanel = forwardRef<HTMLDivElement, QuestionsPanelProps>(
  function QuestionsPanel({ data, entityTypes, onSelectField }, ref) {
    if (!data || data.entities.length === 0) {
      return (
        <div ref={ref} className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground">
          <HelpCircle className="w-10 h-10 mb-4 opacity-50" />
          <p className="text-sm text-center font-serif italic">
            Extract campaign data to see missing fields
          </p>
        </div>
      );
    }

    const emptyFields = getEmptyFields(data, entityTypes);

    // Group by entity
    const groupedByEntity: Record<string, EmptyField[]> = {};
    emptyFields.forEach(field => {
      if (!groupedByEntity[field.entityId]) {
        groupedByEntity[field.entityId] = [];
      }
      groupedByEntity[field.entityId].push(field);
    });

    if (emptyFields.length === 0) {
      return (
        <div ref={ref} className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <span className="text-2xl">✅</span>
          </div>
          <p className="text-sm text-center font-medium text-foreground font-serif">
            All fields filled!
          </p>
          <p className="text-xs text-center mt-1 font-serif">
            Your campaign data is complete
          </p>
        </div>
      );
    }

    return (
      <div ref={ref} className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-primary" />
            <h3 className="font-display text-foreground">
              Missing Information
            </h3>
          </div>
          <p className="text-xs text-muted-foreground font-serif">
            {emptyFields.length} empty field{emptyFields.length !== 1 ? 's' : ''} across {Object.keys(groupedByEntity).length} entit{Object.keys(groupedByEntity).length !== 1 ? 'ies' : 'y'}
          </p>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {Object.entries(groupedByEntity).map(([entityId, fields]) => {
              const firstField = fields[0];
              const color = getEntityColor(entityTypes, firstField.entityType);
              
              return (
                <div key={entityId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium text-sm font-serif">{firstField.entityName}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {fields.length} missing
                    </Badge>
                  </div>
                  
                  <div className="pl-4 space-y-1">
                    {fields.map(field => (
                      <button
                        key={`${field.entityId}-${field.fieldKey}`}
                        onClick={() => onSelectField(field.entityId, field.fieldKey)}
                        className={cn(
                          "w-full flex items-center justify-between p-2 rounded-lg",
                          "bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                        )}
                      >
                        <span className="text-sm text-muted-foreground font-serif">
                          {field.fieldLabel}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  }
);
