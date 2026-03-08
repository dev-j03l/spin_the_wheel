import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Toolbar } from "@/components/Toolbar";
import { GoogleAd } from "@/components/GoogleAd";

export const metadata: Metadata = {
  title: "Wheel of Names - Free and easy to use spinner",
  description: "Enter names, spin wheel to pick a random winner. Customize look and feel, save and share wheels.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#1a1a1a] text-[#e5e5e5]">
        <Script
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9307012174300562"
          crossOrigin="anonymous"
        />
        <Toolbar />
        <div className="min-h-[60vh] w-full">{children}</div>
        <GoogleAd variant="banner" />
        <footer className="border-t border-[#333] bg-[#1a1a1a] mt-8 py-6">
          <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400">
            <span>© Wheel of Names</span>
            <div className="flex gap-6">
              <a href="https://wheelofnames.com/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="hover:text-white">Privacy</a>
              <a href="https://wheelofnames.com/faq" target="_blank" rel="noopener noreferrer" className="hover:text-white">Terms</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
