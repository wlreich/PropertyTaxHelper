import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";
import { CONTACT_EMAIL, SITE_OPERATOR, contactHref } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of use | ParcelSavvy" };

export default function TermsPage() {
  return (
    <InformationPage
      eyebrow="Legal & access"
      title="Terms of use"
      intro={`These terms govern your use of ParcelSavvy, a service operated by ${SITE_OPERATOR}. By using the site, you agree to these terms.`}
    >
      <section>
        <h2>What ParcelSavvy provides</h2>
        <p>
          ParcelSavvy organizes public property-appraisal records and provides
          calculations, comparisons, educational explanations, and printable
          reports. It is independent of the Travis Central Appraisal District,
          the Travis Appraisal Review Board, taxing units, and tax offices.
        </p>
        <p>
          ParcelSavvy is an informational tool. It is not a law firm, appraisal
          firm, tax adviser, protest agent, government office, or substitute for
          an official notice or record. Using the site does not create a lawyer,
          appraiser, adviser, agency, fiduciary, or client relationship.
        </p>
      </section>

      <section>
        <h2>Public records and estimates</h2>
        <p>
          Source records may be incomplete, delayed, corrected, or interpreted
          differently by the issuing agency. ParcelSavvy may combine releases and
          infer limited observations where the methodology is explained. We aim
          to identify the source year, release, and known limitations, but we do
          not guarantee that every record or calculation is complete, current,
          or error-free.
        </p>
        <p>
          Comparable-property adjustments and similar figures are ParcelSavvy
          estimates based on available public inputs and documented methods.
          They are not official Appraisal District appraisals, licensed appraisal
          opinions, evidence that a value is incorrect, or promises of a tax
          reduction. Property values shown on the site are not tax bills.
        </p>
      </section>

      <section>
        <h2>Your responsibility for official action</h2>
        <p>
          You are responsible for confirming information with the appropriate
          government office and meeting all filing, protest, payment, and appeal
          deadlines. A search, email, report, or contribution on ParcelSavvy does
          not file a protest, correct an official record, preserve a deadline, or
          notify an Appraisal District.
        </p>
        <p>
          For official Travis County appraisal records and procedures, use the{" "}
          <a href="https://traviscad.org/" target="_blank" rel="noreferrer">
            Travis Central Appraisal District website ↗
          </a>.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>You may use ParcelSavvy for lawful personal, educational, and professional review. You may not:</p>
        <ul>
          <li>interfere with the site, evade access controls, or test for vulnerabilities without permission;</li>
          <li>use automated requests in a way that degrades service for others;</li>
          <li>misrepresent ParcelSavvy content as an official government record or licensed appraisal;</li>
          <li>remove source, limitation, or attribution language from a report in a misleading way; or</li>
          <li>use the service or its content for unlawful discrimination, harassment, fraud, or privacy violations.</li>
        </ul>
      </section>

      <section>
        <h2>Ownership and permitted sharing</h2>
        <p>
          Government source records remain subject to the rights and rules that
          apply to those records. ParcelSavvy’s original software, design,
          organization, explanations, and report presentation belong to
          {` ${SITE_OPERATOR}`} or its licensors. You may print and share reports
          for ordinary personal or professional review if the source and
          limitation language remains intact. These terms do not grant a right
          to copy the site, resell its presentation, or create a competing data
          service from its interfaces.
        </p>
      </section>

      <section>
        <h2>Optional contributions</h2>
        <p>
          Contributions support hosting, public-data processing, maintenance,
          and continued development. They are voluntary, do not purchase access
          or influence results, and are not charitable contributions or
          tax-deductible donations. Except where required by law or a payment
          processor’s rules, completed contributions are nonrefundable.
        </p>
      </section>

      <section>
        <h2>Third-party services and links</h2>
        <p>
          ParcelSavvy links to government and other third-party services for
          convenience. Those services control their own content, availability,
          and privacy practices. A link does not imply endorsement, partnership,
          or control.
        </p>
      </section>

      <section>
        <h2>Availability, disclaimers, and limits</h2>
        <p>
          ParcelSavvy may change, suspend, or discontinue features and may
          correct information without notice. The service is provided “as is”
          and “as available.” To the fullest extent permitted by law,
          {` ${SITE_OPERATOR}`} disclaims implied warranties and is not liable
          for indirect, incidental, special, consequential, or punitive damages,
          lost savings, lost opportunities, or decisions based on the service.
        </p>
        <p>
          To the fullest extent permitted by law, our total liability arising
          from ParcelSavvy will not exceed the greater of $100 or the amount you
          contributed to ParcelSavvy during the 12 months before the claim.
          Nothing in these terms limits a right or remedy that cannot lawfully
          be waived.
        </p>
      </section>

      <section>
        <h2>Texas law and changes</h2>
        <p>
          Texas law governs these terms without regard to conflict-of-law rules.
          We may update the terms as ParcelSavvy changes. The date above
          identifies the version currently in effect; continued use after an
          update means you accept the revised terms.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms may be sent to{" "}
          <a href={contactHref("Terms of use question")}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </InformationPage>
  );
}
