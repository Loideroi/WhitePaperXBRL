/**
 * Validation Orchestrator
 *
 * Coordinates all validation engines and aggregates results.
 */

import type { ValidationResult, ValidationError } from '@/types/xbrl';
import type { TokenType } from '@/types/taxonomy';
import type { WhitepaperData } from '@/types/whitepaper';

import { validateLEI, validateAllLEIs } from './lei-validator';
import { validateExistenceAssertions, getAssertionSummary } from './existence-engine';
import { validateValueAssertions, getValueAssertionSummary } from './value-engine';
import { detectDuplicateFacts, duplicateResultToValidationErrors } from './duplicate-detector';
import { createIXBRLDocument } from '../generator/document-generator';

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Whether to check LEI with GLEIF API */
  checkGLEIF?: boolean;
  /** Whether to run all validations or stop on first error */
  stopOnFirstError?: boolean;
  /** Skip specific rule IDs */
  skipRules?: string[];
}

/**
 * Detailed validation result
 */
export interface DetailedValidationResult extends ValidationResult {
  /** Results by category */
  byCategory: {
    lei: { errors: ValidationError[]; warnings: ValidationError[] };
    existence: { errors: ValidationError[]; warnings: ValidationError[] };
    value: { errors: ValidationError[]; warnings: ValidationError[] };
    duplicate: { errors: ValidationError[]; warnings: ValidationError[] };
  };
  /** Assertion counts */
  assertionCounts: {
    existence: { total: number; passed: number; failed: number };
    value: { total: number; passed: number; failed: number };
    lei: { total: number; passed: number; failed: number };
    duplicate: { total: number; passed: number; failed: number };
  };
}

/**
 * Filter errors by skip rules
 */
function filterBySkipRules(
  errors: ValidationError[],
  skipRules?: string[]
): ValidationError[] {
  if (!skipRules || skipRules.length === 0) {
    return errors;
  }
  return errors.filter((e) => !skipRules.includes(e.ruleId));
}

/**
 * Run all validations on whitepaper data
 */
