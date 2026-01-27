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

export { generateIXBRLDocument, createIXBRLDocument } from './document-generator';
