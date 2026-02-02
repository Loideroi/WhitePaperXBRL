/**
 * Inline XBRL Tagger
 *
 * Wraps content with appropriate ix:nonNumeric or ix:nonFraction elements.
 * Follows ESMA Guidance 2.2.6 for escape/format attributes.
 */

import type { XBRLDataType } from '@/types/taxonomy';

/**
 * Escape HTML special characters for safe embedding in XHTML
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Options for inline tagging
 */
export interface InlineTagOptions {
  /** Unique fact ID */
  id: string;
  /** Full XBRL element name (e.g., "mica:NameOfOtherTokenOfferor") */
  name: string;
  /** Context reference ID */
  contextRef: string;
  /** The visible value to display */
  value: string;
  /** XBRL data type of the element */
  dataType: XBRLDataType;
  /** Whether this is a text block (textBlockItemType) */
  isTextBlock: boolean;
  /** Unit reference (for numeric facts only) */
  unitRef?: string;
  /** Decimal precision (for numeric facts) */
  decimals?: number;
}

/**
 * Wrap a value with the appropriate inline XBRL tag.
 *
 * Rules (ESMA Guidance 2.2.6):
 * - textBlockItemType -> escape="true" format="ixt4:fixed-true"
 * - stringItemType -> escape="false"
 * - monetaryItemType/decimalItemType/integerItemType -> ix:nonFraction
 * - booleanItemType -> escape="false"
 * - dateItemType -> escape="false"
 * - percentItemType -> ix:nonFraction with unitRef="unit_pure"
 * - leiItemType -> escape="false"
 */
export function wrapInlineTag(options: InlineTagOptions): string {
  const { id, name, contextRef, value, dataType, isTextBlock, unitRef, decimals } = options;

  // Numeric types use ix:nonFraction
  if (isNumericType(dataType)) {
    const unitAttr = unitRef ? ` unitRef="${unitRef}"` : '';
    const decimalsAttr = decimals !== undefined ? ` decimals="${decimals}"` : '';
    const formatAttr = ' format="ixt:num-dot-decimal"';
    return `<ix:nonFraction id="${id}" name="${name}" contextRef="${contextRef}"${unitAttr}${decimalsAttr}${formatAttr}>${escapeHtml(value)}</ix:nonFraction>`;
  }

  // Text block types: escape="true" with format
  if (isTextBlock || dataType === 'textBlockItemType') {
    return `<ix:nonNumeric id="${id}" name="${name}" contextRef="${contextRef}" escape="true" format="ixt4:fixed-true">${escapeHtml(value)}</ix:nonNumeric>`;
  }

  // All other non-numeric types: escape="false"
  return `<ix:nonNumeric id="${id}" name="${name}" contextRef="${contextRef}" escape="false">${escapeHtml(value)}</ix:nonNumeric>`;
}

/**
 * Generate a hidden fact tag for enumeration types.
 * These go in ix:hidden and are linked via -ix-hidden CSS.
 */
export function wrapHiddenFact(
  id: string,
  name: string,
  contextRef: string,
  taxonomyUri: string
): string {
  return `<ix:nonNumeric id="${id}" name="${name}" contextRef="${contextRef}" escape="false">${escapeHtml(taxonomyUri)}</ix:nonNumeric>`;
}

/**
 * Generate the visible div that links to a hidden enumeration fact
 * via the -ix-hidden CSS property.
 */
export function wrapHiddenLink(hiddenFactId: string, humanReadableValue: string): string {
  return `<div style="-ix-hidden:${hiddenFactId};">${escapeHtml(humanReadableValue)}</div>`;
}

/**
 * Check if a data type is numeric (requires ix:nonFraction)
 */
function isNumericType(dataType: XBRLDataType): boolean {
  return [
    'monetaryItemType',
    'decimalItemType',
    'integerItemType',
    'percentItemType',
  ].includes(dataType);
}

/**
 * Get the appropriate unit reference for a numeric data type
 */
export function getUnitRefForType(dataType: XBRLDataType, currency?: string): string | undefined {
  switch (dataType) {
    case 'monetaryItemType':
      return `unit_${currency || 'EUR'}`;
    case 'decimalItemType':
    case 'integerItemType':
      return 'unit_pure';
    case 'percentItemType':
      return 'unit_pure';
    default:
      return undefined;
  }
}
