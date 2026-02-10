/**
 * Language Support for MiCA iXBRL Documents
 *
 * Per MiCA Regulation Article 6(7), crypto-asset white papers shall be drawn up
 * in the official language(s) of the home/host Member State, or in a language
 * customary in the sphere of international finance (English).
 */

/** Supported EU official languages for MiCA white papers */
export const SUPPORTED_LANGUAGES = [
  'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr',
  'ga', 'hr', 'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt',
  'ro', 'sk', 'sl', 'sv',
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/** Validate that a language code is supported */
export function isValidLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

/** Get human-readable language name */
export function getLanguageName(lang: string): string {
  const names: Record<string, string> = {
    bg: 'Bulgarian', cs: 'Czech', da: 'Danish', de: 'German', el: 'Greek',
    en: 'English', es: 'Spanish', et: 'Estonian', fi: 'Finnish', fr: 'French',
    ga: 'Irish', hr: 'Croatian', hu: 'Hungarian', it: 'Italian',
    lt: 'Lithuanian', lv: 'Latvian', mt: 'Maltese', nl: 'Dutch',
    pl: 'Polish', pt: 'Portuguese', ro: 'Romanian', sk: 'Slovak',
    sl: 'Slovenian', sv: 'Swedish',
  };
  return names[lang] || lang;
}

/**
 * Static section titles in supported languages.
 * Currently only English is provided; additional languages can be added.
 */
export function getSectionTitle(sectionKey: string, lang: string): string {
  // For now, return English titles. Extensible for future translations.
  const titles: Record<string, string> = {
    summary: 'Summary',
    A: 'Part A: Information about the Offeror',
    B: 'Part B: Information about the Issuer',
    C: 'Part C: Information about the Operator of the Trading Platform',
    D: 'Part D: Information about the Crypto-Asset Project',
    E: 'Part E: Information about the Offer to the Public or Admission to Trading',
    F: 'Part F: Information about the Crypto-Asset',
    G: 'Part G: Rights and Obligations',
    H: 'Part H: Information on the Underlying Technology',
    I: 'Part I: Risk Disclosure and Compliance Statements',
    J: 'Part J: Information on Sustainability',
    S: 'Annex III: Sustainability Indicators',
  };
  return titles[sectionKey] || `Section ${sectionKey}`;
}
