/**
 * Taxonomy Registry
 *
 * Provides efficient lookup methods for MiCA taxonomy elements.
 */

import type {
  TaxonomyElement,
  TokenType,
  WhitepaperPart,
  XBRLDataType,
} from '@/types/taxonomy';

interface BundledElement {
  name: string;
  localName: string;
  prefix: string;
  label: string;
  documentation?: string;
  terseLabel?: string;
  dataType: string;
  periodType: string;
  abstract: boolean;
  nillable: boolean;
  part?: string;
  tokenTypes: string[];
  order: number;
  required: boolean;
}

interface BundledData {
  version: string;
  publicationDate: string;
  namespace: string;
  elements: BundledElement[];
}

/**
 * Taxonomy Registry class for efficient element lookups
 */
export class TaxonomyRegistry {
  private elements: Map<string, TaxonomyElement> = new Map();
  private elementsByLocalName: Map<string, TaxonomyElement> = new Map();
  private elementsByPart: Map<WhitepaperPart, TaxonomyElement[]> = new Map();
  private elementsByTokenType: Map<TokenType, TaxonomyElement[]> = new Map();

  public readonly version: string;
  public readonly namespace: string;

  constructor(data: BundledData) {
    this.version = data.version;
    this.namespace = data.namespace;
    this.loadElements(data.elements);
  }

  private loadElements(bundledElements: BundledElement[]): void {
    for (const el of bundledElements) {
      const element = this.convertElement(el);

      // Index by full name
      this.elements.set(element.name, element);

      // Index by local name
      this.elementsByLocalName.set(element.localName, element);

      // Index by part
      if (element.part) {
        const partElements = this.elementsByPart.get(element.part) || [];
        partElements.push(element);
        this.elementsByPart.set(element.part, partElements);
      }

      // Index by token type
      for (const tokenType of element.tokenTypes) {
        const typeElements = this.elementsByTokenType.get(tokenType) || [];
        typeElements.push(element);
        this.elementsByTokenType.set(tokenType, typeElements);
      }
    }
  }

  private convertElement(el: BundledElement): TaxonomyElement {
    return {
      name: el.name,
      localName: el.localName,
      prefix: el.prefix,
      label: el.label,
      documentation: el.documentation,
      dataType: el.dataType as XBRLDataType,
      periodType: el.periodType as 'instant' | 'duration',
      abstract: el.abstract,
      nillable: el.nillable,
      part: el.part as WhitepaperPart | undefined,
      tokenTypes: el.tokenTypes as TokenType[],
      order: el.order,
      required: el.required,
    };
  }

  /**
   * Get element by full name (e.g., 'mica:OfferorLegalEntityIdentifier')
   */
  getElement(name: string): TaxonomyElement | undefined {
    return this.elements.get(name);
  }

  /**
   * Get element by local name (e.g., 'OfferorLegalEntityIdentifier')
   */
  getElementByLocalName(localName: string): TaxonomyElement | undefined {
    return this.elementsByLocalName.get(localName);
  }

  /**
   * Get all elements for a specific whitepaper part
   */
  getElementsByPart(part: WhitepaperPart): TaxonomyElement[] {
    return this.elementsByPart.get(part) || [];
  }

  /**
   * Get all elements for a specific token type
   */
  getElementsByTokenType(tokenType: TokenType): TaxonomyElement[] {
    return this.elementsByTokenType.get(tokenType) || [];
  }

  /**
   * Get all non-abstract (reportable) elements
   */
  getReportableElements(): TaxonomyElement[] {
    return Array.from(this.elements.values()).filter((el) => !el.abstract);
  }

  /**
   * Get all elements
   */
  getAllElements(): TaxonomyElement[] {
    return Array.from(this.elements.values());
  }

  /**
   * Get element count
   */
  getElementCount(): number {
    return this.elements.size;
  }

  /**
   * Get reportable element count
   */
  getReportableElementCount(): number {
    return this.getReportableElements().length;
  }

  /**
   * Search elements by label (case-insensitive partial match)
   */
  searchByLabel(query: string): TaxonomyElement[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.elements.values()).filter(
      (el) =>
        el.label.toLowerCase().includes(lowerQuery) ||
        el.documentation?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get elements by data type
   */
  getElementsByDataType(dataType: XBRLDataType): TaxonomyElement[] {
    return Array.from(this.elements.values()).filter((el) => el.dataType === dataType);
  }

  /**
   * Check if element exists
   */
  hasElement(name: string): boolean {
    return this.elements.has(name);
  }

  /**
   * Get elements for a specific token type and part combination
   */
  getElementsForTokenTypeAndPart(tokenType: TokenType, part: WhitepaperPart): TaxonomyElement[] {
    const typeElements = this.getElementsByTokenType(tokenType);
    return typeElements.filter((el) => el.part === part).sort((a, b) => a.order - b.order);
  }
}

// Singleton instance - lazy loaded
let registryInstance: TaxonomyRegistry | null = null;

/**
 * Get the global taxonomy registry instance
 */
export function getTaxonomyRegistry(): TaxonomyRegistry {
  if (!registryInstance) {
    // Dynamically import the bundled data
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require('./data/taxonomy-bundle.json') as BundledData;
    registryInstance = new TaxonomyRegistry(data);
  }
  return registryInstance;
}

/**
 * Create a new registry from custom data (useful for testing)
 */
export function createRegistry(data: BundledData): TaxonomyRegistry {
  return new TaxonomyRegistry(data);
}
