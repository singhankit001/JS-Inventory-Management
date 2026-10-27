import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-xl px-4">
      <div className="card p-6">
        <EmptyState title="Page not found" body="This page doesn't exist, or it hasn't been built yet." action={<Link href="/" className={buttonClass("primary", "sm", "mt-2")}>Back to my dashboard</Link>} />
      </div>
    </div>
  );
}
