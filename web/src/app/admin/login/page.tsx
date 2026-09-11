import { LoginForm } from "./login-form";
export default async function Login({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  return <section className="admin-section admin-login">
    <h1>Administrator sign-in</h1>
    <p>Manage ParcelSavvy’s seasons and published assessment records.</p>
    {notice && <p role="status">{notice === "access" ? "Your account needs administrator access before you can continue." : notice === "expired" ? "Your session expired. Sign in again to continue." : "Sign-in is temporarily unavailable. Please try again."}</p>}
    <LoginForm />
    <p className="overview-note">Access is limited to approved administrators. Sessions last up to one hour. If your account has not been set up, ask the site owner to enable it.</p>
  </section>;
}
