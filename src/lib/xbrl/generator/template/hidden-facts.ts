/**
 * Hidden Facts Generator
 *
 * Generates the ix:hidden block for enumeration facts.
 * Enumeration facts go in ix:hidden because no inline transformation
 * rule exists for them (ESMA Guidance 2.3.1).
 *
 * The visible text is linked via -ix-hidden CSS property.
 */

import { wrapHiddenFact } from './inline-tagger';

/**
 * A hidden fact entry
 */
export interface HiddenFactEntry {
  /** Unique fact ID (used for -ix-hidden CSS linking) */
  id: string;
  /** XBRL element name */
  name: string;
  /** Context reference */
  contextRef: string;
  /** Taxonomy URI (the actual fact value) */
  taxonomyUri: string;
  /** Human-readable display value (shown in visible content) */
  humanReadable: string;
}

/**
 * Generate the complete ix:hidden block containing all enumeration facts.
 */
export function generateHiddenBlock(hiddenFacts: HiddenFactEntry[]): string {
  if (hiddenFacts.length === 0) {
    return '';
  }

  const factElements = hiddenFacts
    .map(fact =>
      `        ${wrapHiddenFact(fact.id, fact.name, fact.contextRef, fact.taxonomyUri)}`
    )
    .join('\n');

  return `      <ix:hidden>\n${factElements}\n      </ix:hidden>`;
}
