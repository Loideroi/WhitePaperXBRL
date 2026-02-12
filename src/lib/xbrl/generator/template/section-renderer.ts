/**
 * Section Renderer
 *
 * Renders MiCA part tables in the numbered format (N | Field | Content)
 * with inline XBRL tags wrapping the content cells.
 */

import type { MiCAFieldDefinition } from '../mica-template/field-definitions';
import { SECTION_TITLES } from '../mica-template/field-definitions';
import {
  wrapInlineTag,
  wrapHiddenLink,
  wrapContinuationTag,
  wrapExclude,
  escapeHtml,
  splitTextIntoFragments,
  TEXT_BLOCK_CONTINUATION_THRESHOLD,
} from './inline-tagger';
import type { HiddenFactEntry } from './hidden-facts';

/**
 * Fact value with rendering metadata
 */
export interface FactValue {
  /** The display value */
  value: string;
  /** Context reference for this fact */
  contextRef: string;
  /** Unit reference (for numeric facts) */
  unitRef?: string;
  /** Decimal precision */
  decimals?: number;
  /** For hidden enumeration facts */
  hiddenFactId?: string;
  /** Human-readable value for hidden facts */
  humanReadable?: string;
  /** Taxonomy URI for hidden facts */
  taxonomyUri?: string;
}

/**
 * Counter for generating unique fact IDs
 */
let factIdCounter = 0;

/**
 * Reset fact counter (for testing)
 */
export function resetFactIdCounter(): void {
  factIdCounter = 0;
}

/**
 * Generate a unique fact ID
 */
export function generateFactId(prefix?: string): string {
  factIdCounter++;
  return prefix ? `${prefix}_${factIdCounter}` : `fact_${factIdCounter}`;
}

/**
 * Render a complete MiCA section as an HTML table.
 *
 * @param sectionKey Section identifier (A, B, C, etc. or 'summary', 'S')
 * @param fields Field definitions for this section
 * @param values Map of xbrlElement -> FactValue
 * @param hiddenFacts Array to push hidden fact entries into
 * @returns HTML string for the section
 */
export function renderSection(
  sectionKey: string,
  fields: MiCAFieldDefinition[],
  values: Map<string, FactValue>,
  hiddenFacts: HiddenFactEntry[]
): string {
  const title = SECTION_TITLES[sectionKey] || `Section ${sectionKey}`;
  const tableClass = sectionKey === 'S' ? 'sustainability' : 'accounts';

  const rows = fields
    .filter(f => !f.isDimensional) // Dimensional fields rendered separately
    .map(field => renderFieldRow(field, values, hiddenFacts))
    .join('\n');

  return `
    <h2 class="section-heading">${escapeHtml(title)}</h2>
    <table class="${tableClass}">
      <thead>
        <tr>
          <th>No</th>
          <th>Field</th>
          <th>Content</th>
        </tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>`;
}

/**
 * Render a single field row in the numbered table.
 *
 * For text blocks exceeding TEXT_BLOCK_CONTINUATION_THRESHOLD characters,
 * the content is split into fragments: the first fragment stays in the table cell,
 * and subsequent ix:continuation elements are placed in the same cell.
 *
 * The field number and label cells use ix:exclude when the content cell contains
 * a tagged fact, since those cells are non-data content within a tagged region context.
 *
 * @param field - The MiCA field definition
 * @param values - Map of xbrlElement to fact values
 * @param hiddenFacts - Array to push hidden fact entries into
 */
