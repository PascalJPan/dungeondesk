import React, { useState, useCallback } from 'react';
import { Upload, FileText, Type, Loader2, Plus, X, Download, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ProcessingState, ExtractionOptions, EntityType, ENTITY_TYPE_INFO, CustomAttribute, CampaignExport, CampaignData } from '@/types/mindmap';
import { cn } from '@/lib/utils';

interface InputPanelProps {
  onProcess: (text: string, extractionOptions: ExtractionOptions) => void;
  onImport: (data: CampaignExport) => void;
  onExport: () => void;
  processingState: ProcessingState;
  hasData: boolean;
}

const ALL_ENTITY_TYPES: EntityType[] = ['location', 'happening', 'character', 'monster', 'item'];

export function InputPanel({ onProcess, onImport, onExport, processingState, hasData }: InputPanelProps) {
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<EntityType[]>(['location', 'happening', 'character', 'monster', 'item']);
  const [customAttributes, setCustomAttributes] = useState<Record<EntityType, CustomAttribute[]>>({
    location: [],
    happening: [],
    character: [],
    monster: [],
    item: [],
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [attributesOpen, setAttributesOpen] = useState(false);

  const isProcessing = processingState.status !== 'idle' && processingState.status !== 'complete' && processingState.status !== 'error';

  const handleEntityTypeToggle = (type: EntityType, checked: boolean) => {
    if (checked) {
      setSelectedEntityTypes(prev => [...prev, type]);
    } else {
      setSelectedEntityTypes(prev => prev.filter(t => t !== type));
    }
  };

  const handleAddAttribute = (type: EntityType) => {
    const newAttr: CustomAttribute = {
      key: `custom_${Date.now()}`,
      label: '',
      type: 'text',
    };
    setCustomAttributes(prev => ({
      ...prev,
      [type]: [...prev[type], newAttr],
    }));
  };

  const handleUpdateAttribute = (type: EntityType, index: number, label: string) => {
    setCustomAttributes(prev => ({
      ...prev,
      [type]: prev[type].map((attr, i) => 
        i === index ? { ...attr, label, key: `custom_${label.toLowerCase().replace(/\s+/g, '_')}` } : attr
      ),
    }));
  };

  const handleRemoveAttribute = (type: EntityType, index: number) => {
    setCustomAttributes(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index),
    }));
  };

  const handleFileUpload = useCallback(async (file: File) => {
    // Handle JSON import
    if (file.name.toLowerCase().endsWith('.json')) {
      try {
        const text = await file.text();
        const data = JSON.parse(text) as CampaignExport;
        if (data.version && data.entities) {
          onImport(data);
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
    if (!inputText.trim() || selectedEntityTypes.length === 0) return;
    
    // Filter out empty custom attributes
    const filteredCustomAttributes: Record<EntityType, CustomAttribute[]> = {} as any;
    for (const type of ALL_ENTITY_TYPES) {
      filteredCustomAttributes[type] = customAttributes[type].filter(a => a.label.trim());
    }
    
    const extractionOptions: ExtractionOptions = {
      entityTypes: selectedEntityTypes,
      customAttributes: filteredCustomAttributes,
    };
    
    onProcess(inputText, extractionOptions);
  };

  const canGenerate = inputText.trim().length > 50 && !isProcessing && !isExtracting && selectedEntityTypes.length > 0;

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto scrollbar-thin ink-texture">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-lg font-display text-foreground">Campaign Input</h2>
        <p className="text-sm text-muted-foreground font-serif">
          Upload notes, paste text, or import JSON
        </p>
      </div>

      {/* Import/Export */}
      {hasData && (
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 font-serif"
            onClick={onExport}
          >
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
        </div>
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
          className="flex-1 min-h-[120px] resize-none bg-muted/30 border-border focus:border-primary/50 text-sm scrollbar-thin font-serif"
        />
        <div className="text-xs text-muted-foreground text-right font-mono">
          {inputText.length.toLocaleString()} characters
        </div>
      </div>

      {/* Entity Types */}
      <div className="space-y-2">
        <Label className="text-sm font-medium font-serif">Extract Entity Types</Label>
        <div className="grid grid-cols-2 gap-2">
          {ALL_ENTITY_TYPES.map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox
                id={`entity-${type}`}
                checked={selectedEntityTypes.includes(type)}
                onCheckedChange={(checked) => handleEntityTypeToggle(type, checked as boolean)}
              />
              <Label 
                htmlFor={`entity-${type}`} 
                className="text-sm cursor-pointer flex items-center gap-2 font-serif"
              >
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: ENTITY_TYPE_INFO[type].color }}
                />
                {ENTITY_TYPE_INFO[type].label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Attributes */}
      <Collapsible open={attributesOpen} onOpenChange={setAttributesOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between font-serif">
            <span>Custom Attributes</span>
            <Plus className={cn("w-4 h-4 transition-transform", attributesOpen && "rotate-45")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {ALL_ENTITY_TYPES.filter(t => selectedEntityTypes.includes(t)).map((type) => (
            <div key={type} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground font-mono uppercase">
                  {ENTITY_TYPE_INFO[type].label}
                </Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2"
                  onClick={() => handleAddAttribute(type)}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              {customAttributes[type].map((attr, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={attr.label}
                    onChange={(e) => handleUpdateAttribute(type, idx, e.target.value)}
                    placeholder="Attribute name (e.g., ATK)"
                    className="h-7 text-xs font-serif"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2"
                    onClick={() => handleRemoveAttribute(type, idx)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

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
  );
}
