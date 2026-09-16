import type { Metadata } from "next";
import { InformationPage, informationStyles as styles } from "@/components/information-page";
import {
  CONTACT_EMAIL,
  SITE_OPERATOR,
  SUPPORT_PAYMENT_URL,
  contactHref,
} from "@/lib/site";

export const metadata: Metadata = { title: "Support ParcelSavvy" };

function getCheckoutUrl() {
  const configuredUrl = process.env.SUPPORT_PAYMENT_URL ?? SUPPORT_PAYMENT_URL;

  try {
    const url = new URL(configuredUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const checkoutUrl = getCheckoutUrl();
  const contributionCompleted = params.thanks === "1";
  return (
    <InformationPage
      eyebrow="Homeowner-supported"
      title="Help keep ParcelSavvy open"
      intro="ParcelSavvy’s core homeowner tools remain available without a subscription. Optional contributions help cover the cost of public-data processing, hosting, maintenance, and continued development."
      updated={null}
    >
      {contributionCompleted ? (
        <section className={styles.notice}>
          <h2>Thank you for supporting ParcelSavvy</h2>
          <p>
            Your payment provider will send the transaction receipt. Your
            contribution does not change access to any ParcelSavvy feature.
          </p>
        </section>
      ) : null}

      <section>
        <h2>Use everything first</h2>
        <p>
          Support ParcelSavvy only if you find it useful. Contributing does not
          unlock features, improve a property result, influence an analysis, or
          create a customer or advisory relationship.
        </p>
      </section>

      <section className={styles.notice}>
        <h2>Contribution details</h2>
        <ul>
          <li>Contributions are voluntary and processed as one-time payments.</li>
          <li>{SITE_OPERATOR} is a for-profit Texas limited liability company.</li>
          <li>Contributions are not charitable donations and are not tax-deductible.</li>
          <li>A secure payment provider processes payment-card details.</li>
        </ul>
      </section>

      <section>
        <h2>Make a contribution</h2>
        {checkoutUrl ? (
          <>
            <p>
              <a className={styles.primaryAction} href={checkoutUrl} rel="noreferrer">
                Continue to secure checkout
              </a>
            </p>
            <p>You will leave ParcelSavvy to complete the payment securely.</p>
          </>
        ) : (
          <>
            <p>
              Secure contribution checkout is being connected. ParcelSavvy is
              still fully available while that setup is completed.
            </p>
            <p>
              <a href={contactHref("Supporting ParcelSavvy")}>Email {CONTACT_EMAIL}</a>{" "}
              if you would like to be notified when checkout is available.
            </p>
          </>
        )}
      </section>
    </InformationPage>
  );
}
