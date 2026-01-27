import { describe, it, expect, beforeAll } from 'vitest';
import { TaxonomyRegistry, createRegistry } from '@/lib/xbrl/taxonomy/registry';

// Sample test data
const testData = {
  version: '2025-03-31',
  publicationDate: '2025-03-31',
  namespace: 'https://www.esma.europa.eu/taxonomy/2025-03-31/mica/',
  elements: [
    {
      name: 'mica:OfferorLegalEntityIdentifier',
      localName: 'OfferorLegalEntityIdentifier',
      prefix: 'mica',
      label: 'Offeror legal entity identifier',
      documentation: 'The LEI of the offeror',
      terseLabel: 'A.1 LEI',
      dataType: 'leiItemType',
      periodType: 'instant',
      abstract: false,
      nillable: false,
      part: 'A',
      tokenTypes: ['OTHR', 'ART', 'EMT'],
      order: 0,
      required: true,
    },
    {
      name: 'mica:CryptoAssetName',
      localName: 'CryptoAssetName',
      prefix: 'mica',
      label: 'Crypto-asset name',
      documentation: 'Name of the crypto-asset',
      terseLabel: 'D.1 Name',
      dataType: 'stringItemType',
      periodType: 'instant',
      abstract: false,
      nillable: false,
      part: 'D',
      tokenTypes: ['OTHR'],
      order: 1,
      required: true,
    },
    {
      name: 'mica:AssetReserveAbstract',
      localName: 'AssetReserveAbstract',
      prefix: 'mica',
      label: 'Asset reserve [abstract]',
      dataType: 'domainItemType',
      periodType: 'duration',
      abstract: true,
      nillable: true,
      part: 'G',
      tokenTypes: ['ART'],
      order: 2,
      required: false,
    },
    {
      name: 'mica:TotalSupply',
      localName: 'TotalSupply',
      prefix: 'mica',
      label: 'Total supply',
      documentation: 'Total supply of the token',
      terseLabel: 'D.5 Total supply',
      dataType: 'integerItemType',
      periodType: 'instant',
      abstract: false,
      nillable: true,
      part: 'D',
      tokenTypes: ['OTHR', 'ART', 'EMT'],
      order: 3,
      required: false,
    },
  ],
};

