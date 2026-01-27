# Security Model - WhitePaper XBRL

## Overview

This document outlines security considerations, threat model, and implementation requirements for the WhitePaper XBRL platform.

---

## Threat Model

### Assets to Protect

| Asset | Sensitivity | Impact if Compromised |
|-------|-------------|----------------------|
| Uploaded PDFs | Medium | Unreleased whitepaper content leaked |
| LEI Numbers | Low | Public information, but could enable tracking |
| Generated iXBRL | Medium | Could be tampered with before submission |
| User Sessions | Medium | Unauthorized access to in-progress work |

### Threat Actors

1. **Malicious Uploader**: Attempts to exploit PDF processing
2. **Competitor**: Attempts to access unreleased whitepapers
3. **Regulatory Fraudster**: Attempts to submit falsified documents
4. **Script Kiddie**: Automated attacks, DoS attempts

---

## Security Requirements

### 1. File Upload Security

#### 1.1 File Type Validation

**NEVER trust file extensions alone.**

```typescript
// REQUIRED: Validate magic bytes
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

async function validatePdfFile(buffer: ArrayBuffer): Promise<boolean> {
  const bytes = new Uint8Array(buffer);
  return PDF_MAGIC_BYTES.every((byte, i) => bytes[i] === byte);
}
```

#### 1.2 File Size Limits

- Maximum file size: 50MB
- Enforce both client-side (UX) and server-side (security)
- Return 413 Payload Too Large for oversized files

#### 1.3 File Storage

- Use signed URLs for temporary storage (Vercel Blob)
- Auto-delete after 1 hour
- Never store in publicly accessible locations
- Never include original filename in storage path

```typescript
// Storage path pattern
const storagePath = `uploads/${sessionId}/${randomUUID()}.pdf`;
```

### 2. Input Sanitization

#### 2.1 PDF Content Sanitization

PDFs can contain malicious content:

- **JavaScript**: Can execute in PDF viewers
- **External Links**: Can phone home
- **Embedded Files**: Can contain malware
- **Form Actions**: Can submit data externally

**Mitigation:**
```typescript
// Extract text only, never execute PDF JavaScript
// Use pdf-parse or similar that extracts text without execution
// Never render PDFs in a way that executes embedded scripts
```

#### 2.2 User Input Validation

All user inputs must be validated using Zod:

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

#### 2.3 Prevent Injection Attacks

| Attack Type | Mitigation |
|-------------|------------|
| XSS | Escape all user content in generated iXBRL |
| XML Injection | Use proper XML library, never string concatenation |
| Path Traversal | Validate and sanitize all file paths |

### 3. Output Security (iXBRL Generation)

#### 3.1 Prohibited Content

The generated iXBRL must NEVER contain:

- `<script>` tags
- JavaScript event handlers (`onclick`, `onload`, etc.)
- Java applets
- Flash objects
- External resource references (except taxonomy URIs)
- `<base>` elements or `xml:base` attributes

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
  ];

  return !prohibited.some(pattern => pattern.test(html));
}
```

#### 3.2 Escape Attributes

Per ESMA requirements:
- `textBlockItemType` elements: `@escape="true"`
- `stringItemType` elements: `@escape="false"`

This prevents XSS in rendered iXBRL while allowing proper HTML in text blocks.

#### 3.3 Image Restrictions

Only allow safe image formats:
- PNG
- GIF
- SVG (must be sanitized - can contain scripts!)
- JPEG

```typescript
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/gif', 'image/jpeg'];
const SVG_SAFE_PATTERN = /^<svg[^>]*>(?!.*<script).*<\/svg>$/s;
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

#### 5.1 API Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/upload | 10 | 1 minute |
| POST /api/validate | 30 | 1 minute |
| POST /api/generate | 10 | 1 minute |

```typescript
// Implement using Vercel Edge Config or Upstash Redis
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});
```

#### 5.2 File Upload Limits

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
- Full PDF content
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

#### 7.2 PDF Library Selection

Choose PDF libraries carefully:
- Prefer libraries that extract text only
- Avoid libraries that render/execute PDF content
- Keep libraries updated

Recommended: `pdf-parse` (text extraction only)

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
- [ ] File uploads validated by magic bytes
- [ ] Generated iXBRL passes security validation
- [ ] Rate limiting configured
- [ ] Error messages don't leak sensitive info
- [ ] No console.log statements with sensitive data
- [ ] Security headers configured
- [ ] Temporary files auto-deleted

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

### Regulatory Submission

- Generated iXBRL is intended for regulatory submission
- Platform does not submit on behalf of users
- Users responsible for verifying content before submission
- Platform provides validation but not legal advice
