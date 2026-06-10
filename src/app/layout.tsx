import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corporate Mapper",
  description:
    "Collaborative prospect org mapping for sales teams — trees, sourced facts, shared research, CRM sync.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-brand-700">
              <span className="text-xl">🌳</span> Corporate Mapper
            </Link>
            <nav className="flex items-center gap-5 text-sm text-gray-600">
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
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
