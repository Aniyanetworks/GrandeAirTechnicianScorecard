"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Live Dashboard" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b-2 border-brand-orange shadow-sm sticky top-0 z-30" style={{ backgroundColor: "#eff4f7" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center flex-shrink-0">
            <Image
              src="/logo.webp"
              alt="Grande Air Solutions"
              width={160}
              height={48}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === l.href
                    ? "bg-brand-orange text-white"
                    : "text-brand-navy hover:text-brand-orange hover:bg-brand-orange-lt"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Mobile nav */}
          <nav className="md:hidden flex items-center gap-1 overflow-x-auto max-w-[60vw]">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  pathname === l.href
                    ? "bg-brand-orange text-white"
                    : "text-brand-navy hover:text-brand-orange hover:bg-brand-orange-lt"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
