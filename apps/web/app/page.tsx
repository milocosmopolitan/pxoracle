import Link from "next/link";
import { CrystalEntryLink } from "../src/runtime/CrystalEntryLink";
export default function Home() {
  return (
    <div className="landing">
      <div className="room-caption">
        <span className="tiny-star">✦</span>
        <p>THE ORACLE’S STUDY</p>
        <small>The lamp is lit. Take your time.</small>
      </div>
      <section className="welcome">
        <p className="eyebrow">STEP INSIDE. SLOW DOWN.</p>
        <h1 tabIndex={-1}>
          Some answers
          <br />
          begin with
          <br />
          <em>a question.</em>
        </h1>
        <p className="intro">
          Come in, dear. The world can wait a moment.
          <br />
          What would you like to explore?
        </p>
        <div className="entry-links">
          <Link className="entry" href="/tarot/" prefetch={false}>
            <span className="entry-icon">▱</span>
            <span>
              <strong>Let the cards speak</strong>
              <small>A tarot reading for the moment you’re in</small>
            </span>
            <span>↗</span>
          </Link>
          <CrystalEntryLink className="entry">
            <span className="entry-icon">☾</span>
            <span>
              <strong>Look to the stars</strong>
              <small>Sit with the oracle for your natal chart; horoscopes are on the way</small>
            </span>
            <span>↗</span>
          </CrystalEntryLink>
        </div>
        <p className="local-note">
          Your questions stay here. Calculations happen on your device.
        </p>
      </section>
    </div>
  );
}
