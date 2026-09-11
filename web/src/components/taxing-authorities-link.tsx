"use client";

export function TaxingAuthoritiesLink() {
  return <a className="homeowner-text-link" href="#taxing-authorities-heading" onClick={() => {
    const details = document.getElementById("taxing-authorities");
    if (details instanceof HTMLDetailsElement) {
      details.open = true;
      details.querySelector("summary")?.focus({preventScroll:true});
    }
  }}>See all taxing authorities</a>;
}
