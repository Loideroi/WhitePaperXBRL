# Security Model - WhitePaper XBRL

## Overview

This document outlines security considerations, threat model, and implementation requirements for the WhitePaper XBRL platform.

---

## Threat Model

### Assets to Protect

| Asset | Sensitivity | Impact if Compromised |
|-------|-------------|----------------------|
| Uploaded Whitepapers | Medium | Unreleased whitepaper content leaked |
| LEI Numbers | Low | Public information, but could enable tracking |
| Generated iXBRL | Medium | Could be tampered with before submission |
| User Sessions | Medium | Unauthorized access to in-progress work |

### Threat Actors

1. **Malicious Uploader**: Attempts to exploit document processing (PDF, DOCX, ODT, RTF)
2. **Competitor**: Attempts to access unreleased whitepapers
3. **Regulatory Fraudster**: Attempts to submit falsified documents
4. **Script Kiddie**: Automated attacks, DoS attempts

---

## Security Requirements

### 1. File Upload Security

#### 1.1 File Type Validation

**NEVER trust file extensions alone.** All uploaded whitepaper documents (PDF, DOCX, ODT, RTF) must be validated by inspecting magic bytes at the beginning of the file buffer.

```typescript
// REQUIRED: Validate magic bytes for all supported formats

/** PDF magic bytes: %PDF (0x25504446) */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];

/** DOCX and ODT magic bytes: ZIP archive header (0x504B0304) */
const ZIP_MAGIC = [0x50, 0x4B, 0x03, 0x04];

/** RTF magic bytes: {\rtf (0x7B5C727466) */
const RTF_MAGIC = [0x7B, 0x5C, 0x72, 0x74, 0x66];

async function validateFileType(
  buffer: ArrayBuffer,
  expectedType: 'pdf' | 'docx' | 'odt' | 'rtf'
): Promise<boolean> {
  const bytes = new Uint8Array(buffer);

  switch (expectedType) {
    case 'pdf':
      return PDF_MAGIC.every((byte, i) => bytes[i] === byte);
    case 'docx':
    case 'odt':
      // Both DOCX and ODT are ZIP-based formats
      return ZIP_MAGIC.every((byte, i) => bytes[i] === byte);
    case 'rtf':
      return RTF_MAGIC.every((byte, i) => bytes[i] === byte);
    default:
      return false;
  }
}
```

#### 1.2 File Size Limits

- Maximum file size: 50MB
- Enforce both client-side (UX) and server-side (security)
- Return 413 Payload Too Large for oversized files

#### 1.3 In-Memory Processing

Files are processed entirely in-memory and are never written to disk or external storage. This eliminates a class of file storage vulnerabilities (path traversal, lingering sensitive data, unauthorized access to stored files).

- Files are read into an `ArrayBuffer` on upload
- Text extraction and processing happens in the same request lifecycle
- No temporary files are written to the filesystem
- No external blob storage is used
- Garbage collection handles cleanup after the request completes

### 2. Input Sanitization

#### 2.1 Document Content Sanitization

Uploaded documents (PDF, DOCX, ODT, RTF) can contain malicious content:

- **JavaScript**: Can execute in PDF viewers
- **External Links**: Can phone home
- **Embedded Files**: Can contain malware
- **Form Actions**: Can submit data externally
- **Macros**: DOCX and ODT files can contain macro code

**Mitigation:**
```typescript
// Extract text only, never execute embedded scripts
// Use pdf-parse for PDFs (text extraction only, no execution)
// Use officeparser for DOCX/ODT (text extraction only)
// Never render documents in a way that executes embedded scripts
```

#### 2.2 Sanitization Functions

The application provides a comprehensive set of sanitization utilities in `src/lib/security/sanitize.ts`:

| Function | Purpose |
|----------|---------|
| `escapeHtml(str)` | Escape HTML entities (`&`, `<`, `>`, `"`, `'`, `/`) |
| `stripHtml(str)` | Remove all HTML tags from a string |
| `sanitizeString(str)` | Strip HTML then escape remaining special characters |
| `sanitizeLEI(lei)` | Validate and normalize LEI (20 alphanumeric, uppercased) |
| `sanitizeUrl(url)` | Validate URL format, block `javascript:` and `data:` protocols |
| `sanitizeEmail(email)` | Validate basic email format |
| `sanitizeCountryCode(code)` | Validate ISO 3166-1 alpha-2 (2 uppercase letters) |
| `sanitizeISODate(date)` | Validate `YYYY-MM-DD` format and confirm valid date |

