"use client";

import { usePathname } from "next/navigation";

/* The marketing navbar and footer belong to the public site, not to the
 * dashboard. The root layout applies to every route, so the admin was getting
 * "Services / Packages / Free AI check" pinned over its own header.
 *
 * A route group would be the tidier fix but would mean moving every public
 * page on disk; this keeps the change to one file. */
const APP_ROUTE = /^\/(admin|dashboard)(\/|$)/;
// A published business profile is that business's page, not ours: it has its
// own small header and footer and no marketing navigation.
const PROFILE_ROUTE = /^\/b\//;

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname && (APP_ROUTE.test(pathname) || PROFILE_ROUTE.test(pathname))) return null;
  return <>{children}</>;
}

/** Page-view tracking is for the public site only — admin traffic is our own
 *  and is already excluded from metrics, and a customer inside their own
 *  dashboard is not a visitor being marketed to. */
export function PublicOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname && APP_ROUTE.test(pathname)) return null;
  return <>{children}</>;
}