function renderFieldRow(
  field: MiCAFieldDefinition,
  values: Map<string, FactValue>,
  hiddenFacts: HiddenFactEntry[]
): string {
  const factValue = values.get(field.xbrlElement);

  let contentCell: string;
  // Track whether this row has a tagged fact (for ix:exclude on number/label cells)
  let hasTaggedFact = false;

  if (!factValue || !factValue.value) {
    // Empty field
    contentCell = '<td class="empty-field"></td>';
  } else if (field.isHidden && factValue.taxonomyUri) {
    // Enumeration field - value goes in ix:hidden, visible text linked via CSS
    const hiddenId = generateFactId('mica_enum');
    hiddenFacts.push({
      id: hiddenId,
      name: field.xbrlElement,
      contextRef: factValue.contextRef,
      taxonomyUri: factValue.taxonomyUri,
      humanReadable: factValue.humanReadable || factValue.value,
    });
    contentCell = `<td>${wrapHiddenLink(hiddenId, factValue.humanReadable || factValue.value)}</td>`;
    hasTaggedFact = true;
  } else if (field.isTextBlock && factValue.value.length > TEXT_BLOCK_CONTINUATION_THRESHOLD) {
    // Long text block — split into fragments using ix:continuation
    hasTaggedFact = true;
    const factId = generateFactId('fact');
    const fragments = splitTextIntoFragments(factValue.value);
    const { primary, continuations } = wrapContinuationTag({
      id: factId,
      name: field.xbrlElement,
      contextRef: factValue.contextRef,
      fragments,
      isTextBlock: true,
    });
    const continuationHtml = continuations.join('\n');
    contentCell = `<td><div class="text-block">${primary}</div>${continuationHtml}</td>`;
  } else {
    // Regular inline fact
    hasTaggedFact = true;
    const factId = generateFactId('fact');
    const taggedContent = wrapInlineTag({
      id: factId,
      name: field.xbrlElement,
      contextRef: factValue.contextRef,
      value: factValue.value,
      dataType: field.dataType,
      isTextBlock: field.isTextBlock,
      unitRef: factValue.unitRef,
      decimals: factValue.decimals,
    });

    if (field.isTextBlock) {
      contentCell = `<td><div class="text-block">${taggedContent}</div></td>`;
    } else {
      contentCell = `<td>${taggedContent}</td>`;
    }
  }

  // Wrap number and label in ix:exclude when the row contains a tagged fact,
  // to prevent them from being treated as part of the XBRL data.
  const numberCell = hasTaggedFact
    ? `<td>${wrapExclude(escapeHtml(field.number))}</td>`
    : `<td>${escapeHtml(field.number)}</td>`;
  const labelCell = hasTaggedFact
    ? `<td>${wrapExclude(escapeHtml(field.label))}</td>`
    : `<td>${escapeHtml(field.label)}</td>`;

  return `        <tr>
          ${numberCell}
          ${labelCell}
          ${contentCell}
        </tr>`;
}

/**
 * Render a dimensional section (management body members or persons involved).
 */
export function renderDimensionalSection(
  title: string,
  memberData: Array<{
    identity: string;
    businessAddress: string;
    functionOrType: string;
    contextRef: string;
  }>,
  fields: {
    identityElement: string;
    addressElement: string;
    functionElement: string;
  },
  hiddenFacts: HiddenFactEntry[]
): string {
  if (memberData.length === 0) {
    return '';
  }

  const rows = memberData
    .map((member, index) => {
      const idId = generateFactId('dim');
      const addrId = generateFactId('dim');
      const funcId = generateFactId('dim');

      return `        <tr>
          <td>${index + 1}</td>
          <td><ix:nonNumeric id="${idId}" name="${fields.identityElement}" contextRef="${member.contextRef}" escape="false">${escapeHtml(member.identity)}</ix:nonNumeric></td>
          <td><ix:nonNumeric id="${addrId}" name="${fields.addressElement}" contextRef="${member.contextRef}" escape="false">${escapeHtml(member.businessAddress)}</ix:nonNumeric></td>
          <td><ix:nonNumeric id="${funcId}" name="${fields.functionElement}" contextRef="${member.contextRef}" escape="false">${escapeHtml(member.functionOrType)}</ix:nonNumeric></td>
        </tr>`;
    })
    .join('\n');

  return `
    <h3 class="section-subheading">${escapeHtml(title)}</h3>
    <table class="dimensional">
      <thead>
        <tr>
          <th>#</th>
          <th>Identity</th>
          <th>Business Address</th>
          <th>Function / Type</th>
        </tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>`;
}
