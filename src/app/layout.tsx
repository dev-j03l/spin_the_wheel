import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
