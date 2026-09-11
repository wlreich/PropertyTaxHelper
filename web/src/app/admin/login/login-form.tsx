"use client";
import { useActionState } from "react";
import { signIn } from "../actions";
export function LoginForm() {
  const [message, action, pending] = useActionState(signIn, null);
  return <form action={action} className="admin-form">
    <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={1024} /></label>
    <button className="action-button" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    <p role="status">{message}</p>
  </form>;
}