Additionally, `sanitizeFilename` prevents path traversal and `sanitizeObject` recursively sanitizes all string values in nested objects.

#### 2.3 User Input Validation

All user inputs must be validated using Zod at the API boundary:

```typescript
import { z } from 'zod';

const WhitepaperInputSchema = z.object({
  tokenType: z.enum(['OTHR', 'ART', 'EMT']),
  lei: z.string().regex(/^[A-Z0-9]{20}$/),
  // ... other fields
});

// Validate at API boundary
const validated = WhitepaperInputSchema.safeParse(input);
if (!validated.success) {
  return Response.json({ errors: validated.error.issues }, { status: 400 });
}
```

#### 2.4 Prevent Injection Attacks

| Attack Type | Mitigation |
|-------------|------------|
| XSS | Escape all user content in generated iXBRL via `escapeHtml` |
| XML Injection | Use proper XML library, never string concatenation |
| Path Traversal | Validate and sanitize all file paths via `sanitizeFilename` |

### 3. Output Security (iXBRL Generation)

#### 3.1 Prohibited Content

The generated iXBRL must NEVER contain:

- `<script>` tags
- JavaScript event handlers (`onclick`, `onload`, etc.)
- Java applets (`<applet>`)
- Flash/plugin objects (`<object>`, `<embed>`)
- External resource references (except taxonomy URIs)
- `<base>` elements or `xml:base` attributes
- `javascript:` protocol URIs

Per the ESMA Reporting Manual, executable code is broadly defined and includes checking image headers and CSS/style properties for script injection vectors.

```typescript
// Validation function for generated output
function validateOutputSecurity(html: string): boolean {
  const prohibited = [
    /<script/i,
    /on\w+\s*=/i,  // onclick, onload, etc.
    /<applet/i,
    /<object/i,
    /<embed/i,
    /<base/i,
    /javascript:/i,
    /xml:base/i,
  ];

  return !prohibited.some(pattern => pattern.test(html));
}
```

#### 3.2 Escape Attributes

Per ESMA requirements:
- `textBlockItemType` elements: `@escape="true"`
- `stringItemType` elements: `@escape="false"`

This prevents XSS in rendered iXBRL while allowing proper HTML in text blocks.

#### 3.3 CSS Security (ESMA Reporting Manual)

CSS rules must not use `display:none` or equivalent visibility-hiding properties on tagged XBRL facts. Doing so constitutes a violation of the `externalCssFile` filing rule. Hidden facts could conceal regulatory data from human reviewers while remaining machine-readable.

#### 3.4 Language Attributes

Per ESMA requirements:
- The root `<html>` element MUST include an `xml:lang` attribute
- All `<ix:references>` elements MUST include an `xml:lang` attribute
- Language values must be valid BCP 47 language tags (e.g., `en`, `nl`, `de`)

#### 3.5 Image Restrictions

Only the following image formats are permitted in iXBRL output:

- **PNG** -- allowed inline and as external references
- **GIF** -- allowed inline and as external references
- **SVG** -- allowed only within `<img>` tags (NEVER inline SVG, which can contain scripts)
- **JPEG** -- allowed inline and as external references

Base64-encoded images MUST specify the correct MIME type in the `data:` URI (e.g., `data:image/png;base64,...`). Images without a MIME type or with a mismatched MIME type must be rejected.

Image file headers should be validated to confirm the actual format matches the declared MIME type, preventing disguised executable content.

```typescript
const ALLOWED_IMAGE_MIMES = [
  'image/png',
  'image/gif',
  'image/jpeg',
  'image/svg+xml',  // Only in <img> tags, never inline
];

// For base64 images, validate the data URI format
const BASE64_IMAGE_PATTERN = /^data:(image\/(png|gif|jpeg|svg\+xml));base64,/;
```

### 4. Session Security

#### 4.1 Session Management

- Generate cryptographically random session IDs
- Store minimal data in session
- Implement session timeout (1 hour inactive)
- Clear session data on completion

```typescript
import { randomUUID } from 'crypto';

function generateSessionId(): string {
  return randomUUID();
}
```

#### 4.2 No Authentication (Phase 1)

Phase 1 operates without user authentication. Security implications:
- No user-specific data retention
- All data cleared after session
- No sharing of work between sessions

### 5. Rate Limiting

#### 5.1 Implementation

Rate limiting is implemented as an in-memory sliding window in `src/lib/security/rate-limiter.ts`. The implementation uses a `Map<string, RateLimitEntry>` store with automatic cleanup of expired entries every 60 seconds.

