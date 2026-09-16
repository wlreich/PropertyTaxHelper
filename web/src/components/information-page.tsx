import Link from "next/link";
import { SiteFooter, SiteHeader } from "./site-shell";
import styles from "./information-page.module.css";

export { styles as informationStyles };

export function InformationPage({
  eyebrow,
  title,
  intro,
  updated = "September 16, 2026",
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated?: string | null;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className={styles.page}>
        <Link href="/" className={styles.backLink}>
          ← Back to ParcelSavvy
        </Link>
        <header className={styles.header}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p className={styles.intro}>{intro}</p>
          {updated && <p className={styles.updated}>Last updated {updated}</p>}
        </header>
        <div className={styles.content}>{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
