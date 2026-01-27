/**
 * Input sanitization utilities
 *
 * Sanitizes user input to prevent XSS and other injection attacks.
 */

/**
 * Escape HTML entities in a string
 */
export function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return str.replace(/[&<>"'/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Strip HTML tags from a string
 */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a string for safe display (escape HTML but keep basic formatting)
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return '';

  // First strip any HTML tags
  let sanitized = stripHtml(str);

  // Escape any remaining special characters
  sanitized = escapeHtml(sanitized);

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Sanitize a filename to prevent path traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') return 'unnamed';

  // Remove path separators and null bytes
  let sanitized = filename.replace(/[\\/\0]/g, '');

  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, '');

  // Only allow alphanumeric, dash, underscore, dot
  sanitized = sanitized.replace(/[^a-zA-Z0-9\-_.]/g, '_');

  // Prevent empty or only extension
  if (!sanitized || sanitized.startsWith('.')) {
    sanitized = 'unnamed' + sanitized;
  }

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop() || '';
    const name = sanitized.slice(0, 250 - ext.length);
    sanitized = name + '.' + ext;
  }

  return sanitized;
}

/**
 * Sanitize an object recursively (for JSON data)
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null
        ? sanitizeObject(item as Record<string, unknown>)
        : typeof item === 'string'
          ? sanitizeString(item)
          : item
    ) as unknown as T;
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key as well
      const sanitizedKey = sanitizeString(key);

      if (typeof value === 'string') {
        sanitized[sanitizedKey] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[sanitizedKey] = sanitizeObject(value as Record<string, unknown>);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }

    return sanitized as T;
  }

  return obj;
}

/**
 * Validate and sanitize LEI format
 * LEI should be exactly 20 alphanumeric characters
 */
export function sanitizeLEI(lei: string): string | null {
  if (typeof lei !== 'string') return null;

  // Uppercase and trim
  const sanitized = lei.toUpperCase().trim();

  // Check format: 20 alphanumeric characters
  if (!/^[A-Z0-9]{20}$/.test(sanitized)) {
    return null;
  }

  return sanitized;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== 'string') return null;

  const trimmed = url.trim();

  // Must have at least a valid domain format
  // Check for basic domain pattern before adding protocol
  const domainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+/i;

  let urlToCheck = trimmed;

  // Only allow http and https protocols
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    // Check if it looks like a valid domain before adding https
    if (!domainPattern.test(trimmed)) {
      return null;
    }
    // Assume https if no protocol
    urlToCheck = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(urlToCheck);

    // Block javascript: and data: protocols
    if (parsed.protocol === 'javascript:' || parsed.protocol === 'data:') {
      return null;
    }

    // Verify hostname looks valid
    if (!domainPattern.test(parsed.hostname)) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') return null;

  const trimmed = email.trim().toLowerCase();

  // Basic email format validation
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Validate and sanitize ISO date
 */
export function sanitizeISODate(date: string): string | null {
  if (typeof date !== 'string') return null;

  const trimmed = date.trim();

  // Check ISO date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  // Validate it's a real date
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    return null;
  }

  return trimmed;
}

/**
 * Validate and sanitize country code
 */
export function sanitizeCountryCode(code: string): string | null {
  if (typeof code !== 'string') return null;

  const sanitized = code.toUpperCase().trim();

  // ISO 3166-1 alpha-2: exactly 2 uppercase letters
  if (!/^[A-Z]{2}$/.test(sanitized)) {
    return null;
  }

  return sanitized;
}
