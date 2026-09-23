import type { Metadata } from "next";
import { InformationPage, informationStyles as styles } from "@/components/information-page";
import { CONTACT_EMAIL, contactHref } from "@/lib/site";

export const metadata: Metadata = { title: "Report a data issue | ParcelSavvy" };

export default async function ReportDataIssuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const property = typeof params.property === "string" && /^\d{1,20}$/.test(params.property)
    ? params.property
    : "";
  const subject = property ? `ParcelSavvy data issue — property ${property}` : "ParcelSavvy data issue";
  const body = [
    `Property address or TCAD property ID: ${property}`,
    "ParcelSavvy page URL:",
    "What appears incorrect:",
    "What you expected to see:",
    "Official source or document that supports the correction (if available):",
    "",
    "Please do not include Social Security numbers, payment-card numbers, passwords, medical information, or other sensitive information.",
  ].join("\n");

  return (
    <InformationPage
      eyebrow="Data quality"
      title="Report a data issue"
      intro="Tell us when ParcelSavvy appears to display, calculate, or explain something incorrectly. A focused report helps us trace the source release and investigate it."
      updated={null}
    >
      <section>
        <h2>Send the details we need</h2>
        <p>Please include:</p>
        <ul>
          <li>the property address or TCAD property ID;</li>
          <li>the ParcelSavvy page address where you saw the issue;</li>
          <li>what appears incorrect and what you expected instead;</li>
          <li>the appraisal year or source date, if relevant; and</li>
          <li>a link or non-sensitive excerpt from an official source, if available.</li>
        </ul>
        <p>
          <a className={styles.primaryAction} href={contactHref(subject, body)}>
            Start a data-issue email
          </a>
        </p>
        <p>The message will be addressed to {CONTACT_EMAIL}. You can review and edit it before sending.</p>
      </section>

      <section className={styles.notice}>
        <h2>ParcelSavvy cannot change the official record</h2>
        <p>
          We can investigate ParcelSavvy’s display, source mapping, or calculation.
          Only the Appraisal District or another responsible government office can
          change an official property record. For ownership, exemption, property
          detail, value, or protest-record corrections, contact the{" "}
          <a href="https://traviscad.org/" target="_blank" rel="noreferrer">
            Travis Central Appraisal District ↗
          </a>.
        </p>
      </section>

      <section>
        <h2>Protect sensitive information</h2>
        <p>
          Do not email Social Security numbers, payment-card numbers, passwords,
          medical information, account PINs, unredacted identification documents,
          or other information that is not needed to understand the issue.
        </p>
      </section>
    </InformationPage>
  );
}
