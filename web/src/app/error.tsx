"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="main-shell empty-state" role="alert">
      <h1>We couldn’t load this page</h1>
      <p>Please try again.</p>
      <button className="action-button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
