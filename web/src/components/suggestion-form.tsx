"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import styles from "./suggestion-form.module.css";

export function SuggestionForm() {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const submissionId = useRef<string | null>(null);
  const previousPayload = useRef("");
  const pending = useRef(false);
  const [state, setState] = useState<"editing" | "saving" | "saved">("editing");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (String(fields.get("message") ?? "").trim().length < 10) {
      setError("Please enter at least 10 characters describing your suggestion.");
      return;
    }
    const payload = JSON.stringify({ category: fields.get("category"), message: fields.get("message") });
    if (previousPayload.current !== payload) submissionId.current = null;
    previousPayload.current = payload;
    submissionId.current ??= crypto.randomUUID();
    pending.current = true;
    setState("saving");
    setError("");
    try {
      const response = await fetch("/api/suggestions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: submissionId.current, category: fields.get("category"), message: fields.get("message"), website: fields.get("website") }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok || (await response.json()).ok !== true) throw new Error("Not saved");
      setState("saved");
      form.reset();
      submissionId.current = null;
    } catch {
      setState("editing");
      setError("We couldn’t save your suggestion. Your text is still here—please try again.");
    } finally { pending.current = false; }
  }

  return <>
    <button ref={trigger} type="button" className={styles.trigger} onClick={() => {
      if (state === "saved") setState("editing");
      dialog.current?.showModal();
    }}>Suggest a feature or metric</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-intro`} onClose={() => trigger.current?.focus()}>
      <div className={styles.heading}>
        <h2 id={`${id}-title`}>What would help you?</h2>
        <button type="button" className={styles.close} aria-label="Close suggestion form" onClick={() => dialog.current?.close()}>×</button>
      </div>
      <p id={`${id}-intro`}>Suggest a tool, number, or comparison you’d like to see on ParcelSavvy.</p>
      {state === "saved" ? <div role="status">
        <p>Thank you! Your suggestion has been saved for private review.</p>
        <button type="button" className="action-button" onClick={() => dialog.current?.close()}>Done</button>
      </div> : <form onSubmit={submit} className={styles.form}>
        <label htmlFor={`${id}-category`}>I’d like to suggest</label>
        <select id={`${id}-category`} name="category" required defaultValue="feature" disabled={state === "saving"}>
          <option value="feature">A feature</option>
          <option value="metric">A number or comparison</option>
        </select>
        <label htmlFor={`${id}-message`}>What would you like to see?</label>
        <textarea id={`${id}-message`} name="message" required minLength={10} maxLength={2000} rows={5} disabled={state === "saving"} aria-describedby={`${id}-privacy`} />
        <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <p id={`${id}-privacy`} className={styles.note}>10–2,000 characters. Please leave out personal or sensitive information. Suggestions are private and don’t require an email address. <a href="/privacy">Privacy policy</a>.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button type="submit" className="action-button" disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Send suggestion"}</button>
      </form>}
    </dialog>
  </>;
}
