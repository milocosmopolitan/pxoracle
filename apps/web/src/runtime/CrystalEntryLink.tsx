"use client";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useOracle } from "../state/store";

/**
 * The landing's astrology entry. Hovering or keyboard-focusing it wakes the room's crystal the same way
 * pointing at the crystal does, so the effect has a keyboard equivalent; the link itself stays the
 * accessible way to astrology.
 */
export function CrystalEntryLink({ className, children }: { className?: string; children: ReactNode }) {
  const setLandingCrystal = useOracle((s) => s.setLandingCrystal);
  useEffect(() => () => setLandingCrystal({ entry: false }), [setLandingCrystal]);
  const lit = (entry: boolean) => () => setLandingCrystal({ entry });
  return (
    <Link className={className} href="/astrology/" prefetch={false}
      onMouseEnter={lit(true)} onMouseLeave={lit(false)} onFocus={lit(true)} onBlur={lit(false)}>
      {children}
    </Link>
  );
}
