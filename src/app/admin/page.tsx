"use client";

import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Page not found</h1>
      <p className="text-slate-400 mb-8">
        This page doesn’t exist.
      </p>
      <Link href="/" className="text-slate-400 text-sm hover:text-slate-200 hover:underline">
        Back to home
      </Link>
    </main>
  );
}
