"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * 9-dot expanding nav cluster, mirrored from arminoorata.com. Click
 * the dot grid to reveal the link cluster (slides in from the right
 * on desktop, drops below on mobile). Click outside or press Escape
 * to close.
 *
 * Links go to the main site at absolute URLs. Same-tab navigation is
 * intentional. Tool state lives in a React Context provider so leaving
 * to the main site does not lose anything; coming back to the tool
 * via the parent-site nav rehydrates from sessionStorage where applicable.
 */
const links = [
  { href: "https://arminoorata.com", label: "Home" },
  { href: "https://arminoorata.com/about", label: "About" },
  { href: "https://arminoorata.com/frameworks", label: "Frameworks" },
  { href: "https://arminoorata.com/tools", label: "Tools" },
  { href: "https://arminoorata.com/connect", label: "Connect" },
];

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className={`menu-cluster ${open ? "open" : ""}`}
    >
      <div className="menu-links" aria-hidden={!open}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} tabIndex={open ? 0 : -1}>
            {link.label}
          </Link>
        ))}
      </div>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border"
        style={{
          borderColor: "var(--line)",
          background: "var(--surface)",
          color: "var(--text)",
        }}
      >
        <span className="dot-grid" aria-hidden>
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} />
          ))}
        </span>
      </button>
    </div>
  );
}
