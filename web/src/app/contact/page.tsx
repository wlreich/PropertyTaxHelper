import type { Metadata } from "next";
import Link from "next/link";
import { InformationPage, informationStyles as styles } from "@/components/information-page";
import { CONTACT_EMAIL, contactHref } from "@/lib/site";

export const metadata: Metadata = { title: "Contact | ParcelSavvy" };

export default function ContactPage() {
  return (
    <InformationPage
      eyebrow="Contact"
      title="How can we help?"
      intro="ParcelSavvy uses one inbox so questions reach the right place without asking you to choose an internal department."
      updated={null}
    >
      <section>
        <h2>Email ParcelSavvy</h2>
        <p>
          <a className={styles.primaryAction} href={contactHref("ParcelSavvy question")}>
            Email {CONTACT_EMAIL}
          </a>
        </p>
        <p>
          Do not send Social Security numbers, payment-card numbers, passwords,
          medical information, or other sensitive personal information.
        </p>
      </section>

      <section>
        <h2>Choose the quickest path</h2>
        <dl className={styles.contactList}>
          <div>
            <dt>Something on ParcelSavvy looks wrong</dt>
            <dd><Link href="/report-data-issue">Report a data issue</Link> with the property and source details we need to investigate.</dd>
          </div>
          <div>
            <dt>You need an official record corrected</dt>
            <dd>Contact the <a href="https://traviscad.org/" target="_blank" rel="noreferrer">Travis Central Appraisal District ↗</a>. ParcelSavvy cannot change official appraisal records.</dd>
          </div>
          <div>
            <dt>You found an accessibility barrier</dt>
            <dd>Review our <Link href="/accessibility">accessibility process</Link> or email us with the page and accommodation you need.</dd>
          </div>
          <div>
            <dt>You have a privacy request</dt>
            <dd>Review the <Link href="/privacy">privacy policy</Link> and email us with the subject “Privacy request.”</dd>
          </div>
        </dl>
      </section>

      <section className={styles.notice}>
        <h2>Do not wait on ParcelSavvy for an official deadline</h2>
        <p>
          Messages to ParcelSavvy do not file a protest, appeal, correction, or
          payment and do not preserve a deadline. Contact the appropriate
          government office directly for time-sensitive matters.
        </p>
      </section>
    </InformationPage>
  );
}
