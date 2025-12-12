import React, { useState, useCallback } from 'react';
import { Upload, FileText, Type, Loader2, Plus, X, Download, Settings, ChevronDown, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProcessingState, ExtractionOptions, EntityTypeDef, AttributeDef, CampaignExport, COLOR_PALETTE, DEFAULT_ENTITY_TYPES, CampaignEntity } from '@/types/mindmap';
import { cn } from '@/lib/utils';

interface InputPanelProps {
  onProcess: (text: string, extractionOptions: ExtractionOptions, keepExisting: boolean) => void;
  onImport: (data: CampaignExport, keepExisting: boolean) => void;
  onExport: () => void;
  processingState: ProcessingState;
  hasData: boolean;
  entityTypes: EntityTypeDef[];
  onEntityTypesChange: (types: EntityTypeDef[]) => void;
  existingEntities: CampaignEntity[];
}

interface DeleteWarning {
  type: 'entityType' | 'attribute';
  entityTypeKey: string;
  attributeKey?: string;
  affectedCount: number;
  onConfirm: () => void;
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
}: InputPanelProps) {
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [openEntityTypes, setOpenEntityTypes] = useState<string[]>([]);
  const [keepAllEntities, setKeepAllEntities] = useState(true);
  const [deleteWarning, setDeleteWarning] = useState<DeleteWarning | null>(null);

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

  const handleFileUpload = useCallback(async (file: File) => {
    if (file.name.toLowerCase().endsWith('.json')) {
      try {
        const text = await file.text();
        const data = JSON.parse(text) as CampaignExport;
        if (data.version && data.entities) {
          onImport(data, keepAllEntities);
          setFileName(file.name);
          return;
        }
      } catch (error) {
        console.error('Invalid JSON:', error);
        alert('Invalid campaign JSON file');
        return;
      }
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF or JSON file');
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
  }, [onImport]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleGenerate = () => {
    if (!inputText.trim() || entityTypes.length === 0) return;
    
    const extractionOptions: ExtractionOptions = {
      entityTypes: entityTypes,
    };
    
    onProcess(inputText, extractionOptions, keepAllEntities);
  };

  const canGenerate = inputText.trim().length > 50 && !isProcessing && !isExtracting && entityTypes.length > 0;

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="settings" className="flex flex-col h-full">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-auto shrink-0">
          <TabsTrigger 
            value="settings"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-serif"
          >
            <Settings className="w-4 h-4 mr-1" />
            Settings
          </TabsTrigger>
          <TabsTrigger 
            value="input"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-serif"
          >
            <FileText className="w-4 h-4 mr-1" />
            Input
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="flex-1 m-0 overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-2 ink-texture">
            <div className="space-y-1 mb-4">
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
                          {typeDef.attributes.map((attr, idx) => (
                            <div key={idx} className="flex gap-2">
                              <Input
                                value={attr.label}
                                onChange={(e) => handleUpdateAttribute(typeDef.key, idx, e.target.value)}
                                placeholder="Attribute name"
                                className="h-8 text-sm font-serif"
                              />
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveAttribute(typeDef.key, idx)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
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
        </TabsContent>

        {/* Input Tab */}
        <TabsContent value="input" className="flex-1 m-0 overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-4 ink-texture">
            {/* Header */}
            <div className="space-y-1">
              <h2 className="text-lg font-display text-foreground">Campaign Input</h2>
              <p className="text-sm text-muted-foreground font-serif">
                Upload notes, paste text, or import JSON
              </p>
            </div>

            {/* Import/Export */}
            {hasData && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full font-serif"
                onClick={onExport}
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            )}

            {/* File Upload */}
            <div
              className={cn(
                "relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 cursor-pointer",
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
                isExtracting && "pointer-events-none opacity-70"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf,.json"
                className="hidden"
                onChange={handleFileInput}
              />
              <div className="flex flex-col items-center gap-2 text-center">
                {isExtracting ? (
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                ) : (
                  <Upload className={cn(
                    "w-8 h-8 transition-colors",
                    isDragging ? "text-primary" : "text-muted-foreground"
                  )} />
                )}
                <div>
                  {fileName ? (
                    <div className="flex items-center gap-2 text-sm text-foreground font-serif">
                      <FileText className="w-4 h-4 text-primary" />
                      {fileName}
                    </div>
                  ) : isExtracting ? (
                    <p className="text-sm text-muted-foreground font-serif">Extracting text...</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground font-serif">
                        Drop PDF or JSON here
                      </p>
                      <p className="text-xs text-muted-foreground font-serif">PDF for extraction, JSON to continue</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Text Input */}
            <div className="flex-1 flex flex-col gap-2 min-h-0">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm text-muted-foreground font-serif">Or paste text directly</Label>
              </div>
              <Textarea
                placeholder="Paste your campaign notes here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 min-h-[150px] resize-none bg-muted/30 border-border focus:border-primary/50 text-sm scrollbar-thin font-serif"
              />
              <div className="text-xs text-muted-foreground text-right font-mono">
                {inputText.length.toLocaleString()} characters
              </div>
            </div>

            {/* Keep All Entities Checkbox */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              <Checkbox
                id="keep-all-entities"
                checked={keepAllEntities}
                onCheckedChange={(checked) => setKeepAllEntities(checked === true)}
              />
              <Label htmlFor="keep-all-entities" className="text-sm font-serif cursor-pointer flex-1">
                Keep existing entities (merge)
              </Label>
            </div>

            {/* Generate Button */}
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full font-display text-base glow-primary-sm"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {processingState.message}
                </>
              ) : (
                'Extract Campaign'
              )}
            </Button>

            {/* Progress */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${processingState.progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center font-mono">
                  {processingState.progress}% complete
                </p>
              </div>
            )}

            {/* Error */}
            {processingState.status === 'error' && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-sm text-destructive font-serif">{processingState.error}</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Warning Dialog */}
      <Dialog open={!!deleteWarning} onOpenChange={() => setDeleteWarning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Warning: Data will be deleted
            </DialogTitle>
            <DialogDescription className="text-sm">
              {deleteWarning?.type === 'entityType' ? (
                <>
                  Deleting this entity type will remove <strong>{deleteWarning.affectedCount} entities</strong> from your campaign.
                </>
              ) : (
                <>
                  Deleting this attribute will remove content from <strong>{deleteWarning?.affectedCount} entities</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteWarning(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteWarning?.onConfirm}>
              Delete Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
