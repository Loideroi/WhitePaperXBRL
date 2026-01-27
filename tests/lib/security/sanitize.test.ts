import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  stripHtml,
  sanitizeString,
  sanitizeFilename,
  sanitizeObject,
  sanitizeLEI,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeISODate,
  sanitizeCountryCode,
} from '@/lib/security/sanitize';

describe('Sanitization Utilities', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('should escape ampersands', () => {
      expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
    });

    it('should handle script tags', () => {
      expect(stripHtml('<script>alert(1)</script>text')).toBe('alert(1)text');
    });

    it('should handle self-closing tags', () => {
      expect(stripHtml('Line 1<br/>Line 2')).toBe('Line 1Line 2');
    });
  });

  describe('sanitizeString', () => {
    it('should sanitize strings with HTML', () => {
      expect(sanitizeString('<script>alert(1)</script>')).toBe('alert(1)');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  hello world  ')).toBe('hello world');
    });

    it('should handle non-string input', () => {
      expect(sanitizeString(null as unknown as string)).toBe('');
      expect(sanitizeString(undefined as unknown as string)).toBe('');
      expect(sanitizeString(123 as unknown as string)).toBe('');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove path separators', () => {
      // Path separators are removed, leading dots stripped
      expect(sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd');
      expect(sanitizeFilename('dir/file.txt')).toBe('dirfile.txt');
    });

    it('should remove leading dots', () => {
      expect(sanitizeFilename('.hidden')).toBe('hidden');
      expect(sanitizeFilename('..file')).toBe('file');
    });

    it('should replace special characters', () => {
      expect(sanitizeFilename('file name!@#$.pdf')).toBe('file_name____.pdf');
    });

    it('should handle empty strings', () => {
      expect(sanitizeFilename('')).toBe('unnamed');
    });

    it('should preserve valid filenames', () => {
      expect(sanitizeFilename('document_2025-01-27.pdf')).toBe('document_2025-01-27.pdf');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize nested objects', () => {
      const input = {
        name: '<script>alert(1)</script>',
        nested: {
          value: '<b>bold</b>',
        },
      };

      const result = sanitizeObject(input);

      expect(result.name).toBe('alert(1)');
      expect(result.nested.value).toBe('bold');
    });

    it('should sanitize arrays', () => {
      const input = {
        items: ['<a>link</a>', 'normal'],
      };

      const result = sanitizeObject(input);

      expect(result.items[0]).toBe('link');
      expect(result.items[1]).toBe('normal');
    });

    it('should preserve non-string values', () => {
      const input = {
        count: 42,
        active: true,
        data: null,
      };

      const result = sanitizeObject(input);

      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.data).toBe(null);
    });
  });

  describe('sanitizeLEI', () => {
    it('should accept valid LEI', () => {
      expect(sanitizeLEI('529900T8BM49AURSDO55')).toBe('529900T8BM49AURSDO55');
    });

    it('should uppercase LEI', () => {
      expect(sanitizeLEI('529900t8bm49aursdo55')).toBe('529900T8BM49AURSDO55');
    });

    it('should reject invalid length', () => {
      expect(sanitizeLEI('529900T8BM49')).toBe(null);
      expect(sanitizeLEI('529900T8BM49AURSDO5512')).toBe(null);
    });

    it('should reject invalid characters', () => {
      expect(sanitizeLEI('529900T8BM49AURSD-55')).toBe(null);
    });
  });

  describe('sanitizeUrl', () => {
    it('should accept valid URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
    });

    it('should add https if missing', () => {
      expect(sanitizeUrl('example.com')).toBe('https://example.com/');
    });

    it('should reject javascript: protocol', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe(null);
    });

    it('should reject data: protocol', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe(null);
    });

    it('should handle invalid URLs', () => {
      expect(sanitizeUrl('not a url at all ::: ???')).toBe(null);
    });
  });

  describe('sanitizeEmail', () => {
    it('should accept valid emails', () => {
      expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
    });

    it('should lowercase emails', () => {
      expect(sanitizeEmail('Test@Example.COM')).toBe('test@example.com');
    });

    it('should reject invalid emails', () => {
      expect(sanitizeEmail('not-an-email')).toBe(null);
      expect(sanitizeEmail('missing@domain')).toBe(null);
      expect(sanitizeEmail('@nodomain.com')).toBe(null);
    });
  });

  describe('sanitizeISODate', () => {
    it('should accept valid ISO dates', () => {
      expect(sanitizeISODate('2025-01-27')).toBe('2025-01-27');
    });

    it('should reject invalid formats', () => {
      expect(sanitizeISODate('01/27/2025')).toBe(null);
      expect(sanitizeISODate('2025-1-27')).toBe(null);
      expect(sanitizeISODate('2025-01-27T12:00:00')).toBe(null);
    });

    it('should reject invalid dates', () => {
      expect(sanitizeISODate('2025-13-45')).toBe(null);
    });
  });

  describe('sanitizeCountryCode', () => {
    it('should accept valid country codes', () => {
      expect(sanitizeCountryCode('US')).toBe('US');
      expect(sanitizeCountryCode('DE')).toBe('DE');
      expect(sanitizeCountryCode('MT')).toBe('MT');
    });

    it('should uppercase country codes', () => {
      expect(sanitizeCountryCode('us')).toBe('US');
    });

    it('should reject invalid codes', () => {
      expect(sanitizeCountryCode('USA')).toBe(null);
      expect(sanitizeCountryCode('X')).toBe(null);
      expect(sanitizeCountryCode('12')).toBe(null);
    });
  });
});
