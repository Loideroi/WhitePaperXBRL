import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupLEI } from '@/lib/xbrl/validator/gleif-lookup';

// Mock the env module to avoid side effects
vi.mock('@/lib/env', () => ({
  getGLEIFApiUrl: () => 'https://api.gleif.org/api/v1',
}));

// A valid LEI for testing (passes format + checksum)
const VALID_LEI = '529900T8BM49AURSDO55';

/**
 * Helper to build a mock GLEIF API response body
 */
function buildGLEIFResponse(overrides?: {
  legalName?: string;
  entityStatus?: string;
  registrationStatus?: string;
  country?: string;
}) {
  return {
    data: {
      attributes: {
        entity: {
          legalName: { name: overrides?.legalName ?? 'Test Entity GmbH' },
          status: overrides?.entityStatus ?? 'ACTIVE',
          legalAddress: { country: overrides?.country ?? 'DE' },
        },
        registration: {
          status: overrides?.registrationStatus ?? 'ISSUED',
        },
      },
    },
  };
}

describe('GLEIF Lookup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Clear any LEI_API_KEY between tests
    delete process.env.LEI_API_KEY;
  });

  describe('lookupLEI', () => {
    it('should return entity information for a valid LEI', async () => {
      const mockResponse = buildGLEIFResponse({
        legalName: 'Acme Corp',
        entityStatus: 'ACTIVE',
        registrationStatus: 'ISSUED',
        country: 'US',
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/vnd.api+json' },
        })
      );

      const result = await lookupLEI(VALID_LEI);

      expect(result.isValid).toBe(true);
      expect(result.lookupPerformed).toBe(true);
      expect(result.legalName).toBe('Acme Corp');
      expect(result.entityStatus).toBe('ACTIVE');
      expect(result.registrationStatus).toBe('ISSUED');
      expect(result.country).toBe('US');
      expect(result.error).toBeUndefined();
    });

    it('should return isValid false when LEI is not found (404)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Not Found', { status: 404 })
      );

      const result = await lookupLEI(VALID_LEI);

      expect(result.isValid).toBe(false);
      expect(result.lookupPerformed).toBe(true);
      expect(result.error).toBe('LEI not found in GLEIF registry');
      expect(result.legalName).toBeUndefined();
    });

    it('should return lookupPerformed false on non-404 HTTP errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Service Unavailable', { status: 503 })
      );

      const result = await lookupLEI(VALID_LEI);

      expect(result.isValid).toBe(false);
      expect(result.lookupPerformed).toBe(false);
      expect(result.error).toBe('GLEIF API returned 503');
    });

    it('should return lookupPerformed false on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network request failed')
      );

      const result = await lookupLEI(VALID_LEI);

      expect(result.isValid).toBe(false);
      expect(result.lookupPerformed).toBe(false);
      expect(result.error).toBe('Network request failed');
    });

    it('should return lookupPerformed false on timeout (abort)', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new DOMException('The operation was aborted.', 'AbortError')
      );

      const result = await lookupLEI(VALID_LEI);

      expect(result.isValid).toBe(false);
      expect(result.lookupPerformed).toBe(false);
      expect(result.error).toBe('The operation was aborted.');
    });

    it('should include Authorization header when LEI_API_KEY is set', async () => {
      process.env.LEI_API_KEY = 'test-api-key-123';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(buildGLEIFResponse()), {
          status: 200,
          headers: { 'Content-Type': 'application/vnd.api+json' },
        })
      );

      await lookupLEI(VALID_LEI);

      expect(fetchSpy).toHaveBeenCalledOnce();
      const callArgs = fetchSpy.mock.calls[0];
      const requestInit = callArgs?.[1] as RequestInit;
      const headers = requestInit?.headers as Record<string, string>;

      expect(headers['Authorization']).toBe('Bearer test-api-key-123');
    });

    it('should not include Authorization header when LEI_API_KEY is not set', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(buildGLEIFResponse()), {
          status: 200,
          headers: { 'Content-Type': 'application/vnd.api+json' },
        })
      );

      await lookupLEI(VALID_LEI);

      expect(fetchSpy).toHaveBeenCalledOnce();
      const callArgs = fetchSpy.mock.calls[0];
      const requestInit = callArgs?.[1] as RequestInit;
      const headers = requestInit?.headers as Record<string, string>;

      expect(headers['Authorization']).toBeUndefined();
    });

    it('should call the correct GLEIF API URL', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(buildGLEIFResponse()), {
          status: 200,
          headers: { 'Content-Type': 'application/vnd.api+json' },
        })
      );

      await lookupLEI(VALID_LEI);

      expect(fetchSpy).toHaveBeenCalledOnce();
      const callArgs = fetchSpy.mock.calls[0];
      expect(callArgs?.[0]).toBe(`https://api.gleif.org/api/v1/lei-records/${VALID_LEI}`);
    });

    it('should handle non-Error thrown values gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce('string error');

      const result = await lookupLEI(VALID_LEI);

      expect(result.isValid).toBe(false);
      expect(result.lookupPerformed).toBe(false);
      expect(result.error).toBe('GLEIF lookup failed');
    });

    it('should handle missing attributes in response gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { attributes: {} } }), {
          status: 200,
          headers: { 'Content-Type': 'application/vnd.api+json' },
        })
      );

      const result = await lookupLEI(VALID_LEI);

      expect(result.isValid).toBe(true);
      expect(result.lookupPerformed).toBe(true);
      expect(result.legalName).toBeUndefined();
      expect(result.entityStatus).toBeUndefined();
      expect(result.registrationStatus).toBeUndefined();
      expect(result.country).toBeUndefined();
    });
  });
});
