# TCAD live-data QA audit — 2026-09-13

## Outcome

The agreed audit scope is complete:

- 32 residential properties across 12 TCAD market areas were reconciled to TCAD's live 2026 property-detail pages.
- Three neighborhoods were independently recalculated from source-level records and compared with the current ParcelSavvy summaries.
- The adjustment engine was checked against the TCAD worked grids and a separate nonzero-neighborhood-factor calculation.

No ParcelSavvy data or calculation defect was found. Twenty-nine properties matched every audited value exactly. Three also reconciled, with only a documented display-precision difference: the TCAD bulk source retains a half square foot while the TCAD portal truncates the visible area to a whole square foot.

## Access checks

The three access paths were tested separately before the audit began.

| Access path | Check | Result |
| --- | --- | --- |
| Execution | Clean repository checkout, dependency installation, and test execution | Pass |
| Database | Read the active `TaxTransparency` project and current release | Pass — 2026 certified release, 491,220 published property documents |
| Browser | Open the official TCAD site, property search, search result, and property-detail page | Pass |

TCAD temporarily stopped populating identity and improvement fields after 28 consecutive property-detail loads. The partial pages still rendered their shells and, in some cases, value history. The stall was reported immediately, no result was counted from an incomplete page, and a fresh browser tab subsequently completed all four records. This was a transient TCAD page-data issue, not a persistent access blocker.

## Property sample

The sample is value-stratified within each market area. Eight areas contribute low/middle/high records; four contribute lower/higher records. T2450 includes 1104 Paw Print plus lower- and higher-value records. This produces 32 properties across a geographically and economically varied set of Travis County residential market areas.

| Market area | Properties | Sample count |
| --- | --- | ---: |
| A5850 | 873942, 778024, 863886 | 3 |
| B16000 | 188602, 530023 | 2 |
| B17000 | 966150, 998244, 966244 | 3 |
| B7000 | 713805, 973277 | 2 |
| D7009 | 222091, 213753 | 2 |
| H0851 | 961067, 925798, 861698 | 3 |
| O22000 | 372731, 512799, 381847 | 3 |
| R38000 | 143616, 146850, 149849 | 3 |
| S1000 | 178126, 175901, 159668 | 3 |
| T2450 | 736206, 736302, 830928 | 3 |
| U2040 | 457958, 360570 | 2 |
| Y4000 | 124386, 241225, 241239 | 3 |

For every property, the audit compared property ID, address, market-area code, land value, improvement value, market value, appraised/net appraised value, acreage, residential floor area, construction class, and year built. The detailed results are in `tcad-live-audit-sample-2026-09-13.csv`.

### Property reconciliation result

| Result | Count | Interpretation |
| --- | ---: | --- |
| Exact match | 29 | Every audited field matches the TCAD portal |
| Source-precision match | 3 | All values match; bulk area ends in `.5` while TCAD truncates the portal display |
| Unexplained mismatch | 0 | None |
| Incomplete | 0 | None |

The three display-precision records are:

- 381847: bulk source 2,767.5 sq. ft.; TCAD portal 2,767 sq. ft.
- 149849: bulk source 2,310.5 sq. ft.; TCAD portal 2,310 sq. ft.
- 736206: bulk source 4,302.5 sq. ft.; TCAD portal 4,302 sq. ft.

ParcelSavvy preserving the source precision is not a defect. It should not be described as an exact reproduction of TCAD's rounded/truncated presentation when a half-square-foot value is involved.

## Independent neighborhood recalculations

The source-level check did not call `property_neighborhood_v2`. It rebuilt the candidate sets from the selected release's comparison areas, property snapshots, public visibility rules, residential floor records, type checks, preliminary/certified pairs, protest observations, and cap inputs. The aggregate calculations were then compared with both the current endpoint's property-level result set and a page rendered from the current `main` code against the live database.

| Measure | T2450 | A5850 | Y4000 |
| --- | ---: | ---: | ---: |
| Candidate properties reviewed | 574 | 2,953 | 1,761 |
| Homes included | 571 | 2,887 | 1,761 |
| Homes excluded | 3 | 66 | 0 |
| Multiple-building homes | 31 | 1 | 60 |
| Land-code mismatches retained | 1 | 0 | 0 |
| Median market value | $1,341,357 | $363,785 | $681,443 |
| Median market value per sq. ft. | $342.713883677298 | $188.458228905597 | $402.403470715835 |
| Initially above cap — verified | 476 (83.4%) | 22 (0.8%) | 101 (5.7%) |
| Values reduced | 343 (60.1%) | 1,252 (43.4%) | 936 (53.2%) |
| Moved below cap — verified | 77 (13.5%) | 8 (0.3%) | 75 (4.3%) |
| Protest on record | 273 (47.8%) | 1,204 (41.7%) | 808 (45.9%) |
| Average reduction among reduced homes | $185,558.2274 | $37,298.4784 | $84,791.6271 |
| Average reduction percentage | 12.2212% | 9.3691% | 11.3380% |

Every source-level value equals the current application result before display formatting. Every displayed count and percentage equals the independently calculated value after the page's documented currency and one-decimal percentage rounding.

## Adjustment-formula validation

The complete website unit suite passed: 51 tests, 0 failures. The formula-specific checks reproduced the TCAD examples exactly:

- Ten TCAD equity grids reproduced every checked adjustment line, all ten indicated values, and the $1,606,460 median.
- The general worked example reproduced adjustments of $815, $5,203, -$32,948, $17,844, $19,105, $0, and $0, producing $676,528.
- The two sales grids reproduced indicated values of $1,573,664 and $1,810,832 from explicitly supplied adjusted sale prices.
- Land-adjustment direction, cents-before-line-calculation, whole-dollar truncation, required-factor completeness, duplicate exclusion, corrected-release behavior, and primary/secondary improvement separation passed.
- A separate nonzero-neighborhood calculation used subject multiplier 2.0, comparable multiplier 1.6, comparable market value $1,000,000, and land value $200,000. The expected equity adjustment is `(2.0 - 1.6) / 1.6 × ($1,000,000 - $200,000) = $200,000`; the engine returned $200,000. In sales mode with a $900,000 adjusted sale price, the expected and returned adjustment was $175,000.

### Formula limitation retained

The nonzero neighborhood formula is algebraically and synthetically validated, but TCAD's available worked examples use equal multipliers. This audit therefore does not claim an observed TCAD nonzero-neighborhood reconciliation case. Percent-good inputs also remain labeled estimates derived from the documented sparse age/class examples; the calculation is correct for the supplied input, but the estimate is not TCAD's complete depreciation schedule.

## Final disposition

| Scope item | Status |
| --- | --- |
| 32 live TCAD property reconciliations | Complete |
| 12 market areas represented | Complete |
| Three independent neighborhood recalculations | Complete |
| TCAD equity and sales worked-grid validation | Complete |
| Nonzero neighborhood-formula validation | Complete — synthetic, limitation disclosed |
| ParcelSavvy defects requiring correction | None found |
