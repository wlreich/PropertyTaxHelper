"use client";
import { useId, useState } from "react";
/** Hover/focus opens the definition; click pins it for touch; Escape dismisses it. */
export function TermDefinition({ term, children }: { term: string; children: React.ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  return <span className="definition" onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!pinned) setOpen(false); }}>
    <button className="definition-trigger" type="button" aria-describedby={id} aria-expanded={open}
      onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setPinned(false); }}
      onClick={() => { setPinned(!pinned); setOpen(!pinned); }}
      onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); setPinned(false); } }}>
      {term}<span aria-hidden="true"> ⓘ</span>
    </button>
    <span id={id} role="tooltip" className="definition-content" hidden={!open}>{children}</span>
  </span>;
}
