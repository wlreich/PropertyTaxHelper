import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import { searchProperties } from "./data/properties";

describe("property search", () => {
  it("matches address, owner, and location terms", () => {
    expect(searchProperties("1601 elm")).toHaveLength(1);
    expect(searchProperties("Morgan Lee")[0].address).toBe("4207 Shoal Creek Boulevard");
    expect(searchProperties("Austin TX")).toHaveLength(3);
    expect(searchProperties("")).toEqual([]);
  });

  it("validates an empty search", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    expect(
      screen.getByText("Enter an address, owner name, or property ID to search."),
    ).toBeInTheDocument();
  });

  it("shows the matching sample record", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Find your property"), {
      target: { value: "1601 Elm Street" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    expect(screen.getByRole("heading", { name: "1 property found" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1601 Elm Street" })).toBeInTheDocument();
    expect(screen.getByText("$684,500")).toBeInTheDocument();
  });

  it("shows a useful empty state for unknown records", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Find your property"), {
      target: { value: "999 Missing Road" },
    });
    fireEvent.submit(screen.getByLabelText("Find your property").closest("form"));

    expect(
      screen.getByRole("heading", { name: "No matching properties" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Try “Austin”/)).toBeInTheDocument();
  });
});
