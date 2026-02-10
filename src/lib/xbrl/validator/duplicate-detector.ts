/**
 * Duplicate Fact Detector
 *
 * Scans generated iXBRL facts and detects duplicates based on:
 * - Same XBRL element name
 * - Same context reference
 * - Same unit reference (for numeric facts)
 *
 * Two facts with identical (name, contextRef, unitRef) are duplicates.
 * Non-dimensional facts should never be duplicated.
 *
 * ESMA requires that each fact (element + context + unit) appears only once
 * in the document. This detector is used as a post-generation validation step.
 */

import type { ValidationError } from '@/types/xbrl';

/**
 * Input fact structure for duplicate detection.
 * Matches the shape produced by both `createIXBRLDocument` and `buildAllFacts`.
 */
export interface FactInput {
  /** The XBRL element name (e.g., "mica:OfferorLegalName") */
  name: string;
  /** The context reference (e.g., "ctx_duration") */
  contextRef: string;
  /** The fact value as a string */
  value: string;
  /** The unit reference, if applicable (e.g., "unit_EUR") */
  unitRef?: string;
}

/**
 * A group of facts that share the same composite key (name + contextRef + unitRef).
 */
export interface DuplicateGroup {
  /** The XBRL element name */
  elementName: string;
  /** The context reference */
  contextRef: string;
  /** The unit reference (if applicable) */
  unitRef?: string;
  /** Number of occurrences (>= 2 if duplicate) */
  count: number;
  /** The values found for each occurrence */
  values: string[];
}

/**
 * Result of duplicate fact detection.
 */
export interface DuplicateFactResult {
  /** Whether duplicates were found */
  hasDuplicates: boolean;
  /** List of duplicate groups (only groups with count >= 2) */
  duplicates: DuplicateGroup[];
  /** Total facts scanned */
  totalFacts: number;
}

/**
 * Build a composite key from (name, contextRef, unitRef) for grouping facts.
 *
 * @param name - The XBRL element name
 * @param contextRef - The context reference
 * @param unitRef - The unit reference (optional)
 * @returns A string key uniquely identifying the fact's identity tuple
 */
function buildFactKey(name: string, contextRef: string, unitRef?: string): string {
  // Use a separator that cannot appear in element names or context IDs
  return `${name}||${contextRef}||${unitRef ?? ''}`;
}

/**
 * Detect duplicate facts in a set of generated facts.
 *
 * Groups facts by their composite key (name + contextRef + unitRef) and
 * identifies any group with more than one occurrence.
 *
 * @param facts - Array of facts to scan for duplicates
 * @returns A structured result indicating whether duplicates exist and their details
 */
export function detectDuplicateFacts(facts: FactInput[]): DuplicateFactResult {
  if (facts.length === 0) {
    return {
      hasDuplicates: false,
      duplicates: [],
      totalFacts: 0,
    };
  }

  // Group facts by composite key
  const groups = new Map<string, { name: string; contextRef: string; unitRef?: string; values: string[] }>();

  for (const fact of facts) {
    const key = buildFactKey(fact.name, fact.contextRef, fact.unitRef);
    const existing = groups.get(key);

    if (existing) {
      existing.values.push(fact.value);
    } else {
      groups.set(key, {
        name: fact.name,
        contextRef: fact.contextRef,
        unitRef: fact.unitRef,
        values: [fact.value],
      });
    }
  }

  // Filter to only groups with duplicates (count >= 2)
  const duplicates: DuplicateGroup[] = [];

  for (const group of groups.values()) {
    if (group.values.length >= 2) {
      duplicates.push({
        elementName: group.name,
        contextRef: group.contextRef,
        unitRef: group.unitRef,
        count: group.values.length,
        values: group.values,
      });
    }
  }

  return {
    hasDuplicates: duplicates.length > 0,
    duplicates,
    totalFacts: facts.length,
  };
}

/**
 * Convert duplicate detection results into ValidationError objects
 * for integration with the validation orchestrator.
 *
 * Each duplicate group produces one ERROR-severity validation error.
 *
 * @param result - The duplicate detection result
 * @returns Array of ValidationError objects (empty if no duplicates)
 */
export function duplicateResultToValidationErrors(
  result: DuplicateFactResult
): ValidationError[] {
  if (!result.hasDuplicates) {
    return [];
  }

  return result.duplicates.map((group) => {
    const unitInfo = group.unitRef ? ` with unit "${group.unitRef}"` : '';
    const valuesPreview = group.values.length <= 3
      ? group.values.map((v) => `"${v.substring(0, 50)}"`).join(', ')
      : `${group.values.slice(0, 3).map((v) => `"${v.substring(0, 50)}"`).join(', ')} ... and ${group.values.length - 3} more`;

    return {
      ruleId: 'DUP-001',
      severity: 'ERROR' as const,
      message: `Duplicate fact: element "${group.elementName}" with context "${group.contextRef}"${unitInfo} appears ${group.count} times. Values: ${valuesPreview}`,
      element: group.elementName,
    };
  });
}
