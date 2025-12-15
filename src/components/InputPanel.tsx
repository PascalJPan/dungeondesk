import React, { useState, useCallback } from 'react';
import { Upload, FileText, Type, Loader2, Plus, X, Download, Settings, ChevronDown, Trash2, AlertTriangle, FileJson, Copy, HelpCircle, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProcessingState, ExtractionOptions, EntityTypeDef, AttributeDef, CampaignExport, COLOR_PALETTE, DEFAULT_ENTITY_TYPES, CampaignEntity, PromptSettings, DEFAULT_PROMPT_SETTINGS, INFER_LEVEL_LABELS, CampaignData, CampaignMetadata, DEFAULT_SYSTEM_PROMPT, getEntityLabel } from '@/types/mindmap';
import { Slider } from '@/components/ui/slider';
import { QuestionsPanel } from '@/components/QuestionsPanel';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';


interface MergeDialogData {
  newEntityTypes: EntityTypeDef[];
  newAttributes: { typeKey: string; typeName: string; attributes: AttributeDef[] }[];
}

interface InputPanelProps {
  onProcess: (text: string, extractionOptions: ExtractionOptions, keepExisting: boolean, openAiApiKey: string, maxEntities: number) => void;
  onImport: (data: CampaignExport, keepEntities: boolean, keepMetadata: boolean, mergeTypes: boolean) => void;
  onExport: () => void;
  processingState: ProcessingState;
  hasData: boolean;
  entityTypes: EntityTypeDef[];
  onEntityTypesChange: (types: EntityTypeDef[]) => void;
  existingEntities: CampaignEntity[];
  campaignData: CampaignData | null;
  onSelectField: (entityId: string, fieldKey: string) => void;
  promptSettings: PromptSettings;
  onPromptSettingsChange: (settings: PromptSettings) => void;
  campaignMetadata: CampaignMetadata;
  onCampaignMetadataChange: (metadata: CampaignMetadata) => void;
  onClearAllEntities: () => void;
}

interface DeleteWarning {
  type: 'entityType' | 'attribute';
  entityTypeKey: string;
  attributeKey?: string;
  affectedCount: number;
  onConfirm: () => void;
}

// Generate Markdown export for entities
function generateMarkdownExport(entities: CampaignEntity[], entityTypes: EntityTypeDef[], metadata: CampaignMetadata, specificEntityId?: string): string {
  const entitiesToExport = specificEntityId 
    ? entities.filter(e => e.id === specificEntityId)
    : entities;
  
  let md = `# ${metadata.name}\n\n`;
  md += `*Exported: ${new Date().toLocaleDateString()}*\n\n---\n\n`;
  
  // Group by type
  const grouped: Record<string, CampaignEntity[]> = {};
  entitiesToExport.forEach(e => {
    if (!grouped[e.type]) grouped[e.type] = [];
    grouped[e.type].push(e);
  });
  
  Object.entries(grouped).forEach(([type, typeEntities]) => {
    const typeDef = entityTypes.find(t => t.key === type);
    md += `## ${typeDef?.label || type}\n\n`;
    
    typeEntities.forEach(entity => {
      md += `### ${entity.name}\n\n`;
      
      typeDef?.attributes.forEach(attr => {
        const value = entity[attr.key];
        if (value && String(value).trim()) {
          md += `**${attr.label}:** ${String(value).trim()}\n\n`;
        }
      });
      
      md += `---\n\n`;
    });
  });
  
  return md;
}

