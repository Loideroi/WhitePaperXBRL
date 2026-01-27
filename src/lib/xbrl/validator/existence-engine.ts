/**
 * Existence Assertion Engine
 *
 * Validates that required fields are present based on token type.
 */

import type { ValidationError } from '@/types/xbrl';
import type { TokenType } from '@/types/taxonomy';
import type { WhitepaperData } from '@/types/whitepaper';

/**
 * Existence assertion definition
 */
export interface ExistenceAssertion {
  /** Unique rule identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** Field path in whitepaper data */
  fieldPath: string;
  /** XBRL element name */
  elementName: string;
  /** Token types this assertion applies to */
  tokenTypes: TokenType[];
  /** Severity level */
  severity: 'ERROR' | 'WARNING';
  /** Optional condition (other field that must exist for this to apply) */
  condition?: {
    fieldPath: string;
    value?: unknown;
  };
}

/**
 * Core required fields for all token types
 */
const COMMON_ASSERTIONS: ExistenceAssertion[] = [
  // Part A: Offeror Information
  {
    id: 'EXS-A-001',
    description: 'Offeror legal name is required',
    fieldPath: 'partA.legalName',
    elementName: 'mica:OfferorLegalName',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
  },
  {
    id: 'EXS-A-002',
    description: 'Offeror LEI is required',
    fieldPath: 'partA.lei',
    elementName: 'mica:OfferorLegalEntityIdentifier',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
  },
  {
    id: 'EXS-A-003',
    description: 'Offeror registered address is required',
    fieldPath: 'partA.registeredAddress',
    elementName: 'mica:OfferorRegisteredAddress',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
  },
  {
    id: 'EXS-A-004',
    description: 'Offeror country is required',
    fieldPath: 'partA.country',
    elementName: 'mica:OfferorCountry',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
  },
  {
    id: 'EXS-A-005',
    description: 'Offeror website is recommended',
    fieldPath: 'partA.website',
    elementName: 'mica:OfferorWebsite',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'WARNING',
  },
  {
    id: 'EXS-A-006',
    description: 'Offeror contact email is recommended',
    fieldPath: 'partA.contactEmail',
    elementName: 'mica:OfferorContactEmail',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'WARNING',
  },

  // Part D: Crypto-Asset Information
  {
    id: 'EXS-D-001',
    description: 'Crypto-asset name is required',
    fieldPath: 'partD.cryptoAssetName',
    elementName: 'mica:CryptoAssetName',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
  },
  {
    id: 'EXS-D-002',
    description: 'Crypto-asset symbol is required',
    fieldPath: 'partD.cryptoAssetSymbol',
    elementName: 'mica:CryptoAssetSymbol',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
  },
  {
    id: 'EXS-D-003',
    description: 'Total supply should be provided',
    fieldPath: 'partD.totalSupply',
    elementName: 'mica:TotalSupply',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'WARNING',
  },
  {
    id: 'EXS-D-004',
    description: 'Project description is required',
    fieldPath: 'partD.projectDescription',
    elementName: 'mica:ProjectDescription',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
  },

  // Part E: Offering Information
  {
    id: 'EXS-E-001',
    description: 'Public offering status must be specified',
    fieldPath: 'partE.isPublicOffering',
    elementName: 'mica:IsPublicOffering',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
  },
  {
    id: 'EXS-E-002',
    description: 'Public offering start date required if public offering',
    fieldPath: 'partE.publicOfferingStartDate',
    elementName: 'mica:PublicOfferingStartDate',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
    condition: { fieldPath: 'partE.isPublicOffering', value: true },
  },

  // Part H: Technology
  {
    id: 'EXS-H-001',
    description: 'Blockchain description is required',
    fieldPath: 'partH.blockchainDescription',
    elementName: 'mica:BlockchainDescription',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'ERROR',
  },
];

/**
 * Additional assertions for OTHR token type
 */
const OTHR_ASSERTIONS: ExistenceAssertion[] = [
  {
    id: 'EXS-OTHR-001',
    description: 'Token standard should be specified',
    fieldPath: 'partD.tokenStandard',
    elementName: 'mica:TokenStandard',
    tokenTypes: ['OTHR'],
    severity: 'WARNING',
  },
  {
    id: 'EXS-OTHR-002',
    description: 'Blockchain network should be specified',
    fieldPath: 'partD.blockchainNetwork',
    elementName: 'mica:BlockchainNetwork',
    tokenTypes: ['OTHR'],
    severity: 'WARNING',
  },
  {
    id: 'EXS-OTHR-003',
    description: 'Consensus mechanism should be documented',
    fieldPath: 'partD.consensusMechanism',
    elementName: 'mica:ConsensusMechanism',
    tokenTypes: ['OTHR'],
    severity: 'WARNING',
  },
];

/**
 * Additional assertions for ART token type
 */
