import React, { useState } from 'react';
import { Sword, Shield, Heart, Footprints, Droplets, Plus, Minus, RotateCcw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  CampaignData, 
  CampaignEntity, 
  EntityTypeDef,
  getEntityColor,
} from '@/types/mindmap';

interface CombatTrackerProps {
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  onEntitySelect: (entity: CampaignEntity | null) => void;
  selectedEntityId: string | null;
}

interface CombatantState {
  currentHP: number;
  initiative: number;
}

export function CombatTracker({ data, entityTypes, onEntitySelect, selectedEntityId }: CombatTrackerProps) {
  const [combatants, setCombatants] = useState<Record<string, CombatantState>>({});
  const [round, setRound] = useState(1);

  // Get entities that have combat stats (monsters and characters)
  const combatEntities = data?.entities.filter(
    e => e.type === 'monster' || e.type === 'character'
  ) || [];

  const getCombatantState = (entity: CampaignEntity): CombatantState => {
    if (combatants[entity.id]) return combatants[entity.id];
    const hp = parseInt(entity.healthPoints) || 0;
    return { currentHP: hp, initiative: 0 };
  };

  const updateCombatant = (entityId: string, updates: Partial<CombatantState>) => {
    setCombatants(prev => ({
      ...prev,
      [entityId]: { ...getCombatantState(combatEntities.find(e => e.id === entityId)!), ...prev[entityId], ...updates }
    }));
  };

  const adjustHP = (entity: CampaignEntity, delta: number) => {
    const current = getCombatantState(entity);
    const maxHP = parseInt(entity.healthPoints) || 0;
    const newHP = Math.max(0, Math.min(maxHP, current.currentHP + delta));
    updateCombatant(entity.id, { currentHP: newHP });
  };

  const resetCombat = () => {
    setCombatants({});
    setRound(1);
  };

  // Sort by initiative
  const sortedCombatants = [...combatEntities].sort((a, b) => {
    const initA = combatants[a.id]?.initiative || 0;
    const initB = combatants[b.id]?.initiative || 0;
    return initB - initA;
  });

  if (!data || combatEntities.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground">
        <Sword className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm text-center font-serif">
          No monsters or characters available for combat tracking
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sword className="w-5 h-5 text-primary" />
          <span className="font-display text-lg">Combat Tracker</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            Round {round}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => setRound(r => r + 1)}>
            Next Round
          </Button>
          <Button variant="ghost" size="icon" onClick={resetCombat} title="Reset Combat">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Combat List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {sortedCombatants.map(entity => {
            const color = getEntityColor(entityTypes, entity.type);
            const state = getCombatantState(entity);
            const maxHP = parseInt(entity.healthPoints) || 0;
            const hpPercent = maxHP > 0 ? (state.currentHP / maxHP) * 100 : 100;
            const isSelected = entity.id === selectedEntityId;
            const ac = entity.armorClass || '—';
            const speed = entity.speed || '—';
            const speedWater = entity.speedWater || '—';

            return (
              <Card 
                key={entity.id}
                className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                onClick={() => onEntitySelect(entity)}
              >
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <CardTitle className="text-base font-display">{entity.name}</CardTitle>
                      <Badge 
                        style={{ backgroundColor: color }}
                        className="text-white text-[10px]"
                      >
                        {entity.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground font-mono">Init:</span>
                      <Input
                        type="number"
                        value={state.initiative}
                        onChange={(e) => updateCombatant(entity.id, { initiative: parseInt(e.target.value) || 0 })}
                        className="w-14 h-7 text-center font-mono text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  {/* Stats Row */}
                  <div className="flex items-center gap-4 mb-3 text-sm">
                    <div className="flex items-center gap-1" title="Armor Class">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono">{ac}</span>
                    </div>
                    <div className="flex items-center gap-1" title="Speed">
                      <Footprints className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono">{speed}</span>
                    </div>
                    <div className="flex items-center gap-1" title="Speed (Water)">
                      <Droplets className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono">{speedWater}</span>
                    </div>
                  </div>

                  {/* HP Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Heart className="w-4 h-4 text-destructive" />
                        <span className="text-sm font-mono">
                          {state.currentHP} / {maxHP}
                        </span>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => adjustHP(entity, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          value={state.currentHP}
                          onChange={(e) => updateCombatant(entity.id, { 
                            currentHP: Math.max(0, Math.min(maxHP, parseInt(e.target.value) || 0)) 
                          })}
                          className="w-14 h-7 text-center font-mono text-sm"
                        />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => adjustHP(entity, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-300 rounded-full"
                        style={{ 
                          width: `${hpPercent}%`,
                          backgroundColor: hpPercent > 50 ? '#22c55e' : hpPercent > 25 ? '#eab308' : '#ef4444'
                        }}
                      />
                    </div>
                  </div>

                  {/* Attacks */}
                  {entity.attacks && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Attacks</p>
                      <p className="text-sm font-serif whitespace-pre-wrap">{entity.attacks}</p>
                    </div>
                  )}

                  {/* Resistances */}
                  {entity.resistancesAdvantages && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Resistances/Advantages</p>
                      <p className="text-sm font-serif whitespace-pre-wrap">{entity.resistancesAdvantages}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