export function InputPanel({ 
  onProcess, 
  onImport, 
  onExport, 
  processingState, 
  hasData,
  entityTypes,
  onEntityTypesChange,
  existingEntities,
  campaignData,
  onSelectField,
  promptSettings,
  onPromptSettingsChange,
  campaignMetadata,
  onCampaignMetadataChange,
  onClearAllEntities,
}: InputPanelProps) {
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [openEntityTypes, setOpenEntityTypes] = useState<string[]>([]);
  const [keepExistingEntities, setKeepExistingEntities] = useState(true);
  const [keepExistingMetadata, setKeepExistingMetadata] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState<DeleteWarning | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [pendingImport, setPendingImport] = useState<CampaignExport | null>(null);
  const [mergeDialog, setMergeDialog] = useState<MergeDialogData | null>(null);
  const [openAiApiKey, setOpenAiApiKey] = useState('');
  const [maxExtractedEntities, setMaxExtractedEntities] = useState(1);

  const isProcessing = processingState.status !== 'idle' && processingState.status !== 'complete' && processingState.status !== 'error';

  const toggleEntityTypeOpen = (key: string) => {
    setOpenEntityTypes(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleAddEntityType = () => {
    const usedColors = entityTypes.map(t => t.color);
    const availableColor = COLOR_PALETTE.find(c => !usedColors.includes(c)) || COLOR_PALETTE[entityTypes.length % COLOR_PALETTE.length];
    
    const newType: EntityTypeDef = {
      key: `type_${Date.now()}`,
      label: 'New Type',
      color: availableColor,
      attributes: [
        { key: 'shortDescription', label: 'Short Description' },
        { key: 'associatedEntities', label: 'Associated Entities' },
      ],
    };
    onEntityTypesChange([...entityTypes, newType]);
    setOpenEntityTypes(prev => [...prev, newType.key]);
  };

  const handleRemoveEntityType = (key: string) => {
    const affectedCount = existingEntities.filter(e => e.type === key).length;
    if (affectedCount > 0) {
      setDeleteWarning({
        type: 'entityType',
        entityTypeKey: key,
        affectedCount,
        onConfirm: () => {
          onEntityTypesChange(entityTypes.filter(t => t.key !== key));
          setDeleteWarning(null);
        },
      });
    } else {
      onEntityTypesChange(entityTypes.filter(t => t.key !== key));
    }
  };

  const handleUpdateEntityType = (key: string, updates: Partial<EntityTypeDef>) => {
    onEntityTypesChange(entityTypes.map(t => 
      t.key === key ? { ...t, ...updates } : t
    ));
  };

  const handleUpdateEntityTypeKey = (oldKey: string, newLabel: string) => {
    const newKey = newLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    onEntityTypesChange(entityTypes.map(t => 
      t.key === oldKey ? { ...t, key: newKey || oldKey, label: newLabel } : t
    ));
  };

  const handleAddAttribute = (typeKey: string) => {
    const typeDef = entityTypes.find(t => t.key === typeKey);
    if (!typeDef) return;
    
    const newAttr: AttributeDef = {
      key: `attr_${Date.now()}`,
      label: '',
    };
    handleUpdateEntityType(typeKey, {
      attributes: [...typeDef.attributes, newAttr],
    });
  };

  const handleUpdateAttribute = (typeKey: string, attrIndex: number, label: string) => {
    const typeDef = entityTypes.find(t => t.key === typeKey);
    if (!typeDef) return;
    
    const newKey = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    handleUpdateEntityType(typeKey, {
      attributes: typeDef.attributes.map((attr, i) => 
        i === attrIndex ? { ...attr, key: newKey || attr.key, label } : attr
      ),
    });
  };

  const handleRemoveAttribute = (typeKey: string, attrIndex: number) => {
    const typeDef = entityTypes.find(t => t.key === typeKey);
    if (!typeDef) return;
    
    const attrKey = typeDef.attributes[attrIndex]?.key;
    
    // Prevent deletion of shortDescription - it's required
    if (attrKey === 'shortDescription') {
      toast({
        title: "Cannot delete",
        description: "Short Description is a required field for all entity types",
        variant: "destructive",
      });
      return;
    }
    
    const affectedCount = existingEntities.filter(e => 
      e.type === typeKey && e[attrKey] && String(e[attrKey]).trim() !== ''
    ).length;
    
    if (affectedCount > 0) {
      setDeleteWarning({
        type: 'attribute',
        entityTypeKey: typeKey,
        attributeKey: attrKey,
        affectedCount,
        onConfirm: () => {
          handleUpdateEntityType(typeKey, {
            attributes: typeDef.attributes.filter((_, i) => i !== attrIndex),
          });
          setDeleteWarning(null);
        },
      });
    } else {
      handleUpdateEntityType(typeKey, {
        attributes: typeDef.attributes.filter((_, i) => i !== attrIndex),
      });
    }
  };

  const handlePdfUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF file');
      return;
    }

    setIsExtracting(true);
    setFileName(file.name);

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }

      setInputText(fullText.trim());
    } catch (error) {
      console.error('Error extracting PDF:', error);
      alert('Failed to extract text from PDF. Please try pasting the text directly.');
      setFileName(null);
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const handleJsonFileUpload = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as CampaignExport;
      if (data.version && data.entities) {
        // Just populate the textarea for review - don't import yet
        setJsonInput(JSON.stringify(data, null, 2));
        toast({
          title: "JSON loaded",
          description: "Review and click 'Import JSON' to apply",
        });
      } else {
        alert('Invalid campaign JSON format');
      }
    } catch (error) {
      console.error('Invalid JSON:', error);
      alert('Invalid JSON file');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, forJson: boolean = false) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      if (forJson) {
        if (file.name.toLowerCase().endsWith('.json')) {
          handleJsonFileUpload(file);
        } else {
          alert('Please upload a JSON file');
        }
      } else {
        handlePdfUpload(file);
      }
    }
  }, [handlePdfUpload, handleJsonFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handlePdfFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePdfUpload(file);
  }, [handlePdfUpload]);

  const handleJsonFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleJsonFileUpload(file);
  }, [handleJsonFileUpload]);

  const handleGenerate = () => {
    if (!inputText.trim() || entityTypes.length === 0 || !openAiApiKey.trim()) return;
    
    const extractionOptions: ExtractionOptions = {
      entityTypes: entityTypes,
      promptSettings: promptSettings,
    };
    
    onProcess(inputText, extractionOptions, keepExistingEntities, openAiApiKey, maxExtractedEntities);
  };

  // Detect new entity types and attributes
  const detectNewTypesAndAttributes = useCallback((importData: CampaignExport): MergeDialogData => {
    const existingTypeKeys = new Set(entityTypes.map(t => t.key));
    
    // Completely new entity types
    const newEntityTypes = (importData.entityTypes || []).filter(
      t => !existingTypeKeys.has(t.key)
    );
    
    // New attributes on existing types
    const newAttributes: { typeKey: string; typeName: string; attributes: AttributeDef[] }[] = [];
    (importData.entityTypes || []).forEach(importedType => {
      const existingType = entityTypes.find(t => t.key === importedType.key);
      if (existingType) {
        const existingAttrKeys = new Set(existingType.attributes.map(a => a.key));
        const newAttrs = importedType.attributes.filter(a => !existingAttrKeys.has(a.key));
        if (newAttrs.length > 0) {
          newAttributes.push({
            typeKey: importedType.key,
            typeName: importedType.label,
            attributes: newAttrs
          });
        }
      }
    });
    
    return { newEntityTypes, newAttributes };
  }, [entityTypes]);

  const handleJsonImport = () => {
    try {
      const data = JSON.parse(jsonInput) as CampaignExport;
      if (!data.version || !data.entities) {
        alert('Invalid campaign JSON format');
        return;
      }
      
      // Check for new types/attributes
      const { newEntityTypes, newAttributes } = detectNewTypesAndAttributes(data);
      
      if (newEntityTypes.length > 0 || newAttributes.length > 0) {
        // Show merge dialog
        setPendingImport(data);
        setMergeDialog({ newEntityTypes, newAttributes });
      } else {
        // No new types/attrs - import directly
        onImport(data, keepExistingEntities, keepExistingMetadata, false);
        setJsonInput('');
      }
    } catch (error) {
      console.error('Invalid JSON:', error);
      alert('Invalid JSON format');
    }
  };

  const handleConfirmMerge = () => {
    if (pendingImport) {
      onImport(pendingImport, keepExistingEntities, keepExistingMetadata, true);
      setJsonInput('');
    }
    setMergeDialog(null);
    setPendingImport(null);
  };

  const handleSkipMerge = () => {
    if (pendingImport) {
      onImport(pendingImport, keepExistingEntities, keepExistingMetadata, false);
      setJsonInput('');
    }
    setMergeDialog(null);
    setPendingImport(null);
  };

  const canGenerate = inputText.trim().length > 50 && !isProcessing && !isExtracting && entityTypes.length > 0 && openAiApiKey.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="settings" className="flex flex-col h-full">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-auto shrink-0">
          <TabsTrigger 
            value="settings"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-3 font-serif text-xs"
          >
            <Settings className="w-4 h-4 mr-1" />
            Settings
          </TabsTrigger>
          <TabsTrigger 
            value="extract"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-3 font-serif text-xs"
          >
            <FileText className="w-4 h-4 mr-1" />
            Extract
          </TabsTrigger>
          <TabsTrigger 
            value="json"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-3 font-serif text-xs"
          >
            <FileJson className="w-4 h-4 mr-1" />
            Data
          </TabsTrigger>
          <TabsTrigger 
            value="questions"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-3 font-serif text-xs"
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            Questions
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="flex-1 m-0 overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-4 ink-texture">
            {/* Campaign Info Section */}
            <div className="space-y-3 pb-4 border-b border-border">
              <h2 className="text-lg font-display text-foreground">Campaign Info</h2>
              <div className="space-y-2">
                <Label htmlFor="campaign-name" className="text-sm font-serif">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  value={campaignMetadata.name}
                  onChange={(e) => onCampaignMetadataChange({ ...campaignMetadata, name: e.target.value })}
                  placeholder="Enter campaign name"
                  className="font-serif"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-serif text-muted-foreground">Created</Label>
                <p className="text-sm font-mono text-foreground">
                  {new Date(campaignMetadata.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            {/* Entity Types Section */}
            <div className="space-y-2">
              <div className="space-y-1">
                <h2 className="text-lg font-display text-foreground">Entity Types</h2>
                <p className="text-sm text-muted-foreground font-serif">
                  Configure entity types and their attributes
                </p>
              </div>

            {entityTypes.map((typeDef) => {
              const isOpen = openEntityTypes.includes(typeDef.key);

              return (
                <Collapsible 
                  key={typeDef.key} 
                  open={isOpen}
                  onOpenChange={() => toggleEntityTypeOpen(typeDef.key)}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  <CollapsibleTrigger className="w-full">
                    <div className={cn(
                      "flex items-center justify-between p-3 hover:bg-muted/30 transition-colors",
                      isOpen && "bg-muted/20"
                    )}>
                      <div className="flex items-center gap-3">
                        <Popover>
                          <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button 
                              className="w-4 h-4 rounded-full border border-border/50 hover:scale-110 transition-transform"
                              style={{ backgroundColor: typeDef.color }}
                            />
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2 bg-popover" align="start">
                            <div className="grid grid-cols-5 gap-1">
                              {COLOR_PALETTE.map((color) => (
                                <button
                                  key={color}
                                  className={cn(
                                    "w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform",
                                    typeDef.color === color ? "border-foreground" : "border-transparent"
                                  )}
                                  style={{ backgroundColor: color }}
                                  onClick={() => handleUpdateEntityType(typeDef.key, { color })}
                                />
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <span className="font-serif font-medium">{typeDef.label}</span>
                        <span className="text-xs text-muted-foreground">({typeDef.attributes.length} attrs)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveEntityType(typeDef.key);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        <ChevronDown className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform",
                          isOpen && "rotate-180"
                        )} />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-3">
                      {/* Entity Type Name */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                          Type Name
                        </Label>
                        <Input
                          value={typeDef.label}
                          onChange={(e) => handleUpdateEntityTypeKey(typeDef.key, e.target.value)}
                          className="h-8 text-sm font-serif"
                          placeholder="Entity type name"
                        />
                      </div>

                      {/* Extraction Prompt */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                          Extraction Prompt
                        </Label>
                        <Textarea
                          value={typeDef.extractionPrompt || ''}
                          onChange={(e) => handleUpdateEntityType(typeDef.key, { extractionPrompt: e.target.value })}
                          className="min-h-[60px] text-sm font-serif resize-none"
                          placeholder="Optional: AI guidance for extracting this entity type..."
                        />
                      </div>

                      {/* Attributes */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                          Attributes
                        </Label>
                        <div className="space-y-2">
                          {typeDef.attributes.map((attr, idx) => {
                            const isProtected = attr.key === 'shortDescription';
                            return (
                              <div key={idx} className="flex gap-2">
                                <Input
                                  value={attr.label}
                                  onChange={(e) => handleUpdateAttribute(typeDef.key, idx, e.target.value)}
                                  placeholder="Attribute name"
                                  className={cn("h-8 text-sm font-serif", isProtected && "bg-muted/50")}
                                  disabled={isProtected}
                                />
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className={cn(
                                    "h-8 px-2 shrink-0",
                                    isProtected 
                                      ? "text-muted-foreground/30 cursor-not-allowed" 
                                      : "text-muted-foreground hover:text-destructive"
                                  )}
                                  onClick={() => handleRemoveAttribute(typeDef.key, idx)}
                                  disabled={isProtected}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            );
                          })}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full font-serif text-muted-foreground"
                            onClick={() => handleAddAttribute(typeDef.key)}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Attribute
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            <Button
              variant="outline"
              className="w-full font-serif"
              onClick={handleAddEntityType}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Entity Type
            </Button>
            </div>
            <div className="pt-4 border-t border-border mt-4 space-y-4">
              {/* Prompt Settings */}
              <div className="space-y-3">
                <h3 className="text-sm font-display text-foreground">Prompt Settings</h3>
                
                {/* Content Language */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                    Content Language
                  </Label>
                  <Input
                    value={promptSettings.contentLanguage}
                    onChange={(e) => onPromptSettingsChange({ ...promptSettings, contentLanguage: e.target.value })}
                    className="h-8 text-sm font-serif"
                    placeholder="English, German, etc."
                  />
                </div>
                
                {/* Tone */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                    Tone / Setting
                  </Label>
                  <Input
                    value={promptSettings.tone}
                    onChange={(e) => onPromptSettingsChange({ ...promptSettings, tone: e.target.value })}
                    className="h-8 text-sm font-serif"
                    placeholder="High Fantasy, Dark Fantasy, etc."
                  />
                </div>
                
                {/* Missing Info Handling - Slider */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                    Infer Missing Info: {INFER_LEVEL_LABELS[promptSettings.inferLevel]}
                  </Label>
                  <Slider
                    value={[promptSettings.inferLevel]}
                    onValueChange={(value) => onPromptSettingsChange({ ...promptSettings, inferLevel: value[0] })}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground font-serif">
                    <span>Never</span>
                    <span>Always</span>
                  </div>
                </div>

                {/* System Prompt for JSON Export */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                    System Prompt (included in JSON export)
                  </Label>
                  <Textarea
                    value={promptSettings.systemPrompt}
                    onChange={(e) => onPromptSettingsChange({ ...promptSettings, systemPrompt: e.target.value })}
                    className="min-h-[120px] text-xs font-mono resize-none"
                    placeholder="Rules for ChatGPT when processing this JSON..."
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs font-serif text-muted-foreground"
                      onClick={() => onPromptSettingsChange({ ...promptSettings, systemPrompt: DEFAULT_SYSTEM_PROMPT })}
                    >
                      Reset to Default
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Extract Tab (AI Extraction from PDF/Text) */}
        <TabsContent value="extract" className="flex-1 m-0 overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-4 ink-texture">
            {/* Header */}
            <div className="space-y-1">
              <h2 className="text-lg font-display text-foreground">AI Extraction</h2>
              <p className="text-sm text-muted-foreground font-serif">
                Upload PDF or paste text for AI extraction using OpenAI.
              </p>
              <p className="text-xs text-muted-foreground/70 font-serif italic">
                Alternatively, use the "Copy as Prompt" button in the Data tab to generate entities with any external AI (ChatGPT, Claude, etc.) and import the JSON result.
              </p>
            </div>

            {/* OpenAI API Key Input */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                OpenAI API Key
              </Label>
              <Input
                type="password"
                value={openAiApiKey}
                onChange={(e) => setOpenAiApiKey(e.target.value)}
                placeholder="sk-..."
                className="h-8 text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground font-serif">
                Your API key is only used in your browser and not stored
              </p>
            </div>

            {/* File Upload */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-border",
                isExtracting && "pointer-events-none opacity-50"
              )}
              onDrop={(e) => handleDrop(e, false)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {isExtracting ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-serif">Extracting text...</span>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground font-serif mb-2">
                    {fileName ? fileName : 'Drop PDF here or'}
                  </p>
                  <label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handlePdfFileInput}
                      className="hidden"
                    />
                    <Button variant="outline" size="sm" className="font-serif" asChild>
                      <span>Browse PDF</span>
                    </Button>
                  </label>
                </>
              )}
            </div>

            {/* Text Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-2">
                  <Type className="w-3 h-3" />
                  Or Paste Text
                </Label>
                {inputText && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs font-serif text-muted-foreground"
                    onClick={() => {
                      setInputText('');
                      setFileName(null);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your campaign notes, adventures, or world-building content here..."
                className="min-h-[200px] font-serif text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground font-serif">
                {inputText.length} characters
              </p>
            </div>

            {/* Keep Existing Options */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="keepExistingEntities"
                  checked={keepExistingEntities}
                  onCheckedChange={(checked) => setKeepExistingEntities(checked === true)}
                />
                <label
                  htmlFor="keepExistingEntities"
                  className="text-sm font-serif text-muted-foreground cursor-pointer"
                >
                  Keep existing entities (merge)
                </label>
              </div>
            </div>

            {/* Max Entities Slider */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                Max Entities to Extract: {maxExtractedEntities}
              </Label>
              <Slider
                value={[maxExtractedEntities]}
                onValueChange={(value) => setMaxExtractedEntities(value[0])}
                min={1}
                max={50}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-serif">
                <span>1</span>
                <span>50</span>
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full font-serif"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {processingState.message}
                </>
              ) : (
                'Extract Campaign'
              )}
            </Button>

            {processingState.error && (
              <p className="text-sm text-destructive font-serif">{processingState.error}</p>
            )}
          </div>
        </TabsContent>

        {/* Data Tab (JSON Import/Export) */}
        <TabsContent value="json" className="flex-1 m-0 overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-4 ink-texture">
            {/* Export Section */}
            <div className="space-y-3 pb-4 border-b border-border">
              <div className="space-y-1">
                <h2 className="text-lg font-display text-foreground">Export</h2>
                <p className="text-sm text-muted-foreground font-serif">
                  Download or copy your campaign data
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 font-serif"
                  onClick={onExport}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export JSON
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 font-serif"
                  onClick={() => {
                    // Generate the same export data inline for copy
                    const exportData: CampaignExport = {
                      version: '1.0',
                      exportedAt: new Date().toISOString(),
                      metadata: campaignMetadata,
                      entityTypes: entityTypes,
                      entities: campaignData?.entities || [],
                      promptSettings: promptSettings,
                    };
                    
                    // Generate chatGptPrompt inline
                    const entityExamples = entityTypes.map(t => {
                      const exampleAttrs: Record<string, string> = {
                        id: `${t.key}-1`,
                        type: t.key,
                        name: `Example ${t.label}`,
                        review: 'false',
                      };
                      t.attributes.forEach(attr => {
                        if (attr.key === 'attacks') {
                          exampleAttrs[attr.key] = 'Longsword: +4 | 1d8+5 slashing\nDagger: +2 | 1d4+3 piercing\nFirecast: +5 | 50% Burning';
                        } else if (attr.key === 'associatedEntities') {
                          exampleAttrs[attr.key] = 'Aragorn, Legolas, Gimli';
                        } else if (attr.key === 'speed') {
                          exampleAttrs[attr.key] = '9';
                        } else {
                          exampleAttrs[attr.key] = `[${attr.label} here]`;
                        }
                      });
                      return JSON.stringify(exampleAttrs, null, 2);
                    }).join('\n\n');

                    exportData.chatGptPrompt = `## ChatGPT Instructions for Dungeon Desk JSON

${promptSettings.systemPrompt}

### Mode 1: Update Existing Entities
Modify the entities array while preserving: all IDs, structure, metadata, entityTypes, promptSettings.
Output the complete JSON with your changes.

### Mode 2: Create New Entities
Output ONLY this structure for merging:
{"version":"1.0","entities":[...your new entities...]}
Then paste into JSON field and Import with "Keep existing entities" checked.

### Settings
- Language: ${promptSettings.contentLanguage}
- Tone: ${promptSettings.tone}
- Infer Missing: ${promptSettings.inferLevel <= 2 ? 'Rarely' : promptSettings.inferLevel >= 4 ? 'Often' : 'Sometimes'}

### Entity Types & Attributes
${entityTypes.map(t => `**${t.label}** (type: "${t.key}")\nAttributes: ${t.attributes.map(a => `${a.key}`).join(', ')}, review`).join('\n\n')}

### Example Entities (follow this structure EXACTLY)
${entityExamples}`;

                    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
                    toast({
                      title: "JSON copied",
                      description: "Full campaign JSON with AI prompt copied - paste directly to ChatGPT",
                    });
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy as Prompt
                </Button>
              </div>
              <p className="text-xs text-muted-foreground font-serif italic">
                "Copy as Prompt" includes AI instructions - paste directly into ChatGPT to generate new entities
              </p>
            </div>

            {/* Import Section */}
            <div className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-lg font-display text-foreground">Import</h2>
                <p className="text-sm text-muted-foreground font-serif">
                  Load campaign data from JSON
                </p>
              </div>

              <div
                className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-border"
              )}
              onDrop={(e) => handleDrop(e, true)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <FileJson className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground font-serif mb-2">
                Drop JSON file here or
              </p>
              <label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleJsonFileInput}
                  className="hidden"
                />
                <Button variant="outline" size="sm" className="font-serif" asChild>
                  <span>Browse JSON</span>
                </Button>
              </label>
            </div>

            {/* JSON Text Input */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                Or Paste JSON
              </Label>
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{"version": "1.0", "entities": [...], "entityTypes": [...]}'
                className="min-h-[150px] font-mono text-xs resize-none"
              />
            </div>

            {/* Keep Existing Options */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="keepExistingEntitiesJson"
                  checked={keepExistingEntities}
                  onCheckedChange={(checked) => setKeepExistingEntities(checked === true)}
                />
                <label
                  htmlFor="keepExistingEntitiesJson"
                  className="text-sm font-serif text-muted-foreground cursor-pointer"
                >
                  Keep existing entities (merge)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="keepExistingMetadataJson"
                  checked={keepExistingMetadata}
                  onCheckedChange={(checked) => setKeepExistingMetadata(checked === true)}
                />
                <label
                  htmlFor="keepExistingMetadataJson"
                  className="text-sm font-serif text-muted-foreground cursor-pointer"
                >
                  Keep existing metadata (name & date)
                </label>
              </div>
            </div>

            {/* Import Button */}
            <Button
              onClick={handleJsonImport}
              disabled={!jsonInput.trim()}
              className="w-full font-serif"
            >
              Import JSON
            </Button>

            {/* Clear All Entities Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full font-serif text-muted-foreground border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
              onClick={onClearAllEntities}
              disabled={!hasData}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Entities
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Questions Tab */}
        <TabsContent value="questions" className="flex-1 m-0 overflow-hidden">
          <QuestionsPanel 
            data={campaignData}
            entityTypes={entityTypes}
            onSelectField={onSelectField}
          />
        </TabsContent>
      </Tabs>

      {/* Delete Warning Dialog */}
      <Dialog open={!!deleteWarning} onOpenChange={() => setDeleteWarning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription className="font-serif">
              {deleteWarning?.type === 'entityType' ? (
                <>
                  Deleting this entity type will remove <strong>{deleteWarning.affectedCount}</strong> existing entities.
                </>
              ) : (
                <>
                  Deleting this attribute will remove content from <strong>{deleteWarning?.affectedCount}</strong> entities.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteWarning(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteWarning?.onConfirm()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={!!mergeDialog} onOpenChange={() => { setMergeDialog(null); setPendingImport(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              New Configuration Found
            </DialogTitle>
            <DialogDescription className="font-serif">
              The imported file contains entity types or attributes not in your current setup.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 my-4">
            {mergeDialog && mergeDialog.newEntityTypes.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">New Entity Types:</h4>
                <ul className="space-y-1">
                  {mergeDialog.newEntityTypes.map(t => (
                    <li key={t.key} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      {t.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {mergeDialog && mergeDialog.newAttributes.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">New Attributes:</h4>
                {mergeDialog.newAttributes.map(item => (
                  <div key={item.typeKey} className="text-sm text-muted-foreground">
                    <strong>{item.typeName}:</strong> {item.attributes.map(a => a.label).join(', ')}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => { setMergeDialog(null); setPendingImport(null); }}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleSkipMerge}>
              Skip (Entities Only)
            </Button>
            <Button onClick={handleConfirmMerge}>
              Merge All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
