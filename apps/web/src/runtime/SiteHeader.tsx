"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "The room" },
  { href: "/tarot/", label: "Tarot" },
  { href: "/astrology/", label: "Astrology" },
];

/** Brand, route links and, on phones, a hamburger that collapses the links into a dropdown. */
export default function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  // Navigating, resizing to desktop widths or pressing Escape always closes the menu.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    const resize = () => window.innerWidth > 800 && setOpen(false);
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", resize);
    };
  }, [open]);
  return (
    <header data-menu={open ? "open" : "closed"}>
      <Link className="brand" href="/" prefetch={false} aria-label="PXOracle, the room">
        <span className="brand-star" aria-hidden="true">✧</span>
        <span className="brand-text">PXORACLE</span>
      </Link>
      <button
        ref={toggle}
        type="button"
        className="menu-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" />
      </button>
      <nav id="site-nav" aria-label="Main navigation">
        {links.map(({ href, label }) => (
          <Link key={href} href={href} prefetch={false} onClick={() => setOpen(false)}>
            {label}
          </Link>
        ))}
      </nav>
      <span className="private-note">◌ &nbsp; A moment, just for you</span>
    </header>
  );
}
