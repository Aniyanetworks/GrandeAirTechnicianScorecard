"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Lock, Mail, LogIn } from "lucide-react";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await loginAction(email, password);
      if (result.success) {
        router.push("/");
        router.refresh();
      } else {
        setError(result.error ?? "Login failed.");
      }
    });
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f2744 100%)" }}>
      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

            {/* Header band */}
            <div className="px-8 pt-8 pb-6 text-center" style={{ background: "linear-gradient(135deg, #eff4f7 0%, #e8f0f7 100%)" }}>
              <div className="flex justify-center mb-4">
                <Image
                  src="/logo.webp"
                  alt="Grande Air Solutions"
                  width={180}
                  height={54}
                  className="h-12 w-auto object-contain"
                  priority
                />
              </div>
              <h1 className="text-xl font-black text-slate-800 mt-3">Admin Dashboard</h1>
              <p className="text-sm text-slate-500 mt-1">Sign in to access the live data portal</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  <span className="mt-0.5 flex-shrink-0">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="admin@example.com"
                    disabled={isPending}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition disabled:opacity-60 bg-slate-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    disabled={isPending}
                    className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition disabled:opacity-60 bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-6 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                style={{ backgroundColor: isPending ? "#f97316" : "#ea580c", boxShadow: "0 4px 14px rgba(234,88,12,0.35)" }}
                onMouseEnter={(e) => { if (!isPending) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#c2410c"; }}
                onMouseLeave={(e) => { if (!isPending) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#ea580c"; }}
              >
                {isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </>
                )}
              </button>

            </form>

            {/* Card footer line */}
            <div className="px-8 pb-6 text-center">
              <p className="text-xs text-slate-400">
                Authorized personnel only · Powered by HousecallPro &amp; Supabase
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Page footer */}
      <footer className="text-center py-5 text-xs text-slate-500">
        Designed &amp; Developed by{" "}
        <a
          href="https://aniyanetworks.net/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-400 hover:text-orange-300 font-semibold transition-colors"
        >
          © 2026 Aniya Network Solutions Inc.
        </a>
      </footer>
    </div>
  );
}
