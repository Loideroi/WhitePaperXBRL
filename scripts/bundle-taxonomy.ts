/**
 * Taxonomy Bundler Script
 *
 * Parses ESMA MiCA taxonomy files and bundles them as JSON for runtime use.
 * Run with: npx tsx scripts/bundle-taxonomy.ts
 */

import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';

const TAXONOMY_BASE = path.join(
  __dirname,
  '../ESME Research documents/mica_taxonomy_2025/www.esma.europa.eu/taxonomy/mica/2025-03-31'
);

const OUTPUT_DIR = path.join(__dirname, '../src/lib/xbrl/taxonomy/data');

interface ParsedElement {
  name: string;
  localName: string;
  type: string;
  periodType: string;
  abstract: boolean;
  nillable: boolean;
}

interface ParsedLabel {
  elementName: string;
  role: string;
  text: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
});

function parseSchema(): ParsedElement[] {
  const schemaPath = path.join(TAXONOMY_BASE, 'mica_cor.xsd');
  const content = fs.readFileSync(schemaPath, 'utf-8');
  const parsed = parser.parse(content);

  const elements: ParsedElement[] = [];
  const schema = parsed['xsd:schema'];

  if (!schema || !schema['xsd:element']) {
    console.error('No elements found in schema');
    return elements;
  }

  const xsdElements = Array.isArray(schema['xsd:element'])
    ? schema['xsd:element']
    : [schema['xsd:element']];

  for (const el of xsdElements) {
    const name = el['@_name'];
    if (!name) continue;

    elements.push({
      name: `mica:${name}`,
      localName: name,
      type: el['@_type'] || 'unknown',
      periodType: el['@_xbrli:periodType'] || 'instant',
      abstract: el['@_abstract'] === 'true',
      nillable: el['@_nillable'] === 'true',
    });
  }

  return elements;
}

