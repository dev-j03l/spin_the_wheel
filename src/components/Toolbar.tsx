"use client";

import Link from "next/link";

const PARTNER_LINKS = [
  { href: "https://wheelofnames.com/", label: "Wheel of Names" },
  { href: "https://namewheel.io/", label: "NameWheel" },
  { href: "https://randomnamepicker.org/", label: "Random Name Picker" },
  { href: "https://spinthenames.com/", label: "Spin the Names" },
  { href: "https://bracketcreator.net/", label: "Bracket Creator" },
  { href: "https://snapbracket.com/", label: "SnapBracket" },
];

export function Toolbar() {
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/"
          className="font-semibold text-slate-800 hover:text-emerald-600 text-sm sm:text-base"
        >
          Spin the Wheel
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3 flex-wrap text-xs sm:text-sm">
          {PARTNER_LINKS.map(({ href, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100"
            >
              {label}
            </a>
          ))}
          <Link
            href="/admin"
            className="text-slate-400 hover:text-slate-600 ml-1 pl-2 border-l border-slate-200"
          >
            Organiser
          </Link>
        </nav>
      </div>
    </header>
  );
}
