"use client";

import Link from "next/link";

const icon = (d: string, viewBox = "0 0 24 24") => (
  <svg className="w-4 h-4 flex-shrink-0" viewBox={viewBox} fill="currentColor" aria-hidden>
    <path d={d} />
  </svg>
);

export function Toolbar() {
  return (
    <header className="bg-[#1a1a1a] border-b border-[#333]">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Small 4-segment wheel icon */}
          <Link href="/" className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-[#444]" aria-hidden>
            <svg viewBox="0 0 32 32" className="w-full h-full">
              <path d="M16 16 L16 2 A16 16 0 0 1 32 16 Z" fill="#ef4444" />
              <path d="M16 16 L32 16 A16 16 0 0 1 16 32 Z" fill="#3b82f6" />
              <path d="M16 16 L16 32 A16 16 0 0 1 0 16 Z" fill="#22c55e" />
              <path d="M16 16 L0 16 A16 16 0 0 1 16 0 Z" fill="#eab308" />
            </svg>
          </Link>
          <a href="https://wheelofnames.com/" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white hover:underline">wheelofnames.com</a>
        </div>
        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          <a href="https://wheelofnames.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-2 py-1.5 rounded hover:bg-[#333]">
            {icon("M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z")}
            Customize
          </a>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-2 py-1.5 rounded hover:bg-[#333]">
            {icon("M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z")}
            New
          </Link>
          <a href="https://wheelofnames.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-2 py-1.5 rounded hover:bg-[#333]">
            {icon("M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z")}
            Open
          </a>
          <a href="https://wheelofnames.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-2 py-1.5 rounded hover:bg-[#333]">
            {icon("M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z")}
            Save
          </a>
          <a href="https://wheelofnames.com/share" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-2 py-1.5 rounded hover:bg-[#333]">
            {icon("M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z")}
            Share
          </a>
          <a href="https://wheelofnames.com/gallery" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-2 py-1.5 rounded hover:bg-[#333]">
            {icon("M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.11-.59 4.22-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z")}
            Gallery
          </a>
          <button type="button" className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#333]" title="Full screen">
            {icon("M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z")}
          </button>
          <select className="ml-1 text-sm bg-transparent text-gray-300 border border-[#444] rounded px-2 py-1 cursor-pointer hover:bg-[#333]" defaultValue="en">
            <option value="en">English</option>
          </select>
        </nav>
      </div>
    </header>
  );
}
