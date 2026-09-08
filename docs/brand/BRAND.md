# ParcelSavvy brand standards

Approved source: ParcelSavvy_Brand_Guide.pdf, v1.0, September 2026. **Must** is a requirement; **recommend** is guidance. Supplemental implementation choices are marked below; do not describe them as decisions explicitly printed in the guide.

## Foundation, strategy and audience

Purpose: give homeowners the context and confidence to understand how their property is assessed. Promise: turn public appraisal data into plain-language insight people can verify. Ambition: be the trusted independent starting point for assessment questions. Guiding idea: **Clarity creates confidence.** Help people understand numbers before asking them to act.

For homeowners and real estate professionals, ParcelSavvy translates public appraisal records into clear comparisons and practical next steps, without hype, mystery or pressure. It is independent, evidence-led, and useful before, during and after protest season. It is not a law firm, appraisal district, guaranteed reduction service, adversarial campaign or black-box valuation oracle.

Design for homeowners first: concerned users need reassurance, definitions and a starting point; proactive users need speed and credible evidence; agents need shareable material, methodology and professional presentation. Saved properties and alerts are future capabilities, not claims about functionality already available. The universal need: “Show me what matters, explain why, and let me verify it.”

## Message and personality

Product spelling is **ParcelSavvy**, no space. Primary tagline: **Know your property. Understand your assessment.** Campaign option: “You know your home. Now know your parcel.” The broader elevator description may mention comparisons only where that capability is delivered. The current search page promises searching records and understanding source values, not automated evidence analysis.

Voice must be clear, calm, curious, candid and empowering. Never conclude overassessment from an isolated difference; show evidence, limitations and next steps. See COPY_GUIDE.md.

## Logo

Approved Option 1 combines neighboring homes and a coral checkmark. Use the supplied vector extracts through BrandLogo; do not redraw or rebuild the wordmark in Manrope/Inter. Horizontal lockup: navigation/reports/partner materials, minimum width 140 px. Standalone mark: favicon/app tile/avatar/compact mobile, minimum 24 px where the medium permits. Clear space: at least the height of one window pane on every side. Extracts include added external clear space.

Never stretch, rotate, recolor individual shapes, add shadows/outlines, place on a busy image, or change composition. The primary lockup uses a white header. An approved reversed horizontal asset was not supplied; do not manufacture it. Standalone reversed mark is supplied in the PDF and extracted separately. See web/public/brand/README.md for provenance, dimensions, alt text and tiny-favicon limitation.

## Color and accessibility

| Semantic token | Value | Role |
|---|---|---|
| --color-brand-primary | #0B2D4D | Parcel Navy: identity, headings, dark sections |
| --color-brand-support | #3F9DE6 | Savvy Blue: logo and supporting decoration |
| --color-brand-accent | #F26B55 | Insight Coral: one focal accent, not alarm |
| --color-action | #1769AA | Action Blue: buttons, links, functional controls |
| --color-action-hover | #0B2D4D | Darker hover state |
| --color-focus | #1769AA | Keyboard focus on light surfaces |
| --color-focus-on-dark | #FFFFFF | Focus on navy |
| --color-text | #173042 | Body text |
| --color-text-muted | #52697A | Secondary text; never low-contrast placeholders |
| --color-background | #F6F9FC | Cloud page/soft surfaces |
| --color-surface | #FFFFFF | Main white surface |
| --color-surface-info | #D9EEFC | Sky Tint informational emphasis |
| --color-border | #D7E1E8 | Structural separators |
| --color-border-strong | #52697A | Functional control boundaries/clear result dividers |
| --color-success | #197A65 | Positive state, paired with label |
| --color-warning | #A86100 | Caution, paired with explanation |
| --color-error | #B83B3B | Error, paired with recovery action |
| --color-information | #1769AA | Informational state |

Semantic status colors are sampled from the guide's vector swatches on page 15; strong-border and hover/focus mappings are implementation choices. Recommended balance: 65% white/cloud, 20% navy, 10% blue, 5% coral. This is a visual balance, not a requirement to fill quotas on every screen.

Normal text requires at least 4.5:1; large text and meaningful non-text indicators require 3:1. The guide rounds Savvy Blue on white to 2.93:1: despite its “large/decorative” label, this is below 3:1, so **use it only decoratively on white**, or verify another background. Coral is also unsuitable for normal-size text on white. Never use either as the sole functional status cue. Links and controls use Action Blue. Use visible, unclipped focus; underline links when color alone would identify them. Respect reduced motion. Do not hide overflow merely to pass a viewport test.

## Typography

Manrope, variable weights 600–800 for headings, key metrics and marketing; Inter, weights 400–600 for body, interface, tables, forms, tooltips and navigation. Approved wordmark artwork is a logo exception. Fonts are self-hosted Latin WOFF2, optimized via next/font/local, with preload, swap and adjusted fallback metrics. Preserve SIL licenses. Additional scripts need explicit subset expansion.

