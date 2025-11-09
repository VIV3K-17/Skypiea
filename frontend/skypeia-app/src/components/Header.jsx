import React from "react";

// SkypieaHeader.jsx
// Tailwind-based responsive header component.
// Default export a React component.

export default function Header() {
  return (
    <header className="w-full bg-white">
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        {/* Left: Logo */}
        <a href="/" className="flex items-center gap-3" aria-label="Skypiea home">
          <span className="inline-block w-1.5 h-6 bg-rose-500 rounded-sm transform -rotate-6" />
          <span className="text-xl font-semibold tracking-wide text-gray-900">Skypiea</span>
        </a>

        {/* Center: Nav (desktop) */}
        <nav className="hidden md:flex gap-12 items-center">
          <a href="/" className="text-gray-700 hover:text-gray-900">Home</a>
          <a href="/about" className="text-gray-700 hover:text-gray-900">About</a>
          <a href="/help" className="text-gray-700 hover:text-gray-900">Help</a>
        </nav>

        {/* Right: CTA */}
        <div className="flex items-center gap-4">
          <a
            href="/signup"
            className="hidden md:inline-block px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium shadow-sm hover:bg-black transition"
          >
            Try now
          </a>

          {/* Mobile menu button */}
          <details className="md:hidden">
            <summary className="w-10 h-10 flex items-center justify-center rounded-md border border-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </summary>
            <div className="mt-2 p-4 rounded-md bg-white shadow-md flex flex-col gap-2">
              <a href="/" className="py-2">Home</a>
              <a href="/about" className="py-2">About</a>
              <a href="/help" className="py-2">Help</a>
              <a href="/signup" className="mt-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm text-center">Try now</a>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
