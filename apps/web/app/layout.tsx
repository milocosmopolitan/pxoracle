import type { Metadata } from "next";
import Link from "next/link";
import Providers from "../src/runtime/Providers";
import "./style.css";
export const metadata: Metadata = {
  title: {
    default: "PXOracle — A little room for reflection",
    template: "%s · PXOracle",
  },
  description:
    "A quiet place to explore tarot and your celestial chart. Private readings, calculated in your browser.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <a className="skip" href="#main">
            Skip to reading
          </a>
          <header>
            <Link className="brand" href="/" prefetch={false}>
              <span className="brand-star">✧</span> PXORACLE
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/" prefetch={false}>
                The room
              </Link>
              <Link href="/tarot/" prefetch={false}>
                Tarot
              </Link>
              <Link href="/astrology/" prefetch={false}>
                Astrology
              </Link>
            </nav>
            <span className="private-note">
              ◌ &nbsp; A moment, just for you
            </span>
          </header>
          <main id="main">{children}</main>
          <footer>
            <span>Made of stardust & a little curiosity.</span>
            <span>Reflective readings · Not predictions</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
