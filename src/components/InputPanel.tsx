import React, { useState, useCallback } from 'react';
import { Upload, FileText, Type, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChunkingMethod, ProcessingState } from '@/types/mindmap';
import { cn } from '@/lib/utils';

interface InputPanelProps {
  onProcess: (text: string, method: ChunkingMethod, customSize?: number) => void;
  processingState: ProcessingState;
}

export function InputPanel({ onProcess, processingState }: InputPanelProps) {
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [chunkingMethod, setChunkingMethod] = useState<ChunkingMethod>('sentence');
  const [customChunkSize, setCustomChunkSize] = useState(500);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const isProcessing = processingState.status !== 'idle' && processingState.status !== 'complete' && processingState.status !== 'error';

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF file');
      return;
    }

    setIsExtracting(true);
    setFileName(file.name);

    try {
      // Use pdf.js for PDF extraction
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
    if (!inputText.trim()) return;
    onProcess(inputText, chunkingMethod, chunkingMethod === 'custom' ? customChunkSize : undefined);
  };

  const canGenerate = inputText.trim().length > 50 && !isProcessing && !isExtracting;

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-lg font-mono font-semibold text-foreground">Input</h2>
        <p className="text-sm text-muted-foreground">
          Upload a PDF or paste your text
        </p>
      </div>

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
          accept=".pdf"
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
              <div className="flex items-center gap-2 text-sm text-foreground">
                <FileText className="w-4 h-4 text-primary" />
                {fileName}
              </div>
            ) : isExtracting ? (
              <p className="text-sm text-muted-foreground">Extracting text...</p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Drop PDF here or click to upload
                </p>
                <p className="text-xs text-muted-foreground">PDF files only</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Text Input */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm text-muted-foreground">Or paste text directly</Label>
        </div>
        <Textarea
          placeholder="Paste your text here..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 min-h-[200px] resize-none bg-muted/30 border-border focus:border-primary/50 text-sm scrollbar-thin"
        />
        <div className="text-xs text-muted-foreground text-right">
          {inputText.length.toLocaleString()} characters
        </div>
      </div>

      {/* Chunking Options */}
      <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-sm">
            <span className="text-muted-foreground">Chunking Options</span>
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              isAdvancedOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-3">
          <RadioGroup
            value={chunkingMethod}
            onValueChange={(v) => setChunkingMethod(v as ChunkingMethod)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="sentence" id="sentence" />
              <Label htmlFor="sentence" className="text-sm cursor-pointer">
                Sentences <span className="text-muted-foreground">(auto-detects lists)</span>
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="line" id="line" />
              <Label htmlFor="line" className="text-sm cursor-pointer">
                Lines <span className="text-muted-foreground">(for bullet points & lists)</span>
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="paragraph" id="paragraph" />
              <Label htmlFor="paragraph" className="text-sm cursor-pointer">
                Paragraphs
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="custom" id="custom" />
              <Label htmlFor="custom" className="text-sm cursor-pointer">
                Custom size
              </Label>
            </div>
          </RadioGroup>
          
          {chunkingMethod === 'custom' && (
            <div className="flex items-center gap-2 pl-6">
              <Input
                type="number"
                value={customChunkSize}
                onChange={(e) => setCustomChunkSize(parseInt(e.target.value) || 500)}
                className="w-24 h-8 text-sm"
                min={100}
                max={2000}
              />
              <span className="text-xs text-muted-foreground">characters</span>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Generate Button */}
      <Button
        variant="glow"
        size="lg"
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="w-full font-mono"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {processingState.message}
          </>
        ) : (
          'Generate Mindmap'
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
          <p className="text-xs text-muted-foreground text-center">
            {processingState.progress}% complete
          </p>
        </div>
      )}

      {/* Error */}
      {processingState.status === 'error' && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-sm text-destructive">{processingState.error}</p>
        </div>
      )}
    </div>
  );
}
