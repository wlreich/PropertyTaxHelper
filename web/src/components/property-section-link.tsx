"use client";

import type { ReactNode } from "react";

export function PropertySectionLink({ target, children, className = "homeowner-text-link" }: { target: string; children: ReactNode; className?: string }) {
  return <a href={`#${target}`} className={className} onClick={event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const destination = document.getElementById(target);
    if (!destination) return;
    let ancestor = destination.closest("details");
    while (ancestor) {
      ancestor.open = true;
      ancestor = ancestor.parentElement?.closest("details") ?? null;
    }
    destination.focus({ preventScroll: true });
  }}>{children}</a>;
}
