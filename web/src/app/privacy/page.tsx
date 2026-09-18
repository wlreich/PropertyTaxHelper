import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";
import { CONTACT_EMAIL, SITE_OPERATOR, contactHref } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy | ParcelSavvy" };

export default function PrivacyPage() {
  return (
    <InformationPage
      eyebrow="Legal & access"
      title="Privacy policy"
      intro={`This policy explains what ParcelSavvy and its operator, ${SITE_OPERATOR}, collect when you use the site, why we use it, and the choices available to you.`}
    >
      <section>
        <h2>The short version</h2>
        <p>
          You can search ParcelSavvy without creating an account. We do not sell
          personal information, use it for targeted advertising, or ask for
          sensitive information to search public property records. We collect
          only the information needed to operate and improve the site, answer messages, and
          process optional contributions.
        </p>
      </section>

      <section>
        <h2>Information ParcelSavvy handles</h2>
        <h3>Public property information</h3>
        <p>
          ParcelSavvy organizes public appraisal records, including property
          addresses and identifiers, appraisal values, property characteristics,
          exemptions, taxing authorities, and available protest observations.
          This information comes from public sources such as the Travis Central
          Appraisal District. It is not information you submit to create a
          ParcelSavvy profile.
        </p>
        <h3>Search and technical information</h3>
        <p>
          When you use the site, our hosting and database providers may process
          your search terms, requested page, IP address, browser or device type,
          timestamps, and diagnostic information. Search terms may include an
          address or property ID. We use this information to return results,
          keep the service secure, diagnose failures, and understand basic
          system performance.
        </p>
        <h3>Messages you send</h3>
        <p>
          If you email us, we receive your email address and whatever you include
          in the message. Please do not send Social Security numbers, payment-card
          numbers, passwords, medical information, or other sensitive personal
          information.
        </p>
        <h3>Suggestions you submit</h3>
        <p>
          If you use the suggestion form, we store your suggestion, its category,
          and the time received for private review and product planning. No email
          address is required. Suggestions are not automatically published or
          sent by email. Please leave out personal or sensitive information.
        </p>
        <h3>Optional contributions</h3>
        <p>
          A payment processor handles contribution checkout and payment-card
          details. ParcelSavvy may receive your name, email address, contribution
          amount, transaction status, and limited transaction identifiers, but
          not your full card number. The processor’s own privacy terms also apply
          to information you provide directly to it.
        </p>
      </section>

      <section>
        <h2>How we use and share information</h2>
        <p>We use information only to:</p>
        <ul>
          <li>provide property searches, comparisons, reports, and explanations;</li>
          <li>operate, secure, troubleshoot, and improve ParcelSavvy;</li>
          <li>respond to questions, accessibility feedback, and data-issue reports;</li>
          <li>process and document optional contributions; and</li>
          <li>comply with law or protect the site, its users, and others.</li>
        </ul>
        <p>
          We share information with service providers only as needed to perform
          these functions, including website hosting, database infrastructure,
          email, and payment processing. We may also disclose information when
          legally required, to investigate misuse or security concerns, or as
          part of a business reorganization where the recipient must protect it.
        </p>
        <p>
          ParcelSavvy does not sell personal data, use personal data for targeted
          advertising, or use search activity to make decisions producing legal
          or similarly significant effects.
        </p>
      </section>

      <section>
        <h2>Cookies and analytics</h2>
        <p>
          ParcelSavvy does not currently use advertising cookies or third-party
          behavioral analytics. Essential hosting, security, or administrative
          functions may use limited cookies or similar technologies. If our
          practices materially change, we will update this policy before using
          information for the new purpose.
        </p>
      </section>

      <section>
        <h2>Retention and security</h2>
        <p>
          We keep suggestions, correspondence, contribution records, and operational records
          only as long as reasonably necessary for the purposes described above,
          legal or accounting requirements, dispute resolution, and security.
          Service-provider logs may follow the provider’s own retention schedule.
          We use reasonable administrative and technical safeguards, but no
          internet service can promise absolute security.
        </p>
      </section>

      <section>
        <h2>Your privacy choices</h2>
        <p>
          You may ask what personal information we maintain about you, request a
          correction or deletion, or ask a privacy question by emailing{" "}
          <a href={contactHref("Privacy request")}>{CONTACT_EMAIL}</a>. We may
          need to verify your identity and clarify the scope of the request. If
          we deny a request and applicable law gives you an appeal right, reply
          with the subject “Privacy appeal” and explain why you disagree.
        </p>
        <p>
          Texas privacy rights depend on the organization and processing involved.
          ParcelSavvy follows the applicable requirements of the{" "}
          <a
            href="https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm"
            target="_blank"
            rel="noreferrer"
          >
            Texas Data Privacy and Security Act ↗
          </a>{" "}
          and offers the request process above even where a particular statutory
          right does not apply.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          ParcelSavvy is designed for property owners and other adults. It is not
          directed to children under 13, and we do not knowingly collect personal
          information from them.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update this policy when the service or applicable requirements
          change. The date above identifies the current version. Questions may be
          sent to <a href={contactHref("Privacy question")}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </InformationPage>
  );
}