function parseLabels(language: string): ParsedLabel[] {
  const labelPath = path.join(TAXONOMY_BASE, `mica_cor-lab-${language}.xml`);

  if (!fs.existsSync(labelPath)) {
    console.warn(`Label file not found: ${labelPath}`);
    return [];
  }

  const content = fs.readFileSync(labelPath, 'utf-8');
  const parsed = parser.parse(content);

  const labels: ParsedLabel[] = [];
  const linkbase = parsed['link:linkbase'];

  if (!linkbase || !linkbase['link:labelLink']) {
    return labels;
  }

  const labelLink = linkbase['link:labelLink'];
  const linkLabels = labelLink['link:label'];
  const locators = labelLink['link:loc'];
  const arcs = labelLink['link:labelArc'];

  if (!linkLabels || !locators || !arcs) {
    return labels;
  }

  // Build locator map
  const locatorMap = new Map<string, string>();
  const locArray = Array.isArray(locators) ? locators : [locators];
  for (const loc of locArray) {
    const label = loc['@_xlink:label'];
    const href = loc['@_xlink:href'];
    if (label && href) {
      // Extract element name from href like "mica_cor.xsd#mica_ElementName"
      const match = href.match(/#mica_(\w+)$/);
      if (match) {
        locatorMap.set(label, match[1]);
      }
    }
  }

  // Build label map
  const labelMap = new Map<string, { role: string; text: string }>();
  const labArray = Array.isArray(linkLabels) ? linkLabels : [linkLabels];
  for (const lab of labArray) {
    const labelId = lab['@_xlink:label'];
    const role = lab['@_xlink:role'];
    const text = lab['#text'];
    if (labelId && text) {
      labelMap.set(labelId, {
        role: role?.replace('http://www.xbrl.org/2003/role/', '') || 'label',
        text,
      });
    }
  }

  // Connect via arcs
  const arcArray = Array.isArray(arcs) ? arcs : [arcs];
  for (const arc of arcArray) {
    const from = arc['@_xlink:from'];
    const to = arc['@_xlink:to'];

    const elementName = locatorMap.get(from);
    const labelInfo = labelMap.get(to);

    if (elementName && labelInfo) {
      labels.push({
        elementName: `mica:${elementName}`,
        role: labelInfo.role,
        text: labelInfo.text,
      });
    }
  }

  return labels;
}

function mapDataType(xsdType: string): string {
  const typeMap: Record<string, string> = {
    'xbrli:booleanItemType': 'booleanItemType',
    'xbrli:stringItemType': 'stringItemType',
    'xbrli:dateItemType': 'dateItemType',
    'xbrli:monetaryItemType': 'monetaryItemType',
    'xbrli:decimalItemType': 'decimalItemType',
    'xbrli:integerItemType': 'integerItemType',
    'dtr-types:textBlockItemType': 'textBlockItemType',
    'dtr-types:percentItemType': 'percentItemType',
    'dtr-types:domainItemType': 'domainItemType',
    'lei:leiItemType': 'leiItemType',
    'enum2:enumerationItemType': 'enumerationItemType',
    'enum2:enumerationSetItemType': 'enumerationSetItemType',
  };

  return typeMap[xsdType] || 'stringItemType';
}

function extractPartFromLabel(terseLabel: string): string | undefined {
  const match = terseLabel.match(/^([A-J])\.\d+/);
  return match ? match[1] : undefined;
}

function buildBundledData() {
  console.log('Parsing schema...');
  const elements = parseSchema();
  console.log(`Found ${elements.length} elements`);

  console.log('Parsing English labels...');
  const enLabels = parseLabels('en');
  console.log(`Found ${enLabels.length} labels`);

  // Build label lookup
  const labelLookup = new Map<string, Map<string, string>>();
  for (const label of enLabels) {
    if (!labelLookup.has(label.elementName)) {
      labelLookup.set(label.elementName, new Map());
    }
    labelLookup.get(label.elementName)!.set(label.role, label.text);
  }

  // Build final element data
  const bundledElements = elements.map((el, index) => {
    const labels = labelLookup.get(el.name) || new Map();
    const terseLabel = labels.get('terseLabel') || '';
    const part = extractPartFromLabel(terseLabel);

    return {
      name: el.name,
      localName: el.localName,
      prefix: 'mica',
      label: labels.get('label') || el.localName,
      documentation: labels.get('documentation'),
      terseLabel: terseLabel || undefined,
      dataType: mapDataType(el.type),
      periodType: el.periodType,
      abstract: el.abstract,
      nillable: el.nillable,
      part,
      tokenTypes: determineTokenTypes(el.localName),
      order: index,
      required: false, // Will be determined by validation rules
    };
  });

  return {
    version: '2025-03-31',
    publicationDate: '2025-03-31',
    namespace: 'https://www.esma.europa.eu/taxonomy/2025-03-31/mica/',
    elements: bundledElements,
  };
}

function determineTokenTypes(elementName: string): string[] {
  // Elements with specific token type indicators
  if (elementName.includes('Assetreferenced') || elementName.includes('ART')) {
    return ['ART'];
  }
  if (elementName.includes('Emoney') || elementName.includes('EMT')) {
    return ['EMT'];
  }
  if (elementName.includes('OtherToken') || elementName.includes('OTHR')) {
    return ['OTHR'];
  }
  // Generic elements apply to all
  return ['OTHR', 'ART', 'EMT'];
}

async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const data = buildBundledData();

  // Write bundled data
  const outputPath = path.join(OUTPUT_DIR, 'taxonomy-bundle.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Written to ${outputPath}`);

  // Also write a TypeScript file for type-safe imports
  const tsContent = `// Auto-generated - do not edit
import type { BundledTaxonomyData } from '@/types/taxonomy';
import data from './taxonomy-bundle.json';
export const taxonomyData = data as unknown as BundledTaxonomyData;
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), tsContent);
  console.log('Done!');
}

main().catch(console.error);
