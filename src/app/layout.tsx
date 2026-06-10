import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/AuthForms";
import { SearchBox } from "@/components/SearchBox";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corporate Mapper",
  description:
    "Collaborative prospect org mapping for sales teams — trees, sourced facts, shared research, CRM sync.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const workspace = user?.memberships[0]?.workspace;

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-brand-700">
              <span className="text-xl">🌳</span> Corporate Mapper
              {workspace && (
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
                  {workspace.name}
                </span>
              )}
            </Link>
            {user ? (
              <div className="flex items-center gap-5 text-sm text-gray-600">
                <SearchBox />
                <Link href="/" className="hover:text-brand-700">
                  Org Maps
                </Link>
                <Link href="/network" className="hover:text-brand-700">
                  Network
                </Link>
                <Link href="/linkedin" className="hover:text-brand-700">
                  LinkedIn
                </Link>
                <Link href="/settings/integrations" className="hover:text-brand-700">
                  Integrations
                </Link>
                <Link href="/settings/team" className="hover:text-brand-700">
                  Team
                </Link>
                <span className="text-gray-400">{user.name}</span>
                <LogoutButton />
              </div>
            ) : (
              <nav className="flex items-center gap-4 text-sm">
                <Link href="/login" className="text-gray-600 hover:text-brand-700">
                  Sign in
                </Link>
                <Link href="/signup" className="btn-primary">
                  Sign up
                </Link>
              </nav>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
