import Link from "next/link";
import { PermissionDenied } from "@/components/ui/states";
import { buttonClass } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <div className="mx-auto mt-16 max-w-xl px-4">
      <div className="card p-6">
        <PermissionDenied />
        <div className="mt-4 flex justify-center"><Link href="/" className={buttonClass("primary", "sm")}>Back to my dashboard</Link></div>
      </div>
    </div>
  );
}
