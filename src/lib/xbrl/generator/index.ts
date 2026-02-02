/**
 * XBRL Generator exports
 */

export { buildContexts, buildAllContexts, getContextId } from './context-builder';
export type { ContextConfig } from './context-builder';

export {
  buildStringFact,
  buildBooleanFact,
  buildMonetaryFact,
  buildIntegerFact,
  buildDecimalFact,
  buildDateFact,
  buildTextBlockFact,
  buildAllFacts,
  getRequiredUnits,
  STANDARD_UNITS,
} from './fact-builder';

// Full-document generator (MiCA-compliant output)
export { generateIXBRLDocument, createIXBRLDocument } from './document-generator';

// Legacy summary generator (debug only)
export { generateSummaryIXBRLDocument, createSummaryIXBRLDocument } from './summary-generator';

// Template modules
export { generateCSSStylesheet } from './template/css-styles';
export { wrapInlineTag, wrapHiddenFact, wrapHiddenLink, escapeHtml } from './template/inline-tagger';
export { generateHiddenBlock } from './template/hidden-facts';
export { renderSection, renderDimensionalSection } from './template/section-renderer';
export { renderCoverPage, renderTableOfContents, wrapInPage } from './template/page-layout';

// MiCA template data
export { OTHR_FIELD_DEFINITIONS, getFieldsForSection, getFieldByElement, SECTION_TITLES } from './mica-template/field-definitions';
export { ENUMERATION_MAPPINGS, getEnumerationUri, getEnumerationLabel } from './mica-template/enumeration-mappings';
