import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { DASHBOARD_PATH } from "@/lib/auth/permissions";

export default async function Home() {
  const s = await requireSession();
  redirect(DASHBOARD_PATH[s.role]);
}