const ART_ASSERTIONS: ExistenceAssertion[] = [
  {
    id: 'EXS-ART-001',
    description: 'Issuer information required for ART',
    fieldPath: 'partB.legalName',
    elementName: 'mica:IssuerLegalName',
    tokenTypes: ['ART'],
    severity: 'ERROR',
  },
  {
    id: 'EXS-ART-002',
    description: 'Issuer LEI required for ART',
    fieldPath: 'partB.lei',
    elementName: 'mica:IssuerLegalEntityIdentifier',
    tokenTypes: ['ART'],
    severity: 'ERROR',
  },
  {
    id: 'EXS-ART-003',
    description: 'Reserve asset information required for ART',
    fieldPath: 'partG.ownershipRights',
    elementName: 'mica:ReserveAssetDescription',
    tokenTypes: ['ART'],
    severity: 'ERROR',
  },
];

/**
 * Additional assertions for EMT token type
 */
const EMT_ASSERTIONS: ExistenceAssertion[] = [
  {
    id: 'EXS-EMT-001',
    description: 'Issuer information required for EMT',
    fieldPath: 'partB.legalName',
    elementName: 'mica:IssuerLegalName',
    tokenTypes: ['EMT'],
    severity: 'ERROR',
  },
  {
    id: 'EXS-EMT-002',
    description: 'Issuer LEI required for EMT',
    fieldPath: 'partB.lei',
    elementName: 'mica:IssuerLegalEntityIdentifier',
    tokenTypes: ['EMT'],
    severity: 'ERROR',
  },
];

/**
 * Part J: Sustainability assertions
 */
const SUSTAINABILITY_ASSERTIONS: ExistenceAssertion[] = [
  {
    id: 'EXS-J-001',
    description: 'Energy consumption should be disclosed',
    fieldPath: 'partJ.energyConsumption',
    elementName: 'mica:EnergyConsumption',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'WARNING',
  },
  {
    id: 'EXS-J-002',
    description: 'Consensus mechanism type should be specified for sustainability',
    fieldPath: 'partJ.consensusMechanismType',
    elementName: 'mica:ConsensusMechanismType',
    tokenTypes: ['OTHR', 'ART', 'EMT'],
    severity: 'WARNING',
  },
];

/**
 * Get all assertions for a token type
 */
export function getExistenceAssertions(tokenType: TokenType): ExistenceAssertion[] {
  const assertions = [...COMMON_ASSERTIONS, ...SUSTAINABILITY_ASSERTIONS];

  switch (tokenType) {
    case 'OTHR':
      assertions.push(...OTHR_ASSERTIONS);
      break;
    case 'ART':
      assertions.push(...ART_ASSERTIONS);
      break;
    case 'EMT':
      assertions.push(...EMT_ASSERTIONS);
      break;
  }

  // Filter to only assertions applicable to this token type
  return assertions.filter((a) => a.tokenTypes.includes(tokenType));
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
 * Check if a value is "present" (not empty)
 */
function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Evaluate a condition
 */
function evaluateCondition(
  data: Record<string, unknown>,
  condition: ExistenceAssertion['condition']
): boolean {
  if (!condition) return true;

  const value = getNestedValue(data, condition.fieldPath);

  if (condition.value !== undefined) {
    return value === condition.value;
  }

  return isPresent(value);
}

/**
 * Validate existence assertions for whitepaper data
 */
export function validateExistenceAssertions(
  data: Partial<WhitepaperData>,
  tokenType: TokenType
): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const assertions = getExistenceAssertions(tokenType);
  const dataObj = data as Record<string, unknown>;

  for (const assertion of assertions) {
    // Check condition first
    if (assertion.condition && !evaluateCondition(dataObj, assertion.condition)) {
      continue; // Condition not met, skip this assertion
    }

    const value = getNestedValue(dataObj, assertion.fieldPath);

    if (!isPresent(value)) {
      const error: ValidationError = {
        ruleId: assertion.id,
        severity: assertion.severity,
        message: assertion.description,
        element: assertion.elementName,
        fieldPath: assertion.fieldPath,
      };

      if (assertion.severity === 'ERROR') {
        errors.push(error);
      } else {
        warnings.push(error);
      }
    }
  }

  return { errors, warnings };
}

/**
 * Get summary of existence assertions by category
 */
export function getAssertionSummary(tokenType: TokenType): {
  total: number;
  required: number;
  recommended: number;
  byPart: Record<string, number>;
} {
  const assertions = getExistenceAssertions(tokenType);

  const byPart: Record<string, number> = {};

  for (const assertion of assertions) {
    const part = assertion.fieldPath.split('.')[0] || 'unknown';
    byPart[part] = (byPart[part] || 0) + 1;
  }

  return {
    total: assertions.length,
    required: assertions.filter((a) => a.severity === 'ERROR').length,
    recommended: assertions.filter((a) => a.severity === 'WARNING').length,
    byPart,
  };
}
