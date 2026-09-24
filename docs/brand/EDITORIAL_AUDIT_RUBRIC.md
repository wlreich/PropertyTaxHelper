# ParcelSavvy editorial audit rubric

This rubric turns the September 19–22, 2026 accepted language changes into a repeatable review standard. It supplements, rather than replaces, `BRAND.md` and `COPY_GUIDE.md`.

## Editorial outcome

Help a homeowner answer three questions without making them decode the data pipeline:

1. What does the available record show?
2. What can ParcelSavvy reasonably conclude from it?
3. What useful action can the homeowner take next?

Copy should earn its place by answering one of those questions. Remove text that only restates the interface, narrates internal processing, or repeats a qualification already visible at the point where it matters.

## Patterns inferred from accepted changes

### Lead with the homeowner's question

- Prefer the result or takeaway before methodology.
- Use property-specific or neighborhood-specific value instead of generic reassurance.
- Name the next action and what it will help the homeowner learn.
- Remove legacy checklists, filler, and repeated “you decide” language when the page already offers concrete actions.

### Use ordinary language at the surface

- Prefer **record**, **assessment history**, **source date**, **proposed value**, and **final value** in primary copy.
- Reserve **snapshot**, **dataset**, **baseline**, **cohort**, **denominator**, **percent good**, and implementation-specific field names for a detailed method disclosure when the term is necessary.
- Define an unavoidable appraisal term before explaining why it matters.
- Do not surface internal import, RPC, migration, reconciliation, or publication mechanics.

### Distinguish rebuilding costs from recorded non-land values

- Use **estimated rebuilding cost before depreciation** for RCN and **estimated rebuilding cost, adjusted for age and condition** or **rebuilding cost after depreciation** for RCNLD.
- Define **percent good** as the percentage of estimated rebuilding cost remaining after depreciation when the term is necessary in detailed methodology.
- Label the recorded `improvement_value` or another already-multiplied non-land total **value of home and other features** or **Home & other features**. State that it is the district's recorded non-land value, not a rebuilding-cost estimate.
- Use **home, other buildings, and features** for physical improvements where ordinary wording is accurate. Preserve statutory **new improvements**, official source wording and internal identifiers.
- At first useful mention, identify the district as the estimator, explain whether depreciation and the neighborhood factor have been applied, and state that land is separate.
- Do not imply that the estimate is a builder or insurance quote, that ParcelSavvy inspected condition, or that a factor increase is the same percentage increase in rebuilding cost, home prices, or the entire appraisal.
- Keep the factor's supported dollar contribution visible with the correct year and direction. State nearby that land and other input changes are separate and that the isolated contribution is not necessarily the total annual change or tax savings.

### Use “Appraisal District” deliberately

- Use **Appraisal District** in general interface explanations after the jurisdiction is already clear.
- Use **Travis Central Appraisal District (TCAD)** when formally identifying the source organization for the first time on a durable information page.
- Preserve an authority's exact name in legal text, official link labels, citations, document titles, and quotations.
- Do not mechanically replace every instance of **TCAD**; context determines whether the formal name or the general label is clearer.

### State evidence and uncertainty once, where they matter

- Distinguish recorded facts, ParcelSavvy estimates, and possible interpretations.
- Keep a qualification beside a number when removing it would make that number misleading.
- Move broader coverage, source, and methodology information into one clearly labeled disclosure per page or task.
- Do not repeat unavailable evidence beneath every row. Show row-level evidence only when a record is present or the absence changes the interpretation.
- Missing, withheld, conflicting, and zero are different states.

### Prefer durable copy

- Derive changing release years, stages, and dates from live release metadata when they help the user.
- Avoid hard-coded source inventories and “checked on” dates in normal page copy.
- Keep a fixed year when it identifies a specific tax-year method, official report, example, or legal deadline.
- Put maintenance metadata in documentation or source records, not in evergreen homeowner explanations.

### Keep detail proportional to the task

- Page-level copy should explain the decision the homeowner can make.
- Collapsed method disclosures may contain necessary calculation detail, but should still use headings, short paragraphs, and progressive disclosure.
- Printable reports may carry more complete provenance because they must stand alone.
- Legal policies and the Protest Guide are protected content: identify issues, but do not bulk-rewrite them without a focused legal or editorial review.

### Use consistent action and support language

- Action labels should describe the destination or outcome: **Compare similar properties**, **Review the evidence**, **Read the Protest Guide**, **Report a data issue**.
- Use **Support ParcelSavvy** and **contribution** for voluntary payments. Avoid **donation** in transactional copy because ParcelSavvy is not presenting contributions as charitable gifts.
- Avoid pressure, countdowns, promises of savings, or language that assumes a protest is the right next step.

## Automated review categories

The copy inventory flags candidates for human review; a flag is not a defect by itself.

| Flag | What it finds | Review question |
|---|---|---|
| `high-risk-claim` | Prohibited certainty or guaranteed outcomes | Is the claim supported and appropriately qualified? |
| `outcome-or-savings-review` | Protest outcomes or tax-savings language | Does it distinguish value change from tax savings and avoid causation claims? |
| `plain-language-review` | Appraisal/data-pipeline terminology | Is the technical term needed at this layer, and is it explained? |
| `dated-maintenance` | Copy likely to become stale | Can the value be derived, generalized, or moved to maintained metadata? |
| `district-name-review` | Formal district names and TCAD | Is the formal name or general “Appraisal District” label appropriate here? |
| `dense-source-note` | Long source or methodology text | Can page-level coverage be stated once without removing a material limitation? |
| `dense-copy` | Long static text | Should it be split, shortened, or protected because it is legal/educational content? |
| `current-without-context` | Potentially ambiguous “current” claims | Does the user have a visible year, stage, or source date? |

## Confidence and handling

### High confidence

Safe to package as normal copy remediation when meaning is unchanged:

- terminology normalization;
- removal of repeated placeholders or duplicated explanations;
- replacement of internal pipeline terms in homeowner-facing states;
- dynamic rather than hard-coded release labels;
- consistent CTA and contribution terminology.

### Medium confidence

Requires a concise before/after editorial review:

- shortening a methodology explanation;
- consolidating source and denominator notes;
- changing information hierarchy or progressive disclosure;
- rewriting an empty or error state where the recovery action changes.

### Low confidence or protected

Do not bulk-edit:

- legal policies and disclaimers;
- protest deadlines, hearing procedures, or other time-sensitive guidance;
- official document titles and quotations;
- calculation qualifications whose removal could change interpretation;
- print-report provenance needed for a standalone artifact.

## Definition of done for a language batch

- Review the current branch and open Linear work first so the batch does not duplicate or conflict with active changes.
- Record the before/after copy and the rule that supports the change.
- Preserve the underlying calculation, source, route, accessibility name, and interaction unless the ticket explicitly changes them.
- Run `npm run copy:audit` and compare the relevant inventory rows; do not require the heuristic flag count to reach zero.
- Run focused unit/browser coverage for affected routes plus lint, build, type, and brand checks.
- Check 375, 768, and 1440 px when text length, wrapping, navigation, a panel, or a printable layout changes.
- Do not regenerate a PDF or run unrelated end-to-end suites for a wording-only change unless the PDF shares that content.
