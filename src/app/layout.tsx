import type { Metadata } from "next";
import "./globals.css";
import { Toolbar } from "@/components/Toolbar";
import { FakeAd } from "@/components/FakeAd";

export const metadata: Metadata = {
  title: "Spin the Wheel — Tournament Draw",
  description: "Fair-looking tournament draw with a spinning wheel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        <Toolbar />
        <FakeAd variant="banner" />
        <div className="min-h-[60vh]">{children}</div>
        <footer className="border-t border-slate-200 bg-white mt-8 py-4">
          <div className="max-w-6xl mx-auto px-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>© Spin the Wheel. For entertainment only.</span>
            <div className="flex gap-4">
              <a href="#" className="hover:text-slate-700">Privacy</a>
              <a href="#" className="hover:text-slate-700">Terms</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
