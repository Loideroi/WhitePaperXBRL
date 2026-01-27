'use client';

/**
 * iXBRL Preview Component
 *
 * Displays generated iXBRL content with syntax highlighting and download option.
 */

import { useState, useCallback, useMemo } from 'react';
import { X, Download, Copy, Check, Code, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface IXBRLPreviewProps {
  /** The iXBRL content to display */
  content: string;
  /** Filename for download */
  filename: string;
  /** Callback when closing the preview */
  onClose: () => void;
  /** Callback when download is requested */
  onDownload?: () => void;
}

interface Section {
  name: string;
  startIndex: number;
  endIndex: number;
  content: string;
}

export function IXBRLPreview({ content, filename, onClose, onDownload }: IXBRLPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Parse sections from the iXBRL content
  const sections = useMemo<Section[]>(() => {
    const result: Section[] = [];

    // Find main sections
    const headMatch = content.match(/<head[\s\S]*?<\/head>/i);
    if (headMatch) {
      result.push({
        name: 'Head (Metadata)',
        startIndex: content.indexOf(headMatch[0]),
        endIndex: content.indexOf(headMatch[0]) + headMatch[0].length,
        content: headMatch[0],
      });
    }

    // Find context section
    const contextMatch = content.match(/<ix:header[\s\S]*?<\/ix:header>/i);
    if (contextMatch) {
      result.push({
        name: 'XBRL Header (Contexts & Units)',
        startIndex: content.indexOf(contextMatch[0]),
        endIndex: content.indexOf(contextMatch[0]) + contextMatch[0].length,
        content: contextMatch[0],
      });
    }

    // Find body content (everything in the body after ix:header)
    const bodyMatch = content.match(/<body[\s\S]*?<\/body>/i);
    if (bodyMatch) {
      const bodyContent = bodyMatch[0];
      const headerEnd = bodyContent.indexOf('</ix:header>');
      if (headerEnd > -1) {
        const factsContent = bodyContent.slice(headerEnd + '</ix:header>'.length);
        result.push({
          name: 'Document Content (Facts)',
          startIndex: content.indexOf(bodyMatch[0]) + headerEnd + '</ix:header>'.length,
          endIndex: content.indexOf(bodyMatch[0]) + bodyMatch[0].length,
          content: factsContent,
        });
      }
    }

    return result;
  }, [content]);

  // Count facts
  const factCount = useMemo(() => {
    const matches = content.match(/<ix:(non)?[Ff]raction|<ix:(non)?[Nn]umeric/g);
    return matches?.length || 0;
  }, [content]);

  // Count contexts
  const contextCount = useMemo(() => {
    const matches = content.match(/<xbrli:context/g);
    return matches?.length || 0;
  }, [content]);

  // Handle copy
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  // Toggle section collapse
  const toggleSection = useCallback((sectionName: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionName)) {
        next.delete(sectionName);
      } else {
        next.add(sectionName);
      }
      return next;
    });
  }, []);

  // Apply basic syntax highlighting
  const highlightXML = useCallback((xml: string): React.ReactNode => {
    // Split into lines for better rendering
    const lines = xml.split('\n');

    return lines.map((line, lineIndex) => {
      // Apply highlighting patterns
      let highlighted = line
        // Tags
        .replace(
          /(&lt;|<)(\/?)([\w:-]+)/g,
          '<span class="text-blue-600">&lt;$2</span><span class="text-purple-600">$3</span>'
        )
        // Attributes
        .replace(
          /\s([\w:-]+)=/g,
          ' <span class="text-orange-600">$1</span>='
        )
        // Attribute values
        .replace(
          /="([^"]*)"/g,
          '="<span class="text-green-600">$1</span>"'
        )
        // Closing bracket
        .replace(
          /(\/?&gt;|\/?>)/g,
          '<span class="text-blue-600">$1</span>'
        )
        // Comments
        .replace(
          /(&lt;!--|<!--)([\s\S]*?)(--&gt;|-->)/g,
          '<span class="text-gray-500 italic">$1$2$3</span>'
        );

      return (
        <div key={lineIndex} className="table-row">
          <span className="table-cell pr-4 text-right text-gray-400 select-none w-12">
            {lineIndex + 1}
          </span>
          <span
            className="table-cell"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </div>
      );
    });
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold">iXBRL Preview</h3>
            <span className="text-xs text-muted-foreground">{filename}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Stats */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mr-4">
              <span>{contextCount} contexts</span>
              <span>{factCount} facts</span>
              <span>{(content.length / 1024).toFixed(1)} KB</span>
            </div>
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setViewMode('formatted')}
                className={`px-2 py-1 text-xs ${
                  viewMode === 'formatted'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`px-2 py-1 text-xs ${
                  viewMode === 'raw'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                <Code className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Actions */}
            <button
              onClick={handleCopy}
              className="px-2 py-1 rounded border border-border hover:bg-muted text-xs flex items-center gap-1"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={onDownload}
              className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-muted"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-muted/30">
          {viewMode === 'formatted' ? (
            <div className="p-4 space-y-4">
              {sections.length > 0 ? (
                sections.map((section) => (
                  <div key={section.name} className="rounded-lg border bg-card overflow-hidden">
                    <button
                      onClick={() => toggleSection(section.name)}
                      className="w-full px-4 py-2 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <span className="font-medium text-sm">{section.name}</span>
                      {collapsedSections.has(section.name) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </button>
                    {!collapsedSections.has(section.name) && (
                      <div className="p-4 overflow-auto max-h-96">
                        <div className="table text-xs font-mono">
                          {highlightXML(section.content)}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border bg-card p-4 overflow-auto">
                  <div className="table text-xs font-mono">
                    {highlightXML(content)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-card rounded-lg p-4 border">
                {content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
