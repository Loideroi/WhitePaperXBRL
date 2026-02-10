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
 * Check if a value string represents a valid numeric value.
 * Strips formatting characters (commas, currency symbols, whitespace, trailing periods)
 * and checks if the result is a finite number.
 */
export function isValueNumeric(value: string): boolean {
  if (!value || value.trim().length === 0) return false;
  const cleaned = value.replace(/[,%$€£\s]/g, '').replace(/\.+$/, '');
  if (cleaned.length === 0) return false;
  const num = Number(cleaned);
  return !isNaN(num) && isFinite(num);
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
 *
 * When a numeric type field contains non-numeric content (e.g., "Not applicable",
 * narrative text), falls back to ix:nonNumeric to produce valid iXBRL.
 */
export function wrapInlineTag(options: InlineTagOptions): string {
  const { id, name, contextRef, value, dataType, isTextBlock, unitRef, decimals } = options;

  // Numeric types use ix:nonFraction only if the value is actually numeric
  if (isNumericType(dataType)) {
    if (isValueNumeric(value)) {
      const unitAttr = unitRef ? ` unitRef="${unitRef}"` : '';
      const decimalsAttr = decimals !== undefined ? ` decimals="${decimals}"` : '';
      const formatAttr = ' format="ixt:num-dot-decimal"';
      return `<ix:nonFraction id="${id}" name="${name}" contextRef="${contextRef}"${unitAttr}${decimalsAttr}${formatAttr}>${escapeHtml(value)}</ix:nonFraction>`;
    }
    // Content is not numeric — fall back to ix:nonNumeric (valid iXBRL for text overrides)
    return `<ix:nonNumeric id="${id}" name="${name}" contextRef="${contextRef}" escape="false">${escapeHtml(value)}</ix:nonNumeric>`;
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
 * Options for continuation tagging of multi-fragment text blocks.
 */
export interface ContinuationTagOptions {
  /** Unique fact ID (used as base for generating continuation IDs) */
  id: string;
  /** Full XBRL element name (e.g., "mica:SomeTextBlock") */
  name: string;
  /** Context reference ID */
  contextRef: string;
  /** Array of HTML fragments that together form the complete fact value */
  fragments: string[];
  /** Whether this is a text block type (determines escape/format attributes) */
  isTextBlock: boolean;
}

/**
 * Result of continuation tagging.
 */
export interface ContinuationTagResult {
  /** The primary ix:nonNumeric tag wrapping the first fragment */
  primary: string;
  /** Array of ix:continuation tags for subsequent fragments */
  continuations: string[];
}

/**
 * Wrap a text block value that requires continuation (split across multiple locations).
 * The first fragment is wrapped in ix:nonNumeric, subsequent fragments use ix:continuation.
 * Per ESMA Guidance: ix:continuation links fragments of the same fact.
 *
 * Linking scheme:
 * - Primary tag has continuedAt="cont_{id}_1"
 * - Each ix:continuation has id="cont_{id}_N" and continuedAt="cont_{id}_{N+1}"
 * - The last continuation has no continuedAt attribute
 *
 * If only one fragment is provided, no continuation is needed and the result
 * contains an empty continuations array.
 *
 * @param options - Continuation tag configuration
 * @returns Object with primary tag and array of continuation tags
 */
export function wrapContinuationTag(options: ContinuationTagOptions): ContinuationTagResult {
  const { id, name, contextRef, fragments, isTextBlock } = options;

  if (fragments.length === 0) {
    // No fragments — return empty primary with no continuations
    const escapeAttr = isTextBlock ? 'escape="true" format="ixt4:fixed-true"' : 'escape="false"';
    return {
      primary: `<ix:nonNumeric id="${id}" name="${name}" contextRef="${contextRef}" ${escapeAttr}></ix:nonNumeric>`,
      continuations: [],
    };
  }

  const escapeAttr = isTextBlock ? 'escape="true" format="ixt4:fixed-true"' : 'escape="false"';

  const firstFragment = fragments[0] as string;

  if (fragments.length === 1) {
    // Single fragment — no continuation needed, just a normal tag
    return {
      primary: `<ix:nonNumeric id="${id}" name="${name}" contextRef="${contextRef}" ${escapeAttr}>${escapeHtml(firstFragment)}</ix:nonNumeric>`,
      continuations: [],
    };
  }

  // Multiple fragments — primary tag + continuation chain
  const firstContId = `cont_${id}_1`;
  const primary = `<ix:nonNumeric id="${id}" name="${name}" contextRef="${contextRef}" ${escapeAttr} continuedAt="${firstContId}">${escapeHtml(firstFragment)}</ix:nonNumeric>`;

  const continuations: string[] = [];
  for (let i = 1; i < fragments.length; i++) {
    const fragment = fragments[i] as string;
    const contId = `cont_${id}_${i}`;
    const isLast = i === fragments.length - 1;
    const continuedAtAttr = isLast ? '' : ` continuedAt="cont_${id}_${i + 1}"`;
    continuations.push(
      `<ix:continuation id="${contId}"${continuedAtAttr}>${escapeHtml(fragment)}</ix:continuation>`
    );
  }

  return { primary, continuations };
}

/**
 * Wrap content that should be excluded from XBRL processing.
 * Used for page numbers, headers/footers, and other non-data content
 * within tagged regions.
 *
 * Per iXBRL specification: ix:exclude prevents the enclosed content from
 * being treated as part of any surrounding XBRL fact.
 *
 * @param content - The HTML content to exclude from XBRL processing
 * @returns The content wrapped in an ix:exclude element
 */
export function wrapExclude(content: string): string {
  return `<ix:exclude>${content}</ix:exclude>`;
}

/**
 * Threshold in characters above which text block values should be split
 * into multiple fragments using ix:continuation.
 */
export const TEXT_BLOCK_CONTINUATION_THRESHOLD = 5000;

/**
 * Split a long text block into fragments of approximately equal size,
 * breaking at paragraph boundaries (double newlines) when possible.
 *
 * @param text - The full text block content
 * @param threshold - Maximum character count per fragment
 * @returns Array of text fragments
 */
export function splitTextIntoFragments(text: string, threshold: number = TEXT_BLOCK_CONTINUATION_THRESHOLD): string[] {
  if (text.length <= threshold) {
    return [text];
  }

  const fragments: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= threshold) {
      fragments.push(remaining);
      break;
    }

    // Try to split at a paragraph boundary (double newline) within the threshold
    const chunk = remaining.slice(0, threshold);
    const lastParagraphBreak = chunk.lastIndexOf('\n\n');

    let splitIndex: number;
    if (lastParagraphBreak > threshold * 0.3) {
      // Found a paragraph break in the latter 70% of the chunk — use it
      splitIndex = lastParagraphBreak + 2; // Include the double newline in the first fragment
    } else {
      // No good paragraph break — try a single newline
      const lastNewline = chunk.lastIndexOf('\n');
      if (lastNewline > threshold * 0.3) {
        splitIndex = lastNewline + 1;
      } else {
        // No good break point — try a space
        const lastSpace = chunk.lastIndexOf(' ');
        if (lastSpace > threshold * 0.3) {
          splitIndex = lastSpace + 1;
        } else {
          // Hard split at threshold
          splitIndex = threshold;
        }
      }
    }

    fragments.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex);
  }

  return fragments;
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
