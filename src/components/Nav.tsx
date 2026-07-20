"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";

const links = [
  { href: "/", label: "Live Dashboard" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <header className="border-b-2 border-brand-orange shadow-sm sticky top-0 z-30" style={{ backgroundColor: "#eff4f7" }}>
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10">
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
          <div className="hidden md:flex items-center gap-2">
            <nav className="flex items-center gap-1">
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
            <div className="h-5 w-px bg-slate-200 mx-1" />
            <button
              onClick={handleLogout}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span>{isPending ? "…" : "Sign Out"}</span>
            </button>
          </div>

          {/* Mobile nav */}
          <div className="md:hidden flex items-center gap-1">
            <nav className="flex items-center gap-1 overflow-x-auto max-w-[50vw]">
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
            <button
              onClick={handleLogout}
              disabled={isPending}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
