/**
 * Image Handler
 *
 * Handles base64 image embedding for logos in the iXBRL document.
 * Only allows PNG, GIF, SVG, JPEG as per ESMA requirements.
 */

/**
 * Allowed image MIME types for iXBRL documents
 */
const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/gif',
  'image/svg+xml',
  'image/jpeg',
  'image/jpg',
] as const;

type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/**
 * Validate that an image type is allowed in iXBRL documents
 */
export function isAllowedImageType(mimeType: string): mimeType is AllowedImageType {
  return ALLOWED_IMAGE_TYPES.includes(mimeType as AllowedImageType);
}

/**
 * Validate and prepare a base64 image for embedding
 *
 * @returns The sanitized base64 string, or undefined if invalid
 */
export function prepareImageForEmbedding(
  base64Data: string,
  mimeType: string
): { base64: string; mimeType: string } | undefined {
  if (!isAllowedImageType(mimeType)) {
    return undefined;
  }

  // Strip any data URL prefix if present
  const cleaned = base64Data.replace(/^data:[^;]+;base64,/, '');

  // Basic validation: check it looks like valid base64
  if (!/^[A-Za-z0-9+/]+=*$/.test(cleaned.replace(/\s/g, ''))) {
    return undefined;
  }

  return {
    base64: cleaned.replace(/\s/g, ''),
    mimeType,
  };
}

/**
 * Generate an img tag with embedded base64 data
 */
export function generateImageTag(
  base64Data: string,
  mimeType: string,
  altText: string,
  cssClass?: string
): string | undefined {
  const prepared = prepareImageForEmbedding(base64Data, mimeType);
  if (!prepared) return undefined;

  const classAttr = cssClass ? ` class="${cssClass}"` : '';
  return `<img${classAttr} src="data:${prepared.mimeType};base64,${prepared.base64}" alt="${altText.replace(/"/g, '&quot;')}" />`;
}
