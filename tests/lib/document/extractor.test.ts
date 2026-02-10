import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('officeparser', () => ({
  parseOffice: vi.fn(),
}));

vi.mock('@/lib/pdf/extractor', () => ({
  extractPdfText: vi.fn(),
}));

import {
  detectFormat,
  isSupportedFormat,
  extractDocument,
  getAcceptedFileTypes,
  getAcceptedMimeTypes,
  MIME_TO_FORMAT,
} from '@/lib/document/extractor';
import { parseOffice } from 'officeparser';
import { extractPdfText } from '@/lib/pdf/extractor';

describe('Document Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectFormat', () => {
    it('should detect PDF from MIME type', () => {
      expect(detectFormat('application/pdf')).toBe('pdf');
    });

    it('should detect DOCX from MIME type', () => {
      expect(detectFormat('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('docx');
    });

    it('should detect ODT from MIME type', () => {
      expect(detectFormat('application/vnd.oasis.opendocument.text')).toBe('odt');
    });

    it('should detect RTF from application/rtf', () => {
      expect(detectFormat('application/rtf')).toBe('rtf');
    });

    it('should detect RTF from text/rtf', () => {
      expect(detectFormat('text/rtf')).toBe('rtf');
    });

    it('should fall back to filename extension for .pdf', () => {
      expect(detectFormat(undefined, 'document.pdf')).toBe('pdf');
    });

    it('should fall back to filename extension for .docx (case-insensitive)', () => {
      expect(detectFormat(undefined, 'Report.DOCX')).toBe('docx');
    });

    it('should return null for unsupported format', () => {
      expect(detectFormat('text/plain', 'file.txt')).toBeNull();
    });

    it('should return null when no MIME type or filename', () => {
      expect(detectFormat()).toBeNull();
    });
  });

  describe('isSupportedFormat', () => {
    it('should return true for pdf, docx, odt, rtf', () => {
      expect(isSupportedFormat('pdf')).toBe(true);
      expect(isSupportedFormat('docx')).toBe(true);
      expect(isSupportedFormat('odt')).toBe(true);
      expect(isSupportedFormat('rtf')).toBe(true);
    });

    it('should return false for null', () => {
      expect(isSupportedFormat(null)).toBe(false);
    });

    it('should return false for unsupported string', () => {
      expect(isSupportedFormat('txt')).toBe(false);
      expect(isSupportedFormat('xlsx')).toBe(false);
    });
  });

  describe('extractDocument', () => {
    it('should dispatch PDF to extractPdfText', async () => {
      vi.mocked(extractPdfText).mockResolvedValue({
        text: 'PDF content',
        pages: 5,
        metadata: { title: 'Test PDF' },
        sections: new Map(),
      });

      const result = await extractDocument(Buffer.from('test'), 'application/pdf');

      expect(extractPdfText).toHaveBeenCalledWith(Buffer.from('test'));
      expect(result.format).toBe('pdf');
      expect(result.text).toBe('PDF content');
      expect(result.pages).toBe(5);
    });

    it('should dispatch DOCX to officeparser', async () => {
      vi.mocked(parseOffice).mockResolvedValue('DOCX content');

      const result = await extractDocument(
        Buffer.from('test'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      expect(parseOffice).toHaveBeenCalled();
      expect(result.format).toBe('docx');
      expect(result.text).toBe('DOCX content');
    });

    it('should dispatch ODT to officeparser', async () => {
      vi.mocked(parseOffice).mockResolvedValue('ODT content');

      const result = await extractDocument(
        Buffer.from('test'),
        'application/vnd.oasis.opendocument.text'
      );

      expect(result.format).toBe('odt');
    });

    it('should dispatch RTF to officeparser', async () => {
      vi.mocked(parseOffice).mockResolvedValue('RTF content');

      const result = await extractDocument(Buffer.from('test'), 'application/rtf');

      expect(result.format).toBe('rtf');
    });

    it('should throw for unsupported format', async () => {
      await expect(
        extractDocument(Buffer.from('test'), 'text/plain', 'file.txt')
      ).rejects.toThrow('Unsupported document format');
    });

    it('should use filename fallback when MIME type is not set', async () => {
      vi.mocked(extractPdfText).mockResolvedValue({
        text: 'content',
        pages: 1,
        metadata: {},
        sections: new Map(),
      });

      const result = await extractDocument(Buffer.from('test'), undefined, 'file.pdf');

      expect(result.format).toBe('pdf');
    });
  });

  describe('getAcceptedFileTypes', () => {
    it('should return expected extensions string', () => {
      const types = getAcceptedFileTypes();

      expect(types).toContain('.pdf');
      expect(types).toContain('.docx');
      expect(types).toContain('.odt');
      expect(types).toContain('.rtf');
    });
  });

  describe('getAcceptedMimeTypes', () => {
    it('should return all MIME types from MIME_TO_FORMAT', () => {
      const mimeTypes = getAcceptedMimeTypes();

      expect(mimeTypes).toEqual(Object.keys(MIME_TO_FORMAT));
      expect(mimeTypes).toContain('application/pdf');
      expect(mimeTypes).toContain('application/rtf');
      expect(mimeTypes).toContain('text/rtf');
    });
  });
});