describe('TaxonomyRegistry', () => {
  let registry: TaxonomyRegistry;

  beforeAll(() => {
    registry = createRegistry(testData);
  });

  describe('getElement', () => {
    it('should return element by full name', () => {
      const element = registry.getElement('mica:OfferorLegalEntityIdentifier');

      expect(element).toBeDefined();
      expect(element?.localName).toBe('OfferorLegalEntityIdentifier');
      expect(element?.dataType).toBe('leiItemType');
    });

    it('should return undefined for unknown element', () => {
      const element = registry.getElement('mica:NonExistent');
      expect(element).toBeUndefined();
    });
  });

  describe('getElementByLocalName', () => {
    it('should return element by local name', () => {
      const element = registry.getElementByLocalName('CryptoAssetName');

      expect(element).toBeDefined();
      expect(element?.name).toBe('mica:CryptoAssetName');
      expect(element?.label).toBe('Crypto-asset name');
    });
  });

  describe('getElementsByPart', () => {
    it('should return elements for part A', () => {
      const elements = registry.getElementsByPart('A');

      expect(elements.length).toBe(1);
      expect(elements[0]?.name).toBe('mica:OfferorLegalEntityIdentifier');
    });

    it('should return elements for part D', () => {
      const elements = registry.getElementsByPart('D');

      expect(elements.length).toBe(2);
      expect(elements.map((e) => e.localName)).toContain('CryptoAssetName');
      expect(elements.map((e) => e.localName)).toContain('TotalSupply');
    });

    it('should return empty array for part with no elements', () => {
      const elements = registry.getElementsByPart('B');
      expect(elements).toEqual([]);
    });
  });

  describe('getElementsByTokenType', () => {
    it('should return elements for OTHR token type', () => {
      const elements = registry.getElementsByTokenType('OTHR');

      expect(elements.length).toBe(3);
      expect(elements.map((e) => e.localName)).toContain('OfferorLegalEntityIdentifier');
      expect(elements.map((e) => e.localName)).toContain('CryptoAssetName');
      expect(elements.map((e) => e.localName)).toContain('TotalSupply');
    });

    it('should return elements for ART token type', () => {
      const elements = registry.getElementsByTokenType('ART');

      expect(elements.length).toBe(3);
      expect(elements.map((e) => e.localName)).toContain('AssetReserveAbstract');
    });

    it('should return elements for EMT token type', () => {
      const elements = registry.getElementsByTokenType('EMT');

      expect(elements.length).toBe(2);
      expect(elements.map((e) => e.localName)).not.toContain('CryptoAssetName');
    });
  });

  describe('getReportableElements', () => {
    it('should return only non-abstract elements', () => {
      const elements = registry.getReportableElements();

      expect(elements.length).toBe(3);
      expect(elements.every((e) => !e.abstract)).toBe(true);
      expect(elements.map((e) => e.localName)).not.toContain('AssetReserveAbstract');
    });
  });

  describe('getElementCount', () => {
    it('should return total element count', () => {
      expect(registry.getElementCount()).toBe(4);
    });
  });

  describe('getReportableElementCount', () => {
    it('should return reportable element count', () => {
      expect(registry.getReportableElementCount()).toBe(3);
    });
  });

  describe('searchByLabel', () => {
    it('should find elements by partial label match', () => {
      const results = registry.searchByLabel('crypto');

      expect(results.length).toBe(1);
      expect(results[0]?.localName).toBe('CryptoAssetName');
    });

    it('should be case-insensitive', () => {
      const results = registry.searchByLabel('LEGAL ENTITY');

      expect(results.length).toBe(1);
      expect(results[0]?.localName).toBe('OfferorLegalEntityIdentifier');
    });

    it('should search in documentation', () => {
      const results = registry.searchByLabel('LEI of the offeror');

      expect(results.length).toBe(1);
      expect(results[0]?.localName).toBe('OfferorLegalEntityIdentifier');
    });
  });

  describe('getElementsByDataType', () => {
    it('should return elements by data type', () => {
      const elements = registry.getElementsByDataType('stringItemType');

      expect(elements.length).toBe(1);
      expect(elements[0]?.localName).toBe('CryptoAssetName');
    });
  });

  describe('hasElement', () => {
    it('should return true for existing element', () => {
      expect(registry.hasElement('mica:CryptoAssetName')).toBe(true);
    });

    it('should return false for non-existing element', () => {
      expect(registry.hasElement('mica:FakeElement')).toBe(false);
    });
  });

  describe('getElementsForTokenTypeAndPart', () => {
    it('should return elements for specific token type and part', () => {
      const elements = registry.getElementsForTokenTypeAndPart('OTHR', 'D');

      expect(elements.length).toBe(2);
      expect(elements[0]?.localName).toBe('CryptoAssetName'); // order 1
      expect(elements[1]?.localName).toBe('TotalSupply'); // order 3
    });

    it('should return empty array for no match', () => {
      const elements = registry.getElementsForTokenTypeAndPart('EMT', 'G');
      expect(elements).toEqual([]);
    });
  });

  describe('version and namespace', () => {
    it('should expose version', () => {
      expect(registry.version).toBe('2025-03-31');
    });

    it('should expose namespace', () => {
      expect(registry.namespace).toBe('https://www.esma.europa.eu/taxonomy/2025-03-31/mica/');
    });
  });
});

describe('TaxonomyRegistry with real data', () => {
  it('should load real taxonomy data', async () => {
    const { getTaxonomyRegistry } = await import('@/lib/xbrl/taxonomy/registry');
    const registry = getTaxonomyRegistry();

    // Should have many elements
    expect(registry.getElementCount()).toBeGreaterThan(500);

    // Should have reportable elements
    expect(registry.getReportableElementCount()).toBeGreaterThan(0);

    // Version should match
    expect(registry.version).toBe('2025-03-31');
  });
});
