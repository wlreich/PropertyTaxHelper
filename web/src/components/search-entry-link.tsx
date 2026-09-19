"use client";

import Link from "next/link";

/** Returning to the form is an input task, so transfer keyboard focus too. */
export function SearchEntryLink({ children, className }: {
  children: React.ReactNode;
  className?: string;
}) {
  return <Link href="/#property-search" className={className} onClick={(event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const input = document.getElementById("address-search");
    if (window.location.pathname !== "/" || !input) return;
    event.preventDefault();
    input.focus({ preventScroll: true });
    document.getElementById("property-search")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }}>{children}</Link>;
}
