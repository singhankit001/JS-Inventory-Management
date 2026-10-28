import { permanentRedirect } from "next/navigation";

/** The permission matrix moved to Administration › Roles & permissions; keep old links working. */
export default function PermissionsPage() {
  permanentRedirect("/admin/roles");
}
