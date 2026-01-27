/**
 * LEI (Legal Entity Identifier) Validator
 *
 * Validates LEI format and checksum according to ISO 17442.
 */

import type { ValidationError } from '@/types/xbrl';

/**
 * LEI format regex: 18 alphanumeric + 2 digits
 */
const LEI_REGEX = /^[A-Z0-9]{18}[0-9]{2}$/;

/**
 * LEI validation result
 */
export interface LEIValidationResult {
  valid: boolean;
  errors: ValidationError[];
  entityInfo?: {
    name?: string;
    status?: string;
    country?: string;
  };
}

/**
 * Check if LEI matches the expected format
 */
export function isValidLEIFormat(lei: string): boolean {
  if (!lei || typeof lei !== 'string') {
    return false;
  }

  // LEI must be exactly 20 characters
  if (lei.length !== 20) {
    return false;
  }

  return LEI_REGEX.test(lei.toUpperCase());
}

/**
 * Validate LEI checksum using ISO 17442 algorithm (mod-97)
 *
 * Similar to IBAN validation:
 * 1. Convert letters to numbers (A=10, B=11, ..., Z=35)
 * 2. Calculate modulo 97
 * 3. Result should be 1
 */
export function validateLEIChecksum(lei: string): boolean {
  if (!isValidLEIFormat(lei)) {
    return false;
  }

  const upperLei = lei.toUpperCase();

  // Convert letters to numbers (A=10, B=11, ..., Z=35)
  let numericString = '';
  for (const char of upperLei) {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      // A-Z: convert to 10-35
      numericString += (code - 55).toString();
    } else {
      // 0-9: keep as is
      numericString += char;
    }
  }

  // Calculate mod 97 using chunked approach (handles large numbers)
  let remainder = 0;
  for (const digit of numericString) {
    remainder = (remainder * 10 + parseInt(digit, 10)) % 97;
  }

  return remainder === 1;
}

/**
 * Validate LEI with GLEIF API (optional, for entity verification)
 */
export async function validateLEIWithGLEIF(lei: string): Promise<LEIValidationResult> {
  const errors: ValidationError[] = [];

  // First check format
  if (!isValidLEIFormat(lei)) {
    errors.push({
      ruleId: 'LEI-001',
      severity: 'ERROR',
      message: 'LEI must be 20 characters: 18 alphanumeric followed by 2 digits',
      element: 'lei',
    });
    return { valid: false, errors };
  }

  // Check checksum
  if (!validateLEIChecksum(lei)) {
    errors.push({
      ruleId: 'LEI-002',
      severity: 'ERROR',
      message: 'LEI checksum is invalid',
      element: 'lei',
    });
    return { valid: false, errors };
  }

  // Try GLEIF API lookup
  try {
    const response = await fetch(`https://api.gleif.org/api/v1/lei-records/${lei}`, {
      headers: { Accept: 'application/vnd.api+json' },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      if (response.status === 404) {
        errors.push({
          ruleId: 'LEI-003',
          severity: 'WARNING',
          message: 'LEI not found in GLEIF database - verify the identifier is correct',
          element: 'lei',
        });
        return { valid: true, errors }; // Format valid, but not in database
      }
      // Other errors - continue without API validation
      return { valid: true, errors };
    }

    const data = await response.json();
    const attributes = data?.data?.attributes;

    if (attributes) {
      const entityInfo = {
        name: attributes.entity?.legalName?.name,
        status: attributes.registration?.status,
        country: attributes.entity?.jurisdiction,
      };

      // Check if LEI is active
      if (attributes.registration?.status !== 'ISSUED') {
        errors.push({
          ruleId: 'LEI-004',
          severity: 'WARNING',
          message: `LEI status is ${attributes.registration?.status} - should be ISSUED`,
          element: 'lei',
        });
      }

      return { valid: errors.length === 0, errors, entityInfo };
    }

    return { valid: true, errors };
  } catch {
    // API call failed - return format validation only
    return { valid: true, errors };
  }
}

/**
 * Full LEI validation (format + checksum, optional GLEIF)
 */
export function validateLEI(
  lei: string | undefined,
  options: { checkGLEIF?: boolean } = {}
): LEIValidationResult | Promise<LEIValidationResult> {
  const errors: ValidationError[] = [];

  // Check if provided
  if (!lei || lei.trim() === '') {
    errors.push({
      ruleId: 'LEI-000',
      severity: 'ERROR',
      message: 'Legal Entity Identifier (LEI) is required',
      element: 'lei',
    });
    return { valid: false, errors };
  }

  const normalizedLei = lei.trim().toUpperCase();

  // Format validation
  if (!isValidLEIFormat(normalizedLei)) {
    errors.push({
      ruleId: 'LEI-001',
      severity: 'ERROR',
      message: `Invalid LEI format: "${lei}". LEI must be 20 characters (18 alphanumeric + 2 check digits)`,
      element: 'lei',
    });
    return { valid: false, errors };
  }

  // Checksum validation
  if (!validateLEIChecksum(normalizedLei)) {
    errors.push({
      ruleId: 'LEI-002',
      severity: 'ERROR',
      message: 'LEI checksum validation failed - please verify the identifier',
      element: 'lei',
    });
    return { valid: false, errors };
  }

  // Optional GLEIF validation
  if (options.checkGLEIF) {
    return validateLEIWithGLEIF(normalizedLei);
  }

  return { valid: true, errors };
}

/**
 * Validate multiple LEIs (for offeror, issuer, operator)
 */
export function validateAllLEIs(
  offerorLei?: string,
  issuerLei?: string,
  operatorLei?: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Offeror LEI is required
  const offerorResult = validateLEI(offerorLei);
  if ('errors' in offerorResult) {
    offerorResult.errors.forEach((e) => {
      errors.push({ ...e, fieldPath: 'partA.lei' });
    });
  }

  // Issuer LEI (if different from offeror)
  if (issuerLei && issuerLei !== offerorLei) {
    const issuerResult = validateLEI(issuerLei);
    if ('errors' in issuerResult) {
      issuerResult.errors.forEach((e) => {
        errors.push({
          ...e,
          ruleId: `${e.ruleId}-ISSUER`,
          message: `Issuer ${e.message}`,
          fieldPath: 'partB.lei',
        });
      });
    }
  }

  // Operator LEI (if provided)
  if (operatorLei && operatorLei !== offerorLei) {
    const operatorResult = validateLEI(operatorLei);
    if ('errors' in operatorResult) {
      operatorResult.errors.forEach((e) => {
        errors.push({
          ...e,
          ruleId: `${e.ruleId}-OPERATOR`,
          message: `Operator ${e.message}`,
          fieldPath: 'partC.lei',
        });
      });
    }
  }

  return errors;
}