| Token | Size/line box | Weight |
|---|---|---|
| --text-display | 48/56 px | 700 |
| --text-h1 | 36/44 px | 700 |
| --text-h2 | 28/36 px | 700 |
| --text-h3 | 22/30 px | 650 |
| --text-body | 16/24 px | 400 |
| --text-small | 14/20 px | 400 |
| --text-label | 12/16 px | 600 |

Corresponding --line-display/h1/h2/h3/body/small/label ratios encode those line boxes. Weights are --weight-normal 400, medium 500, semibold 600, subheading 650, bold 700, heavy 800. Search-result headings are a compact 16 px Manrope exception; secondary metadata uses 14 px Inter. Tabular numerals align values. Use --font-heading and --font-body, never per-component font declarations.

## Layout and UI system

Recommend a 12-column desktop grid, 24 px gutters, maximum 1200 px content width. Spacing uses a 4 px unit: --space-0/1/2/3/4/6/8/12/16 = 0/4/8/12/16/24/32/48/64 px. Search uses 48 px desktop outer margins, 16 px on mobile. Preserve compact clearly divided rows; do not add a card around every datum.

Inputs/buttons: --radius-input 8 px; cards: --radius-card 12 px; pills: --radius-pill 999 px; rows: --radius-none 0. Default border: --border-width 1 px, brand Border; strong result header: --divider-width 2 px. Prefer dividers to shadows. --shadow-card is 0 8px 24px rgba(11,45,77,.08); --shadow-none is none.

Focus: --focus-width 3 px, --focus-offset 4 px, --focus-ring combines width/action color. Controls are --control-height 56 px; touch targets at least --target-min 44 px. --content-width 1200 px; --header-height 88 px; --logo-width 248 px; --logo-min-width 140 px; --logo-mark-min 24 px. Value columns: --value-column 160 px desktop, --value-column-mobile 108 px. --duration-fast 150 ms; --opacity-disabled .65. These component dimensions are implementation choices.

Tokens are defined once in web/src/styles/tokens.css. Compatibility aliases --ink, --muted, --teal, --line and --paper point to semantic tokens for the existing app; they are not a competing palette. The embedded font variables --font-manrope and --font-inter come from Next. --tracking-heading is -.035em; --tracking-label is .06em. CSS breakpoints at 700/900 px are structural exceptions, not brand colors.

## Components and states

Reuse BrandLogo, SearchForm, SiteHeader/SiteFooter, TermDefinition and existing result/notice foundations. One primary action per task area. Secondary actions should be visibly subordinate. Use clear labels, real links, responsive forms and hover/focus/disabled states. Definitions explain the term first, then why it matters; support hover, focus, click/touch and Escape. Do not hide vital qualifications solely in a tooltip.

Search must support partial addresses, multiple results, pagination, no results, errors and loading. Source year/stage and available export date remain visible; unknown dates stay unknown. “Show all parcels” and parkland classification remain functional. Do not fabricate navigation to unfinished features or advertise unbuilt analysis.

Evidence status examples are “Worth a closer look,” “Looks consistent,” and “More data needed.” Use them only when the evidence supports the state. Never communicate confidence or outcome through color alone.

## Data visualization

Use --color-chart-primary (Navy), --color-chart-secondary (Savvy Blue), --color-chart-highlight (Coral), --color-chart-grid (Border). Show the source and time period, lead with the actual takeaway, use direct labels where possible, and reserve coral for one focal point. Distinguish market/appraised/assessed values from tax bills. Do not truncate axes deceptively, manufacture urgency, invent prior-year history, or imply that comparison alone proves an error. Charts need text summaries and non-color identification.

## Art direction

Photography: real homes, authentic Texas housing variety, natural neighborhood light, people reviewing records at home. Avoid idealized luxury-listing imagery. Illustration: simple architectural geometry, parcel outlines, comparison patterns and warm human moments, with consistent line weight. Icons: rounded 2 px strokes on a 24 px grid; pair unfamiliar icons with labels. The approved logo is exempt from generic icon geometry.

## Responsive behavior and governance

Verify at 375, 768 and 1440 px, plus keyboard navigation and 200% zoom where available. Stack search controls on small screens; let metadata wrap; keep values aligned and readable without horizontal scrolling. Preserve logo proportions and minimum size; switch to an approved standalone mark only when necessary. Existing detail screens receive shared branding/fonts but retain their layout and some legacy type sizes pending separate design work; do not silently expand a search-page request into a redesign.

Every change asks: does the claim match the evidence, can a homeowner understand it, does it use approved tokens/components, and can keyboard/screen-reader/low-vision users use it? Final test: would this help someone feel informed, not manipulated?
