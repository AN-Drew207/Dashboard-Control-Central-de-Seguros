import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

// The app area reads its data from the browser (localStorage mock backend),
// so its pages render a loader on the server and are not expected to be instant.
export const instant = false;

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
