/**
 * GLEIF LEI Lookup
 *
 * Validates LEI codes against the Global LEI Foundation (GLEIF) API.
 * API docs: https://api.gleif.org/api/v1/lei-records/{lei}
 *
 * This is an optional enhancement over local checksum validation.
 * Falls back gracefully if the API is unavailable.
 */

import { getGLEIFApiUrl } from '@/lib/env';

/**
 * Result of a GLEIF LEI lookup operation.
 */
export interface GLEIFLookupResult {
  /** Whether the LEI was found and is valid */
  isValid: boolean;
  /** Whether the lookup was performed (false if API unreachable) */
  lookupPerformed: boolean;
  /** Legal name from GLEIF registry */
  legalName?: string;
  /** Entity status (ACTIVE, INACTIVE, etc.) */
  entityStatus?: string;
  /** Registration status (ISSUED, LAPSED, etc.) */
  registrationStatus?: string;
  /** Country of registration */
  country?: string;
  /** Error message if lookup failed */
  error?: string;
}

/**
 * Look up an LEI code in the GLEIF registry.
 * Returns entity information if found, or an error if not.
 *
 * Uses a 5-second timeout to prevent blocking the validation flow.
 * If LEI_API_KEY env var is set, includes it as a Bearer token.
 *
 * @param lei - The 20-character LEI code to look up
 * @returns GLEIF lookup result with entity details or error information
 */
export async function lookupLEI(lei: string): Promise<GLEIFLookupResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.api+json',
    };

    // Optional API key from environment
    const apiKey = process.env.LEI_API_KEY;
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const baseUrl = getGLEIFApiUrl();
    const response = await fetch(`${baseUrl}/lei-records/${lei}`, {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 404) {
      return {
        isValid: false,
        lookupPerformed: true,
        error: 'LEI not found in GLEIF registry',
      };
    }

    if (!response.ok) {
      return {
        isValid: false,
        lookupPerformed: false,
        error: `GLEIF API returned ${response.status}`,
      };
    }

    const data = await response.json();
    const attributes = data?.data?.attributes;
    const entity = attributes?.entity;
    const registration = attributes?.registration;

    return {
      isValid: true,
      lookupPerformed: true,
      legalName: entity?.legalName?.name,
      entityStatus: entity?.status,
      registrationStatus: registration?.status,
      country: entity?.legalAddress?.country,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err)
          ? String((err as { message: unknown }).message)
          : 'GLEIF lookup failed';
    return {
      isValid: false,
      lookupPerformed: false,
      error: message,
    };
  }
}
