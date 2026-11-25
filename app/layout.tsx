import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import CalendarIcon from "@/components/CalendarIcon";
import "./globals.css";

export const metadata: Metadata = {
  title: "Countdown Holidays | Your days, at a glance",
  description: "Count down to holidays and your own events, with holiday calendars from around the world.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link href="/" className="brand" aria-label="Countdown Holidays home">
              <span className="brand-icon"><CalendarIcon /></span>
              <span>Countdown Holidays<span className="brand-caption">Good days ahead.</span></span>
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/">Overview</Link>
              <Link href="/events">My events</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
