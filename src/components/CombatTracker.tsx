import React from 'react';
import { Sword, Shield, Heart, Footprints, Plus, Minus, RotateCcw, UserPlus, X, Dices, ChevronRight, Search } from 'lucide-react';
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
  getEntityLabel,
} from '@/types/mindmap';

// Combat instance: represents a single combatant in combat
// instanceId format: "entityId" for first instance, "entityId#2", "entityId#3", etc.
export interface CombatInstance {
  instanceId: string;
  entityId: string;
  instanceNumber: number; // 1 for first, 2 for second, etc.
  currentHP: number;
  initiative: number;
}

interface CombatTrackerProps {
  data: CampaignData | null;
  entityTypes: EntityTypeDef[];
  onEntitySelect: (entity: CampaignEntity | null) => void;
  selectedEntityId: string | null;
  // Lifted state - now uses instances
  combatInstances: CombatInstance[];
  setCombatInstances: React.Dispatch<React.SetStateAction<CombatInstance[]>>;
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
  combatInstances,
  setCombatInstances,
  round,
  setRound,
  currentTurnId,
  setCurrentTurnId,
}: CombatTrackerProps) {
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [addSearchQuery, setAddSearchQuery] = React.useState('');

  // Get combat-eligible entity types
  const combatEligibleTypes = entityTypes.filter(t => t.combatEligible).map(t => t.key);

  // Get entities that can be in combat
  const allCombatEntities = data?.entities.filter(
    e => combatEligibleTypes.includes(e.type)
  ) || [];

  // Get entity by ID
  const getEntity = (entityId: string): CampaignEntity | undefined => {
    return allCombatEntities.find(e => e.id === entityId);
  };

  // Get display name for instance
  const getInstanceDisplayName = (instance: CombatInstance, entity: CampaignEntity): string => {
    const instanceCount = combatInstances.filter(i => i.entityId === instance.entityId).length;
    if (instanceCount > 1) {
      return `${entity.name} #${instance.instanceNumber}`;
    }
    return entity.name;
  };

  // Update a combat instance
  const updateInstance = (instanceId: string, updates: Partial<CombatInstance>) => {
    setCombatInstances(prev => prev.map(inst => 
      inst.instanceId === instanceId ? { ...inst, ...updates } : inst
    ));
  };

  const adjustHP = (instance: CombatInstance, entity: CampaignEntity, delta: number) => {
    const maxHP = parseInt(entity.healthPoints) || 0;
    const newHP = Math.max(0, Math.min(maxHP, instance.currentHP + delta));
    updateInstance(instance.instanceId, { currentHP: newHP });
  };

  const resetCombat = () => {
    setCombatInstances([]);
    setRound(1);
    setCurrentTurnId(null);
    setShowAddDialog(false);
  };

  const addToCombat = (entityId: string) => {
    const entity = getEntity(entityId);
    if (!entity) return;
    
    // Find how many instances of this entity already exist
    const existingInstances = combatInstances.filter(i => i.entityId === entityId);
    const nextNumber = existingInstances.length + 1;
    const instanceId = nextNumber === 1 ? entityId : `${entityId}#${nextNumber}`;
    
    const hp = parseInt(entity.healthPoints) || 0;
    
    setCombatInstances(prev => [...prev, {
      instanceId,
      entityId,
      instanceNumber: nextNumber,
      currentHP: hp,
      initiative: 0,
    }]);
  };

  const removeFromCombat = (instanceId: string) => {
    setCombatInstances(prev => prev.filter(inst => inst.instanceId !== instanceId));
    if (currentTurnId === instanceId) {
      setCurrentTurnId(null);
    }
  };

  // Roll initiative for all combatants
  const rollAllInitiative = () => {
    setCombatInstances(prev => prev.map(inst => ({
      ...inst,
      initiative: Math.floor(Math.random() * 20) + 1,
    })));
  };

  // Sort available entities by type then alphabetically, filtered by search
  const sortedAvailableEntities = [...allCombatEntities]
    .filter(e => e.name.toLowerCase().includes(addSearchQuery.toLowerCase()))
    .sort((a, b) => {
      // First by type
      const typeOrder = combatEligibleTypes.indexOf(a.type) - combatEligibleTypes.indexOf(b.type);
      if (typeOrder !== 0) return typeOrder;
      // Then alphabetically
      return a.name.localeCompare(b.name);
    });

  // Get count of instances for each entity
  const getInstanceCount = (entityId: string): number => {
    return combatInstances.filter(i => i.entityId === entityId).length;
  };

  // Sort combatants by initiative
  const sortedCombatants = [...combatInstances].sort((a, b) => b.initiative - a.initiative);

  // Next turn handler
  const handleNextTurn = () => {
    if (sortedCombatants.length === 0) return;
    
    if (!currentTurnId) {
      setCurrentTurnId(sortedCombatants[0].instanceId);
      return;
    }
    
    const currentIndex = sortedCombatants.findIndex(c => c.instanceId === currentTurnId);
    if (currentIndex === -1 || currentIndex === sortedCombatants.length - 1) {
      setCurrentTurnId(sortedCombatants[0].instanceId);
      setRound(r => r + 1);
    } else {
      setCurrentTurnId(sortedCombatants[currentIndex + 1].instanceId);
    }
  };

  if (!data || allCombatEntities.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground">
        <Sword className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm text-center font-serif">
          No combat-eligible entities available
        </p>
        <p className="text-xs text-center mt-2">
          Enable "Combat Eligible" in entity type settings
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
          <span className="font-display text-lg">Combat</span>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) setAddSearchQuery('');
          }}>
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search entities..."
                  value={addSearchQuery}
                  onChange={(e) => setAddSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="max-h-72">
                <div className="space-y-2 pr-4">
                  {sortedAvailableEntities.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 font-serif">
                      No combat-eligible entities available
                    </p>
                  ) : (
                    sortedAvailableEntities.map(entity => {
                      const color = getEntityColor(entityTypes, entity.type);
                      const typeLabel = getEntityLabel(entityTypes, entity.type);
                      const instanceCount = getInstanceCount(entity.id);
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
                            {instanceCount > 0 && (
                              <Badge variant="secondary" className="text-[10px]">
                                ×{instanceCount}
                              </Badge>
                            )}
                            <Badge 
                              variant="outline"
                              className="text-[10px]"
                            >
                              {typeLabel}
                            </Badge>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => addToCombat(entity.id)}
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
          {combatInstances.length > 0 && (
            <Button variant="outline" size="sm" onClick={rollAllInitiative} title="Roll initiative for all combatants">
              <Dices className="w-4 h-4 mr-1" />
              Roll Init
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
        {combatInstances.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <p className="font-serif text-sm">No combatants added yet</p>
            <p className="text-xs mt-1">Click "Add" to add entities to combat</p>
          </div>
        ) : (
        <div className="p-4 space-y-3">
          {sortedCombatants.map(instance => {
            const entity = getEntity(instance.entityId);
            if (!entity) return null;
            
            const color = getEntityColor(entityTypes, entity.type);
            const maxHP = parseInt(entity.healthPoints) || 0;
            const hpPercent = maxHP > 0 ? (instance.currentHP / maxHP) * 100 : 100;
            const isSelected = entity.id === selectedEntityId;
            const isCurrentTurn = instance.instanceId === currentTurnId;
            const ac = entity.armorClass || '—';
            const speed = entity.speed || '—';
            const displayName = getInstanceDisplayName(instance, entity);

            return (
            <Card 
                key={instance.instanceId}
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
                      <CardTitle className="text-base font-display">{displayName}</CardTitle>
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
                          value={instance.initiative}
                          onChange={(e) => updateInstance(instance.instanceId, { initiative: parseInt(e.target.value) || 0 })}
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
                          removeFromCombat(instance.instanceId);
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
                          {instance.currentHP} / {maxHP}
                        </span>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => adjustHP(instance, entity, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          value={instance.currentHP}
                          onChange={(e) => updateInstance(instance.instanceId, { 
                            currentHP: Math.max(0, Math.min(maxHP, parseInt(e.target.value) || 0)) 
                          })}
                          className="w-14 h-7 text-center font-mono text-sm"
                        />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => adjustHP(instance, entity, 1)}
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