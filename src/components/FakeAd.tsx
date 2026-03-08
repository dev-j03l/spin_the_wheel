"use client";

interface FakeAdProps {
  variant?: "banner" | "sidebar" | "inline";
}

const BANNER = {
  title: "Free tournament brackets",
  cta: "Create bracket",
  url: "https://bracketcreator.net/",
  by: "BracketCreator.net",
};

const SIDEBAR_LINKS = [
  { label: "Wheel of Names — spin to pick", url: "https://wheelofnames.com/" },
  { label: "Random Name Picker", url: "https://randomnamepicker.org/" },
  { label: "Free bracket generator", url: "https://snapbracket.com/" },
];

const INLINE_ADS = [
  { text: "Fair random name picker with 10,000 names. Try Random Name Picker.", url: "https://randomnamepicker.org/" },
  { text: "Customizable wheel with colors & sound. Wheel of Names.", url: "https://wheelofnames.com/" },
  { text: "Free bracket maker for 2–128 teams. No signup. SnapBracket.", url: "https://snapbracket.com/" },
];

export function FakeAd({ variant = "banner" }: FakeAdProps) {
  if (variant === "banner") {
    return (
      <div className="w-full max-w-3xl mx-auto my-4">
        <a
          href={BANNER.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-slate-100 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
        >
          <div>
            <p className="text-sm font-medium text-slate-700">{BANNER.title}</p>
            <p className="text-xs text-slate-500">{BANNER.by}</p>
          </div>
          <span className="text-xs text-slate-400 uppercase tracking-wide">Ad</span>
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded">
            {BANNER.cta} →
          </span>
        </a>
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <aside className="hidden lg:block w-48 flex-shrink-0">
        <div className="sticky top-4 bg-slate-100 border border-slate-200 rounded-lg p-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Sponsored
          </p>
          <ul className="space-y-1.5 text-sm text-slate-600">
            {SIDEBAR_LINKS.map((item) => (
              <li key={item.url}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-800 hover:underline"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-slate-400 mt-2">Advertisement</p>
        </div>
      </aside>
    );
  }

  // inline — show one of the real sponsored links (fixed per variant to avoid hydration mismatch)
  const ad = INLINE_ADS[0];
  return (
    <div className="my-4 py-3 px-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Advertisement</p>
      <a
        href={ad.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-slate-600 hover:text-emerald-600 hover:underline"
      >
        {ad.text}
      </a>
    </div>
  );
}
