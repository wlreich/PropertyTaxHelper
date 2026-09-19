export const SITE_OPERATOR = "Systems & Sense LLC";
export const CONTACT_EMAIL = "hello@parcelsavvy.org";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://property-tax-helper.vercel.app";
export const SUPPORT_PAYMENT_URL =
  "https://donate.stripe.com/6oUaEP7jn6l39fSgXg7AI00";
export const ADJUSTMENT_METHOD_VERSION = "PS-ADJ-2026.3";
export const NEIGHBORHOOD_METHOD_VERSION = "PS-NBR-2026.1";

export function contactHref(subject: string, body?: string) {
  const query = new URLSearchParams({ subject });
  if (body) query.set("body", body);
  return `mailto:${CONTACT_EMAIL}?${query.toString()}`;
}
