import { protestGuide } from './protest-guide';

// Resolve chapter 02 from the authoritative shared content, not a copied fragment.
const annualReviewChapter = protestGuide.chapters.find(chapter => chapter.number === '02');
if (!annualReviewChapter) throw new Error('The annual-review guide chapter is missing.');
const annualReviewAnchor = annualReviewChapter.anchor;

export function annualReviewGuideHref(propertyId: string) {
  return `/protest-guide?property=${encodeURIComponent(propertyId)}#${annualReviewAnchor}`;
}
