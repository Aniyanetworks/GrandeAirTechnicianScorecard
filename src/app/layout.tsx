import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Grande Air Solutions — Technician Scorecard",
  description: "HVAC Technician Performance Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
          <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100 mt-4">
            © 2026 <span className="text-brand-orange font-semibold">Grande Air Solutions</span> · Austin, TX · Residential HVAC · $2.3M Revenue Goal
          </footer>
        </div>
      </body>
    </html>
  );
}
