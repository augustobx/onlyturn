"use client";

import { usePathname } from "next/navigation";
import { BusinessSetupNav, businessSetupPaths } from "@/components/business-setup-nav";

export function SetupAwareContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const insideSetup = businessSetupPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  return <>{insideSetup && <BusinessSetupNav />}<div className={insideSetup ? "setup-aware-page" : undefined}>{children}</div></>;
}
