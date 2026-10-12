import type { Metadata } from "next";
import Providers from "../src/runtime/Providers";
import SiteHeader from "../src/runtime/SiteHeader";
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
          <SiteHeader />
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
