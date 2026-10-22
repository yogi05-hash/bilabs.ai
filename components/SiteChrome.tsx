"use client";

import { usePathname } from "next/navigation";

/* The marketing navbar and footer belong to the public site, not to the
 * dashboard. The root layout applies to every route, so the admin was getting
 * "Services / Packages / Free AI check" pinned over its own header.
 *
 * A route group would be the tidier fix but would mean moving every public
 * page on disk; this keeps the change to one file. */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}

/** Page-view tracking is for the public site only — admin traffic is our own
 *  and is already excluded from metrics, so there is no reason to record it. */
export function PublicOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}
