/**
 * Unified Document Extractor
 *
 * Extracts text content from multiple document formats:
 * - PDF (.pdf)
 * - Microsoft Word (.docx)
 * - OpenDocument Text (.odt)
 * - Rich Text Format (.rtf)
 *
 * Uses officeparser for Office formats which preserves formatting better
 * than raw PDF extraction.
 */

import { parseOffice } from 'officeparser';
import { extractPdfText, type PdfExtractionResult } from '../pdf/extractor';

/**
 * Supported document formats
 */
export type SupportedFormat = 'pdf' | 'docx' | 'odt' | 'rtf';

/**
 * MIME type to format mapping
 */
export const MIME_TO_FORMAT: Record<string, SupportedFormat> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'docx', // Legacy .doc might be uploaded
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
};

/**
 * File extension to format mapping
 */
export const EXTENSION_TO_FORMAT: Record<string, SupportedFormat> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.doc': 'docx',
  '.odt': 'odt',
  '.rtf': 'rtf',
};

/**
 * Document extraction result
 */
export interface DocumentExtractionResult {
  /** Full extracted text */
  text: string;
  /** Document format */
  format: SupportedFormat;
  /** Number of pages (if available) */
  pages?: number;
  /** Document metadata */
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    creationDate?: string;
    modificationDate?: string;
  };
  /** Detected sections */
  sections: Map<string, string>;
}

/**
 * Detect document format from MIME type or filename
 */
export function detectFormat(mimeType?: string, filename?: string): SupportedFormat | null {
  // Try MIME type first
  if (mimeType && MIME_TO_FORMAT[mimeType]) {
    return MIME_TO_FORMAT[mimeType];
  }

  // Fall back to file extension
  if (filename) {
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && EXTENSION_TO_FORMAT[ext]) {
      return EXTENSION_TO_FORMAT[ext];
    }
  }

  return null;
}

/**
 * Check if a format is supported
 */
export function isSupportedFormat(format: string | null): format is SupportedFormat {
  return format !== null && ['pdf', 'docx', 'odt', 'rtf'].includes(format);
}

/**
 * Extract text from an Office document (docx, odt, rtf) using officeparser
 */
async function extractOfficeDocument(
  buffer: Buffer,
  format: SupportedFormat
): Promise<DocumentExtractionResult> {
  try {
    // parseOffice returns an AST with a toText() method
    const result = await parseOffice(buffer);

    let text = '';
    const metadata: DocumentExtractionResult['metadata'] = {};

    if (typeof result === 'string') {
      // Unlikely but handle string output
      text = result;
    } else if (result && typeof result === 'object') {
      // Use the built-in toText() method for proper text extraction
      if ('toText' in result && typeof result.toText === 'function') {
        text = result.toText();
      } else if ('content' in result && Array.isArray(result.content)) {
        // Fallback: manually extract text from content nodes
        text = extractTextFromContentNodes(result.content);
      }

      // Extract metadata if available
      if ('metadata' in result && result.metadata) {
        const meta = result.metadata as Record<string, unknown>;
        metadata.title = meta.title as string | undefined;
        metadata.author = meta.author as string | undefined;
        metadata.creator = meta.creator as string | undefined;
      }
    }

    // Clean up the extracted text
    text = cleanExtractedText(text);

    return {
      text,
      format,
      metadata,
      sections: new Map(),
    };
  } catch (error) {
    throw new Error(
      `Failed to extract ${format.toUpperCase()} content: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Extract text from officeparser content nodes.
 * Used as a fallback if toText() is not available.
 */
function extractTextFromContentNodes(content: unknown[]): string {
  const lines: string[] = [];

  function processNode(node: unknown): void {
    if (!node || typeof node !== 'object') return;

    const obj = node as Record<string, unknown>;
    const nodeType = obj.type as string | undefined;

    // For table rows, extract cells in order and join with tab
    if (nodeType === 'row' && 'children' in obj && Array.isArray(obj.children)) {
      const cellTexts: string[] = [];
      for (const child of obj.children) {
        const childObj = child as Record<string, unknown>;
        if (childObj.type === 'cell' && typeof childObj.text === 'string') {
          cellTexts.push(childObj.text.trim());
        }
      }
      if (cellTexts.length > 0) {
        lines.push(cellTexts.join('\t'));
      }
      return;
    }

    // For table nodes, process children (rows)
    if (nodeType === 'table' && 'children' in obj && Array.isArray(obj.children)) {
      for (const child of obj.children) {
        processNode(child);
      }
      return;
    }

    // For paragraphs/headings, extract text directly
    if ((nodeType === 'paragraph' || nodeType === 'heading') && typeof obj.text === 'string') {
      const text = obj.text.trim();
      if (text) {
        lines.push(text);
      }
      return;
    }

    // Process children recursively for other node types
    if ('children' in obj && Array.isArray(obj.children)) {
      for (const child of obj.children) {
        processNode(child);
      }
    }
  }

  for (const node of content) {
    processNode(node);
  }

  return lines.join('\n');
}

/**
 * Clean up extracted text - normalize whitespace, fix formatting
 */
function cleanExtractedText(text: string): string {
  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Collapse multiple blank lines to double newline (paragraph break)
    .replace(/\n{3,}/g, '\n\n')
    // Remove trailing whitespace from lines
    .replace(/[ \t]+$/gm, '')
    // Remove leading whitespace from lines (but preserve indentation structure)
    .replace(/^[ \t]+/gm, '')
    .trim();
}

/**
 * Extract text and metadata from a document buffer
 *
 * Supports PDF, DOCX, ODT, and RTF formats.
 */
export async function extractDocument(
  buffer: Buffer,
  mimeType?: string,
  filename?: string
): Promise<DocumentExtractionResult> {
  const format = detectFormat(mimeType, filename);

  if (!format) {
    throw new Error(
      `Unsupported document format. Supported formats: PDF, DOCX, ODT, RTF`
    );
  }

  if (format === 'pdf') {
    // Use existing PDF extractor
    const pdfResult = await extractPdfText(buffer);
    return {
      text: pdfResult.text,
      format: 'pdf',
      pages: pdfResult.pages,
      metadata: pdfResult.metadata,
      sections: pdfResult.sections,
    };
  }

  // Use officeparser for Office formats
  return extractOfficeDocument(buffer, format);
}

/**
 * Get accepted file types for upload components
 */
export function getAcceptedFileTypes(): string {
  return '.pdf,.docx,.doc,.odt,.rtf';
}

/**
 * Get accepted MIME types for validation
 */
export function getAcceptedMimeTypes(): string[] {
  return Object.keys(MIME_TO_FORMAT);
}
