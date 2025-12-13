import React from 'react';
import { Sword, Shield, Heart, Footprints, Plus, Minus, RotateCcw, UserPlus, X, Dices, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  CampaignData, 
  CampaignEntity, 
  EntityTypeDef,
  getEntityColor,
} from '@/types/mindmap';

interface CombatantState {
  currentHP: number;
  initiative: number;
}

interface CombatTrackerProps {
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  onEntitySelect: (entity: CampaignEntity | null) => void;
  selectedEntityId: string | null;
  // Lifted state
  combatants: Record<string, CombatantState>;
  setCombatants: React.Dispatch<React.SetStateAction<Record<string, CombatantState>>>;
  activeCombatantIds: Set<string>;
  setActiveCombatantIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  round: number;
  setRound: React.Dispatch<React.SetStateAction<number>>;
  currentTurnId: string | null;
  setCurrentTurnId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function CombatTracker({ 
  data, 
  entityTypes, 
  onEntitySelect, 
  selectedEntityId, 
  combatants,
  setCombatants,
  activeCombatantIds,
  setActiveCombatantIds,
  round,
  setRound,
  currentTurnId,
  setCurrentTurnId,
}: CombatTrackerProps) {
  const [showAddDialog, setShowAddDialog] = React.useState(false);

  // Get entities that have combat stats (monsters and characters)
  const allCombatEntities = data?.entities.filter(
    e => e.type === 'monster' || e.type === 'character'
  ) || [];

  // Only show entities that are in active combat
  const combatEntities = allCombatEntities.filter(e => activeCombatantIds.has(e.id));

  const getCombatantState = (entity: CampaignEntity): CombatantState => {
    if (combatants[entity.id]) return combatants[entity.id];
    const hp = parseInt(entity.healthPoints) || 0;
    return { currentHP: hp, initiative: 0 };
  };

  const updateCombatant = (entityId: string, updates: Partial<CombatantState>) => {
    const entity = allCombatEntities.find(e => e.id === entityId);
    if (!entity) return;
    
    setCombatants(prev => ({
      ...prev,
      [entityId]: { ...getCombatantState(entity), ...prev[entityId], ...updates }
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
    setActiveCombatantIds(new Set());
    setCurrentTurnId(null);
    setShowAddDialog(false);
  };

  const addToCombat = (entityId: string) => {
    setActiveCombatantIds(prev => new Set([...prev, entityId]));
  };

  const removeFromCombat = (entityId: string) => {
    setActiveCombatantIds(prev => {
      const next = new Set(prev);
      next.delete(entityId);
      return next;
    });
    setCombatants(prev => {
      const next = { ...prev };
      delete next[entityId];
      return next;
    });
    // Reset turn if removed entity had turn
    if (currentTurnId === entityId) {
      setCurrentTurnId(null);
    }
  };

  // Roll initiative for all monsters
  const rollMonsterInitiative = () => {
    const monsters = combatEntities.filter(e => e.type === 'monster');
    monsters.forEach(monster => {
      const roll = Math.floor(Math.random() * 20) + 1;
      updateCombatant(monster.id, { initiative: roll });
    });
  };

  const availableToAdd = allCombatEntities.filter(e => !activeCombatantIds.has(e.id));

  // Sort by initiative
  const sortedCombatants = [...combatEntities].sort((a, b) => {
    const initA = combatants[a.id]?.initiative || 0;
    const initB = combatants[b.id]?.initiative || 0;
    return initB - initA;
  });

  // Next turn handler
  const handleNextTurn = () => {
    if (sortedCombatants.length === 0) return;
    
    if (!currentTurnId) {
      // Start with first combatant
      setCurrentTurnId(sortedCombatants[0].id);
      return;
    }
    
    const currentIndex = sortedCombatants.findIndex(c => c.id === currentTurnId);
    if (currentIndex === -1 || currentIndex === sortedCombatants.length - 1) {
      // Go back to first, increment round
      setCurrentTurnId(sortedCombatants[0].id);
      setRound(r => r + 1);
    } else {
      setCurrentTurnId(sortedCombatants[currentIndex + 1].id);
    }
  };

  if (!data || allCombatEntities.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground">
        <Sword className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm text-center font-serif">
          No monsters or characters available for combat tracking
        </p>
      </div>
    );
  }

  const hasMonsters = combatEntities.some(e => e.type === 'monster');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sword className="w-5 h-5 text-primary" />
          <span className="font-display text-lg">Combat</span>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Add to Combat</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-80">
                <div className="space-y-2 pr-4">
                  {availableToAdd.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 font-serif">
                      All characters and monsters are in combat
                    </p>
                  ) : (
                    availableToAdd.map(entity => {
                      const color = getEntityColor(entityTypes, entity.type);
                      return (
                        <div 
                          key={entity.id}
                          className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-serif">{entity.name}</span>
                            <Badge 
                              variant="outline"
                              className="text-[10px]"
                            >
                              {entity.type}
                            </Badge>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              addToCombat(entity.id);
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
          {hasMonsters && (
            <Button variant="outline" size="sm" onClick={rollMonsterInitiative} title="Roll initiative for all monsters">
              <Dices className="w-4 h-4 mr-1" />
              Roll Monsters
            </Button>
          )}
          <Badge variant="outline" className="font-mono">
            Round {round}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleNextTurn} title="Next turn">
            <ChevronRight className="w-4 h-4 mr-1" />
            Next Turn
          </Button>
          <Button variant="ghost" size="icon" onClick={resetCombat} title="Reset Combat">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Combat List */}
      <ScrollArea className="flex-1">
        {combatEntities.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <p className="font-serif text-sm">No combatants added yet</p>
            <p className="text-xs mt-1">Click "Add" to add monsters or characters</p>
          </div>
        ) : (
        <div className="p-4 space-y-3">
          {sortedCombatants.map(entity => {
            const color = getEntityColor(entityTypes, entity.type);
            const state = getCombatantState(entity);
            const maxHP = parseInt(entity.healthPoints) || 0;
            const hpPercent = maxHP > 0 ? (state.currentHP / maxHP) * 100 : 100;
            const isSelected = entity.id === selectedEntityId;
            const isCurrentTurn = entity.id === currentTurnId;
            const ac = entity.armorClass || '—';
            const speed = entity.speed || '—';

            return (
            <Card 
                key={`combat-${entity.id}`}
                className={`cursor-pointer transition-all ${isCurrentTurn ? 'ring-2 ring-primary bg-primary/5' : ''} ${isSelected && !isCurrentTurn ? 'ring-2 ring-muted-foreground' : 'hover:bg-muted/50'}`}
                onClick={() => onEntitySelect(entity)}
              >
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isCurrentTurn && (
                        <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                      )}
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
                    <div className="flex items-center gap-2">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          removeFromCombat(entity.id);
                        }}
                        title="Remove from combat"
                      >
                        <X className="w-4 h-4" />
                      </Button>
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
        )}
      </ScrollArea>
    </div>
  );
}
