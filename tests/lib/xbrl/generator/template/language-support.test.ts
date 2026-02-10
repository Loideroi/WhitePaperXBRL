import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_LANGUAGES,
  isValidLanguage,
  getLanguageName,
  getSectionTitle,
} from '@/lib/xbrl/generator/template/language-support';

describe('language-support', () => {
  describe('SUPPORTED_LANGUAGES', () => {
    it('should contain 24 EU official languages', () => {
      expect(SUPPORTED_LANGUAGES).toHaveLength(24);
    });

    it('should include English', () => {
      expect(SUPPORTED_LANGUAGES).toContain('en');
    });

    it('should include all major EU languages', () => {
      const expected = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pt', 'pl'];
      for (const lang of expected) {
        expect(SUPPORTED_LANGUAGES).toContain(lang);
      }
    });
  });

  describe('isValidLanguage', () => {
    it('should return true for valid EU language codes', () => {
      expect(isValidLanguage('en')).toBe(true);
      expect(isValidLanguage('de')).toBe(true);
      expect(isValidLanguage('fr')).toBe(true);
    });

    it('should return true for all 24 supported languages', () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(isValidLanguage(lang)).toBe(true);
      }
    });

    it('should return false for invalid/unsupported language codes', () => {
      expect(isValidLanguage('xx')).toBe(false);
      expect(isValidLanguage('zh')).toBe(false);
      expect(isValidLanguage('jp')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidLanguage('')).toBe(false);
    });

    it('should return false for uppercase codes', () => {
      expect(isValidLanguage('EN')).toBe(false);
      expect(isValidLanguage('De')).toBe(false);
    });

    it('should return false for 3-letter codes', () => {
      expect(isValidLanguage('eng')).toBe(false);
      expect(isValidLanguage('deu')).toBe(false);
    });
  });

  describe('getLanguageName', () => {
    it('should return proper English name for known codes', () => {
      expect(getLanguageName('en')).toBe('English');
      expect(getLanguageName('de')).toBe('German');
      expect(getLanguageName('fr')).toBe('French');
      expect(getLanguageName('es')).toBe('Spanish');
      expect(getLanguageName('it')).toBe('Italian');
    });

    it('should return proper names for all supported languages', () => {
      expect(getLanguageName('bg')).toBe('Bulgarian');
      expect(getLanguageName('cs')).toBe('Czech');
      expect(getLanguageName('da')).toBe('Danish');
      expect(getLanguageName('el')).toBe('Greek');
      expect(getLanguageName('et')).toBe('Estonian');
      expect(getLanguageName('fi')).toBe('Finnish');
      expect(getLanguageName('ga')).toBe('Irish');
      expect(getLanguageName('hr')).toBe('Croatian');
      expect(getLanguageName('hu')).toBe('Hungarian');
      expect(getLanguageName('lt')).toBe('Lithuanian');
      expect(getLanguageName('lv')).toBe('Latvian');
      expect(getLanguageName('mt')).toBe('Maltese');
      expect(getLanguageName('nl')).toBe('Dutch');
      expect(getLanguageName('pl')).toBe('Polish');
      expect(getLanguageName('pt')).toBe('Portuguese');
      expect(getLanguageName('ro')).toBe('Romanian');
      expect(getLanguageName('sk')).toBe('Slovak');
      expect(getLanguageName('sl')).toBe('Slovenian');
      expect(getLanguageName('sv')).toBe('Swedish');
    });

    it('should return the code itself for unknown languages', () => {
      expect(getLanguageName('xx')).toBe('xx');
      expect(getLanguageName('zh')).toBe('zh');
    });
  });

  describe('getSectionTitle', () => {
    it('should return correct title for summary', () => {
      expect(getSectionTitle('summary', 'en')).toBe('Summary');
    });

    it('should return correct titles for all MiCA parts', () => {
      expect(getSectionTitle('A', 'en')).toBe('Part A: Information about the Offeror');
      expect(getSectionTitle('B', 'en')).toBe('Part B: Information about the Issuer');
      expect(getSectionTitle('C', 'en')).toBe('Part C: Information about the Operator of the Trading Platform');
      expect(getSectionTitle('D', 'en')).toBe('Part D: Information about the Crypto-Asset Project');
      expect(getSectionTitle('E', 'en')).toBe('Part E: Information about the Offer to the Public or Admission to Trading');
      expect(getSectionTitle('F', 'en')).toBe('Part F: Information about the Crypto-Asset');
      expect(getSectionTitle('G', 'en')).toBe('Part G: Rights and Obligations');
      expect(getSectionTitle('H', 'en')).toBe('Part H: Information on the Underlying Technology');
      expect(getSectionTitle('I', 'en')).toBe('Part I: Risk Disclosure and Compliance Statements');
      expect(getSectionTitle('J', 'en')).toBe('Part J: Information on Sustainability');
      expect(getSectionTitle('S', 'en')).toBe('Annex III: Sustainability Indicators');
    });

    it('should return fallback for unknown section keys', () => {
      expect(getSectionTitle('Z', 'en')).toBe('Section Z');
      expect(getSectionTitle('unknown', 'en')).toBe('Section unknown');
    });

    it('should return English titles regardless of language parameter (for now)', () => {
      // Currently only English is implemented; other languages return English titles
      expect(getSectionTitle('A', 'de')).toBe('Part A: Information about the Offeror');
      expect(getSectionTitle('summary', 'fr')).toBe('Summary');
    });
  });
});