export async function validateWhitepaper(
  data: Partial<WhitepaperData>,
  tokenType: TokenType,
  options: ValidationOptions = {}
): Promise<DetailedValidationResult> {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  const byCategory = {
    lei: { errors: [] as ValidationError[], warnings: [] as ValidationError[] },
    existence: { errors: [] as ValidationError[], warnings: [] as ValidationError[] },
    value: { errors: [] as ValidationError[], warnings: [] as ValidationError[] },
    duplicate: { errors: [] as ValidationError[], warnings: [] as ValidationError[] },
  };

  // 1. LEI Validation
  const leiErrors = validateAllLEIs(
    data.partA?.lei,
    (data as Record<string, unknown>).partB
      ? ((data as Record<string, unknown>).partB as Record<string, unknown>)?.lei as string
      : undefined,
    (data as Record<string, unknown>).partC
      ? ((data as Record<string, unknown>).partC as Record<string, unknown>)?.lei as string
      : undefined
  );

  const filteredLeiErrors = filterBySkipRules(leiErrors, options.skipRules);
  byCategory.lei.errors.push(
    ...filteredLeiErrors.filter((e) => e.severity === 'ERROR')
  );
  byCategory.lei.warnings.push(
    ...filteredLeiErrors.filter((e) => e.severity === 'WARNING')
  );

  // Check GLEIF if requested and LEI is valid
  if (options.checkGLEIF && data.partA?.lei && byCategory.lei.errors.length === 0) {
    const gleifResult = await validateLEI(data.partA.lei, { checkGLEIF: true });
    if ('errors' in gleifResult && gleifResult.errors.length > 0) {
      const gleifErrors = filterBySkipRules(gleifResult.errors, options.skipRules);
      byCategory.lei.errors.push(
        ...gleifErrors.filter((e) => e.severity === 'ERROR')
      );
      byCategory.lei.warnings.push(
        ...gleifErrors.filter((e) => e.severity === 'WARNING')
      );
    }
  }

  // 2. Existence Assertions
  const existenceResult = validateExistenceAssertions(data, tokenType);
  byCategory.existence.errors.push(
    ...filterBySkipRules(existenceResult.errors, options.skipRules)
  );
  byCategory.existence.warnings.push(
    ...filterBySkipRules(existenceResult.warnings, options.skipRules)
  );

  // 3. Value Assertions
  const valueResult = validateValueAssertions(data, tokenType);
  byCategory.value.errors.push(
    ...filterBySkipRules(valueResult.errors, options.skipRules)
  );
  byCategory.value.warnings.push(
    ...filterBySkipRules(valueResult.warnings, options.skipRules)
  );

  // 4. Duplicate Fact Detection
  // Generate the iXBRL document to get the facts, then check for duplicates
  const ixbrlDoc = createIXBRLDocument(data);
  const factsForDuplicateCheck = ixbrlDoc.facts.map((f) => ({
    name: f.name,
    contextRef: f.contextRef,
    value: String(f.value),
    unitRef: f.unitRef,
  }));
  const duplicateResult = detectDuplicateFacts(factsForDuplicateCheck);
  const duplicateErrors = duplicateResultToValidationErrors(duplicateResult);
  const filteredDuplicateErrors = filterBySkipRules(duplicateErrors, options.skipRules);
  byCategory.duplicate.errors.push(
    ...filteredDuplicateErrors.filter((e) => e.severity === 'ERROR')
  );
  byCategory.duplicate.warnings.push(
    ...filteredDuplicateErrors.filter((e) => e.severity === 'WARNING')
  );

  // Aggregate all errors and warnings
  allErrors.push(
    ...byCategory.lei.errors,
    ...byCategory.existence.errors,
    ...byCategory.value.errors,
    ...byCategory.duplicate.errors
  );
  allWarnings.push(
    ...byCategory.lei.warnings,
    ...byCategory.existence.warnings,
    ...byCategory.value.warnings,
    ...byCategory.duplicate.warnings
  );

  // Calculate assertion counts
  const existenceSummary = getAssertionSummary(tokenType);
  const valueSummary = getValueAssertionSummary(tokenType);

  // Duplicate detection counts as 1 assertion (pass or fail)
  const duplicateAssertionTotal = 1;
  const duplicateAssertionFailed = byCategory.duplicate.errors.length > 0 ? 1 : 0;

  const assertionCounts = {
    existence: {
      total: existenceSummary.total,
      passed: existenceSummary.total - byCategory.existence.errors.length,
      failed: byCategory.existence.errors.length,
    },
    value: {
      total: valueSummary.total,
      passed: valueSummary.total - byCategory.value.errors.length,
      failed: byCategory.value.errors.length,
    },
    lei: {
      total: 6, // LEI validation has 6 possible checks
      passed: 6 - byCategory.lei.errors.length,
      failed: byCategory.lei.errors.length,
    },
    duplicate: {
      total: duplicateAssertionTotal,
      passed: duplicateAssertionTotal - duplicateAssertionFailed,
      failed: duplicateAssertionFailed,
    },
  };

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    summary: {
      totalAssertions:
        assertionCounts.existence.total +
        assertionCounts.value.total +
        assertionCounts.lei.total +
        assertionCounts.duplicate.total,
      passed:
        assertionCounts.existence.passed +
        assertionCounts.value.passed +
        assertionCounts.lei.passed +
        assertionCounts.duplicate.passed,
      errors: allErrors.length,
      warnings: allWarnings.length,
    },
    byCategory,
    assertionCounts,
  };
}

/**
 * Quick validation (existence only, no GLEIF)
 */
export function quickValidate(
  data: Partial<WhitepaperData>,
  tokenType: TokenType
): { valid: boolean; errorCount: number; errors: ValidationError[] } {
  const existenceResult = validateExistenceAssertions(data, tokenType);
  const leiErrors = validateAllLEIs(data.partA?.lei);

  const allErrors = [...leiErrors.filter((e) => e.severity === 'ERROR'), ...existenceResult.errors];

  return {
    valid: allErrors.length === 0,
    errorCount: allErrors.length,
    errors: allErrors,
  };
}

/**
 * Validate a single field
 */
export function validateField(
  data: Partial<WhitepaperData>,
  fieldPath: string,
  tokenType: TokenType
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Run existence check for this field
  const existenceResult = validateExistenceAssertions(data, tokenType);
  errors.push(...existenceResult.errors.filter((e) => e.fieldPath === fieldPath));
  errors.push(...existenceResult.warnings.filter((e) => e.fieldPath === fieldPath));

  // Run value check for this field
  const valueResult = validateValueAssertions(data, tokenType);
  errors.push(...valueResult.errors.filter((e) => e.fieldPath === fieldPath));
  errors.push(...valueResult.warnings.filter((e) => e.fieldPath === fieldPath));

  // LEI specific
  if (fieldPath === 'partA.lei') {
    const leiErrors = validateAllLEIs(data.partA?.lei);
    errors.push(...leiErrors);
  }

  return errors;
}

/**
 * Get validation requirements for a token type
 */
export function getValidationRequirements(tokenType: TokenType): {
  existence: ReturnType<typeof getAssertionSummary>;
  value: ReturnType<typeof getValueAssertionSummary>;
  total: number;
} {
  const existence = getAssertionSummary(tokenType);
  const value = getValueAssertionSummary(tokenType);

  return {
    existence,
    value,
    total: existence.total + value.total + 6 + 1, // +6 for LEI checks, +1 for duplicate detection
  };
}
