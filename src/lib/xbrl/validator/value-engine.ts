/**
 * Value Assertion Engine
 *
 * Validates relationships between field values (cross-field, format, range checks).
 */

import type { ValidationError } from '@/types/xbrl';
import type { TokenType } from '@/types/taxonomy';
import type { WhitepaperData } from '@/types/whitepaper';
import { isValidLanguage, SUPPORTED_LANGUAGES } from '@/lib/xbrl/generator/template/language-support';

/**
 * Value assertion definition
 */
export interface ValueAssertion {
  /** Unique rule identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** Token types this assertion applies to */
  tokenTypes: TokenType[];
  /** Severity level */
  severity: 'ERROR' | 'WARNING';
  /** Validation function */
  validate: (data: Partial<WhitepaperData>) => ValidationError | null;
}

/**
 * Get nested value from object by path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Common value assertions
 */
const COMMON_VALUE_ASSERTIONS: ValueAssertion[] = [
  // Date validations
  {
    id: 'VAL-001',
    description: 'Public offering end date must be after start date',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
    validate: (data) => {
      const startDate = parseDate(data.partE?.publicOfferingStartDate);
      const endDate = parseDate(data.partE?.publicOfferingEndDate);

      if (startDate && endDate && endDate <= startDate) {
        return {
          ruleId: 'VAL-001',
          severity: 'ERROR',
          message: 'Public offering end date must be after start date',
          fieldPath: 'partE.publicOfferingEndDate',
        };
      }
      return null;
    },
  },

  // Numeric validations
  {
    id: 'VAL-002',
    description: 'Total supply must be positive',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
    validate: (data) => {
      const supply = data.partD?.totalSupply;
      if (supply !== undefined && supply <= 0) {
        return {
          ruleId: 'VAL-002',
          severity: 'ERROR',
          message: 'Total supply must be a positive number',
          fieldPath: 'partD.totalSupply',
        };
      }
      return null;
    },
  },
  {
    id: 'VAL-003',
    description: 'Token price must be positive if provided',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
    validate: (data) => {
      const price = data.partE?.tokenPrice;
      if (price !== undefined && price <= 0) {
        return {
          ruleId: 'VAL-003',
          severity: 'ERROR',
          message: 'Token price must be a positive number',
          fieldPath: 'partE.tokenPrice',
        };
      }
      return null;
    },
  },
  {
    id: 'VAL-004',
    description: 'Maximum subscription goal must be positive if provided',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
    validate: (data) => {
      const goal = data.partE?.maxSubscriptionGoal;
      if (goal !== undefined && goal <= 0) {
        return {
          ruleId: 'VAL-004',
          severity: 'ERROR',
          message: 'Maximum subscription goal must be a positive number',
          fieldPath: 'partE.maxSubscriptionGoal',
        };
      }
      return null;
    },
  },

  // Percentage validations
  {
    id: 'VAL-005',
    description: 'Renewable energy percentage must be between 0 and 100',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
    validate: (data) => {
      const percentage = data.partJ?.renewableEnergyPercentage;
      if (percentage !== undefined && (percentage < 0 || percentage > 100)) {
        return {
          ruleId: 'VAL-005',
          severity: 'ERROR',
          message: 'Renewable energy percentage must be between 0 and 100',
          fieldPath: 'partJ.renewableEnergyPercentage',
        };
      }
      return null;
    },
  },

  // Format validations
  {
    id: 'VAL-006',
    description: 'Country code must be 2 letters (ISO 3166-1 alpha-2)',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
    validate: (data) => {
      const country = data.partA?.country;
      if (country && !/^[A-Z]{2}$/.test(country)) {
        return {
          ruleId: 'VAL-006',
          severity: 'ERROR',
          message: 'Country must be a 2-letter ISO 3166-1 alpha-2 code (e.g., MT, DE, FR)',
          fieldPath: 'partA.country',
        };
      }
      return null;
    },
  },
  {
    id: 'VAL-007',
    description: 'Website must be a valid URL',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'WARNING',
    validate: (data) => {
      const website = data.partA?.website;
      if (website && !/^https?:\/\/.+/.test(website)) {
        return {
          ruleId: 'VAL-007',
          severity: 'WARNING',
          message: 'Website should be a valid URL starting with http:// or https://',
          fieldPath: 'partA.website',
        };
      }
      return null;
    },
  },
  {
    id: 'VAL-008',
    description: 'Email must be a valid format',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'WARNING',
    validate: (data) => {
      const email = data.partA?.contactEmail;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return {
          ruleId: 'VAL-008',
          severity: 'WARNING',
          message: 'Contact email should be a valid email address',
          fieldPath: 'partA.contactEmail',
        };
      }
      return null;
    },
  },

  // Date format validations
  {
    id: 'VAL-009',
    description: 'Document date must be valid format',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
    validate: (data) => {
      const dateStr = data.documentDate;
      if (dateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return {
          ruleId: 'VAL-009',
          severity: 'ERROR',
          message: 'Document date must be in YYYY-MM-DD format',
          fieldPath: 'documentDate',
        };
      }
      return null;
    },
  },

  // Language validation — format check
  {
    id: 'VAL-010',
    description: 'Language must be 2-letter ISO code',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
    validate: (data) => {
      const lang = data.language;
      if (lang && !/^[a-z]{2}$/.test(lang)) {
        return {
          ruleId: 'VAL-010',
          severity: 'ERROR',
          message: 'Language must be a 2-letter ISO 639-1 code (e.g., en, de, fr)',
          fieldPath: 'language',
        };
      }
      return null;
    },
  },

  // Language validation — MiCA supported EU language
  {
    id: 'VAL-014',
    description: 'Language must be a supported EU official language per MiCA Article 6(7)',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'WARNING',
    validate: (data) => {
      const lang = data.language;
      if (lang && /^[a-z]{2}$/.test(lang) && !isValidLanguage(lang)) {
        return {
          ruleId: 'VAL-014',
          severity: 'WARNING',
          message: `Language '${lang}' is not a supported EU official language. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
          fieldPath: 'language',
        };
      }
      return null;
    },
  },

  // Cross-field consistency
  {
    id: 'VAL-011',
    description: 'If public offering is true, offering details should be provided',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'WARNING',
    validate: (data) => {
      if (data.partE?.isPublicOffering === true) {
        if (!data.partE.tokenPrice && !data.partE.maxSubscriptionGoal) {
          return {
            ruleId: 'VAL-011',
            severity: 'WARNING',
            message: 'Public offering should include token price or subscription goal',
            fieldPath: 'partE',
          };
        }
      }
      return null;
    },
  },

  // Symbol format
  {
    id: 'VAL-012',
    description: 'Token symbol should be uppercase',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'WARNING',
    validate: (data) => {
      const symbol = data.partD?.cryptoAssetSymbol;
      if (symbol && symbol !== symbol.toUpperCase()) {
        return {
          ruleId: 'VAL-012',
          severity: 'WARNING',
          message: 'Token symbol should be uppercase (e.g., BTC, ETH)',
          fieldPath: 'partD.cryptoAssetSymbol',
        };
      }
      return null;
    },
  },

  // Energy consumption validation
  {
    id: 'VAL-013',
    description: 'Energy consumption must be non-negative',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
    validate: (data) => {
      const energy = data.partJ?.energyConsumption;
      if (energy !== undefined && energy < 0) {
        return {
          ruleId: 'VAL-013',
          severity: 'ERROR',
          message: 'Energy consumption cannot be negative',
          fieldPath: 'partJ.energyConsumption',
        };
      }
      return null;
    },
  },
];

/**
 * ART-specific value assertions
 */
const ART_VALUE_ASSERTIONS: ValueAssertion[] = [
  {
    id: 'VAL-ART-001',
    description: 'Issuer LEI must be different from offeror if issuer is specified',
    tokenTypes: ['ART'],
    severity: 'WARNING',
    validate: (data) => {
      const offerorLei = data.partA?.lei;
      const issuerLei = (data as Record<string, unknown>).partB &&
        ((data as Record<string, unknown>).partB as Record<string, unknown>)?.lei;

      if (issuerLei && offerorLei === issuerLei) {
        return {
          ruleId: 'VAL-ART-001',
          severity: 'WARNING',
          message: 'If issuer is the same as offeror, issuer section may be omitted',
          fieldPath: 'partB.lei',
        };
      }
      return null;
    },
  },
];

/**
 * EMT-specific value assertions
 */
const EMT_VALUE_ASSERTIONS: ValueAssertion[] = [
  {
    id: 'VAL-EMT-001',
    description: 'Issuer LEI must be different from offeror if issuer is specified',
    tokenTypes: ['EMT'],
    severity: 'WARNING',
    validate: (data) => {
      const offerorLei = data.partA?.lei;
      const issuerLei = (data as Record<string, unknown>).partB &&
        ((data as Record<string, unknown>).partB as Record<string, unknown>)?.lei;

      if (issuerLei && offerorLei === issuerLei) {
        return {
          ruleId: 'VAL-EMT-001',
          severity: 'WARNING',
          message: 'If issuer is the same as offeror, issuer section may be omitted',
          fieldPath: 'partB.lei',
        };
      }
      return null;
    },
  },
];

/**
 * Get all value assertions for a token type
 */
export function getValueAssertions(tokenType: TokenType): ValueAssertion[] {
  const assertions = [...COMMON_VALUE_ASSERTIONS];

  switch (tokenType) {
    case 'ART':
      assertions.push(...ART_VALUE_ASSERTIONS);
      break;
    case 'EMT':
      assertions.push(...EMT_VALUE_ASSERTIONS);
      break;
  }

  return assertions.filter((a) => a.tokenTypes.includes(tokenType));
}

/**
 * Validate value assertions for whitepaper data
 */
export function validateValueAssertions(
  data: Partial<WhitepaperData>,
  tokenType: TokenType
): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const assertions = getValueAssertions(tokenType);

  for (const assertion of assertions) {
    const error = assertion.validate(data);
    if (error) {
      if (error.severity === 'ERROR') {
        errors.push(error);
      } else {
        warnings.push(error);
      }
    }
  }

  return { errors, warnings };
}

/**
 * Get summary of value assertions
 */
export function getValueAssertionSummary(tokenType: TokenType): {
  total: number;
  required: number;
  recommended: number;
} {
  const assertions = getValueAssertions(tokenType);

  return {
    total: assertions.length,
    required: assertions.filter((a) => a.severity === 'ERROR').length,
    recommended: assertions.filter((a) => a.severity === 'WARNING').length,
  };
}
