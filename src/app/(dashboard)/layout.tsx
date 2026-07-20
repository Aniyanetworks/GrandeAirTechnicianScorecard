import Nav from "@/components/Nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6 sm:px-6 lg:px-10">
        {children}
      </main>
      <footer className="border-t border-gray-100 mt-4">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <span>
            © 2026{" "}
            <span className="text-brand-orange font-semibold">Grande Air Solutions</span>
            {" "}· Austin, TX · Residential HVAC
          </span>
          <a
            href="https://aniyanetworks.net/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600 transition-colors"
          >
            Designed &amp; Developed by © 2026 Aniya Network Solutions Inc.
          </a>
        </div>
      </footer>
    </div>
  );
}