**Note:** In-memory rate limiting is suitable for single-instance deployments. For multi-instance production deployments (e.g., multiple serverless function instances), a shared store such as Redis is required to enforce limits globally across instances.

#### 5.2 API Rate Limits

The `RATE_LIMITS` constant defines per-endpoint limits:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `upload` | 10 requests | 1 minute |
| `process` | 20 requests | 1 minute |
| `validate` | 60 requests | 1 minute |
| `generate` | 30 requests | 1 minute |

#### 5.3 Usage

```typescript
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security/rate-limiter';

// In an API route handler
export async function POST(request: Request) {
  const clientId = getClientIdentifier(request);
  const result = checkRateLimit(`upload:${clientId}`, RATE_LIMITS.upload);

  if (!result.allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: rateLimitHeaders(result),
    });
  }

  // ... handle request
}
```

Client identification uses `X-Forwarded-For` (first IP) or `X-Real-IP` headers, falling back to `'anonymous'` in development.

Response headers include standard rate limit information:
- `X-RateLimit-Limit` -- total limit for the window
- `X-RateLimit-Remaining` -- remaining requests
- `X-RateLimit-Reset` -- Unix timestamp when the window resets

#### 5.4 File Upload Limits

- Max concurrent uploads per IP: 3
- Max total uploads per IP per hour: 20

### 6. Error Handling

#### 6.1 Error Message Safety

Never expose:
- Stack traces
- Internal file paths
- Database queries
- Third-party API responses

```typescript
// BAD
catch (error) {
  return Response.json({ error: error.message });
}

// GOOD
catch (error) {
  console.error('Validation error:', error); // Log internally
  return Response.json({
    error: 'Validation failed. Please check your input.'
  });
}
```

#### 6.2 Logging

Log security-relevant events:
- Failed uploads (file type rejection)
- Rate limit hits
- Validation failures
- Generation errors

Never log:
- Full document content
- LEI values in production logs
- Session tokens

### 7. Dependency Security

#### 7.1 Dependency Scanning

```bash
# Run regularly
npm audit
npm audit fix

# Use automated tools
# - Dependabot (GitHub)
# - Snyk
```

#### 7.2 Document Library Selection

Choose document processing libraries carefully:
- Prefer libraries that extract text only
- Avoid libraries that render/execute document content
- Keep libraries updated

Recommended libraries:
- `pdf-parse` -- PDF text extraction only
- `officeparser` -- DOCX/ODT text extraction via `toText()` method

### 8. HTTPS and Transport Security

#### 8.1 Vercel Defaults

Vercel provides:
- Automatic HTTPS
- TLS 1.2+ enforcement
- HSTS headers

#### 8.2 Additional Headers

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  },
];
```

---

## Security Checklist

### Before Each Release

- [ ] `npm audit` shows no high/critical vulnerabilities
- [ ] All inputs validated with Zod schemas
- [ ] File uploads validated by magic bytes (PDF, DOCX, ODT, RTF)
- [ ] Generated iXBRL passes security validation
- [ ] No `display:none` on tagged XBRL facts
- [ ] `xml:lang` present on root HTML and `ix:references`
- [ ] No `<base>` element or `xml:base` attribute in output
- [ ] Image formats restricted to PNG, GIF, SVG (in `<img>` only), JPEG
- [ ] Base64 images include correct MIME type
- [ ] Rate limiting configured and tested
- [ ] Error messages don't leak sensitive info
- [ ] No console.log statements with sensitive data
- [ ] Security headers configured
- [ ] In-memory processing confirmed (no files written to disk)

### Quarterly

- [ ] Review and update dependencies
- [ ] Review access logs for anomalies
- [ ] Test rate limiting effectiveness
- [ ] Penetration testing (if resources allow)

---

## Incident Response

### If Suspicious Activity Detected

1. Check Vercel logs for patterns
2. Enable stricter rate limiting
3. Block suspicious IPs if necessary
4. Review uploaded files for malicious content
5. Notify stakeholders if data breach suspected

### If Vulnerability Discovered

1. Assess severity and impact
2. Develop fix in private branch
3. Test fix thoroughly
4. Deploy fix
5. Disclose responsibly if third-party affected

---

## Compliance Notes

### GDPR Considerations

- No personal data stored long-term
- Session data cleared after 1 hour
- No analytics tracking without consent
- Right to deletion: automatic via session expiry
- Files processed in-memory only; no persistent storage of uploaded documents

### Regulatory Submission

- Generated iXBRL is intended for regulatory submission
- Platform does not submit on behalf of users
- Users responsible for verifying content before submission
- Platform provides validation but not legal advice
