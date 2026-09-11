import { SiteHeader, SiteFooter } from "@/components/site-shell";
import "./admin.css";
export const metadata = { title: "Administration | ParcelSavvy", robots: { index: false, follow: false } };
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <><SiteHeader /><main id="main-content" className="main-shell admin-shell">{children}</main><SiteFooter /></>;
}
