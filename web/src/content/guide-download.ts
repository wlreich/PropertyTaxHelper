import manifest from './protest-guide-pdf.json';

/** Both placements use the same versioned, public, build-time artifact. */
export const guideDownload = {
  href: `/guides/ParcelSavvy-Protest-Guide.pdf?v=${manifest.sha256.slice(0, 16)}`,
  filename: 'ParcelSavvy-Protest-Guide.pdf',
  contentVersion: manifest.contentVersion,
} as const;
