import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";
import { CONTACT_EMAIL, contactHref } from "@/lib/site";

export const metadata: Metadata = { title: "Accessibility | ParcelSavvy" };

export default function AccessibilityPage() {
  return (
    <InformationPage
      eyebrow="Legal & access"
      title="Accessibility"
      intro="ParcelSavvy is intended to help homeowners understand public appraisal information. That information should be usable by people with disabilities, across devices and assistive technologies."
    >
      <section>
        <h2>Our accessibility goal</h2>
        <p>
          We use the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA
          as our design and testing goal. This is an ongoing commitment rather
          than a claim that every page, browser-generated PDF, or third-party
          service is perfectly conformant in every configuration.
        </p>
        <p>
          The U.S. Department of Justice provides additional guidance on{" "}
          <a href="https://www.ada.gov/resources/web-guidance/" target="_blank" rel="noreferrer">
            web accessibility and the ADA ↗
          </a>, and the standards are published by the{" "}
          <a href="https://www.w3.org/TR/WCAG22/" target="_blank" rel="noreferrer">
            World Wide Web Consortium ↗
          </a>.
        </p>
      </section>

      <section>
        <h2>What we currently do</h2>
        <ul>
          <li>support keyboard navigation and visible keyboard focus;</li>
          <li>use semantic headings, labels, tables, and landmarks;</li>
          <li>maintain color contrast and avoid relying on color alone;</li>
          <li>support responsive layouts, text enlargement, and touch targets;</li>
          <li>include text explanations for visual comparisons; and</li>
          <li>run automated accessibility and responsive checks on key workflows.</li>
        </ul>
      </section>

      <section>
        <h2>Known variables</h2>
        <p>
          ParcelSavvy links to third-party government and payment services that
          we do not control. Printable reports use your browser’s print or save
          function, so the accessibility of a saved PDF can vary by browser,
          operating system, and PDF tool. The HTML report remains available as
          an alternative.
        </p>
      </section>

      <section>
        <h2>Tell us about a barrier</h2>
        <p>
          If you cannot access information or complete an action, email{" "}
          <a href={contactHref("Accessibility assistance")}>{CONTACT_EMAIL}</a>.
          Please include the page address, what you were trying to do, the
          browser or assistive technology involved if you are comfortable
          sharing it, and the format or accommodation that would help. We will
          work with you to provide the information in another reasonable format.
        </p>
      </section>
    </InformationPage>
  );
}
